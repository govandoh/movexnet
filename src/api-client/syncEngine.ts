/**
 * Motor de la cola offline (issue #87, DEC-079). Ejecuta lo que decide `domain/sync.ts`:
 * guarda la cola en el dispositivo, la envía en orden cuando hay red y sesión, reintenta con
 * backoff exponencial, hace la primera subida del historial y fusiona lo que baja de la nube.
 *
 * No conoce React ni el estado de la app: lee y escribe los datos locales con `LocalPort`.
 * El almacenamiento, el reloj, el azar y los temporizadores llegan por parámetro para poder
 * probarlo sin navegador; `attachBrowserTriggers` conecta los eventos de `window`.
 *
 * Dueño de los datos del dispositivo: la primera cuenta que entra reclama el historial local
 * (`OWNER_KEY`). Si entra otra cuenta sin que la anterior haya cerrado sesión con la app,
 * lo local de la anterior se borra antes de bajar lo de la nueva.
 */

import type { GoalRepository, ProfileRepository, RoutineRepository, WorkoutRepository } from '../domain/ports.ts';
import type { SetRecord } from '../domain/sessionHistory.ts';
import type { Routine } from '../domain/routines.ts';
import type { Goal } from '../domain/progress.ts';
import {
  SyncError, backoffMs, enqueue, isUntouchedTemplate, isUuid, mergeById, mergeHistory, nextBatch, pendingIds,
  pendingSets, planHistoryUpload, profileToProgram, programToProfile, setFromCloud, setOps, singleActive,
  type ProgramState, type SyncOp,
} from '../domain/sync.ts';

export interface SyncRepositories {
  workout: WorkoutRepository;
  profile: ProfileRepository;
  routines: RoutineRepository;
  goals: GoalRepository;
}

/** Lo que el motor lee y escribe del estado de la app. */
export interface LocalData {
  history: SetRecord[];
  routines: Routine[];
  goals: Goal[];
  program: ProgramState;
}

export interface LocalPort {
  read(): LocalData;
  /** Reemplaza solo las claves dadas, sin avisar de vuelta al motor. */
  write(patch: Partial<LocalData>): void;
  /** Borra del dispositivo los datos de la cuenta (cierre de sesión, cambio de dueño). */
  clear(): void;
}

/** `localStorage` con try/catch (DEC-024); en memoria si está bloqueado. */
export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface SyncStatus {
  /** `offline`: sin red; `retrying`: el último envío falló y espera su reintento. */
  state: 'synced' | 'pending' | 'syncing' | 'offline' | 'retrying';
  pendingSets: number;
  pendingOps: number;
  /** Operaciones que la nube rechazó (datos inválidos): quedan solo en el dispositivo. */
  failed: number;
}

export interface SyncEngineDeps {
  userId: string;
  repos: SyncRepositories;
  local: LocalPort;
  store: KeyValueStore;
  makeId: () => string;
  now?: () => number;
  random?: () => number;
  isOnline?: () => boolean;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  /** Series que conserva el dispositivo (`MAX_HISTORY` del estado local). */
  maxHistory?: number;
}

/** Dueño de los datos del dispositivo (ver arriba). */
export const OWNER_KEY = 'movexnet_data_owner_v1';
const QUEUE_PREFIX = 'movexnet_sync_v1:';
export const queueKey = (userId: string) => `${QUEUE_PREFIX}${userId}`;

/** Lecturas de la nube como mucho cada 5 min, salvo al iniciar sesión. */
export const PULL_INTERVAL_MS = 5 * 60_000;
/** Ventana que se baja de la nube: un año de series. */
const PULL_WINDOW_MS = 365 * 86_400_000;
/**
 * Sesiones recientes ya enviadas, para no volver a abrirlas. Si una serie llega para una que
 * ya salió de la ventana, se reenvía su `session`: inocuo, la inserción ignora duplicados.
 */
const KNOWN_SESSIONS = 20;

interface PersistedState {
  ops: SyncOp[];
  failed: number;
  knownSessions: string[];
  /** Sesión de cámara abierta y el cierre de su última serie: si la app se cerró sin salir, se cierra al volver. */
  openSession: { id: string; lastCompletedAt: string } | null;
  lastPullAt: number | null;
  firstSyncDone: boolean;
}

