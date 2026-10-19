# Fitnet — Dominio

> Responsabilidad de este archivo: glosario ES/EN y modelo de dominio (entidades, relaciones, métodos de entrenamiento). Las fórmulas de las métricas están en `METRICS.md`; el esquema físico (tablas, RLS) vive en `supabase/migrations` y se documenta en `DATA-GOVERNANCE.md`. Los tipos TypeScript de estas entidades se definen en `@fitnet/domain` y `@fitnet/contracts`.

## Glosario

| Español | Inglés (código) | Definición |
|---|---|---|
| Landmark / punto clave | `Landmark` | Uno de los 33 puntos corporales que MediaPipe estima por frame: `{x, y, z, visibility}`. `image` = coordenadas normalizadas 0–1 respecto a la imagen; `world` = metros respecto al centro de cadera. |
| Frame de landmarks | `LandmarkFrame` | Conjunto de 33 landmarks (2D y opcionalmente 3D) con timestamp `t` (ms), secuencia `seq` y vista de cámara. |
| Ángulo articular | `jointAngle` | Ángulo en el vértice B formado por A-B-C (p. ej. cadera-rodilla-tobillo), 0–180°. |
| Repetición / rep | `Rep` | Un ciclo completo del movimiento (p. ej. de pie → abajo → de pie). Se cuenta al confirmar el extremo del recorrido y volver a la posición inicial (`DEC-017`). |
| Serie | `Set` | Grupo consecutivo de reps de un ejercicio sin descanso intermedio (o con las pausas del método). |
| Sesión de entrenamiento | `WorkoutSession` | Conjunto de series realizadas en una visita, opcionalmente asociada a un día de rutina. |
| Fase | `phase` | Estado de la máquina de estados del tracker (`standing`/`squatting`, `extended`/`flexed`, `lowered`/`pressed`). |
| Pico / fondo | `peak` / `bottom` | Extremo del ángulo dentro de una rep (mínimo en sentadilla y curl, máximo en press). |
| Histéresis | `hysteresis` | Umbrales distintos de entrada y salida de una fase para absorber ruido (`DEC-010`). |
| Rango de movimiento | `rom` (Range of Motion) | Diferencia entre el ángulo en el extremo y el ángulo inicial de la rep. |
| Tempo | `tempo` | Duración de las fases excéntrica y concéntrica de una rep. |
| Velocidad concéntrica pico | `peakVel` | Máxima velocidad de la fase concéntrica, en m/s (desde `world`) o °/s (desde ángulos). |
| Pérdida de velocidad | `velocityDeclinePct` | Caída porcentual de `peakVel` dentro de una serie respecto a la mejor rep. |
| Puntuación de forma | `formScore` | 0–100, calidad técnica de una rep. |
| Error de forma | `FormErrorCode` | Etiqueta discreta de un patrón incorrecto (`knee_valgus`, `trunk_lean`, ...). |
| Índice de fatiga | `fatigueIndex` | Combinación de pérdida de velocidad, deriva de ROM y CV de tempo. |
| Consistencia | `consistency` | Regularidad de las reps de una serie (inverso de la variabilidad). |
| Asimetría | `asymmetry` | Diferencia izquierda/derecha en ángulo, ROM o velocidad. |
| Esfuerzo percibido | `rpe` (Rating of Perceived Exertion) | Escala 1–10 reportada por el usuario al final de una serie. |
| Fixture | `fixture` | Secuencia de `LandmarkFrame` grabada o sintética, usada en tests golden y en `ml/`. |
| Golden / snapshot | `golden` | Salida esperada de un tracker o política sobre un fixture, congelada en tests. |
| Grabación | `Recording` | Fixture con consentimiento asociado, subida al dataset de entrenamiento. |
| Consentimiento | `RecordingConsent` | Autorización explícita del usuario para guardar una grabación de landmarks. |
| Ejercicio | `Exercise` | Entrada del catálogo: articulaciones primarias, polaridad, tracker y modelos asociados. |
| Objetivo de entrenamiento | `TrainingGoal` | Meta general declarada en el cuestionario (`muscle_gain`, `weight_loss`, `strength_gain`); fija la prescripción del generador de rutinas (`DEC-056`). No confundir con `Goal`, que es un objetivo medible con fecha. |
| Lugar de entrenamiento | `TrainingLocation` | Dónde entrena el usuario: `gym_full`, `home_none`, `home_limited`; junto con `equipment[]` filtra el catálogo (`DEC-056`). |
| Patrón de movimiento | `MovementPattern` | Clase biomecánica de un ejercicio (`knee_dominant`, `hip_hinge`, `horizontal_push`, `vertical_push`, `horizontal_pull`, `vertical_pull`, `isolation_upper`, `isolation_lower`, `core`, `cardio`); el generador llena cada día por patrones. |
| Ola del asistente | `assistantWave` | Tanda de ejercicios que pasan a `tracking: camera` (análisis con cámara): 0 = sentadilla, curl, press; 1–3 amplían hacia casa sin equipo, casa con mancuernas y gimnasio (`DEC-056`). |
| Plantilla de programa | `ProgramTemplate` | Rutina predefinida que el usuario adopta tal cual o que usa el generador; libre o premium. |
| Rutina | `Routine` | Plan de días de entrenamiento con ejercicios, series, reps y método. |
| Método de entrenamiento | `TrainingMethod` | Técnica de organización de series (`rest_pause`, `dropset`, `ppl_split`, `superset`). |
| Plan | `Plan` | Producto de un entrenador: una o más rutinas, privado o en el marketplace. |
| Entrenador | `Trainer` | Rol sobre un usuario que puede publicar planes y dar coaching. |
| Relación de coaching | `CoachingRelationship` | Vínculo entrenador-cliente que autoriza ver métricas y chatear. |
| Asistente de coaching | `CoachAssistant` | Servicio de IA (Claude) que redacta resúmenes y sugerencias a partir de métricas (`DEC-033`). |
| Reto | `Challenge` | Competencia con reglas, periodo y ranking. |
| Ranking | `Leaderboard` | Ordenamiento de usuarios por puntuación en un reto o global. |
| Derecho / entitlement | `Entitlement` | Capacidad concreta habilitada por una suscripción (p. ej. `advanced_analysis`). |

