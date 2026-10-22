import { dayKey, isSetRecord, type FatigueSummary, type SetRecord } from './sessionHistory.ts';
import type { MetricValue, Profile, SetLog, WorkoutSession } from './ports.ts';
import { ROUTINE_TEMPLATES, type Routine } from './routines.ts';
import type { Goal } from './progress.ts';
import { suggestProgram, type Questionnaire } from './routineGenerator.ts';

/**
 * Sincronización del historial, el programa, las rutinas y los objetivos con la nube
 * (issue #87, DEC-079). Módulo puro: la cola, el mapeo entre el estado local y los puertos,
 * la primera subida y la fusión. Quien la ejecuta (persistencia, red, reintentos) vive en
 * `src/api-client/syncEngine.ts`; los ids y la hora llegan por parámetro.
 *
 * Reglas de DEC-079:
 * - Todo se guarda primero en el dispositivo; la cola solo lleva lo pendiente de subir.
 * - Sesiones, series y métricas solo se insertan, con ids del cliente: reintentar no duplica.
 * - Rutinas y objetivos: gana la última escritura según `updatedAt`. Al leer de la nube, lo
 *   que sigue pendiente en la cola gana; lo demás lo decide la nube (también los borrados).
 * - El programa del perfil: lo pendiente gana; sin pendientes, manda la nube.
 */

/** Error de un repositorio de datos. `transient`: vale la pena reintentar (red, 5xx, sesión). */
export class SyncError extends Error {
  readonly transient: boolean;
  readonly code: string;

