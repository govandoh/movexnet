# DEC-063 · Contrato `ExerciseTracker` v1.0.0 y adaptadores de los contadores

- **Estado:** Aceptada (2026-10-21, por el responsable del proyecto)
- **Fecha:** 2026-10-07
- **Decisores:** leads de contratos B (Análisis & Runtime) y D (Backend de producto); revisión de E por `src/ui/**`
- **Etiquetas:** contracts, analysis-core, ui

## Contexto y problema

El PR 2 de `ARCHITECTURE.md` (issue #11) pide crear `src/contracts/` con `LandmarkFrame`, `TrackerOutput` y `ExerciseTracker`, y adaptadores sobre los contadores, para que la pantalla deje de conocer cada uno. El código actual mostró:

- **La pantalla conoce cada motor y cada señal.** `WorkoutScreen.tsx` elegía el contador con un `if/else` por ejercicio y traducía `atBottom` (sentadilla), `atTop` (curl) y `atPeak` (press) a mano, con casts entre `SquatResult`, `BicepCurlResult` y `ShoulderPressResult`. El motor 3D (`DEC-057`) y la plancha tenían ramas propias.
- **Un solo `FramePipeline` para todos los ejercicios 3D.** La calibración de pie (`DEC-053`) sobrevive al cambio de ejercicio porque el pipeline se reutiliza con `setExercise`. Un contador por ejercicio no puede tener su propio pipeline sin perder ese comportamiento.
- **El contador 3D acumula entre series**, y la calibración del press decide si aprende comparando `repCount` con las repeticiones al empezar la serie. Reiniciarlo en cada serie cambiaría cuándo aprende.
- **Tipos duplicados.** `FeedbackLevel` estaba definido cuatro veces; la lista de ejercicios, en `AssistantId` (dominio) y en los fixtures; los contadores 2D importaban el tipo de landmark de MediaPipe.
- **`zod` no está instalado** y añadir dependencias exige discutirlo (regla dura 9).

## Opciones consideradas

1. **Mover `ExerciseDefinition3D` y `Tracker3DResult` al contrato.** Están estables, pero arrastran `CycleConfig`, `QualityThresholds`, `RepMetrics`, `FatigueState` y funciones: son internos de `analysis-core`, no una frontera entre workstreams.
2. **`TrackerOutput<D>` genérico con un `detail` del motor dentro del contrato.** Cómodo para la pantalla, pero mete una vía de escape sin forma definida en el contrato.
3. **Contrato mínimo y subtipo en B con lo propio de cada motor** (elegida).
4. **Un pipeline 3D por ejercicio.** Más simple de cablear, pero perdería la calibración al cambiar de ejercicio.
5. **Tipos con esquemas `zod` desde ahora.** Coherente con `ARCHITECTURE.md` §2.2, pero es una dependencia nueva y todavía no hay datos serializados que crucen fronteras con este contrato.

## Decisión

Creamos `src/contracts/` con solo tipos de TypeScript, versión **`CONTRACTS_VERSION = '1.0.0'`**, y adaptadores finos en `src/exercises/exerciseTrackers.ts`. La pantalla recorre un `Record<ExerciseId, ExerciseTracker>`.

### Contrato (`src/contracts/`)

```ts
type ExerciseId = 'squat' | 'curl' | 'press' | 'pushup' | 'lunge' | 'bridge' | 'plank';
type FeedbackLevel = 'idle' | 'good' | 'warning' | 'bad';
interface Landmark { x: number; y: number; z: number; visibility: number }
interface LandmarkFrame { t: number; image: Landmark[]; world?: Landmark[]; down?: Vec3 | null }
type RepEvent =
  | { kind: 'peak'; t: number; extremeAngle: number }
  | { kind: 'complete'; t: number }
  | { kind: 'rejected'; t: number; reason: string; message: string };
interface TrackerOutput { phase: string; reps: number; feedbackLevel: FeedbackLevel; feedbackMessage: string; events: RepEvent[] }
interface ExerciseTracker { readonly exerciseId: ExerciseId; update(frame: LandmarkFrame): TrackerOutput; reset(): void }
```

Diferencias con `ARCHITECTURE.md` §2.2:

- **Sin `seq` ni `view` en `LandmarkFrame`:** nada los produce todavía. Se añadirán como opcionales (versión menor).
- **`down` en `LandmarkFrame`:** el "abajo" del acelerómetro que necesita la nivelación (`DEC-050`); mismo nombre que en los fixtures.
- **Evento `rejected`:** el motor 3D descarta ciclos (demasiado rápidos, recorrido incompleto…) y la voz los anuncia.
- **`complete` sin `extremeAngle`:** el extremo ya viaja en `peak`.
- **`update` sin `features`:** llegará con `FeatureExtractor` (PR 7).

`FeedbackLevel` y `Landmark` de los contadores pasan a venir del contrato, y `AssistantId` del dominio pasa a ser un alias de `ExerciseId`.

### Adaptadores (`src/exercises/exerciseTrackers.ts`)

- **2D** (`squat2D`, `curl2D`, `press2D`): `atBottom`/`atTop`/`atPeak` → `peak` con `minAngleReached` o `maxAngleReached`; aumento de `reps` → `complete`. No cambian el contador que envuelven.
- **`Engine3DTracker`**, sobre un `FramePipeline` **compartido** por todos los ejercicios 3D: `peak`, `repCounted` y `rejection` de `Tracker3D` → `peak`, `complete`, `rejected`. `reset()` activa la definición del ejercicio en el pipeline si no lo estaba; si ya lo estaba, el contador interno sigue acumulando entre series, como antes. `reps` cuenta solo la serie en curso.
- **`PlankExerciseTracker`**: usa solo `prepare()` del pipeline compartido y `PlankTracker`; no emite eventos.
- Lo que cada motor aporta además a la pantalla viaja en **`EngineOutput.detail`**, un subtipo de B fuera del contrato:
  - el `Tracker3DResult` completo para el resumen de la serie;
  - los landmarks procesados para el mini mapa;
  - el `PlankResult`;
  - o `none` si un contador 3D recibe un frame sin `world`.

### Pantalla

- `createWorkoutTrackers()` (`src/ui/workout/exercises.ts`) crea el `Record` con el motor de cada ejercicio (`DEC-059`) y el pipeline compartido.
- `WorkoutScreen` reinicia solo el contador que va a usar, llama a un único `update(frame)` por cuadro y trata 2D y 3D con el mismo manejador de repeticiones.

### Patrón para lo que venga

- Un contador nuevo implementa `ExerciseTracker`.
- Si la pantalla necesita algo más de un motor, va en `detail`. Pasa al contrato, con su DEC y su versión, cuando lo necesite otro workstream.

## Consecuencias

### Positivas

- La pantalla deja de conocer `atBottom`/`atTop`/`atPeak` y los tipos de resultado de cada contador.
- Añadir un ejercicio es añadir su `ExerciseId` y una entrada en `createWorkoutTrackers()`, sin tocar el bucle.
- Comportamiento idéntico:
  - los golden del PR 1 no cambian;
  - `exerciseTrackers.test.ts` reproduce los diez fixtures por los adaptadores 2D y comprueba, frame a frame, la misma salida que el contador original;
  - el adaptador 3D da los mismos eventos que `Tracker3D` en las demos sintéticas.
- Desaparecen tres definiciones duplicadas de `FeedbackLevel` y la dependencia de tipos de los contadores con MediaPipe.

### Negativas

- Hay una rama por motor en la pantalla: el resumen de la serie aún se alimenta con `addFrame` (3D) o `addRep2D` (2D). Se unificará con `AnalysisPipeline` (PR 5, issue #14).
- `reset()` no significa lo mismo en el motor 3D (activa la definición y conserva el contador interno) que en el 2D (borra todo). Desde el contrato es equivalente, porque `reps` vuelve a 0, pero quien toque `FramePipeline` debe conocerlo.
- La plancha implementa el contrato sin repeticiones (`reps: 0`): su tiempo sostenido solo está en `detail`. Si otro consumidor lo necesita, se añade `heldMs` opcional (versión menor).
- `LandmarkFrame` todavía no tiene validación en tiempo de ejecución. Cuando un dato con este contrato se serialice (grabaciones, mensajes a un Worker), se decide `zod` con su DEC.

## Referencias

- Issue #11 y su brief del Sprint 1; PR 2 de `ARCHITECTURE.md` §2.4.
- `DEC-016` (voz), `DEC-022` (cooldown entre brazos), `DEC-053` (calibración de pie), `DEC-057` (motor 3D), `DEC-059` (motor por ejercicio).
- `src/contracts/`, `src/exercises/exerciseTrackers.ts`, `src/ui/workout/exercises.ts`, `src/ui/workout/WorkoutScreen.tsx`.
- `docs/WORKSTREAMS.md` §2 (reglas de cambio de contratos y semver).
