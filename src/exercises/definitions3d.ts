import {
  LM, WORLD_UP, angleBetween, areVisible, calculateAngle3D, cross, dot, getTorsoInclination, normalize, subtract,
  type Landmark3D,
} from '../geometry/vectors3d.ts';
import type { ExerciseId } from '../contracts/index.ts';
import type { ExerciseDefinition3D, FormContext, Side } from './tracker3d.ts';
import { GOOD_DEPTH_ANGLE } from './squat.ts';
import { GOOD_LOCKOUT_ANGLE } from './shoulderPress.ts';

/**
 * Definiciones 3D de sentadilla, curl y press (ver DEC-057).
 *
 * Umbrales tomados de los trackers 3D de fitnetv2 (commit d456e95): histéresis de fase,
 * validación temporal por ejercicio (DEC-037/045) y comprobaciones de forma que solo son
 * medibles en 3D (DEC-036). El umbral de extensión completa del press (`GOOD_LOCKOUT_ANGLE`)
 * se comparte con el tracker 2D. El curl tiene el suyo (`CURL_GOOD_CONTRACTION_3D_DEG`)
 * porque el 3D mide el codo menos doblado, y el press no avisa de bajar de más (DEC-073).
 *
 * Las comprobaciones contra la vertical (tronco, brazo) suponen landmarks nivelados por
 * gravedad o calibración (DEC-050/053).
 */

/** Margen de confirmación del pico o fondo, en grados: supera el temblor típico (1–3°). ver DEC-044 */
const CONFIRM_MARGIN_DEG = 8;
/** Bloqueo tras contar, en ms: ~15 frames a 60 fps del MVP (DEC-022), ahora independiente de los fps. */
const ARM_COOLDOWN_MS = 250;
const MIN_VISIBILITY = 0.5;

/** Inclinación del tronco en la sentadilla que dispara `trunk_lean`, en grados (DEC-057). */
export const SQUAT_MAX_TRUNK_LEAN_DEG = 55;
/** Asimetría de rodillas que dispara el aviso, como fracción. */
const SQUAT_MAX_ASYMMETRY = 0.18;
/** Desviación del brazo respecto a la vertical que dispara `elbow_drift`, en grados. */
// Con 25° el aviso saltaba en el 38–50 % de los frames de curls bien hechos: en las
// grabaciones de #58 el brazo superior se separa de la vertical 20–23° de mediana y 45–52°
// en el p95 aun con el codo quieto. 50° deja el aviso para el despegue claro (DEC-073).
export const CURL_MAX_ELBOW_DRIFT_DEG = 50;
/**
 * Tiempo que el codo debe seguir despegado para avisar, en ms. Aun con 50°, el 3D da saltos
 * de 0.1–0.3 s en curls bien hechos (3 de 5 repeticiones de perfil con aviso falso); un
 * despegue real dura 0.6–1 s en las grabaciones de #58 (DEC-075).
 */
export const CURL_ELBOW_DRIFT_HOLD_MS = 400;

/**
 * Codo por debajo de este ángulo = contracción completa en el curl, en grados. El 3D (`lite`)
 * comprime el codo: un curl completo que en la imagen llega a 20–30° mide 53–68° en 3D
 * (grabaciones de #58). Coincide con el umbral de esfuerzo del ciclo (DEC-073).
 */
export const CURL_GOOD_CONTRACTION_3D_DEG = 70;
/** Inclinación del tronco en el press que dispara `lumbar_arch`, en grados. */
export const PRESS_MAX_TRUNK_LEAN_DEG = 25;
const ARM_MAX_ASYMMETRY = 0.2;

const SIDE = {
  left:  { shoulder: LM.LEFT_SHOULDER,  elbow: LM.LEFT_ELBOW,  wrist: LM.LEFT_WRIST,  hip: LM.LEFT_HIP,  knee: LM.LEFT_KNEE,  ankle: LM.LEFT_ANKLE },
  right: { shoulder: LM.RIGHT_SHOULDER, elbow: LM.RIGHT_ELBOW, wrist: LM.RIGHT_WRIST, hip: LM.RIGHT_HIP, knee: LM.RIGHT_KNEE, ankle: LM.RIGHT_ANKLE },
} as const;

