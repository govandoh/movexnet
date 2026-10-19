# Arquitectura de MovexNet

> Documento vivo. Última actualización: 2026-09-24 (integración de fitnetv2, paso I-1). Las decisiones que sustentan cada parte están en `docs/adr/`; las métricas en `docs/METRICS.md`; el pipeline de datos y modelos en `docs/ML-PIPELINE.md`.

## 1. Estado actual (2026-09)

La app en producción es una PWA Vite única (`src/`, 2 318 líneas) que corre completamente en el cliente. Pipeline real, con rutas:

```
getUserMedia  (src/pose/camera.ts: startCamera / stopCamera)
     │
     ▼
<video>  ──► PoseLandmarker.detectForVideo(video, t)      src/pose/poseDetector.ts
              │  modelo pose_landmarker_lite float16, delegate 'GPU', WASM desde jsDelivr @0.10.35
              │  dibuja el esqueleto con DrawingUtils en el mismo paso (detectAndDraw)
              ▼
         result.landmarks[0]  (33 × {x, y, z, visibility}, normalizados 0–1)
              │            (result.worldLandmarks se descarta)
              ▼
         calculateAngle(A, B, C)                            src/geometry/angles.ts (atan2, 0–180°)
              │
              ▼
         Tracker del ejercicio activo                       src/exercises/{squat,bicepCurl,shoulderPress}.ts
              │  histéresis de umbral doble + gate de confirmación de pico/fondo
              ▼
         {phase, reps, feedbackLevel, feedbackMessage, atBottom|atTop|atPeak, min|maxAngleReached}
              │
              ├──► ExerciseOverlay (DOM, barra inferior)     src/ui/ExerciseOverlay.tsx
              └──► reglas de voz (DEC-016) + useSpeech       src/ui/CameraView.tsx l.146-188, src/ui/useSpeech.ts
```

Orquestación: `src/ui/CameraView.tsx` (299 líneas) monta cámara y detector en un `useEffect`, corre el loop `requestAnimationFrame`, mantiene los tres trackers en `useRef`, elige el tracker con un `if/else` por ejercicio (l. 138-142), aplica la política de voz inline y llama `setExerciseResult(result)` en cada frame. `src/App.tsx` decide entre `OnboardingFlow` y `CameraView` según `localStorage('ob_complete_v1')`.

### Deudas que la arquitectura objetivo corrige

| Deuda | Dónde | Efecto | Lo corrige |
|---|---|---|---|
| Detección y dibujo acoplados | `poseDetector.ts::detectAndDraw` | No se puede detectar sin canvas ni reproducir fixtures sin cámara. | PR 3 (`PoseSource` + `SkeletonRenderer`). |
| Se descartan `worldLandmarks` | `poseDetector.ts` l.65 | Sin coordenadas 3D métricas no hay velocidad, ROM ni asimetría fiables. | PR 3 (`LandmarkFrame.world`). |
| Sin interfaz común entre trackers | `SquatResult`/`BicepCurlResult`/`ShoulderPressResult` | `CameraView` conoce los tres tipos y sus eventos (`atBottom`/`atTop`/`atPeak`). | PR 2 (`ExerciseTracker`, `TrackerOutput.events`). |
| Constantes en frames a 60 fps | `REP_COOLDOWN_FRAMES=15`, `MIN_RISING_FRAMES=3`, `MIN_FALLING_FRAMES=3`, `RISING_THRESHOLD=2` | A 30 fps el cooldown dura el doble; la confirmación de pico cambia por dispositivo. | PR 7 (`PeakDetector` con `confirmMs`). |
| Duplicación `ArmTracker` / `ArmPressTracker` | `bicepCurl.ts`, `shoulderPress.ts` | Mismo detector de pico con polaridad invertida; `ArmTracker` además exige `MIN_START_ANGLE=130`. | PR 7 (`PeakDetector({polarity})`). |
| Política de voz inline | `CameraView.tsx` l.146-188 | Dos estrategias (DEC-016) mezcladas con React; imposible probarlas sin montar el componente. | PR 4 (`FeedbackPolicy`). |
| `setState` por frame | `CameraView.tsx` l.191 | Re-render a 30–60 Hz aunque nada visible cambie. | PR 5 (`onState` solo ante cambios de `reps`/`feedbackLevel`/`feedbackMessage`). |
| Sin fixtures ni golden | Solo existe `src/geometry/angles.test.ts` | Cualquier refactor de los trackers es a ciegas (el PR 0 ya dejó Vitest y CI listos). | PR 1. |

