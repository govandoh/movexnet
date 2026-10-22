import { useSyncExternalStore } from 'react';
import { isSetRecord, type SetRecord } from '../../domain/sessionHistory';
import { FREE_ENTITLEMENT, isEntitlement, type Entitlement } from '../../domain/payment';
import type { Questionnaire } from '../../domain/routineGenerator';
import { ALL_EQUIPMENT } from '../../domain/catalog';
import { ROUTINE_TEMPLATES, activate, instantiateTemplate, resolveStoredRoutines, type Routine } from '../../domain/routines';
import { isGoal, type Goal } from '../../domain/progress';
import type { ProgramState } from '../../domain/sync';

/**
 * Estado local de la app (historial, cuestionario, suscripción simulada, voz).
 *
 * Vive en `localStorage` (DEC-024: siempre con try/catch y validación). Si el almacenamiento
 * está bloqueado, la app funciona igual con el estado en memoria de la sesión: nunca se
 * pierde lo que ya se tenía por un error de escritura.
 *
 * Con cuenta, el dispositivo sigue siendo la primera copia: cada cambio se guarda aquí y se
 * avisa por `onLocalChange` para que la sincronización lo suba (issue #87, DEC-079). Lo que
 * baja de la nube entra por `syncLocal.write`, que no vuelve a avisar.
 */

export interface AppState {
  history: SetRecord[];
  questionnaire: Questionnaire | null;
  /** Inicio del programa, ISO 8601: define en qué semana se está. */
  programStartedAt: string | null;
  entitlement: Entitlement;
  voiceEnabled: boolean;
  /** Preferencias de vista (DEC-061): cada persona decide qué ayudas ve. */
  view: ViewPrefs;
  /** Rutinas propias y plantillas; solo una puede estar activa (DEC-040, DEC-052). */
  routines: Routine[];
  /** Objetivos del perfil; su avance se deriva del historial (DEC-041). */
  goals: Goal[];
  /** Recordatorios de las sesiones del programa (#35). */
  reminders: ReminderPrefs;
}

export interface ReminderPrefs {
  enabled: boolean;
  /** Hora local del aviso el día de la sesión. */
  hour: number;
  minute: number;
}

export const DEFAULT_REMINDERS: ReminderPrefs = { enabled: false, hour: 18, minute: 0 };

function readReminders(v: unknown): ReminderPrefs {
  if (typeof v !== 'object' || v === null) return DEFAULT_REMINDERS;
  const o = v as Record<string, unknown>;
  const int = (x: unknown, min: number, max: number, d: number) =>
    (typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max ? x : d);
  return {
    enabled: typeof o.enabled === 'boolean' ? o.enabled : false,
    hour: int(o.hour, 0, 23, DEFAULT_REMINDERS.hour),
    minute: int(o.minute, 0, 59, DEFAULT_REMINDERS.minute),
  };
}

export interface ViewPrefs {
  /** Modelo 3D de demostración en la ficha de técnica. */
  showDemo: boolean;
  /** Mini mapa 3D flotante durante el entrenamiento. */
  showMiniMap: boolean;
  /** Tarjeta de consejos durante la serie. */
  showTips: boolean;
  /** Posición del mini mapa: lado de la pantalla y altura relativa (0 arriba, 1 abajo). */
  miniMap: { side: 'left' | 'right'; y: number };
  /** Ejercicios (id del catálogo) cuya ficha de técnica ya se vio: la primera vez se abre sola. */
  seenTechnique: string[];
}

export const DEFAULT_VIEW: ViewPrefs = {
  showDemo: true,
  showMiniMap: true,
  showTips: false,
  miniMap: { side: 'left', y: 0.35 },
  seenTechnique: [],
};

/** Tope de fichas recordadas (el catálogo tiene 60). */
const MAX_SEEN = 100;