function torsoLean(w: readonly Landmark3D[]): number {
  return getTorsoInclination(w[LM.LEFT_SHOULDER], w[LM.RIGHT_SHOULDER], w[LM.LEFT_HIP], w[LM.RIGHT_HIP]);
}

function elbowAngle(w: readonly Landmark3D[], s: Side): number {
  const j = SIDE[s];
  return calculateAngle3D(w[j.shoulder], w[j.elbow], w[j.wrist]);
}

/** Desviación del brazo (hombro→codo) respecto a la vertical descendente (+Y), en grados. */
function upperArmDrift(w: readonly Landmark3D[], s: Side): number {
  const j = SIDE[s];
  return angleBetween(subtract(w[j.elbow], w[j.shoulder]), { x: 0, y: 1, z: 0 });
}

function armSideLandmarks(s: Side): readonly number[] {
  return [SIDE[s].shoulder, SIDE[s].elbow, SIDE[s].wrist];
}

// ─────────────────────────────── Sentadilla ───────────────────────────────

export const SQUAT_3D: ExerciseDefinition3D = {
  id: 'squat',
  name: 'Sentadillas',
  sides: 'both',
  sideLandmarks: {
    left:  [SIDE.left.hip, SIDE.left.knee, SIDE.left.ankle],
    right: [SIDE.right.hip, SIDE.right.knee, SIDE.right.ankle],
  },
  extraLandmarks: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
  sideAngle: (w, s) => calculateAngle3D(w[SIDE[s].hip], w[SIDE[s].knee], w[SIDE[s].ankle]),
  combine: 'mean',
  // De pie > 140°, abajo < 100° (DEC-010). El 3D de MediaPipe mide la rodilla de pie en
  // ~146–152° (160° no se alcanzaba y la rep no se cerraba): ver DEC-066.
  cycle: { polarity: 'min', restDeg: 140, effortDeg: 100, confirmMarginDeg: CONFIRM_MARGIN_DEG },
  perSideCycles: false,
  cooldownMs: 0,
  shape: { effortIsMinimum: true, concentricFirst: false },
  quality: { minRomDegrees: 40, minDurationMs: 800, maxDurationMs: 15000, minSmoothness: 0.35 },
  formCheck(ctx: FormContext) {
    if (ctx.phase !== 'effort') return null;
    if (torsoLean(ctx.world) > SQUAT_MAX_TRUNK_LEAN_DEG) {
      return { code: 'trunk_lean', level: 'bad', message: 'Pecho arriba, estás inclinando la espalda' };
    }
    if (ctx.asymmetry > SQUAT_MAX_ASYMMETRY) {
      return { code: 'asymmetry', level: 'warning', message: 'Reparte el peso entre las dos piernas' };
    }
    return null;
  },
  phaseFeedback(ctx: FormContext) {
    if (ctx.phase === 'rest') return { level: 'idle', message: 'Listo, baja para la sentadilla' };
    // Ya pasó el fondo: se juzga la profundidad alcanzada, no se pide bajar mientras sube.
    if (ctx.peakReached) {
      return ctx.extremeDeg <= GOOD_DEPTH_ANGLE
        ? { level: 'good', message: '¡Buena profundidad! Sube con los talones' }
        : { level: 'warning', message: 'Sube. En la próxima, baja un poco más' };
    }
    return ctx.primaryAngle <= GOOD_DEPTH_ANGLE
      ? { level: 'good', message: '¡Excelente profundidad!' }
      : { level: 'warning', message: 'Baja un poco más' };
  },
  notVisibleMessage: 'Asegúrate de que tu cuerpo completo sea visible',
  calibrateDuringSet: true,
};

// ─────────────────────────────── Curl de bíceps ───────────────────────────────