Lo que sí se conserva tal cual: algoritmos de histéresis (DEC-010), detección de pico/fondo (DEC-014/016), gate de conteo (DEC-017), conteo unificado con cooldown (DEC-022/023), overlay DOM (DEC-011/012), voz (DEC-013), PWA manual (DEC-006/025), delay de cámara (DEC-021), `localStorage` defensivo (DEC-024).

### Integración de fitnetv2 (`DEC-054`)

El paso I-1 trajo el motor puro de fitnetv2 (workstream B), con tests Vitest pero **sin conectar a la UI**: el pipeline de arriba sigue siendo el de producción.

| Ruta | Qué hace | DEC |
|---|---|---|
| `src/geometry/vectors3d.ts` | Vectores 3D, `calculateAngle3D`, `getBodyOrientation`, inclinación del tronco, asimetría. | DEC-036 |
| `src/geometry/landmarkFilter.ts` | Filtro One Euro por landmark (`OneEuroFilter`, `LandmarkSmoother`). | DEC-046 |
| `src/geometry/gravityAlign.ts` | Parte pura de la nivelación: `GravityEstimator`, `alignToGravityChecked`. El adaptador DOM del acelerómetro llega en I-3. | DEC-050 |
| `src/geometry/standingCalibration.ts` | Corrección vertical residual con la postura de pie (`StandingCalibrator`). | DEC-053 |
| `src/geometry/poseEmbedding.ts` | Normalización canónica y vector de 60 rasgos para el k-NN. | DEC-055 |
| `src/analysis/movementQuality.ts` | Validación temporal de reps y métricas por rep (`MovementAnalyzer`). | DEC-037, DEC-045 |
| `src/analysis/fatigue.ts` | Fatiga por degradación (`FatigueDetector`). | DEC-038 |
| `src/analysis/messages.ts` | Textos de rechazo y de fatiga para el usuario, en tuteo. | DEC-049 |
| `src/analysis/poseClassifier.ts` | `KnnPoseClassifier` y `ScoreSmoother`. | DEC-055 |
| `src/exercises/demoPoses.ts` | Poses 3D de demostración (tutorial, pruebas del motor, plantillas iniciales del k-NN). | DEC-043, DEC-048 |
| `src/testing/syntheticMotion.ts` | Movimiento 3D sintético para los tests del motor. | DEC-048 |

`src/analysis/` es nuevo y pertenece al workstream B, junto a `src/geometry/` y `src/exercises/`. Los trackers 3D que usarán este motor llegan en I-2 (cambian golden).

## 2. Arquitectura objetivo

### 2.1 Paquetes y dirección de dependencias (`DEC-028`)

```
                     ┌────────────────────────┐
                     │ @movexnet/contracts    │  tipos + zod, semver, schemaVersion
                     └───────────┬────────────┘
                ┌────────────────┼────────────────────────┐
                ▼                │                        ▼
   ┌────────────────────────┐    │           ┌────────────────────────┐
   │ @movexnet/pose-engine  │    │           │ @movexnet/domain       │  entidades, puertos, casos de uso
   │ (MediaPipe aquí)       │    │           └────────────┬───────────┘
   └────────────┬───────────┘    │                        ▼
                ▼                │           ┌────────────────────────┐
   ┌────────────────────────┐    │           │ @movexnet/api-client   │  Supabase, CoachAssistant HTTP,
   │ @movexnet/analysis-core│    │           └────────────────────────┘  cola offline
   └────────────┬───────────┘    │
                ▼                │
   ┌────────────────────────┐    │
   │ @movexnet/ml-runtime   │    │
   │ (ONNX)                 │    │
   └────────────────────────┘    │
                                 │
                                 │
                                 │
                                 ▼
               ┌────────────────────────────────────┐
               │ @movexnet/ui + apps/web            │  importa todo; nadie la importa
               └────────────────────────────────────┘
```

```
contracts ← pose-engine ← analysis-core ← ml-runtime
contracts ← domain ← api-client
apps/web importa todo; nada importa apps/web
```

Restricciones aplicadas por eslint (`import/no-restricted-paths`): `@mediapipe/tasks-vision` solo en `pose-engine`; `onnxruntime-web` solo en `ml-runtime`; SDK de Supabase y `supabase/` solo en `api-client`; `analysis-core` sin React ni DOM (corre en Node con fixtures). `analysis-core` usa `contracts.Landmark`, no el tipo de MediaPipe (mismo patrón que `Point2D`, DEC-009).

