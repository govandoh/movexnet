import { dayKey, totals, weekActivity, streakDays, type SetRecord } from './sessionHistory.ts';
import { getExercise } from './catalog.ts';

/**
 * Perfil, progreso y logros derivados del historial (DEC-041, issue #34).
 *
 * Nada se guarda de forma acumulada: estadísticas, avance de objetivos y logros se recalculan
 * del historial de series en cada render, que es la única fuente de verdad. Un contador
 * guardado puede desincronizarse y contradecir al historial sin forma de saber cuál miente.
 * Todo recibe `now` (nunca `Date.now()`) y usa claves de día locales (`dayKey`), no
 * `toISOString`: en zonas horarias negativas como la de Guatemala convertiría a UTC y correría
 * un día entero.
 */

const DAY_MS = 86_400_000;

/** Número de día del calendario local, para comparar días seguidos sin arrastrar el horario de verano. */
function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

/** La racha más larga de días seguidos con alguna serie, en todo el historial. */
export function bestStreak(records: readonly SetRecord[]): number {
  const days = [...new Set(records.map(r => dayKey(new Date(r.completedAt))))].map(dayNumber).sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && days[i] - days[i - 1] === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

export interface Stats {
  sets: number;
  /** Repeticiones válidas (los ejercicios por tiempo no suman aquí). */
  reps: number;
  /** Segundos sostenidos en ejercicios por tiempo. */
  heldSeconds: number;
  activeDays: number;
  streak: number;
  bestStreak: number;
  /** Días con alguna serie en la semana en curso (lunes a domingo). */
  daysThisWeek: number;
  /** Repeticiones sin aviso de técnica sobre repeticiones válidas, 0–100, o `null` sin datos. */
  techniquePct: number | null;
  /** Ejercicios distintos del catálogo que se han entrenado. */
  distinctExercises: number;
}

export function computeStats(records: readonly SetRecord[], now: Date): Stats {
  const t = totals(records);
  const counted = records.filter(r => !r.timed);
  const good = counted.reduce((s, r) => s + r.goodReps, 0);
  return {
    sets: t.sets,
    reps: t.reps,
    heldSeconds: records.filter(r => r.timed).reduce((s, r) => s + r.validReps, 0),
    activeDays: t.activeDays,
    streak: streakDays(records, now),
    bestStreak: bestStreak(records),
    daysThisWeek: weekActivity(records, now).filter(Boolean).length,
    techniquePct: t.reps > 0 ? Math.round((good / t.reps) * 100) : null,
    distinctExercises: new Set(records.map(r => r.exerciseId).filter(id => getExercise(id) !== undefined)).size,
  };
}

// ─────────────────────────── Objetivos ───────────────────────────

export type GoalKind = 'weekly_days' | 'total_reps' | 'total_sets' | 'streak_days';

export interface Goal {
  id: string;
  kind: GoalKind;
  target: number;
  /** Alta del objetivo, epoch en ms. */
  createdAt: number;
  /** Último cambio, epoch en ms: decide qué versión gana al sincronizar (DEC-079). */
  updatedAt?: number;
}

/** Rango válido del objetivo de cada tipo: [mínimo, máximo]. */
export const GOAL_RANGE: Record<GoalKind, readonly [number, number]> = {
  weekly_days: [1, 7],
  total_reps: [10, 100_000],
  total_sets: [1, 10_000],
  streak_days: [2, 365],
};

export const GOAL_LABEL: Record<GoalKind, { title: string; unit: string }> = {
  weekly_days: { title: 'Entrenar cada semana', unit: 'días esta semana' },
  total_reps: { title: 'Acumular repeticiones', unit: 'repeticiones' },
  total_sets: { title: 'Completar series', unit: 'series' },
  streak_days: { title: 'Mantener una racha', unit: 'días seguidos' },
};

export interface GoalProgress {
  current: number;
  target: number;
  /** 0–100, sin pasar de 100. */
  pct: number;
  done: boolean;
}

function statFor(kind: GoalKind, stats: Stats): number {
  switch (kind) {
    case 'weekly_days': return stats.daysThisWeek;
    case 'total_reps': return stats.reps;
    case 'total_sets': return stats.sets;
    case 'streak_days': return stats.streak;
  }
}

/** Contrasta el objetivo contra la estadística que le corresponde. */
export function goalProgress(goal: Goal, stats: Stats): GoalProgress {
  const current = statFor(goal.kind, stats);
  const target = Math.max(1, goal.target);
  return { current, target, pct: Math.min(100, Math.round((current / target) * 100)), done: current >= target };
}

export function isGoal(v: unknown): v is Goal {
  if (typeof v !== 'object' || v === null) return false;
  const g = v as Record<string, unknown>;
  if (typeof g.id !== 'string' || typeof g.createdAt !== 'number' || typeof g.target !== 'number') return false;
  if (typeof g.kind !== 'string' || !(g.kind in GOAL_RANGE)) return false;
  if (g.updatedAt !== undefined && typeof g.updatedAt !== 'number') return false;
  const [min, max] = GOAL_RANGE[g.kind as GoalKind];
  return Number.isFinite(g.target) && g.target >= min && g.target <= max;
}

/** Acota un objetivo al rango de su tipo. */
export function clampTarget(kind: GoalKind, target: number): number {
  const [min, max] = GOAL_RANGE[kind];
  return Math.round(Math.min(max, Math.max(min, Number.isFinite(target) ? target : min)));
}

// ─────────────────────────── Logros ───────────────────────────

export interface Achievement {
  id: string;
  title: string;
  description: string;
  current: number;
  target: number;
  pct: number;
  unlocked: boolean;
}

/** Repeticiones mínimas para que el porcentaje de técnica cuente como logro. */
const TECHNIQUE_MIN_REPS = 50;
const TECHNIQUE_TARGET_PCT = 90;

interface AchievementDef {
  id: string;
  title: string;
  description: string;
  target: number;
  value: (s: Stats) => number;
}

const DEFS: readonly AchievementDef[] = [
  { id: 'first-set', title: 'Primera serie', description: 'Completa tu primera serie.', target: 1, value: s => s.sets },
  { id: 'sets-25', title: 'Constante', description: 'Completa 25 series.', target: 25, value: s => s.sets },
  { id: 'reps-100', title: 'Cien repeticiones', description: 'Acumula 100 repeticiones válidas.', target: 100, value: s => s.reps },
  { id: 'reps-1000', title: 'Mil repeticiones', description: 'Acumula 1000 repeticiones válidas.', target: 1000, value: s => s.reps },
  { id: 'streak-3', title: 'Tres días seguidos', description: 'Entrena 3 días seguidos.', target: 3, value: s => s.bestStreak },
  { id: 'streak-7', title: 'Semana completa', description: 'Entrena 7 días seguidos.', target: 7, value: s => s.bestStreak },
  { id: 'variety-5', title: 'Variedad', description: 'Entrena 5 ejercicios distintos.', target: 5, value: s => s.distinctExercises },
  {
    id: 'technique-90', title: 'Técnica limpia',
    description: `Llega a ${TECHNIQUE_TARGET_PCT} % de repeticiones sin aviso, con al menos ${TECHNIQUE_MIN_REPS} repeticiones.`,
    target: TECHNIQUE_TARGET_PCT,
    // Con pocas repeticiones el porcentaje no es confiable: no avanza.
    value: s => (s.reps >= TECHNIQUE_MIN_REPS && s.techniquePct !== null ? s.techniquePct : 0),
  },
];

/** Los ocho logros con su avance parcial; se desbloquean al llegar a la meta. */
export function computeAchievements(stats: Stats): Achievement[] {
  return DEFS.map(d => {
    const current = d.value(stats);
    return {
      id: d.id, title: d.title, description: d.description,
      current: Math.min(current, d.target), target: d.target,
      pct: Math.min(100, Math.round((current / d.target) * 100)),
      unlocked: current >= d.target,
    };
  });
}