export const CURL_3D: ExerciseDefinition3D = {
  id: 'curl',
  name: 'Curl de Bíceps',
  sides: 'either',
  sideLandmarks: { left: armSideLandmarks('left'), right: armSideLandmarks('right') },
  extraLandmarks: [],
  sideAngle: elbowAngle,
  combine: 'min',
  // Extendido > 140°, arriba < 70°; el brazo debe haber llegado a 125° antes de subir (DEC-017).
  // El 3D comprime el codo (extendido ~150°, arriba ~60°): con 160°/60° no contaba nada.
  // Con 140°/70°, de perfil: 6 de 6–8 bien hechas y 1 en la toma a medias (DEC-073).
  cycle: { polarity: 'min', restDeg: 140, effortDeg: 70, confirmMarginDeg: CONFIRM_MARGIN_DEG, minStartDeg: 125 },
  perSideCycles: true,
  cooldownMs: ARM_COOLDOWN_MS,
  shape: { effortIsMinimum: true, concentricFirst: true },
  quality: { minRomDegrees: 50, minDurationMs: 700, maxDurationMs: 10000, minSmoothness: 0.3 },
  formCheck(ctx: FormContext) {
    // El balanceo invalida el estímulo del bíceps: se evalúa en todo el ciclo, por lado visible.
    for (const s of ['left', 'right'] as const) {
      if (!areVisible(ctx.world, armSideLandmarks(s), MIN_VISIBILITY)) continue;
      if (upperArmDrift(ctx.world, s) > CURL_MAX_ELBOW_DRIFT_DEG) {
        return { code: 'elbow_drift', level: 'bad', message: 'Pega el codo al cuerpo, estás usando impulso' };
      }
    }
    if (ctx.phase === 'effort' && ctx.asymmetry > ARM_MAX_ASYMMETRY) {
      return { code: 'asymmetry', level: 'warning', message: 'Un brazo va adelantado, iguala el recorrido' };
    }
    return null;
  },
  phaseFeedback(ctx: FormContext) {
    if (ctx.phase === 'rest') return { level: 'idle', message: 'Listo, sube el peso' };
    if (ctx.peakReached) {
      return ctx.extremeDeg <= CURL_GOOD_CONTRACTION_3D_DEG
        ? { level: 'good', message: '¡Contracción completa! Baja controlado' }
        : { level: 'warning', message: 'Baja. En la próxima, sube un poco más' };
    }
    return ctx.primaryAngle <= CURL_GOOD_CONTRACTION_3D_DEG
      ? { level: 'good', message: '¡Contracción completa!' }
      : { level: 'warning', message: 'Sube un poco más' };
  },
  notVisibleMessage: 'Asegúrate de que tu brazo sea visible',
  issueHoldMs: { elbow_drift: CURL_ELBOW_DRIFT_HOLD_MS },
  calibrateDuringSet: true,
};

// ─────────────────────────────── Press de hombro ───────────────────────────────

const HIPS = [LM.LEFT_HIP, LM.RIGHT_HIP] as const;