Layout completo de directorios: `AGENTS.md` y `DEC-028`.

### 2.2 Contratos núcleo (`packages/contracts`)

Firmas resumidas; la fuente de verdad será el código TypeScript + zod del paquete. Todo tipo persistido lleva `schemaVersion`. Lo marcado `v1` ya existe en `src/contracts/` (versión 1.0.0, DEC-063); el resto es objetivo.

```ts
// Pose
interface LandmarkFrame { t: number; image: Landmark[33]; world?: Landmark[33]; down?: Vec3 | null }  // v1; seq y view llegarán como opcionales
interface PoseSource   { start(): Promise<void>; stop(): void; onFrame(cb: (f: LandmarkFrame) => void): void }
//   implementaciones: CameraPoseSource (getUserMedia + MediaPipe), ReplayPoseSource (fixture JSON)
interface SkeletonRenderer { draw(frame: LandmarkFrame): void }          // separa dibujo de detección

// Features
interface FeatureVector { angles: Record<JointId, number>; angVel: Record<JointId, number> /* deg/s por Δt */;
                          symmetry: Record<string, number>; trajectory: number[]; visibility: number[]; schemaVersion: string }
interface FeatureExtractor { push(frame: LandmarkFrame): FeatureVector }

// Trackers y segmentación
type RepEvent = { kind: 'peak'; t: number; extremeAngle: number } | { kind: 'complete'; t: number }
               | { kind: 'rejected'; t: number; reason: string; message: string }                           // v1
interface TrackerOutput { phase: string; reps: number; feedbackLevel: FeedbackLevel; feedbackMessage: string; events: RepEvent[] }  // v1
interface ExerciseTracker { exerciseId: ExerciseId; update(frame: LandmarkFrame): TrackerOutput; reset(): void }  // v1; `features?` llega con FeatureExtractor (PR 7)
class PeakDetector { constructor(opts: { polarity: 'min' | 'max'; confirmMs: number; minDeltaDeg: number }) }  // reemplaza ArmTracker/ArmPressTracker
interface RepSegmenter { push(frame, features): RepWindow | null }      // RuleRepSegmenter (histéresis actual) | MlRepSegmenter

// Forma y fatiga
interface FormAssessment { score: number /* 0-100 */; confidence: number; source: 'rules' | 'ml' | 'ensemble';
                           errors: { code: FormErrorCode; severity: number; evidence: unknown }[] }
interface FormAnalyzer   { analyzeRep(window: RepWindow): Promise<FormAssessment> }  // RuleBasedAnalyzer | MlAnalyzer | EnsembleAnalyzer
interface FatigueEstimate { velocityDeclinePct: number; romDeclinePct: number; tempoCv: number; consistency: number }
interface FatigueAnalyzer { push(rep: RepSummary): FatigueEstimate }

// Feedback
interface FeedbackPolicy { decide(input: { output: TrackerOutput; assessment?: FormAssessment; fatigue?: FatigueEstimate; now: number }): FeedbackAction[] }
//   PeakAtEndOfEffortPolicy (curl, press) | MidRangePeakPolicy (sentadilla) — codifican DEC-016; repPhrase() vive aquí
interface FeedbackSink { emit(action: FeedbackAction): void }            // SpeechSink, StoreSink

// Captura y modelos
interface SessionRecorder { begin(meta: { consentId: string; exerciseId; device }): void; record(frame, features, output): void; label(l: Label): void; end(): Blob /* json-v1 */ }
interface ModelRegistry  { resolve(task: ModelTask, exerciseId: ExerciseId): Promise<InferenceSession> }  // lee models/manifest.json (sha256, featureSchemaVersion)

// Nube
interface CoachAssistant { summarizeSession(input): Promise<SessionSummary>; suggestRoutineAdjustments(input): Promise<RoutineAdjustment[]>; trainerDigest(input): Promise<TrainerDigest> }
//   puerto; la implementación vive detrás de la Edge Function `coach` (DEC-033)
```

### 2.3 `AnalysisPipeline` (sin React)