function readView(v: unknown): ViewPrefs {
  if (typeof v !== 'object' || v === null) return DEFAULT_VIEW;
  const o = v as Record<string, unknown>;
  const m = o.miniMap as Record<string, unknown> | undefined;
  const bool = (x: unknown, d: boolean) => (typeof x === 'boolean' ? x : d);
  return {
    showDemo: bool(o.showDemo, DEFAULT_VIEW.showDemo),
    showMiniMap: bool(o.showMiniMap, DEFAULT_VIEW.showMiniMap),
    showTips: bool(o.showTips, DEFAULT_VIEW.showTips),
    miniMap: m && (m.side === 'left' || m.side === 'right') && typeof m.y === 'number' && m.y >= 0 && m.y <= 1
      ? { side: m.side, y: m.y } : DEFAULT_VIEW.miniMap,
    seenTechnique: Array.isArray(o.seenTechnique)
      ? o.seenTechnique.filter((x): x is string => typeof x === 'string').slice(-MAX_SEEN) : [],
  };
}

const KEYS = {
  history: 'fitnet_history_v1',
  profile: 'fitnet_profile_v1',
  entitlement: 'fitnet_entitlement_v1',
  view: 'fitnet_view_v1',
  routines: 'fitnet_routines_v1',
  /** Copia del valor crudo cuando lo guardado venía dañado, antes de escribir encima. */
  routinesBackup: 'fitnet_routines_v1_backup',
  goals: 'fitnet_goals_v1',
  reminders: 'fitnet_reminders_v1',
} as const;

/** Tope de objetivos: la lista del perfil es corta a propósito. */
export const MAX_GOALS = 6;

/**
 * UUID v4 para entidades locales: las tablas de la nube usan `uuid` (DEC-079).
 * `crypto.randomUUID` no existe en contextos inseguros (HTTP en la LAN), `getRandomValues` sí.
 */
export function newId(): string {
  try { return crypto.randomUUID(); } catch { /* contexto inseguro */ }
  const b = new Uint8Array(16);
  try {
    crypto.getRandomValues(b);
  } catch {
    for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  }
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Series que se conservan en el dispositivo. */
const MAX_HISTORY = 1000;

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* almacenamiento lleno, bloqueado o en modo privado: se sigue en memoria */
  }
}

function isQuestionnaire(v: unknown): v is Questionnaire {
  if (typeof v !== 'object' || v === null) return false;
  const q = v as Record<string, unknown>;
  return ['muscle_gain', 'weight_loss', 'strength_gain'].includes(q.goal as string) &&
    ['beginner', 'intermediate', 'advanced'].includes(q.level as string) &&
    ['gym_full', 'home_none', 'home_limited'].includes(q.location as string) &&
    typeof q.daysPerWeek === 'number' && q.daysPerWeek >= 2 && q.daysPerWeek <= 6 &&
    typeof q.sessionMinutes === 'number' &&
    (q.equipment === undefined || (Array.isArray(q.equipment) && q.equipment.every(e => ALL_EQUIPMENT.includes(e)))) &&
    (q.programType === undefined || ['full_body', 'upper_lower', 'ppl'].includes(q.programType as string));
}

/**
 * Lee lo guardado distinguiendo "no hay nada" (`null`) de "hay algo ilegible" (el texto crudo,
 * que no es una lista y se trata como `corrupt`). `read` no sirve aquí: devuelve `null` también
 * cuando el JSON no se puede interpretar, y eso sembraría plantillas encima de datos dañados.
 */
function readRoutinesRaw(): unknown {
  let text: string | null;
  try { text = localStorage.getItem(KEYS.routines); } catch { return null; }
  if (text === null) return null;
  try { return JSON.parse(text); } catch { return text; }
}

/**
 * Lee las rutinas con la regla de DEC-052: las plantillas se siembran solo si NO había nada
 * guardado. Si lo guardado venía dañado (`partial` o `corrupt`) se conserva lo válido, se
 * respalda el valor crudo y nunca se reemplaza por plantillas (defecto de fitnetv2).
 */
function loadRoutines(): Routine[] {
  const raw = readRoutinesRaw();
  const result = resolveStoredRoutines(raw, newId, Date.now());
  if (result.status === 'seeded') write(KEYS.routines, result.routines);
  else if ((result.status === 'partial' || result.status === 'corrupt') && read(KEYS.routinesBackup) === null) {
    write(KEYS.routinesBackup, raw);
  }
  return result.routines;
}