  constructor(transient: boolean, code: string) {
    super(`sincronización: ${code}`);
    this.name = 'SyncError';
    this.transient = transient;
    this.code = code;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Las tablas usan `uuid`; los ids locales viejos pueden no serlo (respaldo de `newId`). */
export function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

// ─────────────────────────── Series ↔ nube ───────────────────────────

/** Nombres de docs/METRICS.md §3. */
export const SET_METRICS = {
  rejected: 'rejected_reps',
  clean: 'clean_reps',
  fatigue: 'fatigue_level',
  hold: 'hold_seconds',
} as const;

const FATIGUE_LEVELS: readonly FatigueSummary[] = ['baja', 'moderada', 'alta'];

/** Inicio de la serie: cierre menos la duración medida (o el cierre si no hay duración). */
export function setStartedAt(r: SetRecord): string {
  return new Date(Date.parse(r.completedAt) - (r.durationMs ?? 0)).toISOString();
}

export interface CloudSet {
  set: SetLog;
  metrics: MetricValue[];
}

/**
 * Serie local a fila de `set_logs` más sus métricas. La plancha no guarda segundos en `reps`
 * (cualquier plancha de más de 100 s quedaría `reps_gt_100`): van en `hold_seconds`.
 */
export function setToCloud(r: SetRecord & { sessionId: string }, makeId: () => string): CloudSet {
  // Las métricas también llevan id del cliente: reenviarlas no duplica.
  const metric = (name: string, value: number, unit: string): MetricValue => ({
    id: makeId(), sessionId: r.sessionId, setId: r.id, scope: 'set', name, value, unit, schemaVersion: 1,
    computedAt: r.completedAt,
  });
  const metrics: MetricValue[] = r.timed
    ? [metric(SET_METRICS.hold, r.validReps, 's')]
    : [metric(SET_METRICS.rejected, r.rejectedReps, 'reps'), metric(SET_METRICS.clean, r.goodReps, 'reps')];
  if (r.fatigue !== null) metrics.push(metric(SET_METRICS.fatigue, FATIGUE_LEVELS.indexOf(r.fatigue), 'level'));
  return {
    set: {
      id: r.id,
      sessionId: r.sessionId,
      source: r.source ?? 'imported',
      durationMs: r.durationMs ?? null,
      exerciseId: r.exerciseId,
      method: 'normal',
      methodParams: {},
      loadKg: null,
      rpe: null,
      reps: r.timed ? null : r.validReps,
      startedAt: setStartedAt(r),
    },
    metrics,
  };
}

/** Fila de la nube a serie local; `null` si no se puede reconstruir (sin trabajo). */
export function setFromCloud(set: SetLog, metrics: readonly MetricValue[]): SetRecord | null {
  const m = new Map(metrics.map(x => [x.name, x.value]));
  const hold = m.get(SET_METRICS.hold);
  const timed = set.reps === null && hold !== undefined;
  const validReps = timed ? hold : set.reps ?? 0;
  if (!(validReps > 0)) return null;
  const level = m.get(SET_METRICS.fatigue);
  const record: SetRecord = {
    id: set.id,
    completedAt: new Date(Date.parse(set.startedAt) + (set.durationMs ?? 0)).toISOString(),
    exerciseId: set.exerciseId,
    validReps,
    rejectedReps: timed ? 0 : m.get(SET_METRICS.rejected) ?? 0,
    goodReps: timed ? validReps : Math.min(validReps, Math.max(0, m.get(SET_METRICS.clean) ?? validReps)),
    timed,
    fatigue: level === undefined ? null : FATIGUE_LEVELS[level] ?? null,
    sessionId: set.sessionId,
    source: set.source,
    durationMs: set.durationMs,
  };
  return isSetRecord(record) ? record : null;
}

// ─────────────────────────── Cola ───────────────────────────

export type SyncOp =
  | { op: 'session'; session: WorkoutSession }
  | { op: 'session_end'; sessionId: string; endedAt: string }
  | { op: 'set'; set: SetLog; metrics: MetricValue[] }
  | { op: 'routine'; routine: Routine }
  | { op: 'routine_delete'; id: string }
  | { op: 'goal'; goal: Goal }
  | { op: 'goal_delete'; id: string }
  | { op: 'profile'; patch: Partial<Profile> };

/** Identidad de lo que toca una operación: dos operaciones con la misma clave se fusionan. */
export function opKey(o: SyncOp): string {
  switch (o.op) {
    case 'session': return `session:${o.session.id}`;
    case 'session_end': return `session_end:${o.sessionId}`;
    case 'set': return `set:${o.set.id}`;
    case 'routine': return `routine:${o.routine.id}`;
    case 'routine_delete': return `routine:${o.id}`;
    case 'goal': return `goal:${o.goal.id}`;
    case 'goal_delete': return `goal:${o.id}`;
    case 'profile': return 'profile';
  }
}

/** Operaciones que solo insertan: si ya están en la cola, la nueva sobra. */
const INSERT_ONLY = new Set<SyncOp['op']>(['session', 'session_end', 'set']);

/**
 * Agrega operaciones a la cola. Las de inserción se deduplican (la primera gana: es la misma
 * fila); rutinas, objetivos y perfil reemplazan a la pendiente con la misma clave, porque
 * solo importa la última versión.
 */
export function enqueue(queue: readonly SyncOp[], ops: readonly SyncOp[]): SyncOp[] {
  let next = [...queue];
  for (const o of ops) {
    const key = opKey(o);
    if (INSERT_ONLY.has(o.op)) {
      if (!next.some(q => opKey(q) === key)) next.push(o);
    } else {
      next = next.filter(q => opKey(q) !== key);
      next.push(o);
    }
  }
  return next;
}

/** Tope de filas por petición: el historial previo puede traer hasta 1000 series. */
export const BATCH_MAX = 100;

/** Operaciones que se envían juntas: las primeras de la cola del mismo tipo. */
export function nextBatch(queue: readonly SyncOp[]): SyncOp[] {
  if (queue.length === 0) return [];
  const kind = queue[0].op;
  if (kind === 'session_end' || kind === 'profile') return [queue[0]];
  const batch: SyncOp[] = [];
  for (const o of queue) {
    if (o.op !== kind || batch.length >= BATCH_MAX) break;
    batch.push(o);
  }
  return batch;
}

/** Series que esperan subir, para el estado en Perfil. */
export function pendingSets(queue: readonly SyncOp[]): number {
  return queue.filter(o => o.op === 'set').length;
}

/** Ids de rutinas u objetivos con cambios pendientes: al fusionar, gana la versión local. */
export function pendingIds(queue: readonly SyncOp[], kind: 'routine' | 'goal'): Set<string> {
  const ids = new Set<string>();
  for (const o of queue) {
    if (o.op === kind) ids.add(kind === 'routine' ? (o as { routine: Routine }).routine.id : (o as { goal: Goal }).goal.id);
    else if (o.op === `${kind}_delete`) ids.add((o as { id: string }).id);
  }
  return ids;
}

export const BACKOFF_BASE_MS = 2_000;
export const BACKOFF_MAX_MS = 5 * 60_000;

/**
 * Espera antes del reintento `attempt` (0 = primero): 2 s, 4 s, 8 s… con tope de 5 min y
 * jitter entre 50 % y 100 % para que muchos dispositivos no reintenten a la vez.
 */
export function backoffMs(attempt: number, random: number): number {
  const base = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempt));
  return Math.round(base * (0.5 + Math.min(1, Math.max(0, random)) / 2));
}

