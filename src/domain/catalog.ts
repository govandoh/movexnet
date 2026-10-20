/**
 * Catálogo de ejercicios (DEC-040, ampliado por DEC-056).
 *
 * Portado de fitnetv2 (`src/exercises/catalog.ts`, commit d456e95): los 60 ejercicios,
 * sus grupos musculares, dificultad, modo de registro y consejos. Cambios de DEC-056:
 *
 * - `equipment` pasa de texto libre a **opciones de etiquetas**: cada opción es un conjunto
 *   de etiquetas que basta para hacer el ejercicio ("Mancuernas o barra" = dos opciones).
 *   El texto original queda en `equipmentLabel` para mostrarlo.
 * - `pattern`: patrón de movimiento, con el que el generador llena cada día.
 * - `assistant`: id del contador 3D cuando el ejercicio tiene análisis por cámara; es lo que
 *   marca la insignia "con asistente". `tracking` conserva el modo de registro de fitnetv2
 *   (`reps`/`time` es el respaldo manual). La ola 1 usa el motor 3D sin flag (DEC-059):
 *   flexiones, zancadas y puente pasaron a `camera` tras validarse en celular con personas
 *   (#39, DEC-066, DEC-071). La plancha sigue en `time`, porque el generador de rutinas y la
 *   sesión la recetan en segundos con ese valor.
 *
 * El lugar (gimnasio o casa) no se guarda por ejercicio: se deriva del equipo disponible.
 * Sin colores ni otros datos de UI (esos viven en `src/ui`). Módulo puro.
 */

import type { ExerciseId } from '../contracts/index.ts';

export type MuscleGroup =
  | 'pecho' | 'espalda' | 'hombros' | 'biceps' | 'triceps'
  | 'cuadriceps' | 'isquiotibiales' | 'gluteos' | 'pantorrillas'
  | 'core' | 'cardio';

export type Difficulty = 'bajo' | 'medio' | 'alto';

/** `camera` = análisis en vivo; `reps` = conteo manual; `time` = temporizador. */
export type TrackingMode = 'camera' | 'reps' | 'time';

/**
 * Etiquetas de equipo (DEC-056). Las tres últimas (`dip_bars`, `ab_wheel`, `jump_rope`) se
 * añadieron al portar el catálogo para no forzar accesorios pequeños dentro de `machine`.
 */
export type EquipmentTag =
  | 'bodyweight' | 'dumbbell' | 'barbell' | 'bench' | 'band' | 'pullup_bar'
  | 'kettlebell' | 'machine' | 'cable' | 'cardio_machine'
  | 'dip_bars' | 'ab_wheel' | 'jump_rope';

export const ALL_EQUIPMENT: readonly EquipmentTag[] = [
  'bodyweight', 'dumbbell', 'barbell', 'bench', 'band', 'pullup_bar',
  'kettlebell', 'machine', 'cable', 'cardio_machine', 'dip_bars', 'ab_wheel', 'jump_rope',
];

export type MovementPattern =
  | 'knee_dominant' | 'hip_hinge'
  | 'horizontal_push' | 'vertical_push' | 'horizontal_pull' | 'vertical_pull'
  | 'isolation_upper' | 'isolation_lower' | 'core' | 'cardio';

/** Contador asociado; la lista la define el contrato de los contadores (DEC-063). */
export type AssistantId = ExerciseId;

export interface CatalogExercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  secondary: MuscleGroup[];
  /** Dificultad técnica intrínseca del movimiento. */
  baseDifficulty: Difficulty;
  tracking: TrackingMode;
  /** Presente cuando el ejercicio tiene análisis por cámara. */
  assistant?: AssistantId;
  pattern: MovementPattern;
  /** Opciones de equipo: basta con tener todas las etiquetas de UNA opción. */
  equipment: EquipmentTag[][];
  equipmentLabel: string;
  cues: string;
}