function load(): AppState {
  const history = read(KEYS.history);
  const profile = read(KEYS.profile) as Record<string, unknown> | null;
  const entitlement = read(KEYS.entitlement);
  const goals = read(KEYS.goals);
  return {
    history: Array.isArray(history) ? history.filter(isSetRecord) : [],
    questionnaire: profile && isQuestionnaire(profile.questionnaire) ? profile.questionnaire : null,
    programStartedAt: profile && typeof profile.programStartedAt === 'string' ? profile.programStartedAt : null,
    voiceEnabled: profile && typeof profile.voiceEnabled === 'boolean' ? profile.voiceEnabled : true,
    entitlement: isEntitlement(entitlement) ? entitlement : FREE_ENTITLEMENT,
    view: readView(read(KEYS.view)),
    routines: loadRoutines(),
    goals: Array.isArray(goals) ? goals.filter(isGoal).slice(0, MAX_GOALS) : [],
    reminders: readReminders(read(KEYS.reminders)),
  };
}

let state: AppState = load();
const listeners = new Set<() => void>();

function set(next: Partial<AppState>): void {
  state = { ...state, ...next };
  if ('history' in next) write(KEYS.history, state.history);
  if ('questionnaire' in next || 'programStartedAt' in next || 'voiceEnabled' in next) {
    write(KEYS.profile, {
      questionnaire: state.questionnaire,
      programStartedAt: state.programStartedAt,
      voiceEnabled: state.voiceEnabled,
    });
  }
  if ('entitlement' in next) write(KEYS.entitlement, state.entitlement);
  if ('view' in next) write(KEYS.view, state.view);
  if ('routines' in next) write(KEYS.routines, state.routines);
  if ('goals' in next) write(KEYS.goals, state.goals);
  if ('reminders' in next) write(KEYS.reminders, state.reminders);
  for (const l of listeners) l();
}

/** Cambio hecho por la persona en este dispositivo, para la sincronización (DEC-079). */
export type LocalChange =
  /** `close`: la sesión termina con estas series (modo manual). */
  | { type: 'sets'; records: SetRecord[]; close: boolean }
  | { type: 'session_end'; sessionId: string; endedAt: string }
  | { type: 'routines'; upserted: Routine[]; deleted: string[] }
  | { type: 'goals'; upserted: Goal[]; deleted: string[] }
  | { type: 'program'; program: ProgramState };

const changeListeners = new Set<(change: LocalChange) => void>();

export function onLocalChange(listener: (change: LocalChange) => void): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

function emit(change: LocalChange): void {
  for (const l of changeListeners) l(change);
}

/**
 * Guarda las rutinas marcando con la hora del cambio las que se tocaron (decide cuál gana al
 * sincronizar) y avisa solo de esas. El estado es inmutable: lo que no cambió conserva la
 * misma referencia.
 */
function setRoutines(next: readonly Routine[], deleted: readonly string[]): void {
  const prev = state.routines;
  const now = Date.now();
  const routines = next.map(r => (prev.includes(r) ? r : { ...r, updatedAt: Math.max(r.updatedAt, now) }));
  set({ routines });
  const upserted = routines.filter(r => !prev.includes(r));
  if (upserted.length > 0 || deleted.length > 0) emit({ type: 'routines', upserted, deleted: [...deleted] });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, () => state);
}

