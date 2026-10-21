import type { AssistantId } from '../../domain/catalog';
import type { FeedbackStrategy } from '../../feedback/feedbackPolicy';
import { GOOD_DEPTH_ANGLE } from '../../exercises/squat';
import { GOOD_FORM_ANGLE } from '../../exercises/bicepCurl';
import { GOOD_LOCKOUT_ANGLE } from '../../exercises/shoulderPress';
import {
  BRIDGE_GOOD_EXTENSION_DEG, CURL_GOOD_CONTRACTION_3D_DEG, DEFINITIONS_3D, LUNGE_GOOD_DEPTH_DEG, PUSHUP_GOOD_DEPTH_DEG,
} from '../../exercises/definitions3d';
import type { FatigueLevel } from '../../analysis/fatigue';
import type { FatigueSummary } from '../../domain/sessionHistory';

/**
 * Configuración de la voz por ejercicio, movida sin cambios desde `CameraView` (PR 4).
 * Los umbrales siguen viniendo de los contadores: aquí solo se eligen las frases.
 */

/** Estrategia de voz por ejercicio (DEC-016): la sentadilla habla en el fondo; curl y press, con el número. */
export const FEEDBACK_STRATEGY: Record<AssistantId, FeedbackStrategy> = {
  squat: 'mid-range-peak',
  curl: 'peak-at-end-of-effort',
  press: 'peak-at-end-of-effort',
  // Flexión y zancada tienen el fondo a mitad de la rep, como la sentadilla; el puente
  // llega arriba al final del esfuerzo, como el press.
  pushup: 'mid-range-peak',
  lunge: 'mid-range-peak',
  bridge: 'peak-at-end-of-effort',
  plank: 'mid-range-peak',
};

/** Definición 3D por ejercicio. La plancha no cuenta ciclos (usa `PlankTracker`). */
export function definitionFor(ex: AssistantId) {
  return ex === 'plank' ? DEFINITIONS_3D.squat : DEFINITIONS_3D[ex];
}

/**
 * Frase de técnica al confirmar el pico o fondo, a partir del extremo alcanzado: mínimo de
 * rodilla o de codo, o máximo de codo en el press. En el curl el umbral depende del motor,
 * porque el 3D mide el codo menos doblado de lo que está (DEC-073).
 */
export function peakPhrase(ex: AssistantId, extremeDeg: number, engine3D = false): string {
  switch (ex) {
    case 'squat': return extremeDeg < GOOD_DEPTH_ANGLE ? '¡Excelente profundidad!' : 'Baja un poco más';
    case 'curl': {
      const complete = engine3D ? extremeDeg <= CURL_GOOD_CONTRACTION_3D_DEG : extremeDeg < GOOD_FORM_ANGLE;
      return complete ? '¡Excelente contracción!' : 'Sube un poco más';
    }
    case 'press': return extremeDeg >= GOOD_LOCKOUT_ANGLE ? '¡Extensión completa!' : 'Extiende un poco más';
    case 'pushup': return extremeDeg <= PUSHUP_GOOD_DEPTH_DEG ? '¡Buena bajada!' : 'Baja más el pecho';
    case 'lunge': return extremeDeg <= LUNGE_GOOD_DEPTH_DEG ? '¡Buena profundidad!' : 'Baja un poco más';
    case 'bridge': return extremeDeg >= BRIDGE_GOOD_EXTENSION_DEG ? '¡Cadera arriba!' : 'Sube más la cadera';
    case 'plank': return '';
  }
}

/**
 * Avisos de técnica que la voz dice en el pico en lugar del elogio del recorrido (DEC-076).
 * Solo entran los validados con grabaciones reales: en el press bien hecho, `lumbar_arch` y
 * `asymmetry` salen en casi todos los picos (fixtures de #84) y la voz regañaría cada
 * repetición. Se agregan aquí cuando dejen de dar falsos positivos.
 */
export const VOICED_TECHNIQUE_ISSUES: ReadonlySet<string> = new Set(['elbow_drift']);

/**
 * Frase que se dice al confirmar el pico o fondo. Si en ese frame hay un aviso de técnica de
 * `VOICED_TECHNIQUE_ISSUES`, se dice el aviso: con los codos abiertos, la voz no debe decir
 * "¡Excelente contracción!". Es el mismo frame que usa el resumen para marcar la calidad de
 * la repetición (`SetSummaryBuilder.addFrame`).
 */
export function spokenPeakPhrase(
  ex: AssistantId, extremeDeg: number, engine3D: boolean,
  issue: { code: string; message: string } | null,
): string {
  return issue && VOICED_TECHNIQUE_ISSUES.has(issue.code) ? issue.message : peakPhrase(ex, extremeDeg, engine3D);
}

/** Nombre de la métrica angular que se muestra durante la serie. */
export const EXTREME_LABEL: Record<AssistantId, string> = {
  squat: 'Profundidad', curl: 'Contracción', press: 'Extensión', pushup: 'Bajada',
  lunge: 'Profundidad', bridge: 'Cadera', plank: 'Línea',
};

/** Cada cuántos segundos de plancha sostenida se anuncia el tiempo. */
export const PLANK_ANNOUNCE_EVERY_S = 10;
/** Separación mínima entre avisos de forma en la plancha, en ms. */
export const PLANK_WARNING_MIN_MS = 3000;
/** Repeticiones objetivo si el programa no indica otra cosa. */
export const DEFAULT_TARGET_REPS = 10;
/** Repeticiones mínimas para informar la fatiga de la serie (FatigueDetector necesita línea base). */
export const MIN_REPS_FOR_FATIGUE = 4;

export function fatigueSummary(level: FatigueLevel, validReps: number): FatigueSummary | null {
  if (validReps < MIN_REPS_FOR_FATIGUE) return null;
  return level === 'fresh' ? 'baja' : level === 'moderate' ? 'moderada' : 'alta';
}