export const EXERCISE_CATALOG: readonly CatalogExercise[] = [
  // ── pecho ──
  { id: 'press-banca', name: 'Press de banca', muscleGroup: 'pecho', secondary: ['triceps', 'hombros'], baseDifficulty: 'medio', tracking: 'reps', pattern: 'horizontal_push', equipment: [['barbell', 'bench']], equipmentLabel: 'Barra y banco', cues: 'Escápulas retraídas, pies firmes en el suelo.' },
  { id: 'press-banca-mancuernas', name: 'Press con mancuernas', muscleGroup: 'pecho', secondary: ['triceps', 'hombros'], baseDifficulty: 'medio', tracking: 'reps', pattern: 'horizontal_push', equipment: [['dumbbell', 'bench']], equipmentLabel: 'Mancuernas y banco', cues: 'Baja hasta que los codos queden a la altura del torso.' },
  { id: 'press-inclinado', name: 'Press inclinado', muscleGroup: 'pecho', secondary: ['hombros', 'triceps'], baseDifficulty: 'medio', tracking: 'reps', pattern: 'horizontal_push', equipment: [['barbell', 'bench'], ['dumbbell', 'bench']], equipmentLabel: 'Banco inclinado', cues: 'Inclinación de 30 a 45 grados, ni más.' },
  { id: 'aperturas', name: 'Aperturas con mancuernas', muscleGroup: 'pecho', secondary: [], baseDifficulty: 'medio', tracking: 'reps', pattern: 'isolation_upper', equipment: [['dumbbell', 'bench']], equipmentLabel: 'Mancuernas y banco', cues: 'Codos con una flexión leve y fija durante todo el recorrido.' },
  { id: 'cruce-poleas', name: 'Cruce de poleas', muscleGroup: 'pecho', secondary: [], baseDifficulty: 'medio', tracking: 'reps', pattern: 'isolation_upper', equipment: [['cable']], equipmentLabel: 'Poleas', cues: 'Junta las manos por delante del esternón y sostén un instante.' },
  { id: 'flexiones', name: 'Flexiones de brazos', muscleGroup: 'pecho', secondary: ['triceps', 'core'], baseDifficulty: 'bajo', tracking: 'camera', assistant: 'pushup', pattern: 'horizontal_push', equipment: [['bodyweight']], equipmentLabel: 'Peso corporal', cues: 'Cuerpo en línea recta de la cabeza a los talones.' },
  { id: 'flexiones-inclinadas', name: 'Flexiones inclinadas', muscleGroup: 'pecho', secondary: ['triceps'], baseDifficulty: 'bajo', tracking: 'reps', pattern: 'horizontal_push', equipment: [['bench']], equipmentLabel: 'Banco o cajón', cues: 'Cuanto más alto el apoyo, menos carga.' },
  { id: 'fondos-paralelas', name: 'Fondos en paralelas', muscleGroup: 'pecho', secondary: ['triceps', 'hombros'], baseDifficulty: 'alto', tracking: 'reps', pattern: 'horizontal_push', equipment: [['dip_bars']], equipmentLabel: 'Paralelas', cues: 'Inclinar el torso adelante carga más el pecho.' },
  // ── espalda ──
  { id: 'dominadas', name: 'Dominadas', muscleGroup: 'espalda', secondary: ['biceps'], baseDifficulty: 'alto', tracking: 'reps', pattern: 'vertical_pull', equipment: [['pullup_bar']], equipmentLabel: 'Barra fija', cues: 'Sube llevando los codos hacia las costillas, no con los brazos.' },
  { id: 'jalon-pecho', name: 'Jalón al pecho', muscleGroup: 'espalda', secondary: ['biceps'], baseDifficulty: 'bajo', tracking: 'reps', pattern: 'vertical_pull', equipment: [['cable']], equipmentLabel: 'Polea alta', cues: 'Lleva la barra al pecho, nunca detrás de la nuca.' },
  { id: 'remo-barra', name: 'Remo con barra', muscleGroup: 'espalda', secondary: ['biceps', 'isquiotibiales'], baseDifficulty: 'alto', tracking: 'reps', pattern: 'horizontal_pull', equipment: [['barbell']], equipmentLabel: 'Barra', cues: 'Espalda neutra, torso a unos 45 grados.' },
  { id: 'remo-mancuerna', name: 'Remo con mancuerna', muscleGroup: 'espalda', secondary: ['biceps'], baseDifficulty: 'medio', tracking: 'reps', pattern: 'horizontal_pull', equipment: [['dumbbell']], equipmentLabel: 'Mancuerna y banco', cues: 'Un lado a la vez, sin rotar la cadera.' },
  { id: 'remo-polea', name: 'Remo en polea baja', muscleGroup: 'espalda', secondary: ['biceps'], baseDifficulty: 'bajo', tracking: 'reps', pattern: 'horizontal_pull', equipment: [['cable']], equipmentLabel: 'Polea baja', cues: 'Pecho afuera, junta las escápulas al final.' },
  { id: 'peso-muerto', name: 'Peso muerto', muscleGroup: 'espalda', secondary: ['isquiotibiales', 'gluteos'], baseDifficulty: 'alto', tracking: 'reps', pattern: 'hip_hinge', equipment: [['barbell']], equipmentLabel: 'Barra', cues: 'La barra pegada al cuerpo todo el recorrido.' },
  { id: 'pullover', name: 'Pullover', muscleGroup: 'espalda', secondary: ['pecho'], baseDifficulty: 'medio', tracking: 'reps', pattern: 'isolation_upper', equipment: [['dumbbell', 'bench']], equipmentLabel: 'Mancuerna y banco', cues: 'Controla el estiramiento, no fuerces el hombro.' },
  { id: 'face-pull', name: 'Face pull', muscleGroup: 'espalda', secondary: ['hombros'], baseDifficulty: 'bajo', tracking: 'reps', pattern: 'isolation_upper', equipment: [['cable'], ['band']], equipmentLabel: 'Polea con cuerda', cues: 'Lleva la cuerda a la frente separando las manos.' },
  // ── hombros ──
  { id: 'press-hombro', name: 'Press de hombro', muscleGroup: 'hombros', secondary: ['triceps'], baseDifficulty: 'medio', tracking: 'camera', assistant: 'press', pattern: 'vertical_push', equipment: [['dumbbell'], ['barbell']], equipmentLabel: 'Mancuernas o barra', cues: 'Abdomen apretado, sin arquear la espalda.' },
  { id: 'elevaciones-laterales', name: 'Elevaciones laterales', muscleGroup: 'hombros', secondary: [], baseDifficulty: 'bajo', tracking: 'reps', pattern: 'isolation_upper', equipment: [['dumbbell'], ['band']], equipmentLabel: 'Mancuernas', cues: 'Sube hasta la altura del hombro, no más.' },
  { id: 'elevaciones-frontales', name: 'Elevaciones frontales', muscleGroup: 'hombros', secondary: [], baseDifficulty: 'bajo', tracking: 'reps', pattern: 'isolation_upper', equipment: [['dumbbell']], equipmentLabel: 'Mancuernas o disco', cues: 'Sin balanceo de cadera.' },
  { id: 'pajaros', name: 'Pájaros (deltoides posterior)', muscleGroup: 'hombros', secondary: ['espalda'], baseDifficulty: 'medio', tracking: 'reps', pattern: 'isolation_upper', equipment: [['dumbbell']], equipmentLabel: 'Mancuernas', cues: 'Torso paralelo al suelo, codos apenas flexionados.' },
  { id: 'press-arnold', name: 'Press Arnold', muscleGroup: 'hombros', secondary: ['triceps'], baseDifficulty: 'alto', tracking: 'reps', pattern: 'vertical_push', equipment: [['dumbbell']], equipmentLabel: 'Mancuernas', cues: 'Rota las muñecas durante la subida.' },
  { id: 'encogimientos', name: 'Encogimientos de trapecio', muscleGroup: 'hombros', secondary: [], baseDifficulty: 'bajo', tracking: 'reps', pattern: 'isolation_upper', equipment: [['dumbbell'], ['barbell']], equipmentLabel: 'Mancuernas o barra', cues: 'Sube los hombros en línea recta, sin rotarlos.' },
  // ── biceps ──
  { id: 'curl-biceps', name: 'Curl de bíceps', muscleGroup: 'biceps', secondary: [], baseDifficulty: 'bajo', tracking: 'camera', assistant: 'curl', pattern: 'isolation_upper', equipment: [['dumbbell'], ['barbell'], ['band']], equipmentLabel: 'Mancuernas o barra', cues: 'Codos pegados al cuerpo, sin impulso.' },
  { id: 'curl-martillo', name: 'Curl martillo', muscleGroup: 'biceps', secondary: [], baseDifficulty: 'bajo', tracking: 'reps', pattern: 'isolation_upper', equipment: [['dumbbell']], equipmentLabel: 'Mancuernas', cues: 'Palmas enfrentadas durante todo el recorrido.' },
  { id: 'curl-predicador', name: 'Curl predicador', muscleGroup: 'biceps', secondary: [], baseDifficulty: 'medio', tracking: 'reps', pattern: 'isolation_upper', equipment: [['machine']], equipmentLabel: 'Banco Scott', cues: 'No extiendas del todo el codo en el punto bajo.' },
  { id: 'curl-concentrado', name: 'Curl concentrado', muscleGroup: 'biceps', secondary: [], baseDifficulty: 'bajo', tracking: 'reps', pattern: 'isolation_upper', equipment: [['dumbbell']], equipmentLabel: 'Mancuerna', cues: 'Codo apoyado en el muslo, movimiento lento.' },
  { id: 'curl-polea', name: 'Curl en polea', muscleGroup: 'biceps', secondary: [], baseDifficulty: 'bajo', tracking: 'reps', pattern: 'isolation_upper', equipment: [['cable']], equipmentLabel: 'Polea baja', cues: 'Tensión constante, sin soltar en el punto bajo.' },
  // ── triceps ──
  { id: 'extension-polea', name: 'Extensión en polea', muscleGroup: 'triceps', secondary: [], baseDifficulty: 'bajo', tracking: 'reps', pattern: 'isolation_upper', equipment: [['cable'], ['band']], equipmentLabel: 'Polea alta', cues: 'Codos fijos a los costados.' },
  { id: 'press-frances', name: 'Press francés', muscleGroup: 'triceps', secondary: [], baseDifficulty: 'medio', tracking: 'reps', pattern: 'isolation_upper', equipment: [['barbell', 'bench']], equipmentLabel: 'Barra Z y banco', cues: 'Baja la barra hacia la frente con codos quietos.' },
  { id: 'fondos-banco', name: 'Fondos en banco', muscleGroup: 'triceps', secondary: ['hombros'], baseDifficulty: 'bajo', tracking: 'reps', pattern: 'isolation_upper', equipment: [['bench']], equipmentLabel: 'Banco', cues: 'No bajes más allá de 90 grados de codo.' },
  { id: 'patada-triceps', name: 'Patada de tríceps', muscleGroup: 'triceps', secondary: [], baseDifficulty: 'bajo', tracking: 'reps', pattern: 'isolation_upper', equipment: [['dumbbell']], equipmentLabel: 'Mancuerna', cues: 'Extiende completo y sostén un instante arriba.' },
  { id: 'extension-sobre-cabeza', name: 'Extensión sobre la cabeza', muscleGroup: 'triceps', secondary: [], baseDifficulty: 'medio', tracking: 'reps', pattern: 'isolation_upper', equipment: [['dumbbell']], equipmentLabel: 'Mancuerna', cues: 'Codos apuntando al frente, no abiertos.' },
  // ── cuadriceps ──
  { id: 'sentadilla', name: 'Sentadillas', muscleGroup: 'cuadriceps', secondary: ['gluteos', 'core'], baseDifficulty: 'medio', tracking: 'camera', assistant: 'squat', pattern: 'knee_dominant', equipment: [['bodyweight'], ['barbell']], equipmentLabel: 'Peso corporal o barra', cues: 'Rodillas en línea con los pies, pecho arriba.' },
  { id: 'sentadilla-frontal', name: 'Sentadilla frontal', muscleGroup: 'cuadriceps', secondary: ['core'], baseDifficulty: 'alto', tracking: 'reps', pattern: 'knee_dominant', equipment: [['barbell']], equipmentLabel: 'Barra', cues: 'Codos altos para sostener la barra.' },
  { id: 'prensa', name: 'Prensa de piernas', muscleGroup: 'cuadriceps', secondary: ['gluteos'], baseDifficulty: 'bajo', tracking: 'reps', pattern: 'knee_dominant', equipment: [['machine']], equipmentLabel: 'Máquina de prensa', cues: 'No bloquees las rodillas al extender.' },
  { id: 'extension-cuadriceps', name: 'Extensión de cuádriceps', muscleGroup: 'cuadriceps', secondary: [], baseDifficulty: 'bajo', tracking: 'reps', pattern: 'isolation_lower', equipment: [['machine']], equipmentLabel: 'Máquina', cues: 'Movimiento controlado, sin impulso.' },
  { id: 'zancadas', name: 'Zancadas', muscleGroup: 'cuadriceps', secondary: ['gluteos'], baseDifficulty: 'medio', tracking: 'camera', assistant: 'lunge', pattern: 'knee_dominant', equipment: [['bodyweight'], ['dumbbell']], equipmentLabel: 'Peso corporal o mancuernas', cues: 'La rodilla de atrás casi toca el suelo.' },
  { id: 'sentadilla-bulgara', name: 'Sentadilla búlgara', muscleGroup: 'cuadriceps', secondary: ['gluteos'], baseDifficulty: 'alto', tracking: 'reps', pattern: 'knee_dominant', equipment: [['bench']], equipmentLabel: 'Banco y mancuernas', cues: 'El pie de atrás solo da equilibrio, no empuja.' },
  { id: 'sentadilla-goblet', name: 'Sentadilla goblet', muscleGroup: 'cuadriceps', secondary: ['core'], baseDifficulty: 'bajo', tracking: 'reps', pattern: 'knee_dominant', equipment: [['dumbbell'], ['kettlebell']], equipmentLabel: 'Mancuerna o pesa rusa', cues: 'Peso pegado al pecho, codos por dentro de las rodillas.' },
  // ── isquiotibiales ──
  { id: 'peso-muerto-rumano', name: 'Peso muerto rumano', muscleGroup: 'isquiotibiales', secondary: ['gluteos', 'espalda'], baseDifficulty: 'medio', tracking: 'reps', pattern: 'hip_hinge', equipment: [['barbell'], ['dumbbell']], equipmentLabel: 'Barra o mancuernas', cues: 'Cadera atrás, rodillas casi fijas.' },
  { id: 'curl-femoral', name: 'Curl femoral', muscleGroup: 'isquiotibiales', secondary: [], baseDifficulty: 'bajo', tracking: 'reps', pattern: 'isolation_lower', equipment: [['machine']], equipmentLabel: 'Máquina', cues: 'Cadera pegada al banco todo el recorrido.' },
  { id: 'buenos-dias', name: 'Buenos días', muscleGroup: 'isquiotibiales', secondary: ['espalda'], baseDifficulty: 'alto', tracking: 'reps', pattern: 'hip_hinge', equipment: [['barbell']], equipmentLabel: 'Barra', cues: 'Poco peso: la técnica manda en este movimiento.' },
  // ── gluteos ──
  { id: 'hip-thrust', name: 'Hip thrust', muscleGroup: 'gluteos', secondary: ['isquiotibiales'], baseDifficulty: 'medio', tracking: 'reps', pattern: 'hip_hinge', equipment: [['barbell', 'bench']], equipmentLabel: 'Barra y banco', cues: 'Mentón hacia el pecho, aprieta arriba.' },
  { id: 'puente-gluteo', name: 'Puente de glúteo', muscleGroup: 'gluteos', secondary: ['core'], baseDifficulty: 'bajo', tracking: 'camera', assistant: 'bridge', pattern: 'hip_hinge', equipment: [['bodyweight']], equipmentLabel: 'Peso corporal', cues: 'Empuja con los talones.' },
  { id: 'patada-gluteo', name: 'Patada de glúteo', muscleGroup: 'gluteos', secondary: [], baseDifficulty: 'bajo', tracking: 'reps', pattern: 'isolation_lower', equipment: [['cable'], ['bodyweight']], equipmentLabel: 'Polea o peso corporal', cues: 'Sin arquear la zona lumbar.' },
  { id: 'abduccion', name: 'Abducción de cadera', muscleGroup: 'gluteos', secondary: [], baseDifficulty: 'bajo', tracking: 'reps', pattern: 'isolation_lower', equipment: [['machine'], ['band']], equipmentLabel: 'Máquina o banda', cues: 'Torso levemente inclinado al frente.' },
  // ── pantorrillas ──
  { id: 'elevacion-talones-pie', name: 'Elevación de talones de pie', muscleGroup: 'pantorrillas', secondary: [], baseDifficulty: 'bajo', tracking: 'reps', pattern: 'isolation_lower', equipment: [['bodyweight'], ['machine']], equipmentLabel: 'Peso corporal o máquina', cues: 'Recorrido completo, pausa arriba.' },
  { id: 'elevacion-talones-sentado', name: 'Elevación de talones sentado', muscleGroup: 'pantorrillas', secondary: [], baseDifficulty: 'bajo', tracking: 'reps', pattern: 'isolation_lower', equipment: [['machine']], equipmentLabel: 'Máquina', cues: 'Trabaja el sóleo: sube lento.' },
  // ── core ──
  { id: 'plancha', name: 'Plancha', muscleGroup: 'core', secondary: ['hombros'], baseDifficulty: 'bajo', tracking: 'time', assistant: 'plank', pattern: 'core', equipment: [['bodyweight']], equipmentLabel: 'Peso corporal', cues: 'Cadera ni alta ni hundida, glúteos apretados.' },
  { id: 'plancha-lateral', name: 'Plancha lateral', muscleGroup: 'core', secondary: [], baseDifficulty: 'medio', tracking: 'time', pattern: 'core', equipment: [['bodyweight']], equipmentLabel: 'Peso corporal', cues: 'Hombro alineado sobre el codo.' },
  { id: 'abdominales', name: 'Abdominales', muscleGroup: 'core', secondary: [], baseDifficulty: 'bajo', tracking: 'reps', pattern: 'core', equipment: [['bodyweight']], equipmentLabel: 'Peso corporal', cues: 'Sin tirar del cuello con las manos.' },
  { id: 'elevacion-piernas', name: 'Elevación de piernas', muscleGroup: 'core', secondary: [], baseDifficulty: 'medio', tracking: 'reps', pattern: 'core', equipment: [['bodyweight'], ['pullup_bar']], equipmentLabel: 'Peso corporal o barra', cues: 'Zona lumbar pegada al suelo.' },
  { id: 'russian-twist', name: 'Russian twist', muscleGroup: 'core', secondary: [], baseDifficulty: 'medio', tracking: 'reps', pattern: 'core', equipment: [['bodyweight']], equipmentLabel: 'Disco o balón', cues: 'Rota desde el tronco, no desde los brazos.' },
  { id: 'mountain-climbers', name: 'Mountain climbers', muscleGroup: 'core', secondary: ['cardio'], baseDifficulty: 'medio', tracking: 'time', pattern: 'core', equipment: [['bodyweight']], equipmentLabel: 'Peso corporal', cues: 'Cadera baja, ritmo sostenido.' },
  { id: 'rueda-abdominal', name: 'Rueda abdominal', muscleGroup: 'core', secondary: ['espalda'], baseDifficulty: 'alto', tracking: 'reps', pattern: 'core', equipment: [['ab_wheel']], equipmentLabel: 'Rueda', cues: 'No dejes que la lumbar se arquee al extender.' },
  // ── cardio ──
  { id: 'burpees', name: 'Burpees', muscleGroup: 'cardio', secondary: ['core', 'pecho'], baseDifficulty: 'alto', tracking: 'time', pattern: 'cardio', equipment: [['bodyweight']], equipmentLabel: 'Peso corporal', cues: 'Ritmo constante antes que velocidad.' },
  { id: 'saltar-cuerda', name: 'Saltar la cuerda', muscleGroup: 'cardio', secondary: ['pantorrillas'], baseDifficulty: 'medio', tracking: 'time', pattern: 'cardio', equipment: [['jump_rope']], equipmentLabel: 'Cuerda', cues: 'Saltos bajos, muñecas relajadas.' },
  { id: 'caminadora', name: 'Caminadora', muscleGroup: 'cardio', secondary: [], baseDifficulty: 'bajo', tracking: 'time', pattern: 'cardio', equipment: [['cardio_machine']], equipmentLabel: 'Caminadora', cues: 'Usa la inclinación antes que la velocidad.' },
  { id: 'bicicleta', name: 'Bicicleta estática', muscleGroup: 'cardio', secondary: ['cuadriceps'], baseDifficulty: 'bajo', tracking: 'time', pattern: 'cardio', equipment: [['cardio_machine']], equipmentLabel: 'Bicicleta', cues: 'Ajusta el asiento a la altura de la cadera.' },
  { id: 'remo-ergometro', name: 'Remo ergómetro', muscleGroup: 'cardio', secondary: ['espalda'], baseDifficulty: 'medio', tracking: 'time', pattern: 'cardio', equipment: [['cardio_machine']], equipmentLabel: 'Ergómetro', cues: 'Primero piernas, después espalda, al final brazos.' },
];

const BY_ID = new Map(EXERCISE_CATALOG.map(e => [e.id, e]));

export function getExercise(id: string): CatalogExercise | undefined {
  return BY_ID.get(id);
}

/** true si el equipo disponible cubre alguna de las opciones del ejercicio. */
export function canPerform(exercise: CatalogExercise, available: ReadonlySet<EquipmentTag>): boolean {
  return exercise.equipment.some(option => option.every(tag => available.has(tag)));
}

/** Ejercicios con asistente por cámara (la insignia "con asistente"). */
export function withAssistant(): CatalogExercise[] {
  return EXERCISE_CATALOG.filter(e => e.assistant !== undefined);
}