const EMPTY: PersistedState = {
  ops: [], failed: 0, knownSessions: [], openSession: null, lastPullAt: null, firstSyncDone: false,
};

function parseState(raw: string | null): PersistedState {
  if (!raw) return { ...EMPTY };
  try {
    const v = JSON.parse(raw) as Partial<PersistedState>;
    return {
      ops: Array.isArray(v.ops) ? v.ops.filter(o => typeof o === 'object' && o !== null && typeof o.op === 'string') : [],
      failed: typeof v.failed === 'number' ? v.failed : 0,
      knownSessions: Array.isArray(v.knownSessions) ? v.knownSessions.filter(x => typeof x === 'string') : [],
      openSession: v.openSession && typeof v.openSession.id === 'string' && typeof v.openSession.lastCompletedAt === 'string'
        ? v.openSession : null,
      lastPullAt: typeof v.lastPullAt === 'number' ? v.lastPullAt : null,
      firstSyncDone: v.firstSyncDone === true,
    };
  } catch {
    return { ...EMPTY };
  }
}

export class SyncEngine {
  private readonly d: Required<SyncEngineDeps>;
  private state: PersistedState;
  private attempt = 0;
  private timer: unknown = null;
  private running: Promise<void> | null = null;
  private again = false;
  private wantPull = false;
  private forcePull = false;
  private stopped = false;
  private lastError: SyncError | null = null;
  private readonly listeners = new Set<() => void>();
  private snapshot: SyncStatus;

  constructor(deps: SyncEngineDeps) {
    this.d = {
      now: () => Date.now(),
      random: Math.random,
      isOnline: () => true,
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: h => clearTimeout(h as ReturnType<typeof setTimeout>),
      maxHistory: 1000,
      ...deps,
    };
    this.state = parseState(this.d.store.get(queueKey(this.d.userId)));
    this.snapshot = this.computeStatus(false);
  }

  /** Reclama el dispositivo, cierra la sesión que quedó abierta y sincroniza con lectura. */
  start(): Promise<void> {
    const owner = this.d.store.get(OWNER_KEY);
    if (owner !== this.d.userId) {
      if (owner) {
        // Datos de otra cuenta que no cerró sesión desde la app: no se mezclan.
        this.d.local.clear();
        this.d.store.remove(queueKey(owner));
        this.state = { ...EMPTY };
      }
      this.d.store.set(OWNER_KEY, this.d.userId);
    }
    const open = this.state.openSession;
    if (open) {
      this.state.ops = enqueue(this.state.ops, [{ op: 'session_end', sessionId: open.id, endedAt: open.lastCompletedAt }]);
      this.state.openSession = null;
    }
    this.persist();
    return this.sync({ pull: true, force: true });
  }

  /** Detiene los reintentos (sesión vencida o cambio de cuenta). La cola queda guardada. */
  stop(): void {
    this.stopped = true;
    this.clearTimer();
  }

  /** Cierre de sesión desde la app: la cola, la marca de dueño y los datos locales se borran. */
  discard(): void {
    this.stop();
    forgetAccount(this.d.store, this.d.userId);
    this.d.local.clear();
    this.state = { ...EMPTY };
    this.notify();
  }

  // ─────────────────────────── Cambios locales ───────────────────────────

  /**
   * Series nuevas. `close`: la sesión termina con ellas (modo manual), así que se crea ya
   * cerrada. Si no, queda abierta hasta `endSession` (cámara).
   */
  recordSets(records: readonly SetRecord[], close: boolean): void {
    const withSession = records.filter((r): r is SetRecord & { sessionId: string } => !!r.sessionId && isUuid(r.sessionId));
    if (withSession.length === 0) return;
    const lastBySession = new Map<string, string>();
    for (const r of withSession) {
      const prev = lastBySession.get(r.sessionId);
      if (!prev || r.completedAt > prev) lastBySession.set(r.sessionId, r.completedAt);
    }
    const ops: SyncOp[] = [];
    for (const r of withSession) {
      const known = this.state.knownSessions.includes(r.sessionId) || ops.some(o => o.op === 'session' && o.session.id === r.sessionId);
      ops.push(...setOps(r, known, this.d.makeId, close ? lastBySession.get(r.sessionId)! : null));
      if (!known) this.state.knownSessions = [...this.state.knownSessions, r.sessionId].slice(-KNOWN_SESSIONS);
    }
    if (!close) {
      const last = withSession[withSession.length - 1];
      this.state.openSession = { id: last.sessionId, lastCompletedAt: lastBySession.get(last.sessionId)! };
    }
    this.push(ops);
  }

