import { useSyncExternalStore } from 'react';
import { isSetRecord, type SetRecord } from '../../domain/sessionHistory';
import { FREE_ENTITLEMENT, isEntitlement, type Entitlement } from '../../domain/payment';
import type { Questionnaire } from '../../domain/routineGenerator';
import { ALL_EQUIPMENT } from '../../domain/catalog';
import { activate, resolveStoredRoutines, type Routine } from '../../domain/routines';
import { isGoal, type Goal } from '../../domain/progress';

/**
 * Estado local de la app (historial, cuestionario, suscripción simulada, voz).
 *
 * Vive en `localStorage` mientras no exista `api-client` (DEC-024: siempre con try/catch y
 * validación). Si el almacenamiento está bloqueado, la app funciona igual con el estado en
 * memoria de la sesión: nunca se pierde lo que ya se tenía por un error de escritura.
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

/** Id único para entidades locales; `crypto.randomUUID` no existe en contextos inseguros. */
export function newId(): string {
  try { return crypto.randomUUID(); } catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }
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

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, () => state);
}

export const appActions = {
  addSet(record: SetRecord): void {
    set({ history: [...state.history, record].slice(-MAX_HISTORY) });
  },
  /** Varias series de golpe (modo manual): una sola escritura y una sola notificación. */
  addSets(records: readonly SetRecord[]): void {
    if (records.length === 0) return;
    set({ history: [...state.history, ...records].slice(-MAX_HISTORY) });
  },
  /** Crea o reemplaza una rutina por id. */
  saveRoutine(routine: Routine): void {
    const exists = state.routines.some(r => r.id === routine.id);
    const routines = exists ? state.routines.map(r => (r.id === routine.id ? routine : r)) : [...state.routines, routine];
    // Si la rutina guardada llega activa, desactiva las demás.
    set({ routines: routine.active ? activate(routines, routine.id) : routines });
  },
  deleteRoutine(id: string): void {
    set({ routines: state.routines.filter(r => r.id !== id) });
  },
  /** Deja activa solo la rutina `id` (o ninguna con `null`). */
  activateRoutine(id: string | null): void {
    set({ routines: activate(state.routines, id) });
  },
  saveGoal(goal: Goal): void {
    const exists = state.goals.some(g => g.id === goal.id);
    if (!exists && state.goals.length >= MAX_GOALS) return;
    set({ goals: exists ? state.goals.map(g => (g.id === goal.id ? goal : g)) : [...state.goals, goal] });
  },
  deleteGoal(id: string): void {
    set({ goals: state.goals.filter(g => g.id !== id) });
  },
  saveQuestionnaire(q: Questionnaire, now: Date): void {
    set({ questionnaire: q, programStartedAt: now.toISOString() });
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

/** Semana del programa en curso (0 = semana 1) según la fecha de inicio. */
export function currentProgramWeek(startedAt: string | null, now: Date): number {
  if (!startedAt) return 0;
  const days = Math.floor((now.getTime() - Date.parse(startedAt)) / 86_400_000);
  return Math.max(0, Math.floor(days / 7));
}
