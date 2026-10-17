import {
  ALL_EQUIPMENT, EXERCISE_CATALOG, canPerform,
  type CatalogExercise, type Difficulty, type EquipmentTag, type MovementPattern, type MuscleGroup,
} from './catalog.ts';

/**
 * Generador de rutinas personalizadas por reglas (ver DEC-056, issue #35).
 *
 * Función pura y determinista, sin LLM (cero costo, DEC-035): con las mismas respuestas del
 * cuestionario devuelve siempre la misma rutina, y se puede probar exhaustivamente.
 *
 * 1. El equipo disponible sale del lugar (gimnasio completo, casa sin equipo, casa con el
 *    equipo marcado) y filtra el catálogo.
 * 2. La división sale de los días y el nivel, salvo que el usuario elija otra.
 * 3. Cada día es una lista de huecos por patrón de movimiento; cada hueco se llena con el
 *    mejor ejercicio elegible, **prefiriendo los que tienen asistente por cámara**.
 * 4. Series, repeticiones y descanso salen del objetivo y el nivel.
 * 5. Métodos avanzados solo desde nivel intermedio.
 *
 * Las reglas de prescripción simplifican la literatura de fuerza y deben revisarse con un
 * entrenador; no son consejo médico.
 */

export type TrainingGoal = 'muscle_gain' | 'weight_loss' | 'strength_gain';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type TrainingLocation = 'gym_full' | 'home_none' | 'home_limited';
export type ProgramType = 'full_body' | 'upper_lower' | 'ppl';
export type TrainingMethod = 'normal' | 'rest_pause' | 'dropset' | 'superset';

/** Respuestas del cuestionario (libre, DEC-056). */
export interface Questionnaire {
  goal: TrainingGoal;
  level: ExperienceLevel;
  location: TrainingLocation;
  /** Equipo marcado en casa con equipo limitado; se ignora en los otros lugares. */
  equipment?: EquipmentTag[];
  /** 2–6. */
  daysPerWeek: number;
  /** Duración objetivo de la sesión, en minutos (30–90). */
  sessionMinutes: number;
  /** Si el usuario elige una división; si no, se sugiere con `suggestProgram`. */
  programType?: ProgramType;
}

export interface PlannedExercise {
  exerciseId: string;
  name: string;
  sets: number;
  /** Repeticiones objetivo (ejercicios por repeticiones). */
  reps?: number;
  /** Segundos por serie (plancha, cardio). */
  holdSeconds?: number;
  restSeconds: number;
  method: TrainingMethod;
  /** Ejercicios con el mismo número se hacen en superserie. */
  supersetGroup?: number;
  /** Tiene análisis por cámara: la insignia "con asistente". */
  withAssistant: boolean;
}

export interface PlannedDay {
  /** 0 = domingo … 6 = sábado (convención de fitnetv2). */
  weekday: number;
  label: string;
  exercises: PlannedExercise[];
}

export interface GeneratedRoutine {
  goal: TrainingGoal;
  level: ExperienceLevel;
  programType: ProgramType;
  /**
   * División pedida o sugerida que no era viable con el equipo disponible (p. ej. PPL en
   * casa sin equipo: no hay ningún ejercicio de tracción con peso corporal). La UI debe
   * explicar el cambio a cuerpo completo.
   */
  adjustedFrom?: ProgramType;
  /** Semanas del programa completo (premium). La semana 1 es libre. */
  weeks: number;
  days: PlannedDay[];
}

/** Semanas del programa completo. */
export const PROGRAM_WEEKS = 8;
/** Mínimo de ejercicios por día para que una división se considere viable. */
export const MIN_EXERCISES_PER_DAY = 3;

// ─────────────────────────── Equipo, división y días ───────────────────────────

export function availableEquipment(q: Pick<Questionnaire, 'location' | 'equipment'>): Set<EquipmentTag> {
  if (q.location === 'gym_full') return new Set(ALL_EQUIPMENT);
  if (q.location === 'home_none') return new Set<EquipmentTag>(['bodyweight']);
  return new Set<EquipmentTag>(['bodyweight', ...(q.equipment ?? [])]);
}

