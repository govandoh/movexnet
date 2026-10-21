import {
  LM, areVisible, asymmetryRatio, getBodyOrientation,
  type BodyOrientation, type Landmark3D,
} from '../geometry/vectors3d.ts';
import { CycleDetector, type CycleConfig, type CyclePhase } from '../analysis/cycleDetector.ts';
import {
  MovementAnalyzer, type CycleShape, type QualityThresholds, type RejectionReason, type RepMetrics,
} from '../analysis/movementQuality.ts';
import { FatigueDetector, FRESH_FATIGUE, type FatigueState } from '../analysis/fatigue.ts';
import { FATIGUE_MESSAGES, REJECTION_MESSAGES } from '../analysis/messages.ts';
import type { FeedbackLevel } from '../contracts/index.ts';

/**
 * Contador de repeticiones 3D configurable por ejercicio (ver DEC-057, paso I-2 de DEC-054).
 *
 * Porta los trackers 3D de fitnetv2 (`squat.ts`, `bicepCurl.ts`, `shoulderPress.ts`,
 * commit d456e95) a un único motor, porque los tres repetían el mismo esquema:
 * visibilidad → ángulo primario → ciclo con histéresis → validación temporal → fatiga →
 * feedback. Añadir un ejercicio (olas de DEC-056) pasa a ser escribir un
 * `ExerciseDefinition3D`, no un tracker nuevo.
 *
 * Corrige al portar los defectos detectados en fitnetv2 (DEC-054):
 * - pico confirmado por margen en grados, no por frames (`CycleDetector`);
 * - cooldown entre brazos en ms, no en frames;
 * - la fatiga recibe la asimetría del punto de esfuerzo, no la del frame de cierre;
 * - las comprobaciones de forma declaran en qué fase aplican y qué landmarks exigen.
 *
 * Módulo puro: recibe `worldLandmarks` ya suavizados y nivelados (ver `framePipeline.ts`)
 * y el `t` de cada frame.
 */

export type { FeedbackLevel };
export type Side = 'left' | 'right';

/** Contexto que reciben las comprobaciones de forma y el feedback de cada ejercicio. */
export interface FormContext {
  world: readonly Landmark3D[];
  phase: CyclePhase;
  primaryAngle: number;
  /** Extremo del ciclo en curso (mínimo o máximo según la polaridad). */
  extremeDeg: number;
  /** true cuando el extremo del ciclo en curso ya se confirmó. */
  peakReached: boolean;
  asymmetry: number;
  fatigue: FatigueState;
}

export interface FormIssue {
  /** Código de `METRICS.md` §5.2 (p. ej. `trunk_lean`). */
  code: string;
  level: 'warning' | 'bad';
  message: string;
}

export interface Feedback {
  level: FeedbackLevel;
  message: string;
}

export interface ExerciseDefinition3D {
  id: string;
  name: string;
  /**
   * `both`: ambos lados deben verse y el ángulo primario los combina (sentadilla).
   * `either`: basta un lado; si la visibilidad difiere mucho (vista lateral) se usa el
   * más visible (curl, press).
   */
  sides: 'both' | 'either';
  /** Landmarks que deben verse en cada lado para medir su ángulo. */
  sideLandmarks: Record<Side, readonly number[]>;
  /** Landmarks exigidos además de los del lado (p. ej. hombros para la orientación). */
  extraLandmarks: readonly number[];
  sideAngle(world: readonly Landmark3D[], side: Side): number;
  /** Cómo se combinan los lados en el ángulo primario. */
  combine: 'mean' | 'min' | 'max';
  cycle: CycleConfig;
  /**
   * true: un detector de ciclo por lado, y cualquiera que complete cuenta (con cooldown),
   * para contar curls alternos. false: un solo detector sobre el ángulo combinado.
   */
  perSideCycles: boolean;
  /** Bloqueo tras contar, en ms: absorbe el segundo brazo en movimientos bilaterales (DEC-022). */
  cooldownMs: number;
  shape: CycleShape;
  quality: Partial<QualityThresholds>;
  /** Primera comprobación de forma que falla, en orden de prioridad (seguridad primero). */
  formCheck(ctx: FormContext): FormIssue | null;
  /**
   * Tiempo mínimo, en ms, que un problema de forma debe repetirse en frames seguidos antes
   * de avisar, por código. Filtra los saltos de un instante del 3D (DEC-075). Sin entrada,
   * el aviso sale en el primer frame.
   */
  issueHoldMs?: Partial<Record<string, number>>;
  /** Feedback de técnica cuando no hay problema de forma. */
  phaseFeedback(ctx: FormContext): Feedback;
  notVisibleMessage: string;
  /**
   * Si la calibración de pie puede seguir aprendiendo con la serie ya empezada. En el
   * press no: absorbería un arqueo moderado (DEC-053).
   */
  calibrateDuringSet: boolean;
}