export const appActions = {
  /** Serie de la cámara; su sesión sigue abierta hasta `endSession`. */
  addSet(record: SetRecord): void {
    set({ history: [...state.history, record].slice(-MAX_HISTORY) });
    emit({ type: 'sets', records: [record], close: false });
  },
  /** Varias series de golpe (modo manual): una sola escritura y una sola notificación; cierran su sesión. */
  addSets(records: readonly SetRecord[]): void {
    if (records.length === 0) return;
    set({ history: [...state.history, ...records].slice(-MAX_HISTORY) });
    emit({ type: 'sets', records: [...records], close: true });
  },
  /** Fin de la visita a la cámara: cerrar la sesión evita falsos solapamientos (DEC-074). */
  endSession(sessionId: string, endedAt: string): void {
    emit({ type: 'session_end', sessionId, endedAt });
  },
  /** Crea o reemplaza una rutina por id. */
  saveRoutine(routine: Routine): void {
    const exists = state.routines.some(r => r.id === routine.id);
    const routines = exists ? state.routines.map(r => (r.id === routine.id ? routine : r)) : [...state.routines, routine];
    // Si la rutina guardada llega activa, desactiva las demás.
    setRoutines(routine.active ? activate(routines, routine.id) : routines, []);
  },
  deleteRoutine(id: string): void {
    setRoutines(state.routines.filter(r => r.id !== id), [id]);
  },
  /** Deja activa solo la rutina `id` (o ninguna con `null`). */
  activateRoutine(id: string | null): void {
    setRoutines(activate(state.routines, id), []);
  },
  saveGoal(goal: Goal): void {
    const exists = state.goals.some(g => g.id === goal.id);
    if (!exists && state.goals.length >= MAX_GOALS) return;
    const saved = { ...goal, updatedAt: Date.now() };
    set({ goals: exists ? state.goals.map(g => (g.id === goal.id ? saved : g)) : [...state.goals, saved] });
    emit({ type: 'goals', upserted: [saved], deleted: [] });
  },
  deleteGoal(id: string): void {
    set({ goals: state.goals.filter(g => g.id !== id) });
    emit({ type: 'goals', upserted: [], deleted: [id] });
  },
  saveQuestionnaire(q: Questionnaire, now: Date): void {
    set({ questionnaire: q, programStartedAt: now.toISOString() });
    emit({ type: 'program', program: { questionnaire: q, programStartedAt: state.programStartedAt } });
  },
  setEntitlement(e: Entitlement): void {
    set({ entitlement: e });
  },
  setReminders(patch: Partial<ReminderPrefs>): void {
    set({ reminders: readReminders({ ...state.reminders, ...patch }) });
  },
  setVoice(enabled: boolean): void {
    set({ voiceEnabled: enabled });
  },
  setView(patch: Partial<ViewPrefs>): void {
    set({ view: { ...state.view, ...patch } });
  },
  markTechniqueSeen(exerciseId: string): void {
    if (state.view.seenTechnique.includes(exerciseId)) return;
    set({ view: { ...state.view, seenTechnique: [...state.view.seenTechnique, exerciseId].slice(-MAX_SEEN) } });
  },
};

/**
 * Datos de la cuenta para la sincronización (`LocalPort` de `api-client`). `write` no avisa
 * por `onLocalChange`: lo que baja de la nube no se vuelve a subir.
 */
export const syncLocal = {
  read() {
    return {
      history: state.history,
      routines: state.routines,
      goals: state.goals,
      program: { questionnaire: state.questionnaire, programStartedAt: state.programStartedAt },
    };
  },
  write(patch: { history?: SetRecord[]; routines?: Routine[]; goals?: Goal[]; program?: ProgramState }): void {
    const next: Partial<AppState> = {};
    if (patch.history) next.history = patch.history.slice(-MAX_HISTORY);
    if (patch.routines) next.routines = patch.routines;
    if (patch.goals) next.goals = patch.goals.slice(0, MAX_GOALS);
    if (patch.program) {
      next.questionnaire = patch.program.questionnaire;
      next.programStartedAt = patch.program.programStartedAt;
    }
    set(next);
  },
  /**
   * Cierre de sesión: el historial, el programa, las rutinas y los objetivos son de la cuenta
   * y no los debe ver quien use el celular después (DEC-079). Las rutinas vuelven a ser las
   * plantillas; voz, vista y recordatorios son del dispositivo y se quedan.
   */
  clear(): void {
    try { localStorage.removeItem(KEYS.routinesBackup); } catch { /* bloqueado: no hay respaldo */ }
    set({
      history: [],
      questionnaire: null,
      programStartedAt: null,
      routines: ROUTINE_TEMPLATES.map(t => instantiateTemplate(t, newId, Date.now())),
      goals: [],
    });
  },
};

/** Semana del programa en curso (0 = semana 1) según la fecha de inicio. */
export function currentProgramWeek(startedAt: string | null, now: Date): number {
  if (!startedAt) return 0;
  const days = Math.floor((now.getTime() - Date.parse(startedAt)) / 86_400_000);
  return Math.max(0, Math.floor(days / 7));
}
