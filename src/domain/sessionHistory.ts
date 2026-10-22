/**
 * Historial de series y estadísticas del día (workstream D, puro).
 *
 * Alimenta la pantalla Hoy (anillo de 33 nodos, técnica, semana, racha) y el Perfil. Todas
 * las funciones reciben `now` y trabajan en la hora local del dispositivo: "hoy" es el día
 * del calendario de quien entrena, no el de UTC. No importa `analysis`: los niveles de
 * fatiga se traducen a los de aquí en la capa de UI.
 */

export type FatigueSummary = 'baja' | 'moderada' | 'alta';

export interface SetRecord {
  id: string;
  /** Instante de cierre de la serie, ISO 8601. */
  completedAt: string;
  /** Ejercicio del catálogo (`catalog.ts`). */
  exerciseId: string;
  /** Repeticiones contadas y válidas (o segundos sostenidos en la plancha). */
  validReps: number;
  /** Ciclos descartados por la validación temporal (demasiado rápidos, recorrido corto…). */
  rejectedReps: number;
  /** Repeticiones válidas que terminaron sin aviso de técnica. */
  goodReps: number;
  /** true si el ejercicio se mide por tiempo (plancha): `validReps` son segundos. */
  timed: boolean;
  fatigue: FatigueSummary | null;
  /**
   * Sesión a la que pertenece (una visita a la cámara o un ejercicio manual). Los registros
   * anteriores a la sincronización no la tienen: se agrupan por día al subirlos (DEC-079).
   */
  sessionId?: string;
  /** Origen de la serie (DEC-067); sin él, la serie es anterior a la sincronización. */
  source?: SetSource;
  /** Duración medida por la cámara, en ms; `null` en el modo manual (DEC-074). */
  durationMs?: number | null;
}

/** `imported`: historial local anterior a la sincronización; nunca puntúa (DEC-079). */
export type SetSource = 'camera' | 'manual' | 'imported';

export interface DayStats {
  sets: number;
  reps: number;
  /** Repeticiones sin aviso sobre repeticiones válidas, 0–100, o `null` sin datos. */
  techniquePct: number | null;
}

/** Meta de repeticiones del día cuando no hay programa. */
export const DEFAULT_DAILY_GOAL_REPS = 60;

/** Clave de día en hora local: `AAAA-MM-DD`. */
export function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function recordDay(r: SetRecord): string {
  return dayKey(new Date(r.completedAt));
}

export function dayStats(records: readonly SetRecord[], day: Date): DayStats {
  const key = dayKey(day);
  const today = records.filter(r => recordDay(r) === key);
  const counted = today.filter(r => !r.timed);
  const reps = counted.reduce((s, r) => s + r.validReps, 0);
  const good = counted.reduce((s, r) => s + r.goodReps, 0);
  return {
    sets: today.length,
    reps,
    techniquePct: reps > 0 ? Math.round((good / reps) * 100) : null,
  };
}

/** Actividad de la semana en curso, de lunes a domingo. */
export function weekActivity(records: readonly SetRecord[], now: Date): boolean[] {
  const active = new Set(records.map(recordDay));
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    return active.has(dayKey(d));
  });
}

/**
 * Días seguidos con al menos una serie. Cuenta hasta hoy o, si hoy todavía no se entrenó,
 * hasta ayer: la racha no se rompe a primera hora de la mañana.
 */
export function streakDays(records: readonly SetRecord[], now: Date): number {
  const active = new Set(records.map(recordDay));
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!active.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (active.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** La serie más reciente, o `null`. */
export function lastSet(records: readonly SetRecord[]): SetRecord | null {
  let last: SetRecord | null = null;
  for (const r of records) if (!last || r.completedAt > last.completedAt) last = r;
  return last;
}

export interface Totals {
  sets: number;
  reps: number;
  activeDays: number;
}

export function totals(records: readonly SetRecord[]): Totals {
  return {
    sets: records.length,
    reps: records.filter(r => !r.timed).reduce((s, r) => s + r.validReps, 0),
    activeDays: new Set(records.map(recordDay)).size,
  };
}

/** Validación de lo leído del almacenamiento local: descarta registros mal formados. */
export function isSetRecord(v: unknown): v is SetRecord {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.id === 'string' && typeof r.completedAt === 'string' && !Number.isNaN(Date.parse(r.completedAt)) &&
    typeof r.exerciseId === 'string' && typeof r.validReps === 'number' && typeof r.rejectedReps === 'number' &&
    typeof r.goodReps === 'number' && typeof r.timed === 'boolean' &&
    (r.fatigue === null || r.fatigue === 'baja' || r.fatigue === 'moderada' || r.fatigue === 'alta') &&
    (r.sessionId === undefined || typeof r.sessionId === 'string') &&
    (r.source === undefined || r.source === 'camera' || r.source === 'manual' || r.source === 'imported') &&
    (r.durationMs === undefined || r.durationMs === null ||
      (typeof r.durationMs === 'number' && Number.isFinite(r.durationMs) && r.durationMs >= 0));
}