export interface Tracker3DResult {
  exerciseId: string;
  reps: number;
  visible: boolean;
  phase: CyclePhase;
  primaryAngle: number;
  extremeDeg: number;
  /** true solo en el frame en que se confirma el pico o fondo. */
  peak: boolean;
  /** true solo en el frame en que se cuenta una repetición. */
  repCounted: boolean;
  /** Motivo por el que se descartó un ciclo en este frame, o `null`. */
  rejection: RejectionReason | null;
  rejectionMessage: string | null;
  feedbackLevel: FeedbackLevel;
  feedbackMessage: string;
  /** Código del problema de forma activo, o `null`. */
  formIssue: string | null;
  orientation: BodyOrientation;
  fatigue: FatigueState;
  lastRepMetrics: RepMetrics | null;
  /** Velocidad angular reciente, en °/s. */
  velocity: number;
  asymmetry: number;
  /** Lados usados en este frame. */
  activeSides: Side[];
  /** Pose en el extremo del ciclo, emitida junto con `peak` (frame clave para el k-NN, DEC-055). */
  keyFrame: Landmark3D[] | null;
}

const MIN_VISIBILITY = 0.5;
/** Diferencia de visibilidad entre lados a partir de la cual se asume vista lateral. */
const LATERAL_VISIBILITY_DIFF = 0.35;

export class Tracker3D {
  readonly def: ExerciseDefinition3D;
  private reps = 0;
  private lastRepMetrics: RepMetrics | null = null;
  private cooldownUntilMs = -Infinity;
  private readonly combined: CycleDetector;
  private readonly perSide: Record<Side, CycleDetector>;
  private prevPhase: CyclePhase = 'rest';
  private readonly analyzer: MovementAnalyzer;
  private readonly fatigue = new FatigueDetector();
  /** Asimetría en el punto de esfuerzo del ciclo en curso (la que se pasa a la fatiga). */
  private effortAsymmetry = 0;
  private extreme = { angle: NaN, world: null as Landmark3D[] | null };
  /** Problema de forma que se está repitiendo y desde cuándo (ms), para `issueHoldMs`. */
  private pendingIssue: { code: string; sinceMs: number } | null = null;

  constructor(def: ExerciseDefinition3D) {
    this.def = def;
    this.combined = new CycleDetector(def.cycle);
    this.perSide = { left: new CycleDetector(def.cycle), right: new CycleDetector(def.cycle) };
    this.analyzer = new MovementAnalyzer(def.quality);
  }

  get repCount(): number {
    return this.reps;
  }

  get phase(): CyclePhase {
    return this.prevPhase;
  }