export const PRESS_3D: ExerciseDefinition3D = {
  id: 'press',
  name: 'Press de Hombro',
  sides: 'either',
  sideLandmarks: { left: armSideLandmarks('left'), right: armSideLandmarks('right') },
  extraLandmarks: [],
  sideAngle: elbowAngle,
  combine: 'max',
  // Abajo < 100°, arriba > 150°; polaridad invertida: el esfuerzo es el ángulo máximo (DEC-018).
  // Sin calibrar con personas: subirlo a 110° hacía contar repeticiones a medias (DEC-066);
  // se calibra en el issue #58.
  cycle: { polarity: 'max', restDeg: 100, effortDeg: 150, confirmMarginDeg: CONFIRM_MARGIN_DEG },
  perSideCycles: true,
  cooldownMs: ARM_COOLDOWN_MS,
  shape: { effortIsMinimum: false, concentricFirst: true },
  // minSmoothness 0.4: de frente los dos brazos desfasados contaban recorridos entrecortados
  // (suavidad 0.33) como repeticiones; con 0.4 el press de frente pasa de 13 a 8 sobre 6–8
  // reales, sin cambiar el de perfil ni los parciales (DEC-073).
  quality: { minRomDegrees: 45, minDurationMs: 700, maxDurationMs: 10000, minSmoothness: 0.4 },
  formCheck(ctx: FormContext) {
    // Arqueo lumbar: solo con la cadera visible (sin ella la inclinación sale de puntos
    // estimados) y con los brazos por encima del reposo, que es cuando hay carga arriba.
    // fitnetv2 lo evaluaba en todas las fases y sin exigir cadera (DEC-054).
    const armsUp = ctx.phase === 'effort' || ctx.primaryAngle > PRESS_3D.cycle.restDeg;
    if (armsUp && areVisible(ctx.world, HIPS, MIN_VISIBILITY) && torsoLean(ctx.world) > PRESS_MAX_TRUNK_LEAN_DEG) {
      return { code: 'lumbar_arch', level: 'bad', message: 'Aprieta el abdomen, estás arqueando la espalda' };
    }
    // Sin aviso de "cuida los hombros" en 3D: abajo, el codo 3D midió 9–55° en presses bien
    // hechos de perfil y no se distingue de bajar de más, así que el aviso salía casi siempre.
    // Vuelve cuando haya una medida que separe los dos casos (DEC-073, #58).
    if (ctx.phase === 'effort' && ctx.asymmetry > ARM_MAX_ASYMMETRY) {
      return { code: 'asymmetry', level: 'warning', message: 'Un brazo sube más que el otro' };
    }
    return null;
  },
  phaseFeedback(ctx: FormContext) {
    if (ctx.phase === 'rest') return { level: 'idle', message: 'Listo, empuja hacia arriba' };
    if (ctx.peakReached) {
      return ctx.extremeDeg >= GOOD_LOCKOUT_ANGLE
        ? { level: 'good', message: '¡Extensión completa! Baja controlado' }
        : { level: 'warning', message: 'Baja. En la próxima, extiende un poco más' };
    }
    return ctx.primaryAngle >= GOOD_LOCKOUT_ANGLE
      ? { level: 'good', message: '¡Extensión completa!' }
      : { level: 'warning', message: 'Extiende un poco más' };
  },
  notVisibleMessage: 'Asegúrate de que tus brazos sean visibles',
  calibrateDuringSet: false,
};

// ─────────────────────── Ola 1: peso corporal (DEC-056, issue #39) ───────────────────────
//
// Umbrales iniciales propuestos en este repositorio. Los de vuelta al reposo se calibraron
// con las grabaciones de una persona (DEC-066); el resto sigue sin calibrar con personas.
// Se ajustan con las grabaciones por guion (DEC-055) y cualquier cambio que altere tests
// de comportamiento exige DEC.

/**
 * Codo por debajo de este ángulo = flexión profunda, en grados. El 3D mide el codo menos
 * doblado de lo que está: en las flexiones completas grabadas el fondo dio mediana 84° y
 * p90 95°, y con 90° una de cada cuatro recibía "Baja más el pecho" estando abajo (DEC-066).
 */
export const PUSHUP_GOOD_DEPTH_DEG = 95;
/**
 * Desviación de la línea hombro-cadera-tobillo (en el plano vertical del cuerpo) desde la que
 * se avisa "cadera caída" o "cadera arriba", en grados. Calibradas con 11 grabaciones de dos
 * personas (#59, DEC-071): con el cuerpo recto el 3D mide entre −5° y +4°, y la cadera caída
 * es más sutil que la levantada, de ahí la asimetría.
 */