/** División sugerida: principiante cuerpo completo; intermedio torso/pierna o PPL; avanzado PPL. */
export function suggestProgram(level: ExperienceLevel, daysPerWeek: number): ProgramType {
  if (level === 'beginner' || daysPerWeek <= 2) return 'full_body';
  if (level === 'intermediate') return daysPerWeek === 4 ? 'upper_lower' : daysPerWeek >= 5 ? 'ppl' : 'full_body';
  return daysPerWeek >= 5 || daysPerWeek === 3 ? 'ppl' : 'upper_lower';
}

/** Días de la semana por defecto según cuántos: repartidos con descanso entre ellos. */
const WEEKDAYS: Record<number, number[]> = {
  2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6],
};

/** Ejercicios por sesión según la duración. */
function slotsForMinutes(minutes: number): number {
  if (minutes <= 30) return 4;
  if (minutes <= 45) return 5;
  if (minutes <= 60) return 6;
  if (minutes <= 75) return 7;
  return 8;
}

// ─────────────────────────── Plantillas de día ───────────────────────────

interface Slot {
  pattern: MovementPattern;
  muscle?: MuscleGroup;
}

const s = (pattern: MovementPattern, muscle?: MuscleGroup): Slot => ({ pattern, muscle });

/** Huecos por tipo de día, en orden de prioridad (los primeros entran siempre). */
const DAY_TEMPLATES: Record<string, { label: string; slots: Slot[] }> = {
  fullA: { label: 'Cuerpo completo A', slots: [
    s('knee_dominant'), s('horizontal_push'), s('horizontal_pull'), s('hip_hinge'),
    s('core'), s('vertical_push'), s('isolation_upper', 'biceps'), s('isolation_lower', 'pantorrillas'),
  ] },
  fullB: { label: 'Cuerpo completo B', slots: [
    s('hip_hinge'), s('vertical_pull'), s('knee_dominant'), s('horizontal_push'),
    s('core'), s('isolation_upper', 'triceps'), s('isolation_upper', 'hombros'), s('cardio'),
  ] },
  upper: { label: 'Torso', slots: [
    s('horizontal_push'), s('horizontal_pull'), s('vertical_push'), s('vertical_pull'),
    s('isolation_upper', 'biceps'), s('isolation_upper', 'triceps'), s('isolation_upper', 'hombros'), s('core'),
  ] },
  lower: { label: 'Pierna', slots: [
    s('knee_dominant'), s('hip_hinge'), s('knee_dominant'), s('isolation_lower', 'gluteos'),
    s('core'), s('isolation_lower', 'isquiotibiales'), s('isolation_lower', 'pantorrillas'), s('cardio'),
  ] },
  push: { label: 'Empuje', slots: [
    s('horizontal_push'), s('vertical_push'), s('horizontal_push'), s('isolation_upper', 'hombros'),
    s('isolation_upper', 'triceps'), s('core'), s('isolation_upper', 'pecho'), s('isolation_upper', 'triceps'),
  ] },
  pull: { label: 'Tracción', slots: [
    s('vertical_pull'), s('horizontal_pull'), s('horizontal_pull'), s('isolation_upper', 'biceps'),
    s('isolation_upper', 'espalda'), s('core'), s('isolation_upper', 'biceps'), s('isolation_upper', 'hombros'),
  ] },
  legs: { label: 'Pierna', slots: [
    s('knee_dominant'), s('hip_hinge'), s('knee_dominant'), s('isolation_lower', 'gluteos'),
    s('core'), s('isolation_lower', 'isquiotibiales'), s('isolation_lower', 'pantorrillas'), s('cardio'),
  ] },
};

const SPLITS: Record<ProgramType, string[]> = {
  full_body:   ['fullA', 'fullB'],
  upper_lower: ['upper', 'lower'],
  ppl:         ['push', 'pull', 'legs'],
};

/** Patrón alternativo cuando no hay ningún ejercicio elegible (p. ej. sin barra de dominadas). */
const FALLBACK: Partial<Record<MovementPattern, MovementPattern>> = {
  vertical_pull: 'horizontal_pull',
  horizontal_pull: 'vertical_pull',
  vertical_push: 'horizontal_push',
  horizontal_push: 'vertical_push',
};

const COMPOUND: ReadonlySet<MovementPattern> = new Set([
  'knee_dominant', 'hip_hinge', 'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull',
]);

// ─────────────────────────── Elección de ejercicios ───────────────────────────