// ─────────────────────────── Sesiones ───────────────────────────

/** Sesión que abre la primera serie de una visita a la cámara; se cierra al salir. */
export function openSession(id: string, startedAt: string): WorkoutSession {
  return { id, startedAt, endedAt: null, device: null, modelVersions: {} };
}

/** Operaciones de una serie nueva; abre la sesión si todavía no se había enviado. */
export function setOps(
  r: SetRecord & { sessionId: string }, sessionKnown: boolean, makeId: () => string, closeAt: string | null = null,
): SyncOp[] {
  const ops: SyncOp[] = [];
  if (!sessionKnown) ops.push({ op: 'session', session: { ...openSession(r.sessionId, setStartedAt(r)), endedAt: closeAt } });
  const c = setToCloud(r, makeId);
  ops.push({ op: 'set', set: c.set, metrics: c.metrics });
  return ops;
}

// ─────────────────────────── Primera subida ───────────────────────────

export interface UploadPlan {
  /** Historial con ids válidos, sesión y origen asignados; se guarda antes de encolar. */
  records: SetRecord[];
  ops: SyncOp[];
}

/**
 * Sube el historial del dispositivo la primera vez que una cuenta lo reclama (DEC-079).
 * - Ids que no son UUID se reemplazan (las tablas usan `uuid`).
 * - Las series sin sesión se agrupan en una sesión por día local; sin origen son `imported`:
 *   no puntúan y no dicen ser de la cámara sin duración (evita `missing_duration`).
 * - Cada sesión se crea ya cerrada (inicio de la primera serie, fin de la última), para que
 *   dos días seguidos no se solapen por el fin efectivo de 3 h de DEC-074.
 * - Orden: todas las sesiones, luego todas las series (la serie necesita su sesión).
 * Es idempotente: si se repite, los mismos ids no duplican nada en la nube.
 */
export function planHistoryUpload(history: readonly SetRecord[], makeId: () => string): UploadPlan {
  const dayIds = new Map<string, string>();
  const records = history.map(r => {
    const id = isUuid(r.id) ? r.id : makeId();
    let sessionId = r.sessionId && isUuid(r.sessionId) ? r.sessionId : undefined;
    if (!sessionId) {
      const day = dayKey(new Date(r.completedAt));
      sessionId = dayIds.get(day) ?? makeId();
      dayIds.set(day, sessionId);
    }
    return { ...r, id, sessionId, source: r.source ?? 'imported', durationMs: r.durationMs ?? null };
  });

  const sessions = new Map<string, WorkoutSession>();
  for (const r of records) {
    const start = setStartedAt(r);
    const s = sessions.get(r.sessionId);
    if (!s) sessions.set(r.sessionId, { ...openSession(r.sessionId, start), endedAt: r.completedAt });
    else {
      if (start < s.startedAt) s.startedAt = start;
      if (s.endedAt === null || r.completedAt > s.endedAt) s.endedAt = r.completedAt;
    }
  }
  const ops: SyncOp[] = [...sessions.values()].map(session => ({ op: 'session', session }));
  for (const r of records) {
    const c = setToCloud(r, makeId);
    ops.push({ op: 'set', set: c.set, metrics: c.metrics });
  }
  return { records, ops };
}