  update(world: Landmark3D[], timeMs: number): Tracker3DResult {
    const def = this.def;
    const orientation = world.length > LM.RIGHT_SHOULDER
      ? getBodyOrientation(world[LM.LEFT_SHOULDER], world[LM.RIGHT_SHOULDER]).orientation
      : 'frontal';

    const sides = this.visibleSides(world);
    if (sides.length === 0) {
      this.pendingIssue = null;
      return this.idle(orientation);
    }

    const angles: Partial<Record<Side, number>> = {};
    for (const s of sides) angles[s] = def.sideAngle(world, s);
    const values = sides.map(s => angles[s]!);
    const primaryAngle = def.combine === 'mean'
      ? values.reduce((a, v) => a + v, 0) / values.length
      : def.combine === 'min' ? Math.min(...values) : Math.max(...values);
    const asymmetry = sides.length === 2 ? asymmetryRatio(angles.left!, angles.right!) : 0;

    this.analyzer.addSample(primaryAngle, timeMs);

    // ── Ciclo: un detector combinado o uno por lado ──
    let phase: CyclePhase;
    let peak = false;
    let completed = false;
    let extremeDeg: number;
    if (def.perSideCycles) {
      let anyEffort = false;
      for (const s of sides) {
        const u = this.perSide[s].update(angles[s]!);
        anyEffort ||= u.phase === 'effort';
        peak ||= u.peakConfirmed;
        completed ||= u.cycleCompleted;
      }
      phase = anyEffort ? 'effort' : 'rest';
      extremeDeg = this.trackExtreme(phase, primaryAngle, world);
    } else {
      const u = this.combined.update(primaryAngle);
      phase = u.phase;
      peak = u.peakConfirmed;
      completed = u.cycleCompleted;
      extremeDeg = this.trackExtreme(phase, primaryAngle, world);
    }
    if (peak) this.effortAsymmetry = asymmetry;
    const keyFrame = peak ? this.extreme.world : null;

    // ── Cierre: validación temporal y cooldown ──
    let rejection: RejectionReason | null = null;
    let repCounted = false;
    if (completed && timeMs >= this.cooldownUntilMs) {
      const v = this.analyzer.validateRep(def.shape);
      if (v.valid) {
        this.reps++;
        repCounted = true;
        this.lastRepMetrics = v.metrics;
        this.fatigue.addRep(v.metrics, this.effortAsymmetry);
      } else {
        rejection = v.reason ?? null;
      }
      // También tras un rechazo: evita que el segundo brazo reintente el mismo ciclo.
      this.cooldownUntilMs = timeMs + def.cooldownMs;
    }

    // Con todo de vuelta al reposo se cierra la ventana del analizador. Se marca después
    // de validar para no vaciar la ventana recién evaluada.
    if (this.prevPhase === 'effort' && phase === 'rest') {
      this.analyzer.markCycleBoundary();
      this.extreme = { angle: NaN, world: null };
    }
    this.prevPhase = phase;

    const fatigue = this.fatigue.getState();
    const ctx: FormContext = {
      world, phase, primaryAngle, extremeDeg,
      peakReached: def.perSideCycles
        ? sides.some(s => this.perSide[s].peakReached)
        : this.combined.peakReached,
      asymmetry, fatigue,
    };
    const issue = this.heldIssue(def.formCheck(ctx), timeMs);
    const feedback = this.feedback(ctx, issue);

    return {
      exerciseId: def.id,
      reps: this.reps,
      visible: true,
      phase,
      primaryAngle,
      extremeDeg,
      peak,
      repCounted,
      rejection,
      rejectionMessage: rejection ? REJECTION_MESSAGES[rejection] : null,
      feedbackLevel: feedback.level,
      feedbackMessage: feedback.message,
      formIssue: issue?.code ?? null,
      orientation,
      fatigue,
      lastRepMetrics: this.lastRepMetrics,
      velocity: this.analyzer.currentVelocity(),
      asymmetry,
      activeSides: sides,
      keyFrame,
    };
  }