export const HIP_SAG_MIN_DEG = 8;
export const HIP_PIKE_MIN_DEG = 18;
/** Rodilla delantera por debajo de este ángulo = zancada profunda, en grados. */
export const LUNGE_GOOD_DEPTH_DEG = 100;
/** Inclinación del tronco en la zancada que dispara `trunk_lean`, en grados. */
export const LUNGE_MAX_TRUNK_LEAN_DEG = 35;
/** Cadera por encima de este ángulo = extensión completa del puente, en grados. */
export const BRIDGE_GOOD_EXTENSION_DEG = 165;

export type HipIssue = 'hip_sag' | 'hip_pike';

export interface BodyLine {
  /** Ángulo hombro-cadera-tobillo en el plano vertical del cuerpo (180° = recta), en grados. */
  angle: number;
  /** Desviación de la recta con signo, en grados: positiva = cadera abajo, negativa = arriba. */
  deviationDeg: number;
  /** Inclinación de la recta hombro-tobillo respecto a la vertical, en grados (90° = horizontal). */
  inclineDeg: number;
}

const BODY_LINE_SIDES: Record<Side, readonly number[]> = {
  left: [LM.LEFT_SHOULDER, LM.LEFT_HIP, LM.LEFT_ANKLE],
  right: [LM.RIGHT_SHOULDER, LM.RIGHT_HIP, LM.RIGHT_ANKLE],
};

/**
 * Alineación del cuerpo en tabla (flexión, plancha) con el lado más visible. De perfil el lado
 * lejano casi siempre está tapado: exigir los dos dejaba sin evaluar la mayoría de los cuadros, y
 * promediar con el lado tapado enderezaba la línea (#59, DEC-071).
 *
 * Se mide en el plano vertical que contiene la recta hombro-tobillo: con un solo lado, el ancho
 * de los hombros frente a la cadera tuerce la línea hacia un costado (~9° en una postura recta)
 * y eso no es cadera caída ni levantada. `null` si ningún lado se ve completo.
 */
export function bodyLine(w: readonly Landmark3D[]): BodyLine | null {
  const vis = (ids: readonly number[]) => Math.min(...ids.map(i => w[i]?.visibility ?? 0));
  const ids = vis(BODY_LINE_SIDES.left) >= vis(BODY_LINE_SIDES.right) ? BODY_LINE_SIDES.left : BODY_LINE_SIDES.right;
  if (w.length <= LM.RIGHT_ANKLE || vis(ids) < MIN_VISIBILITY) return null;
  const [sh, hip, an] = ids.map(i => w[i]);

  const d = subtract(an, sh);
  // Normal del plano vertical de la recta (eje lateral). Con el cuerpo vertical no hay plano
  // definido: se mide sin proyectar.
  const lateral = cross(d, WORLD_UP);
  const n = Math.hypot(lateral.x, lateral.y, lateral.z) > 1e-6 ? normalize(lateral) : null;
  const project = (p: Landmark3D) => {
    if (!n) return p;
    const k = dot(p, n);
    return { x: p.x - k * n.x, y: p.y - k * n.y, z: p.z - k * n.z };
  };
  const angle = calculateAngle3D(project(sh), project(hip), project(an));

  // ¿La cadera queda por debajo (+y) de la recta hombros→tobillos? (proyección sobre la recta)
  const t = dot(subtract(hip, sh), d) / (dot(d, d) || 1);
  const hipBelow = hip.y > sh.y + t * d.y;
  return {
    angle,
    deviationDeg: hipBelow ? 180 - angle : angle - 180,
    inclineDeg: angleBetween(subtract(sh, an), WORLD_UP),
  };
}

/** Ejercicios que empiezan en el suelo: no tienen una postura de pie que calibrar. */
const FLOOR_EXERCISES: ReadonlySet<ExerciseId> = new Set<ExerciseId>(['pushup', 'bridge', 'plank']);

/**
 * Si la preparación debe esperar la calibración de pie (DEC-053) antes de arrancar la serie.
 * En los ejercicios de suelo no: quien ya está acostado nunca la completaría y la serie no
 * arrancaba sola (#39, DEC-071). La calibración sigue aprendiendo si la persona se para frente
 * a la cámara antes de bajar, y no aprende acostada (su tope de 35° lo impide).
 */