```
PoseSource ──frame──► SkeletonRenderer.draw
                 └──► suavizado One Euro (DEC-046) ──► nivelación por gravedad (DEC-050) ──► calibración de pie (DEC-053)
                                                                      │
                 ┌────────────────────────────────────────────────────┘
                 └──► FeatureExtractor.push ──features──► ExerciseTracker.update ──output──► SessionRecorder.record
                                                                      │
                                                        evento 'complete' (por rep)
                                                                      ▼
                                   FormAnalyzer.analyzeRep(RepWindow)  (async; ML en Web Worker)
                                                                      ▼
                                   FatigueAnalyzer.push(RepSummary)
                                                                      ▼
                                   FeedbackPolicy.decide({output, assessment, fatigue, now}) ──► FeedbackSink[] (SpeechSink, StoreSink)
```

- El suavizado, la nivelación y la calibración ya existen en `src/geometry/` (I-1 de `DEC-054`); el pipeline congela la calibración mientras dura el ejercicio (`StandingCalibrator.setLearning(false)`, se cablea en I-2).
- `onState` se dispara solo cuando cambian `reps`, `feedbackLevel` o `feedbackMessage` (elimina el `setState` por frame).
- Estado de UI en un store pequeño (zustand) `useWorkoutStore`; hook `useAnalysisPipeline()` conserva el delay de 450 ms de DEC-021.
- `CameraView` se descompone en `WorkoutScreen = <CameraStage/> + <ExerciseOverlay/> + <ExerciseChips/> + <CameraToggle/>`, cada uno ≤ 60 líneas.
- `EnsembleAnalyzer` avanza por ejercicio: sombra → ponderado → ML primario con reglas de fallback si `confidence < τ` (DEC-027).

### 2.4 Migración por PRs (strangler; la app se despliega tras cada uno)