  /** Reinicia todo, incluido el conteo (cambio de ejercicio). */
  reset(): void {
    this.reps = 0;
    this.lastRepMetrics = null;
    this.cooldownUntilMs = -Infinity;
    this.combined.reset();
    this.perSide.left.reset();
    this.perSide.right.reset();
    this.prevPhase = 'rest';
    this.analyzer.reset();
    this.fatigue.reset();
    this.effortAsymmetry = 0;
    this.extreme = { angle: NaN, world: null };
    this.pendingIssue = null;
  }

  /** Cierra la serie sin borrar el conteo: reinicia la línea base de fatiga. */
  startNewSet(): void {
    this.fatigue.reset();
    this.analyzer.reset();
  }

  /**
   * Aplica `issueHoldMs`: un problema con tiempo de espera solo se informa cuando lleva ese
   * tiempo repitiéndose sin interrupción. Cualquier frame sin él, o con otro, reinicia la cuenta.
   */
  private heldIssue(issue: FormIssue | null, timeMs: number): FormIssue | null {
    if (!issue) {
      this.pendingIssue = null;
      return null;
    }
    const holdMs = this.def.issueHoldMs?.[issue.code] ?? 0;
    if (this.pendingIssue?.code !== issue.code) this.pendingIssue = { code: issue.code, sinceMs: timeMs };
    return timeMs - this.pendingIssue.sinceMs >= holdMs ? issue : null;
  }

  private visibleSides(world: readonly Landmark3D[]): Side[] {
    const def = this.def;
    if (!areVisible(world, def.extraLandmarks, MIN_VISIBILITY)) return [];
    const vis = (s: Side) => Math.min(...def.sideLandmarks[s].map(i => world[i]?.visibility ?? 0));
    const left = vis('left');
    const right = vis('right');

    if (def.sides === 'both') {
      return left >= MIN_VISIBILITY && right >= MIN_VISIBILITY ? ['left', 'right'] : [];
    }
    const lateral = Math.abs(left - right) > LATERAL_VISIBILITY_DIFF;
    const out: Side[] = [];
    if (left >= MIN_VISIBILITY && (!lateral || left >= right)) out.push('left');
    if (right >= MIN_VISIBILITY && (!lateral || right > left)) out.push('right');
    return out;
  }

  /** Extremo del ciclo agregado y la pose en ese instante (frame clave). */
  private trackExtreme(phase: CyclePhase, angle: number, world: Landmark3D[]): number {
    if (phase !== 'effort') return Number.isNaN(this.extreme.angle) ? angle : this.extreme.angle;
    const isMin = this.def.cycle.polarity === 'min';
    if (Number.isNaN(this.extreme.angle) || (isMin ? angle < this.extreme.angle : angle > this.extreme.angle)) {
      this.extreme = { angle, world };
    }
    return this.extreme.angle;
  }

  private feedback(ctx: FormContext, issue: FormIssue | null): Feedback {
    if (ctx.fatigue.shouldRest) return { level: 'bad', message: FATIGUE_MESSAGES[ctx.fatigue.level] };
    if (issue) return { level: issue.level, message: issue.message };
    if (ctx.phase === 'rest' && ctx.fatigue.level === 'high') {
      return { level: 'warning', message: FATIGUE_MESSAGES.high };
    }
    return this.def.phaseFeedback(ctx);
  }

  private idle(orientation: BodyOrientation): Tracker3DResult {
    return {
      exerciseId: this.def.id,
      reps: this.reps,
      visible: false,
      phase: this.prevPhase,
      primaryAngle: 0,
      extremeDeg: 0,
      peak: false,
      repCounted: false,
      rejection: null,
      rejectionMessage: null,
      feedbackLevel: 'idle',
      feedbackMessage: this.def.notVisibleMessage,
      formIssue: null,
      orientation,
      fatigue: this.reps > 0 ? this.fatigue.getState() : FRESH_FATIGUE,
      lastRepMetrics: this.lastRepMetrics,
      velocity: 0,
      asymmetry: 0,
      activeSides: [],
      keyFrame: null,
    };
  }
}