const DIFFICULTY_SCORE: Record<ExperienceLevel, Record<Difficulty, number>> = {
  beginner:     { bajo: 10, medio: 5, alto: -100 },  // nada técnicamente difícil para empezar
  intermediate: { bajo: 5, medio: 10, alto: 3 },
  advanced:     { bajo: 3, medio: 8, alto: 10 },
};
/** Peso de tener asistente por cámara: domina a la dificultad (el diferenciador de MovexNet). */
const ASSISTANT_SCORE = 100;

function score(e: CatalogExercise, level: ExperienceLevel): number {
  return (e.assistant ? ASSISTANT_SCORE : 0) + DIFFICULTY_SCORE[level][e.baseDifficulty];
}

function pick(
  slot: Slot, pool: readonly CatalogExercise[], used: ReadonlySet<string>, level: ExperienceLevel, variant: number,
): CatalogExercise | null {
  const tryPattern = (pattern: MovementPattern) => {
    const candidates = pool
      .filter(e => e.pattern === pattern && !used.has(e.id) && (!slot.muscle || e.muscleGroup === slot.muscle))
      .filter(e => score(e, level) > 0)
      .sort((a, b) => score(b, level) - score(a, level) || a.id.localeCompare(b.id));
    if (candidates.length === 0) return null;
    // Entre los empatados en la mejor puntuación se rota por variante para variar los días.
    const best = candidates.filter(c => score(c, level) === score(candidates[0], level));
    return best[variant % best.length];
  };
  const fallback = FALLBACK[slot.pattern];
  return tryPattern(slot.pattern) ?? (fallback ? tryPattern(fallback) : null);
}

// ─────────────────────────── Prescripción ───────────────────────────

type Kind = 'compound' | 'isolation' | 'timed' | 'cardio';

function kindOf(e: CatalogExercise): Kind {
  if (e.pattern === 'cardio') return 'cardio';
  if (e.tracking === 'time') return 'timed';
  return COMPOUND.has(e.pattern) ? 'compound' : 'isolation';
}

const LEVEL_INDEX: Record<ExperienceLevel, 0 | 1 | 2> = { beginner: 0, intermediate: 1, advanced: 2 };

/** Series, reps o segundos y descanso por objetivo, nivel y tipo de ejercicio (DEC-056). */
function prescribe(goal: TrainingGoal, level: ExperienceLevel, kind: Kind): Omit<PlannedExercise, 'exerciseId' | 'name' | 'method' | 'withAssistant'> {
  const i = LEVEL_INDEX[level];
  if (kind === 'cardio') return { sets: 1, holdSeconds: [300, 480, 600][i], restSeconds: 0 };
  if (kind === 'timed')  return { sets: [2, 3, 3][i], holdSeconds: [20, 40, 60][i], restSeconds: 45 };
  switch (goal) {
    case 'strength_gain':
      return kind === 'compound'
        ? { sets: [3, 4, 5][i], reps: 5, restSeconds: 150 }
        : { sets: 3, reps: 8, restSeconds: 90 };
    case 'muscle_gain':
      return kind === 'compound'
        ? { sets: [3, 3, 4][i], reps: 10, restSeconds: 90 }
        : { sets: 3, reps: 12, restSeconds: 60 };
    case 'weight_loss':
      return { sets: [2, 3, 3][i], reps: 15, restSeconds: 40 };
  }
}

/** Aplica los métodos de entrenamiento permitidos al día (solo desde nivel intermedio). */
function applyMethods(day: PlannedExercise[], goal: TrainingGoal, level: ExperienceLevel, kinds: Kind[]): void {
  if (level === 'beginner') return;
  if (goal === 'muscle_gain') {
    // Método de intensidad en el último ejercicio de aislamiento del día.
    for (let k = day.length - 1; k >= 0; k--) {
      if (kinds[k] === 'isolation') {
        day[k].method = level === 'advanced' ? 'dropset' : 'rest_pause';
        break;
      }
    }
  } else if (goal === 'weight_loss') {
    // Superseries con pares consecutivos de ejercicios por repeticiones.
    let group = 1;
    for (let k = 0; k + 1 < day.length; k++) {
      const pairable = (n: number) => kinds[n] === 'compound' || kinds[n] === 'isolation';
      if (pairable(k) && pairable(k + 1)) {
        day[k].method = day[k + 1].method = 'superset';
        day[k].supersetGroup = day[k + 1].supersetGroup = group++;
        k++;
      }
    }
  }
}

