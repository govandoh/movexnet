import { getExercise } from './catalog.ts';
import type { FatigueSummary, SetRecord, SetSource } from './sessionHistory.ts';
import type { ManualPlan, ManualState } from './manualWorkout.ts';
import { completedSets } from './manualWorkout.ts';
import type { Routine, RoutineExercise } from './routines.ts';

/**
 * Construcción de series compartida entre la cámara y el modo manual (issue #34, DEC-047).
 *
 * Las dos pantallas terminan en el mismo `SetRecord`, así que el perfil, los logros y el
 * historial no distinguen de dónde vino una serie. Y una sola función, `startPath`, decide si
 * un ejercicio va a la cámara o al modo manual: ningún botón puede mandar un ejercicio a una
 * pantalla que no sabe ejecutarlo. Módulo puro: la hora y los ids llegan por parámetro.
 */

export type StartPath =
  | { kind: 'camera'; assistant: string }
  | { kind: 'manual'; exerciseId: string };

/** Camino de entrenamiento de un ejercicio del catálogo; `null` si no existe. */
export function startPath(exerciseId: string): StartPath | null {
  const ex = getExercise(exerciseId);
  if (!ex) return null;
  return ex.assistant ? { kind: 'camera', assistant: ex.assistant } : { kind: 'manual', exerciseId: ex.id };
}

/** Dirección del entrenamiento (HashRouter) para un ejercicio; `null` si no existe. */
export function startHref(exerciseId: string): string | null {
  const p = startPath(exerciseId);
  if (!p) return null;
  return p.kind === 'camera' ? `/entrenar?ex=${p.assistant}` : `/manual?ex=${p.exerciseId}`;
}

export interface SetInput {
  id: string;
  now: Date;
  exerciseId: string;
  /** Repeticiones válidas, o segundos si `timed`. */
  validReps: number;
  rejectedReps?: number;
  goodReps?: number;
  timed: boolean;
  fatigue?: FatigueSummary | null;
  /** Sesión, origen y duración medida, para la sincronización (DEC-074, DEC-079). */
  sessionId?: string;
  source?: SetSource;
  durationMs?: number | null;
}

/**
 * Arma el registro del historial. Sin cámara no hay validación de técnica: todo lo contado
 * cuenta como bueno y nada se descarta. Devuelve `null` si no hubo trabajo (valor <= 0).
 */
export function buildSetRecord(i: SetInput): SetRecord | null {
  if (!(i.validReps > 0)) return null;
  return {
    id: i.id,
    completedAt: i.now.toISOString(),
    exerciseId: i.exerciseId,
    validReps: i.validReps,
    rejectedReps: i.rejectedReps ?? 0,
    goodReps: i.timed ? i.validReps : Math.min(i.validReps, i.goodReps ?? i.validReps),
    timed: i.timed,
    fatigue: i.fatigue ?? null,
    ...(i.sessionId !== undefined ? { sessionId: i.sessionId } : {}),
    ...(i.source !== undefined ? { source: i.source } : {}),
    ...(i.durationMs !== undefined ? { durationMs: i.durationMs } : {}),
  };
}

/**
 * Una serie por cada serie cerrada con trabajo real del modo manual. Todas van a la misma
 * sesión; sin duración, porque la declara la persona y no la mide la cámara (DEC-074).
 */
export function manualRecords(s: ManualState, makeId: () => string, sessionId?: string): SetRecord[] {
  return completedSets(s).flatMap(d => {
    const r = buildSetRecord({
      id: makeId(), now: new Date(d.at), exerciseId: s.plan.exerciseId, validReps: d.amount, timed: d.timed,
      ...(sessionId !== undefined ? { sessionId, source: 'manual' as const, durationMs: null } : {}),
    });
    return r ? [r] : [];
  });
}

/** Plan del modo manual a partir de una entrada de rutina. */
export function planFromEntry(e: RoutineExercise): ManualPlan {
  const plan: ManualPlan = {
    exerciseId: e.exerciseId, sets: e.sets, restSeconds: e.restSeconds, method: e.method,
  };
  if (e.holdSeconds !== undefined) plan.holdSeconds = e.holdSeconds;
  else plan.reps = e.reps;
  if (e.loadKg !== undefined) plan.loadKg = e.loadKg;
  return plan;
}

/** Plan manual por defecto de un ejercicio del catálogo, para entrenar libre; `null` si no existe. */
export function defaultPlan(exerciseId: string): ManualPlan | null {
  const ex = getExercise(exerciseId);
  if (!ex) return null;
  const timed = ex.tracking === 'time';
  const base = { exerciseId: ex.id, sets: 3, restSeconds: 60, method: 'normal' } as const;
  return timed ? { ...base, holdSeconds: 30 } : { ...base, reps: 10 };
}

/** Busca una entrada por id en cualquier día de las rutinas. */
export function findEntry(routines: readonly Routine[], entryId: string): RoutineExercise | null {
  for (const r of routines) for (const d of r.days) {
    const e = d.exercises.find(x => x.id === entryId);
    if (e) return e;
  }
  return null;
}