  /**
   * Fin de la visita a la cámara. Sin series no hay sesión que cerrar (no se creó). Se cierra
   * con el fin de la última serie, no con la hora de salida: quedarse en el resumen no alarga
   * la sesión ni la acerca a la siguiente (solapamiento, DEC-074).
   */
  endSession(sessionId: string, fallbackEndedAt: string): void {
    if (!this.state.knownSessions.includes(sessionId)) return;
    const open = this.state.openSession;
    const endedAt = open?.id === sessionId ? open.lastCompletedAt : fallbackEndedAt;
    if (open?.id === sessionId) this.state.openSession = null;
    this.push([{ op: 'session_end', sessionId, endedAt }]);
  }

  saveRoutines(upserted: readonly Routine[], deleted: readonly string[]): void {
    this.push([
      ...upserted.filter(r => isUuid(r.id)).map((routine): SyncOp => ({ op: 'routine', routine })),
      ...deleted.filter(isUuid).map((id): SyncOp => ({ op: 'routine_delete', id })),
    ]);
  }

  saveGoals(upserted: readonly Goal[], deleted: readonly string[]): void {
    this.push([
      ...upserted.filter(g => isUuid(g.id)).map((goal): SyncOp => ({ op: 'goal', goal })),
      ...deleted.filter(isUuid).map((id): SyncOp => ({ op: 'goal_delete', id })),
    ]);
  }

  saveProgram(program: ProgramState): void {
    this.push([{ op: 'profile', patch: programToProfile(program) }]);
  }

  private push(ops: readonly SyncOp[]): void {
    if (ops.length === 0) return;
    this.state.ops = enqueue(this.state.ops, ops);
    this.persist();
    void this.sync();
  }

  // ─────────────────────────── Estado ───────────────────────────