## Modelo de dominio

```
User 1—1 Profile · User 1—* Goal · User 1—* Achievement · User 1—* Subscription 1—* Entitlement
Trainer (rol sobre User) 1—* Plan (visibility: private|marketplace, price)
Plan 1—* Routine 1—* RoutineDay 1—* RoutineExercise (Exercise, sets×reps, TrainingMethod)
Exercise (catálogo: primaryJoints, polarity, trackerId, modelIds, equipment[], locations[], movementPattern, tracking)
ProgramTemplate (free|premium) → genera Routine
User *—* Plan vía PlanEnrollment
User 1—* WorkoutSession (routineDayId?, device, modelVersions) 1—* Set (exerciseId, method) 1—* Rep (durationMs, rom, peakVel, formScore, errors[])
Set/WorkoutSession 1—* Metric (name, value, unit)   ← única entrada del CoachAssistant
Trainer *—* User(cliente) vía CoachingRelationship 1—1 CoachingThread 1—* Message (trainer|client|assistant) · Thread 1—* Report
Challenge 1—* ChallengeEntry · LeaderboardEntry (challengeId|global, userId, score, period)
RecordingConsent 1—1 Recording (dataset de landmarks; retención, borrable)
```

### Identidad y cuenta

| Entidad | Descripción | Campos clave | Relaciones |
|---|---|---|---|
| `User` | Cuenta autenticada (Supabase Auth). | `id`, `email`, `createdAt`, `roles[]` | 1—1 `Profile`; 1—* `Goal`, `Achievement`, `Subscription`, `WorkoutSession`, `PlanEnrollment`. |
| `Profile` | Datos visibles, de configuración y respuestas del cuestionario (`DEC-056`). | `displayName`, `birthYear?`, `birthMonth?` (1–12, puerta 18+, `DEC-069`), `heightCm?`, `weightKg?`, `experienceLevel` (`beginner`/`intermediate`/`advanced`), `goal: TrainingGoal`, `trainingLocation: TrainingLocation`, `equipment[]` (etiquetas de equipo), `daysPerWeek` (2–6), `sessionMinutes`, `programType` (`full_body`/`upper_lower`/`ppl`), `preferredCamera`, `publicProfile: boolean`, `privacyVersion`, `privacyAcceptedAt` (aceptación del aviso, la fija el servidor y no se edita, `DEC-069`) | Pertenece a un `User`. Lo crea el alta de la cuenta, solo para mayores de 18 (`DEC-067`). |
| `Goal` | Objetivo medible con fecha. | `metricName`, `target`, `deadline`, `status` | Se evalúa contra `Metric` de progreso. |
| `Achievement` | Logro desbloqueado. | `code`, `unlockedAt` | Otorgado por reglas sobre métricas o retos. |
| `Subscription` | Estado de pago del usuario o del entrenador. | `provider` (`recurrente`/`paddle`), `plan`, `status`, `periodEnd`, `externalId` | Escrita solo por webhook (`DEC-030`); 1—* `Entitlement`. |
| `Entitlement` | Capacidad habilitada. | `code`, `validUntil` | Derivado de `Subscription`; consultado por `is_premium(uid)` en RLS. |