export function needsStandingCalibration(ex: ExerciseId): boolean {
  return !FLOOR_EXERCISES.has(ex);
}

/** Problema de cadera según la línea del cuerpo, o `null` si está recta (DEC-071). */
export function hipIssue(line: BodyLine): HipIssue | null {
  if (line.deviationDeg >= HIP_SAG_MIN_DEG) return 'hip_sag';
  if (line.deviationDeg <= -HIP_PIKE_MIN_DEG) return 'hip_pike';
  return null;
}

export const PUSHUP_3D: ExerciseDefinition3D = {
  id: 'pushup',
  name: 'Flexiones',
  sides: 'either',
  sideLandmarks: { left: armSideLandmarks('left'), right: armSideLandmarks('right') },
  extraLandmarks: [],
  sideAngle: elbowAngle,
  combine: 'mean',
  // Brazos extendidos > 140°, abajo < 100°. El 3D mide los brazos estirados en ~140–156°:
  // con 150° varias reps se fundían en un ciclo largo y se descartaban (DEC-066).
  cycle: { polarity: 'min', restDeg: 140, effortDeg: 100, confirmMarginDeg: CONFIRM_MARGIN_DEG },
  perSideCycles: false,
  cooldownMs: 0,
  shape: { effortIsMinimum: true, concentricFirst: false },
  quality: { minRomDegrees: 40, minDurationMs: 600, maxDurationMs: 10000, minSmoothness: 0.35 },
  formCheck(ctx: FormContext) {
    // Solo durante la flexión: arriba, entre repeticiones, la gente descansa con la cadera alta
    // y avisar ahí era ruido (25–36% de los cuadros en flexiones correctas). En el esfuerzo la
    // línea de una flexión correcta queda en ~−3°…+3° (DEC-071).
    if (ctx.phase !== 'effort') return null;
    const line = bodyLine(ctx.world);
    const issue = line && hipIssue(line);
    if (issue === 'hip_sag') return { code: 'hip_sag', level: 'bad', message: 'Aprieta el abdomen, la cadera se cae' };
    if (issue === 'hip_pike') return { code: 'hip_pike', level: 'warning', message: 'Baja la cadera, cuerpo en línea recta' };
    return null;
  },
  phaseFeedback(ctx: FormContext) {
    if (ctx.phase === 'rest') return { level: 'idle', message: 'Listo, baja el pecho' };
    if (ctx.peakReached) {
      return ctx.extremeDeg <= PUSHUP_GOOD_DEPTH_DEG
        ? { level: 'good', message: '¡Buena bajada! Empuja el suelo' }
        : { level: 'warning', message: 'Sube. En la próxima, baja más el pecho' };
    }
    return ctx.primaryAngle <= PUSHUP_GOOD_DEPTH_DEG
      ? { level: 'good', message: '¡Buena profundidad!' }
      : { level: 'warning', message: 'Baja más el pecho' };
  },
  notVisibleMessage: 'Ponte de perfil a la cámara, con el cuerpo completo a la vista',
  calibrateDuringSet: true,
};

