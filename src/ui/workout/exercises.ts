import { EXERCISE_CATALOG, type AssistantId } from '../../domain/catalog';
import { FramePipeline } from '../../analysis/framePipeline';
import {
  Engine3DTracker, PlankExerciseTracker, curl2D, press2D, squat2D, type EngineTracker,
} from '../../exercises/exerciseTrackers';
import { ENGINE_OVERRIDE, type EngineOverride } from '../engineFlag';
import { definitionFor } from './coaching';

/** Ejercicios con asistente por cámara, en el orden de los chips. */
export const ASSISTED: readonly AssistantId[] = ['squat', 'curl', 'press', 'pushup', 'lunge', 'bridge', 'plank'];

export const ASSISTED_NAMES: Record<AssistantId, string> = {
  squat: 'Sentadilla',
  curl: 'Curl de bíceps',
  press: 'Press de hombro',
  pushup: 'Flexiones',
  lunge: 'Zancadas',
  bridge: 'Puente de glúteo',
  plank: 'Plancha',
};

/** Ejercicio del catálogo (`catalog.ts`) que registra el historial para cada asistente. */
export function catalogIdFor(ex: AssistantId): string {
  return EXERCISE_CATALOG.find(e => e.assistant === ex)?.id ?? ex;
}

/** Ejercicios con contador 2D (los del MVP), que `?engine=2d` puede recuperar. */
const HAS_2D: readonly AssistantId[] = ['squat', 'curl', 'press'];

/**
 * Motor por ejercicio (DEC-059, DEC-072). La sentadilla usa el motor 3D desde DEC-072,
 * validada en celular con personas. Curl y press siguen en el motor 2D de producción,
 * congelado por los golden, hasta resolver la #58; con `?engine=3d` pasan al 3D. Con
 * `?engine=2d` la sentadilla vuelve al 2D como respaldo. La ola 1 no tiene versión 2D y
 * usa siempre el motor 3D.
 */
export function usesEngine3D(ex: AssistantId, override: EngineOverride = ENGINE_OVERRIDE): boolean {
  if (override === '2d') return !HAS_2D.includes(ex);
  return override === '3d' || (ex !== 'curl' && ex !== 'press');
}

export function isAssistantId(v: string | null): v is AssistantId {
  return v !== null && (ASSISTED as readonly string[]).includes(v);
}

export interface WorkoutTrackers {
  /** Pipeline 3D compartido; la preparación lo usa para calibrar antes de la serie. */
  pipeline: FramePipeline;
  trackers: Record<AssistantId, EngineTracker>;
}

/**
 * Un contador por ejercicio, con el motor que le toca (contrato de DEC-063). Los 3D
 * comparten un pipeline para que la calibración de pie sobreviva al cambio de ejercicio.
 */
export function createWorkoutTrackers(initial: AssistantId, override: EngineOverride = ENGINE_OVERRIDE): WorkoutTrackers {
  const pipeline = new FramePipeline(definitionFor(initial));
  const engine3D = (ex: Exclude<AssistantId, 'plank'>) => new Engine3DTracker(ex, pipeline, definitionFor(ex));
  const trackers: Record<AssistantId, EngineTracker> = {
    squat: usesEngine3D('squat', override) ? engine3D('squat') : squat2D(),
    curl: usesEngine3D('curl', override) ? engine3D('curl') : curl2D(),
    press: usesEngine3D('press', override) ? engine3D('press') : press2D(),
    pushup: engine3D('pushup'),
    lunge: engine3D('lunge'),
    bridge: engine3D('bridge'),
    plank: new PlankExerciseTracker(pipeline, definitionFor('plank')),
  };
  return { pipeline, trackers };
}