  status(): SyncStatus {
    return this.snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private computeStatus(syncing: boolean): SyncStatus {
    const ops = this.state.ops;
    const base = { pendingSets: pendingSets(ops), pendingOps: ops.length, failed: this.state.failed };
    if (!this.d.isOnline() || this.lastError?.code === 'network') return { ...base, state: 'offline' };
    if (syncing) return { ...base, state: 'syncing' };
    if (this.lastError) return { ...base, state: 'retrying' };
    return { ...base, state: ops.length > 0 ? 'pending' : 'synced' };
  }

  private notify(syncing = false): void {
    this.snapshot = this.computeStatus(syncing);
    for (const l of this.listeners) l();
  }

  private persist(): void {
    this.d.store.set(queueKey(this.d.userId), JSON.stringify(this.state));
    this.notify(this.running !== null);
  }

  // ─────────────────────────── Envío ───────────────────────────

  /**
   * Disparador único (tras cada cambio, al volver la red o la app, al vencer el backoff).
   * Una sola ejecución a la vez; lo que llega mientras tanto se atiende al terminar.
   */
  sync(opts: { pull?: boolean; force?: boolean } = {}): Promise<void> {
    if (opts.pull) this.wantPull = true;
    if (opts.force) this.forcePull = true;
    if (this.stopped) return Promise.resolve();
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.clearTimer();
    this.running = this.loop().finally(() => {
      this.running = null;
      this.notify();
    });
    return this.running;
  }

  /** Al volver la red no tiene sentido esperar el backoff acumulado. */
  resetBackoff(): void {
    this.attempt = 0;
  }

  private async loop(): Promise<void> {
    do {
      this.again = false;
      if (!this.d.isOnline()) {
        this.notify();
        return;
      }
      this.notify(true);
      try {
        if (!this.state.firstSyncDone) await this.firstSync();
        await this.flush();
        if (this.wantPull && this.state.ops.length === 0) await this.maybePull();
        this.attempt = 0;
        this.lastError = null;
      } catch (e) {
        this.lastError = e instanceof SyncError ? e : new SyncError(true, 'unknown');
        this.scheduleRetry();
        return;
      }
    } while (this.again && !this.stopped);
  }

  private scheduleRetry(): void {
    if (this.stopped) return;
    const wait = backoffMs(this.attempt, this.d.random());
    this.attempt++;
    this.timer = this.d.setTimer(() => {
      this.timer = null;
      void this.sync();
    }, wait);
  }

  private clearTimer(): void {
    if (this.timer !== null) this.d.clearTimer(this.timer);
    this.timer = null;
  }

  /** Envía la cola en orden. Un error transitorio la detiene; uno permanente descarta la operación. */
  private async flush(): Promise<void> {
    while (this.state.ops.length > 0 && !this.stopped) {
      const batch = nextBatch(this.state.ops);
      try {
        await this.send(batch);
        this.remove(batch);
      } catch (e) {
        if (!(e instanceof SyncError) || e.transient) throw e;
        if (batch.length === 1) {
          this.state.failed++;
          this.remove(batch);
          continue;
        }
        // En un lote no se sabe qué fila falló: se reenvía de a una y solo se descarta esa.
        for (const op of batch) {
          try {
            await this.send([op]);
          } catch (inner) {
            if (!(inner instanceof SyncError) || inner.transient) throw inner;
            this.state.failed++;
          }
          this.remove([op]);
        }
      }
    }
  }

  private remove(done: readonly SyncOp[]): void {
    // Por identidad: si mientras se enviaba llegó una versión nueva de una rutina u objetivo
    // (`enqueue` la reemplaza por otro objeto), esa sigue pendiente.
    this.state.ops = this.state.ops.filter(o => !done.includes(o));
    this.persist();
  }

  private async send(batch: readonly SyncOp[]): Promise<void> {
    const { workout, routines, goals, profile } = this.d.repos;
    const first = batch[0];
    switch (first.op) {
      case 'session':
        for (const o of batch) if (o.op === 'session') await workout.startSession(o.session);
        return;
      case 'session_end':
        return workout.endSession(first.sessionId, first.endedAt);
      case 'set': {
        const sets = batch.flatMap(o => (o.op === 'set' ? [o] : []));
        await workout.logSets(sets.map(o => o.set));
        await workout.logMetrics(sets.flatMap(o => o.metrics));
        return;
      }
      case 'routine':
        return routines.upsert(batch.flatMap(o => (o.op === 'routine' ? [o.routine] : [])));
      case 'routine_delete':
        return routines.remove(batch.flatMap(o => (o.op === 'routine_delete' ? [o.id] : [])));
      case 'goal':
        return goals.upsert(batch.flatMap(o => (o.op === 'goal' ? [o.goal] : [])));
      case 'goal_delete':
        return goals.remove(batch.flatMap(o => (o.op === 'goal_delete' ? [o.id] : [])));
      case 'profile':
        return profile.update(first.patch);
    }
  }

  // ─────────────────────────── Primera subida y lectura ───────────────────────────

  /**
   * Una sola vez por cuenta en este dispositivo: sube el historial, las rutinas, los objetivos
   * y el programa que ya estaban aquí. Primero guarda lo local con los ids definitivos y
   * después encola: si la app se cierra a mitad, repetirla usa los mismos ids y no duplica.
   */
  private async firstSync(): Promise<void> {
    const [cloudRoutines, cloudProfile] = await Promise.all([
      this.d.repos.routines.list(), this.d.repos.profile.get(),
    ]);
    const local = this.d.local.read();
    const plan = planHistoryUpload(local.history, this.d.makeId);
    const withId = <T extends { id: string }>(x: T): T => (isUuid(x.id) ? x : { ...x, id: this.d.makeId() });
    const routines = local.routines.map(withId);
    const goals = local.goals.map(withId);
    this.d.local.write({ history: plan.records, routines, goals });

    // Cada dispositivo siembra las plantillas con ids propios: si la cuenta ya tiene rutinas,
    // subirlas las duplicaría. Las que nadie editó se quedan fuera (y la lectura las quita).
    const upload = cloudRoutines.length > 0 ? routines.filter(r => !isUntouchedTemplate(r)) : routines;
    const ops: SyncOp[] = [
      ...plan.ops,
      ...upload.map((routine): SyncOp => ({ op: 'routine', routine })),
      ...goals.map((goal): SyncOp => ({ op: 'goal', goal })),
    ];
    // El programa de la nube gana sobre el de un dispositivo que se estrena con la cuenta.
    if (!cloudProfile?.programStartedAt && local.program.questionnaire) {
      ops.push({ op: 'profile', patch: programToProfile(local.program) });
    }
    this.state.ops = enqueue(this.state.ops, ops);
    this.state.knownSessions = [
      ...this.state.knownSessions, ...plan.ops.flatMap(o => (o.op === 'session' ? [o.session.id] : [])),
    ].slice(-KNOWN_SESSIONS);
    this.state.firstSyncDone = true;
    this.persist();
  }

  private async maybePull(): Promise<void> {
    const now = this.d.now();
    if (!this.forcePull && this.state.lastPullAt !== null && now - this.state.lastPullAt < PULL_INTERVAL_MS) {
      this.wantPull = false;
      return;
    }
    const range = { from: new Date(now - PULL_WINDOW_MS).toISOString(), to: new Date(now + 86_400_000).toISOString() };
    const { workout, routines, goals, profile } = this.d.repos;
    const [p, cloudRoutines, cloudGoals, sets, metrics] = await Promise.all([
      profile.get(), routines.list(), goals.list(), workout.listSets(range), workout.listSetMetrics(range),
    ]);
    const bySet = new Map<string, typeof metrics>();
    for (const m of metrics) if (m.setId) bySet.set(m.setId, [...(bySet.get(m.setId) ?? []), m]);
    const cloudHistory = sets.flatMap(s => {
      const r = setFromCloud(s, bySet.get(s.id) ?? []);
      return r ? [r] : [];
    });

    // Se lee lo local y la cola después de esperar a la red: pudo cambiar mientras tanto.
    const local = this.d.local.read();
    const ops = this.state.ops;
    const patch: Partial<LocalData> = {
      history: mergeHistory(local.history, cloudHistory, this.d.maxHistory),
      routines: singleActive(mergeById(local.routines, cloudRoutines, pendingIds(ops, 'routine'))),
      goals: mergeById(local.goals, cloudGoals, pendingIds(ops, 'goal')),
    };
    const program = p ? profileToProgram(p) : null;
    if (program && !ops.some(o => o.op === 'profile')) patch.program = program;
    this.d.local.write(patch);

    this.state.lastPullAt = now;
    this.wantPull = false;
    this.forcePull = false;
    this.persist();
  }
}

/**
 * Disparadores del navegador: al volver la red y al volver a la app. Devuelve la función que
 * los quita. Fuera del motor para que este se pruebe sin `window`.
 */
export function attachBrowserTriggers(engine: SyncEngine): () => void {
  const onOnline = () => {
    engine.resetBackoff();
    void engine.sync();
  };
  const onOffline = () => void engine.sync();
  const onVisible = () => {
    if (document.visibilityState === 'visible') void engine.sync({ pull: true });
  };
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

/**
 * Borra la cola y la marca de dueño de una cuenta sin arrancar el motor: cierre de sesión
 * cuando el motor no llegó a cargar (DEC-079 §10).
 */
export function forgetAccount(store: KeyValueStore, userId: string): void {
  store.remove(queueKey(userId));
  if (store.get(OWNER_KEY) === userId) store.remove(OWNER_KEY);
}

/** `localStorage` defensivo (DEC-024): si falla, el motor sigue con su estado en memoria. */
export const browserStore: KeyValueStore = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* lleno o bloqueado: sigue en memoria */ }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch { /* bloqueado: no hay nada que borrar */ }
  },
};