| PR | Cambio | Red de seguridad | Estado |
|---|---|---|---|
| 0 | Tooling: pnpm, Vitest, scripts `typecheck` y `check`, GitHub Actions (lint/typecheck/test/build), commitlint + husky, plantilla de PR, CODEOWNERS, capa agéntica `.claude/`. | No toca `src/`. | **Completado** |
| 1 | **Fixtures primero.** Flag dev `?debug=record` en `CameraView` que descarga `{t, landmarks, worldLandmarks}[]` como JSON. Grabar 3–5 secuencias por ejercicio (lateral/frontal, buena/corta, ruidosa). Tests `exercises/*.test.ts` que reproducen fixtures contra los trackers actuales; snapshot golden de `{reps, transiciones, frames de pico}`. Arranca con fixtures sintéticos (senoidales con ruido). | Congela el comportamiento actual antes de refactorizar. | **Completado** (fixtures reales: #15) |
| 2 | `src/contracts/` con `LandmarkFrame`, `TrackerOutput`, `ExerciseTracker`; adaptadores finos sobre los 3 trackers; `CameraView` itera `Record<ExerciseId, ExerciseTracker>` y elimina el `if/else` de `CameraView.tsx:138-142`. | Golden sin cambios. | Pendiente |
| 3 | Partir `poseDetector.ts` en `detect(video, t) → {image, world}` + `SkeletonRenderer`; `CameraPoseSource` y `ReplayPoseSource`. | Ya estaba previsto en el ARCHITECTURE.md del MVP. | Pendiente |
| 4 | Extraer `FeedbackPolicy` (ambas estrategias) de `CameraView.tsx:146-188` a `src/feedback/`; tests con secuencias sintéticas (cooldown, utterance combinado, sin colisión). | `CameraView` baja a ~150 líneas. | Pendiente |
| 5 | `AnalysisPipeline` + store + `useAnalysisPipeline`; `CameraView → WorkoutScreen`. Playwright smoke con `--use-fake-device-for-media-stream`. | Pipeline probado por replay. | Pendiente |
| 6 | Convertir a workspace pnpm; mover carpetas a `packages/*` con sus tests (`git mv`, sin cambios de lógica). | CI verde. | Pendiente |
| 7 | `FeatureExtractor` v1 (ángulos con `calculateAngle` existente, angVel, simetría, trayectorias normalizadas); `PeakDetector` basado en tiempo reemplaza conteos de frames (golden actualizados con DEC). | Fixtures con timestamps reales. | Pendiente |
| 8 | Modo captura/etiquetado: ruta `/capture`, pantalla de consentimiento, chips de etiqueta (ejercicio, límites de rep propuestos por el tracker de reglas, tags de error), export JSON; subida a Storage cuando exista auth. | Detrás de feature flag. | Pendiente |
| 9 | Scaffold `ml/`: espejo pydantic de `LandmarkFrame`/`FeatureVector`, JSON→Parquet, test de paridad de features TS vs Python (tolerancia 1e-3), modelos baseline, export ONNX, reporte de evaluación. | Gate de modelo. | Pendiente |
| 10 | `ml-runtime` + `ModelRegistry` + `MlAnalyzer` en Worker; `EnsembleAnalyzer` en modo sombra → ponderado → ML primario con fallback. | Flag por ejercicio. | Pendiente |
| 11+ | `domain`, `api-client`, auth/perfiles/sincronización de sesiones, Edge Function `coach` (Claude), rutinas/calendario, entrenadores, pagos, comunidad. | Puertos mockeados en tests. | Pendiente |

**Pasos de integración de fitnetv2 (`DEC-054`).** Se intercalan con los PR anteriores, no forman una línea aparte:

| Paso | Contenido | Se solapa con | Estado |
|---|---|---|---|
| I-1 | Motor puro en `src/geometry/` y `src/analysis/` (§1) | — (no toca producción) | **Completado** en `claude/dazzling-maxwell-npeqcz`, sin mergear |
| I-2 | Trackers 3D reemplazan a los 2D, con los defectos de fitnetv2 corregidos (cooldown y pico en ms, asimetría, press con cadera visible, calibración congelada); cambia golden con DEC | PR 7 (`PeakDetector` en ms) | Pendiente |
| I-3 | `poseDetector` devuelve `{screen, world}`; `DeviceGravityTracker` como adaptador DOM; permiso de sensores en iOS (workstream A) | PR 3 | Pendiente |
| I-4 | UI de fitnetv2: catálogo, rutinas, editor, modo manual, perfil y logros, tutoriales y `Pose3DView` (three.js) en lazy, router (E + D) | PR 11+ | Pendiente |
| I-5 | Cuestionario, generador de rutinas y paywall (`DEC-056`, D + E) | PR 11+ | Pendiente |

### 2.5 Quality gates (CI en cada PR)

1. `pnpm check` = `pnpm lint` (incluirá las fronteras entre paquetes tras el PR 6) + `pnpm typecheck` + `pnpm test` + `pnpm build`, tal como lo ejecuta `.github/workflows/ci.yml`.
2. Cobertura mínima por paquete (`analysis-core` ≥ 80 %).
3. Regresión golden: fixtures reproducidos por cada `ExerciseTracker`, `FeedbackPolicy` y `FormAnalyzer`; cambiar un snapshot exige enlazar una DEC (un script lo verifica).
4. Paridad de features TS vs Python sobre el mismo fixture.
5. Gate de modelo: `ml/eval.py` escribe `reports/<task>@<version>.json`; CI lo compara con `ml/thresholds.yaml` y con la versión promovida; un PR que toca `models/manifest.json` falla sin reporte aprobado y `sha256` coincidente.
6. Playwright smoke: onboarding → workout con cámara falsa → chips → replay de fixture muestra reps ≥ 1; manifest y SW registrados.
7. Vercel preview por PR; presupuesto Lighthouse (shell ≤ 350 kB gz; modelos lazy).
8. Edge Functions con tests y esquemas zod de entrada/salida.

### 2.6 Backend y nube

Supabase `us-east-1` (`DEC-029`): Postgres con RLS, Auth, Storage (grabaciones de landmarks con consentimiento), Realtime (chat 1:1 por Broadcast desde trigger), Edge Functions (`coach` con Claude, webhooks de Recurrente/Paddle), `pg_cron` (rankings materializados, agregados nocturnos, ping anti-pausa). Solo `@movexnet/api-client` conoce al proveedor; `@movexnet/domain` define los puertos. Modelo de dominio en `docs/DOMAIN.md`.

## 3. Decisiones de diseño que se mantienen del MVP

- **Video + canvas superpuestos** (`object-fit: cover`, canvas sincronizado con `videoWidth/videoHeight` en cada frame) para que los landmarks normalizados se dibujen con la relación de aspecto real.
- **Singleton de módulo para `PoseLandmarker`**: la inicialización (descarga del modelo, compilación WASM) es cara y solo hay una cámara activa. En el layout objetivo vive dentro de `CameraPoseSource`.
- **`facingMode: 'environment'` por defecto**, con preferencia persistida en `localStorage('preferred_camera')` y validación explícita (DEC-024).
- **Unidades `dvw`/`dvh` y `viewport-fit=cover`** para móviles.
- **Overlay DOM** en lugar de texto en canvas (DEC-011/012).