### Entrenamiento

| Entidad | Descripción | Campos clave | Relaciones |
|---|---|---|---|
| `Exercise` | Catálogo (60 ejercicios de fitnetv2, `DEC-040`, `DEC-056`). | `id` (`squat`, `bicep_curl`, `shoulder_press`, ...), `name_es`, `primaryJoints[]`, `polarity` (`min`/`max`), `trackerId`, `modelIds[]`, `views[]`, `equipment[]` (`bodyweight`, `dumbbell`, `barbell`, `bench`, `band`, `pullup_bar`, `kettlebell`, `machine`, `cable`, `cardio_machine`), `locations[]` (`gym`/`home`), `movementPattern: MovementPattern`, `tracking` (`camera`/`reps`/`time`; `camera` = "con asistente") | Referenciado por `RoutineExercise`, `Set` y `ProgramTemplate`. Elegible para un usuario si todas sus etiquetas de `equipment` están en `Profile.equipment`. |
| `ProgramTemplate` | Rutina predefinida (p. ej. las 3 plantillas de fitnetv2: PPL, cuerpo completo, división por músculo). | `id`, `name`, `programType`, `daysPerWeek`, `experienceLevel?`, `tier` (`free`/`premium`) | Se instancia como `Routine` del usuario; las premium exigen `Entitlement` (`DEC-056`). |
| `Plan` | Producto de un entrenador. | `trainerId`, `title`, `visibility` (`private`/`marketplace`), `price?`, `currency?` | 1—* `Routine`; *—* `User` vía `PlanEnrollment`. |
| `Routine` | Programa de días. | `planId?`, `ownerId`, `name`, `weeks?` | 1—* `RoutineDay`. |
| `RoutineDay` | Día del programa. | `dayIndex`, `label` (p. ej. "Push") | 1—* `RoutineExercise`. |
| `RoutineExercise` | Prescripción. | `exerciseId`, `sets`, `reps`, `restSec`, `loadKg?` (para medir progresión, `DEC-056`), `method: TrainingMethod`, `methodParams` | Pertenece a `RoutineDay`. |
| `PlanEnrollment` | Inscripción de un usuario a un plan. | `userId`, `planId`, `startedAt`, `status` | — |
| `WorkoutSession` | Sesión realizada. | `userId`, `routineDayId?`, `startedAt`, `endedAt`, `device`, `modelVersions` (versiones de `models/manifest.json` usadas) | 1—* `Set`, `Metric`. |
| `Set` | Serie ejecutada. | `sessionId`, `exerciseId`, `method`, `loadKg?`, `rpe?`, `startedAt` | 1—* `Rep`, `Metric`. |
| `Rep` | Repetición analizada. | `durationMs`, `eccentricMs`, `concentricMs`, `rom`, `peakVel`, `formScore`, `errors: FormErrorCode[]`, `source` (`rules`/`ml`/`ensemble`) | Pertenece a `Set`. |
| `Metric` | Valor agregado con nombre. | `name`, `value`, `unit`, `scope` (`set`/`session`), `computedAt`, `schemaVersion` | **Única entrada del `CoachAssistant`.** Nombres y fórmulas en `METRICS.md`. |