export const LUNGE_3D: ExerciseDefinition3D = {
  id: 'lunge',
  name: 'Zancadas',
  sides: 'either',
  sideLandmarks: {
    left:  [SIDE.left.hip, SIDE.left.knee, SIDE.left.ankle],
    right: [SIDE.right.hip, SIDE.right.knee, SIDE.right.ankle],
  },
  extraLandmarks: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
  sideAngle: (w, s) => calculateAngle3D(w[SIDE[s].hip], w[SIDE[s].knee], w[SIDE[s].ankle]),
  // La rodilla que más se dobla es la de la pierna delantera.
  combine: 'min',
  // De pie > 135°, abajo < 110°. El 3D mide la rodilla delantera de pie entre ~131° y 170°
  // según la toma: con 160° casi ninguna zancada se cerraba (DEC-066).
  cycle: { polarity: 'min', restDeg: 135, effortDeg: 110, confirmMarginDeg: CONFIRM_MARGIN_DEG },
  perSideCycles: false,
  cooldownMs: 0,
  shape: { effortIsMinimum: true, concentricFirst: false },
  quality: { minRomDegrees: 40, minDurationMs: 800, maxDurationMs: 15000, minSmoothness: 0.35 },
  formCheck(ctx: FormContext) {
    if (ctx.phase === 'effort' && torsoLean(ctx.world) > LUNGE_MAX_TRUNK_LEAN_DEG) {
      return { code: 'trunk_lean', level: 'bad', message: 'Tronco erguido, no te inclines hacia adelante' };
    }
    return null;
  },
  phaseFeedback(ctx: FormContext) {
    if (ctx.phase === 'rest') return { level: 'idle', message: 'Listo, da el paso y baja' };
    if (ctx.peakReached) {
      return ctx.extremeDeg <= LUNGE_GOOD_DEPTH_DEG
        ? { level: 'good', message: '¡Buena profundidad! Sube con la pierna delantera' }
        : { level: 'warning', message: 'Sube. En la próxima, baja un poco más' };
    }
    return ctx.primaryAngle <= LUNGE_GOOD_DEPTH_DEG
      ? { level: 'good', message: '¡Buena profundidad!' }
      : { level: 'warning', message: 'Baja un poco más' };
  },
  notVisibleMessage: 'Asegúrate de que tus piernas sean visibles',
  calibrateDuringSet: true,
};

export const BRIDGE_3D: ExerciseDefinition3D = {
  id: 'bridge',
  name: 'Puente de glúteo',
  sides: 'either',
  sideLandmarks: {
    left:  [SIDE.left.shoulder, SIDE.left.hip, SIDE.left.knee],
    right: [SIDE.right.shoulder, SIDE.right.hip, SIDE.right.knee],
  },
  extraLandmarks: [],
  sideAngle: (w, s) => calculateAngle3D(w[SIDE[s].shoulder], w[SIDE[s].hip], w[SIDE[s].knee]),
  combine: 'mean',
  // Cadera en el suelo < 145°; el ciclo cuenta desde 158° para poder avisar de una
  // extensión incompleta (158–165°) en vez de ignorarla. El esfuerzo es el máximo.
  cycle: { polarity: 'max', restDeg: 145, effortDeg: 158, confirmMarginDeg: 6 },
  perSideCycles: false,
  cooldownMs: 0,
  shape: { effortIsMinimum: false, concentricFirst: true },
  quality: { minRomDegrees: 25, minDurationMs: 800, maxDurationMs: 15000, minSmoothness: 0.35 },
  formCheck() {
    return null;
  },
  phaseFeedback(ctx: FormContext) {
    if (ctx.phase === 'rest') return { level: 'idle', message: 'Listo, sube la cadera' };
    if (ctx.peakReached) {
      return ctx.extremeDeg >= BRIDGE_GOOD_EXTENSION_DEG
        ? { level: 'good', message: '¡Cadera arriba! Baja controlado' }
        : { level: 'warning', message: 'Baja. En la próxima, sube más la cadera' };
    }
    return ctx.primaryAngle >= BRIDGE_GOOD_EXTENSION_DEG
      ? { level: 'good', message: '¡Aprieta los glúteos arriba!' }
      : { level: 'warning', message: 'Sube más la cadera' };
  },
  notVisibleMessage: 'Acuéstate de perfil a la cámara, con hombros y rodillas a la vista',
  calibrateDuringSet: false,
};

export const DEFINITIONS_3D = {
  squat: SQUAT_3D, curl: CURL_3D, press: PRESS_3D,
  pushup: PUSHUP_3D, lunge: LUNGE_3D, bridge: BRIDGE_3D,
} as const;
export type Exercise3DId = keyof typeof DEFINITIONS_3D;