/** Plantilla sembrada que nadie editó: no se sube si la cuenta ya tiene rutinas en la nube. */
export function isUntouchedTemplate(r: Routine): boolean {
  return r.createdAt === r.updatedAt && ROUTINE_TEMPLATES.some(t => t.name === r.name);
}

// ─────────────────────────── Programa ↔ perfil ───────────────────────────

export interface ProgramState {
  questionnaire: Questionnaire | null;
  programStartedAt: string | null;
}

/**
 * Cuestionario a columnas del perfil. `programType` vacío significa "el sugerido": se guarda
 * el sugerido y al leer se vuelve a omitir si coincide.
 */
export function programToProfile(p: ProgramState): Partial<Profile> {
  const q = p.questionnaire;
  if (!q || !p.programStartedAt) return { programStartedAt: null };
  return {
    goal: q.goal,
    experienceLevel: q.level,
    trainingLocation: q.location,
    equipment: q.equipment ?? [],
    daysPerWeek: q.daysPerWeek,
    sessionMinutes: q.sessionMinutes,
    programType: q.programType ?? suggestProgram(q.level, q.daysPerWeek),
    programStartedAt: p.programStartedAt,
  };
}

/** `null` si la cuenta no tiene cuestionario en la nube. */
export function profileToProgram(p: Profile): ProgramState | null {
  if (!p.programStartedAt) return null;
  const q: Questionnaire = {
    goal: p.goal, level: p.experienceLevel, location: p.trainingLocation,
    daysPerWeek: p.daysPerWeek, sessionMinutes: p.sessionMinutes,
  };
  if (p.equipment.length > 0) q.equipment = p.equipment;
  if (p.programType !== suggestProgram(p.experienceLevel, p.daysPerWeek)) q.programType = p.programType;
  return { questionnaire: q, programStartedAt: p.programStartedAt };
}

// ─────────────────────────── Fusión ───────────────────────────

/** Unión por id (la serie es inmutable: si ya está en el dispositivo, se queda esa). */
export function mergeHistory(local: readonly SetRecord[], cloud: readonly SetRecord[], max: number): SetRecord[] {
  const ids = new Set(local.map(r => r.id));
  const merged = [...local, ...cloud.filter(r => !ids.has(r.id))];
  merged.sort((a, b) => (a.completedAt < b.completedAt ? -1 : a.completedAt > b.completedAt ? 1 : 0));
  return merged.slice(-max);
}

/**
 * Rutinas u objetivos: lo pendiente en la cola gana (si se borró aquí, no vuelve); lo demás
 * es lo de la nube, así que lo borrado en otro dispositivo desaparece. Conserva el orden
 * local y agrega al final lo nuevo de la nube.
 */
export function mergeById<T extends { id: string; createdAt: number }>(
  local: readonly T[], cloud: readonly T[], pending: ReadonlySet<string>,
): T[] {
  const fromCloud = new Map(cloud.map(x => [x.id, x]));
  const kept = local.flatMap(x => (pending.has(x.id) ? [x] : fromCloud.has(x.id) ? [fromCloud.get(x.id)!] : []));
  const known = new Set(local.map(x => x.id));
  const added = cloud.filter(x => !known.has(x.id) && !pending.has(x.id)).sort((a, b) => a.createdAt - b.createdAt);
  return [...kept, ...added];
}

/** Solo una rutina activa: si dos dispositivos activaron distintas, gana la más reciente. */
export function singleActive(routines: readonly Routine[]): Routine[] {
  const active = routines.filter(r => r.active);
  if (active.length <= 1) return [...routines];
  const winner = active.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a));
  return routines.map(r => (r.active && r !== winner ? { ...r, active: false } : r));
}