### Coaching

| Entidad | Descripción | Campos clave | Relaciones |
|---|---|---|---|
| `Trainer` | Rol sobre `User`. | `userId`, `bio`, `verifiedAt?`, `feeStatus` | 1—* `Plan`; *—* clientes vía `CoachingRelationship`. |
| `CoachingRelationship` | Autorización entrenador ↔ cliente. | `trainerId`, `clientId`, `status`, `startedAt` | Gobierna RLS de métricas y chat (`DEC-029`); 1—1 `CoachingThread`. |
| `CoachingThread` | Conversación 1:1. | `relationshipId` | 1—* `Message`, `Report`. |
| `Message` | Mensaje del hilo. | `author` (`trainer`/`client`/`assistant`), `body`, `structured?` (JSON validado si es del asistente), `createdAt` | — |
| `Report` | Salida del asistente o del entrenador. | `type` (`session_summary`/`routine_adjustment`/`trainer_digest`), `payload`, `reviewedBy?`, `visibleToClient` | Los ajustes del asistente solo son visibles al cliente tras revisión del entrenador (`DEC-033`). |

### Comunidad y competencia

| Entidad | Descripción | Campos clave | Relaciones |
|---|---|---|---|
| `Challenge` | Reto con reglas. | `title`, `metricName`, `period`, `rules`, `visibility`, `creatorId` | 1—* `ChallengeEntry`. |
| `ChallengeEntry` | Participación. | `userId`, `challengeId`, `score`, `updatedAt` | — |
| `LeaderboardEntry` | Fila de ranking (vista materializada). | `challengeId | 'global'`, `userId`, `score`, `period`, `computedAt` | Refrescada por `pg_cron`; puntuación según `METRICS.md` §7. |

### Datos y consentimiento

| Entidad | Descripción | Campos clave | Relaciones |
|---|---|---|---|
| `RecordingConsent` | Consentimiento explícito. | `userId`, `scope` (`training_dataset`), `grantedAt`, `revokedAt?`, `textVersion` | 1—1 `Recording` (un consentimiento por grabación, DATA-GOVERNANCE §2). |
| `Recording` | Grabación de landmarks (nunca video). | `consentId`, `exerciseId`, `view`, `device`, `schemaVersion`, `storagePath`, `labels[]`, `retentionUntil` | Borrable por el usuario; detalle en `DATA-GOVERNANCE.md`. |

## Métodos de entrenamiento (`TrainingMethod`)

| Código | Nombre | Definición | Cómo se registra |
|---|---|---|---|
| `rest_pause` | Rest-pause | Una serie llevada cerca del fallo, seguida de pausas cortas (10–20 s) y mini-series con la misma carga hasta completar el objetivo de reps. | Un `Set` con `methodParams.pauses[]`; las reps de cada bloque se agrupan por `blockIndex`. Las métricas de fatiga se calculan sobre la serie completa y por bloque. |
| `dropset` | Dropset | Al alcanzar el fallo se reduce la carga (habitualmente 20–30 %) y se continúa sin descanso; puede repetirse varias veces. | Un `Set` con `methodParams.drops[] = {loadKg, reps}`; `loadKg` por sub-serie. |
| `ppl_split` | Push / Pull / Legs | División semanal por patrones: empuje (pecho, hombro, tríceps), tracción (espalda, bíceps), piernas. | Etiqueta de `RoutineDay` (`label`) y regla de generación de rutina; no altera la ejecución de la serie. |
| `superset` | Superserie | Dos ejercicios ejecutados consecutivamente sin descanso (antagonistas o mismo grupo). | Dos `RoutineExercise` con el mismo `supersetGroup`; en la sesión, dos `Set` con `pairedSetId` y descanso solo al terminar el par. |

Las definiciones son las estándar del entrenamiento de fuerza; los parámetros por defecto (segundos de pausa, porcentaje de descarga) son configurables por rutina y no forman parte del contrato.