// ─────────────────────────── Generación ───────────────────────────

export function generateRoutine(q: Questionnaire, catalog: readonly CatalogExercise[] = EXERCISE_CATALOG): GeneratedRoutine {
  const daysPerWeek = Math.min(6, Math.max(2, Math.round(q.daysPerWeek)));
  const requested = q.programType ?? suggestProgram(q.level, daysPerWeek);
  const pool = catalog.filter(e => canPerform(e, availableEquipment(q)));
  const slotsPerDay = slotsForMinutes(q.sessionMinutes);

  let days = buildDays(q, requested, daysPerWeek, pool, slotsPerDay);
  if (requested !== 'full_body' && days.some(d => d.exercises.length < MIN_EXERCISES_PER_DAY)) {
    // Con este equipo la división deja días casi vacíos: cuerpo completo sí es viable.
    days = buildDays(q, 'full_body', daysPerWeek, pool, slotsPerDay);
    return { goal: q.goal, level: q.level, programType: 'full_body', adjustedFrom: requested, weeks: PROGRAM_WEEKS, days };
  }
  return { goal: q.goal, level: q.level, programType: requested, weeks: PROGRAM_WEEKS, days };
}

function buildDays(
  q: Questionnaire, programType: ProgramType, daysPerWeek: number,
  pool: readonly CatalogExercise[], slotsPerDay: number,
): PlannedDay[] {
  const split = SPLITS[programType];
  return WEEKDAYS[daysPerWeek].map((weekday, d) => {
    const template = DAY_TEMPLATES[split[d % split.length]];
    const variant = Math.floor(d / split.length);
    const used = new Set<string>();
    const exercises: PlannedExercise[] = [];
    const kinds: Kind[] = [];

    for (const slot of template.slots) {
      if (exercises.length >= slotsPerDay) break;
      const e = pick(slot, pool, used, q.level, variant);
      if (!e) continue;
      used.add(e.id);
      const kind = kindOf(e);
      kinds.push(kind);
      exercises.push({
        exerciseId: e.id,
        name: e.name,
        ...prescribe(q.goal, q.level, kind),
        method: 'normal',
        withAssistant: e.assistant !== undefined,
      });
    }
    applyMethods(exercises, q.goal, q.level, kinds);
    // Segunda vuelta de la división en la semana: "Empuje (2)".
    const label = variant > 0 ? `${template.label} (${variant + 1})` : template.label;
    return { weekday, label, exercises };
  });
}

// ─────────────────────────── Progresión y acceso ───────────────────────────

/** Tope de repeticiones por objetivo al progresar. */
const MAX_REPS: Record<TrainingGoal, number> = { strength_gain: 6, muscle_gain: 12, weight_loss: 20 };

/**
 * Plan de una semana concreta (0 = semana 1). Progresión simple: +1 repetición cada dos
 * semanas hasta el tope del objetivo (+5 s en los ejercicios por tiempo), y una semana de
 * descarga cada cuatro (una serie menos).
 */
export function weekPlan(routine: GeneratedRoutine, week: number): PlannedDay[] {
  const deload = (week + 1) % 4 === 0;
  const step = Math.floor(week / 2);
  return routine.days.map(day => ({
    ...day,
    exercises: day.exercises.map(e => {
      const sets = deload ? Math.max(1, e.sets - 1) : e.sets;
      if (e.reps !== undefined) {
        return { ...e, sets, reps: Math.min(MAX_REPS[routine.goal], e.reps + (deload ? 0 : step)) };
      }
      if (e.holdSeconds !== undefined && e.restSeconds > 0) {
        return { ...e, sets, holdSeconds: e.holdSeconds + (deload ? 0 : step * 5) };
      }
      return { ...e, sets };
    }),
  }));
}

/**
 * Semanas accesibles según la suscripción (DEC-056): la semana 1 es libre; el programa
 * completo, premium. La autoridad real es el backend (RLS, `is_premium`); esto es la UI.
 */
export function accessibleWeeks(routine: GeneratedRoutine, isPremium: boolean): number {
  return isPremium ? routine.weeks : 1;
}
