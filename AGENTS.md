# AGENTS.md — MovexNet

Guía operativa para cualquier agente de IA (Claude Code, Codex, Cursor, Gemini CLI) y para desarrolladores nuevos. Es vendor-neutral; lo específico de Claude Code está en `CLAUDE.md`. Estado vivo del proyecto: `docs/STATUS.md`.

## Qué es MovexNet

PWA mobile-first de entrenamiento con análisis de movimiento en tiempo real. La cámara del celular alimenta MediaPipe Pose (33 landmarks); sobre esos landmarks se cuentan repeticiones, se evalúa la técnica y se dan retroalimentación visual y de voz en español. Nació como MVP del curso IA26 (UMG, mayo 2026) con tres ejercicios (sentadilla, curl de bíceps, press de hombro) y evoluciona hacia una app de gimnasio completa: perfiles, análisis de fatiga/velocidad/consistencia, rutinas y calendario, planes de entrenadores, coaching asistido por IA, rankings, comunidad y modelo freemium. Visión y alcance: `docs/PRODUCT.md`.

## Mapa del repositorio

### Estado actual (`src/`, app Vite única)

| Ruta | Qué hay | Deuda conocida |
|---|---|---|
| `src/pose/camera.ts` | `startCamera`/`stopCamera` con `getUserMedia`. | — |
| `src/pose/poseDetector.ts` | Singleton `PoseLandmarker` (lite, `delegate: 'GPU'`), `detectAndDraw()` detecta **y** dibuja. | Descarta `result.worldLandmarks` (3D); mezcla detección y render. |
| `src/geometry/angles.ts` | `calculateAngle(A,B,C)` con `atan2`, tipo `Point2D` (2D, el que usa producción). | — |
| `src/geometry/{vectors3d,landmarkFilter,gravityAlign,standingCalibration,poseEmbedding}.ts` | Motor 3D puro traído de fitnetv2 (I-1 de `DEC-054`): ángulos 3D, filtro One Euro, nivelación por gravedad, calibración de pie, vector de rasgos del k-NN. Con tests. | — |
| `src/analysis/` | `movementQuality`, `fatigue`, `messages`, `cycleDetector`, `framePipeline` (DEC-057), `setSummary` (resumen de serie), `poseClassifier` + `knnDataset` (k-NN y LOSO, `DEC-055`). Workstream B. Con tests. | Curl y press usan el motor 3D solo con `?engine=3d`; la sentadilla, por defecto (`?engine=2d` la devuelve al 2D), y la ola 1, siempre (DEC-059, DEC-072). |
| `src/exercises/{tracker3d,definitions3d,plankTracker,demoPoses}.ts` | Motor de conteo 3D configurable (DEC-057): sentadilla, curl, press y ola 1 (flexiones, zancadas, puente, plancha). | Umbrales de la ola 1 sin calibrar con personas. |
| `src/feedback/feedbackPolicy.ts` | Política de voz de DEC-016 (PR 4), compartida por los dos motores. | — |
| `src/domain/{catalog,routineGenerator,tutorials,sessionHistory,payment}.ts` | Catálogo de 60 ejercicios (DEC-040/056), generador de rutinas por reglas (DEC-056), fichas de técnica (DEC-043/061), historial y estadísticas del día, puerto de pagos con `MockPaymentProvider` (regla dura 8). Workstream D. | El historial vive en `localStorage` hasta `api-client`. |
| `src/exercises/{squat,bicepCurl,shoulderPress}.ts` | Trackers con histéresis y gate de confirmación. | Sin interfaz común (`atBottom`/`atTop`/`atPeak`); constantes en frames a 60 fps (`REP_COOLDOWN_FRAMES=15`, `MIN_RISING_FRAMES=3`); `ArmTracker` y `ArmPressTracker` son el mismo detector con polaridad invertida. |
| `src/ui/workout/` | Pantalla de entrenamiento (DEC-058): `WorkoutScreen` (cámara, bucle, fases preparación/serie/resumen), `PrepPanel` (nivelador), `SetHud` (isla de aviso, contador), `SetSummaryView`, `coaching.ts` (frases y estrategia de voz), `exercises.ts` (motor por ejercicio, DEC-059), `MiniMap3D` + `miniMapLayout.ts` (mini mapa arrastrable), `bodyView.ts` (vista del cuerpo) y `SetTips` (DEC-061). | `WorkoutScreen` concentra cámara, bucle y fases; las frases de técnica usan umbrales de los contadores. |
| `src/ui/technique/`, `src/ui/components/Pose3DView.tsx` | Ficha de técnica en hoja inferior (demo 3D, pestañas) y visor three.js con órbita y zoom, siempre lazy (DEC-039/061). | El mini mapa comparte la GPU con MediaPipe; falta medir fps en gama baja. |
| `src/ui/{tokens.css,base.css,AppShell.tsx,screens/,components/,state/}`, `useSpeech.ts`, `Onboarding/` | Identidad y tokens (DEC-058, `docs/DESIGN.md`), navegación inferior con HashRouter (DEC-042), pantallas Hoy, Rutinas, Ejercicios, Perfil y Cuestionario, hoja Premium simulada, estado local validado, voz `es-ES`, bienvenida. | — |
| `public/sw.js`, `public/manifest.json` | PWA manual (network-first HTML, cache-first assets). | — |
| `docs/academico/` | Entregables del curso (histórico, no se edita). | — |

### Layout objetivo (monorepo pnpm; se alcanza en el PR 6 de `ARCHITECTURE.md`)

```
apps/web/            shell + features/{workout,capture,routines,profile,trainer}
packages/contracts   @movexnet/contracts   tipos + zod (co-propiedad B y D)
packages/pose-engine @movexnet/pose-engine cámara, detect-only, PoseSource, SkeletonRenderer
packages/analysis-core @movexnet/analysis-core ángulos, features, trackers, analyzers, FeedbackPolicy, AnalysisPipeline
packages/ml-runtime  @movexnet/ml-runtime  ModelRegistry, ONNX en Worker, MlAnalyzer
packages/domain      @movexnet/domain      entidades, puertos, casos de uso
packages/api-client  @movexnet/api-client  adaptadores Supabase, CoachAssistant HTTP, cola offline
packages/ui          @movexnet/ui          componentes, tokens
ml/                  Python: datasets, features (paridad con TS), train, eval, export ONNX
models/manifest.json artefactos publicados (sha256, versión)
fixtures/landmarks/  secuencias golden compartidas TS/Python
supabase/            migraciones, Edge Functions (coach)
e2e/                 Playwright
```

Hasta que exista `packages/`, las mismas fronteras aplican a `src/pose` (A), `src/exercises` + `src/geometry` + `src/analysis` + `src/feedback` (B), `src/domain` (D), `src/ui` (E).

## Reglas duras vigentes

1. **Mobile-first.** La prueba real es en celular (Android Chrome, iOS Safari). No se desarrolla para webcam de escritorio ni hay app nativa. La app debe ser responsiva y funcional en cualquier tamaño de celular, en vertical y en horizontal, respetando notch, Dynamic Island y barra de gestos (`DEC-060`, `docs/DESIGN.md` §7): áreas seguras solo con los tokens `--safe-*`, pantallas con scroll real y `scripts/audit-responsive.cjs` sin problemas antes de pedir revisión.
2. **El video nunca sale del dispositivo.** A la nube solo viajan landmarks y métricas estructuradas, con consentimiento explícito por grabación (`docs/DATA-GOVERNANCE.md`).
3. **No exponer claves.** API keys (Claude, pagos, service-role) viven solo en Edge Functions o secretos de CI. Nunca en el bundle ni en el repo.
4. **Español en UI y documentación entregable; identificadores de código en inglés.** Sin emojis en docs ni código.
5. **No cambiar snapshots golden sin una DEC enlazada en el PR.** Los fixtures de `fixtures/landmarks/` congelan el comportamiento en producción.
6. **`packages/contracts/**`, `src/contracts/**` y `models/manifest.json` solo se editan en ramas `adr/*` o `contracts/*`**, con bump semver y la DEC enlazada (`docs/WORKSTREAMS.md`). En Claude Code lo bloquea el hook `guard-protected-paths.mjs`.
7. **Cero costo, sin excepciones.** MovexNet es un proyecto de seminario y no factura (`DEC-035`): todo va sobre planes gratuitos (Supabase Free, Vercel Hobby, Kaggle, GitHub Actions, Hugging Face). Cualquier gasto real requiere DEC y aprobación explícita.
8. **Los pagos son simulados.** Se implementa el puerto `PaymentProvider` con `MockPaymentProvider`; el flujo es completo y demostrable, pero ningún cobro es real y la interfaz debe decirlo. Nunca integrar una pasarela real ni pedir datos de tarjeta.
9. **No instalar dependencias ni introducir tecnologías sin discutirlo**; si hace falta, proponerlo como opción con su DEC.

## Dirección de dependencias

```
contracts ← pose-engine ← analysis-core ← ml-runtime
contracts ← domain ← api-client
apps/web importa todo; nada importa apps/web
```

`@mediapipe/tasks-vision` solo en `pose-engine`; `onnxruntime-web` solo en `ml-runtime`; SDK de Supabase solo en `api-client`. `analysis-core` no importa React ni APIs del navegador: debe correr en Node con fixtures. Regla de lint: `import/no-restricted-paths` (`DEC-028`).

## Workstreams y propiedad

| Workstream | Posee | Consume |
|---|---|---|
| A. Pose & Captura | `packages/pose-engine`, `apps/web/src/features/capture`, `fixtures/` | `contracts.pose`, `recording` |
| B. Análisis & Runtime | `packages/analysis-core`, `packages/ml-runtime`, `models/manifest.json` | `contracts.*`, artefactos de C |
| C. ML Training | `ml/`, reportes de evaluación, artefactos ONNX | `fixtures`, `contracts.features` |
| D. Backend de producto | `packages/domain`, `packages/api-client`, `supabase/` | `contracts.domain`, `coach` |
| E. App & UI | `apps/web` (salvo capture), `packages/ui`, `e2e/` | todo vía interfaces |

`packages/contracts`: co-propiedad B + D. `docs/adr/`: aprueban B, D y E. Detalle, rituales y DoD: `docs/WORKSTREAMS.md`.

## Regla de oro

**Un agente edita solo dentro de su propiedad.** Si para cumplir una historia necesita algo de otro paquete (un campo nuevo en `LandmarkFrame`, un método en `FormAnalyzer`, una tabla), pide un **cambio de contrato**: abre un issue, propone la DEC (`docs/adr/TEMPLATE.md`) y espera la aprobación. No importa por rutas relativas a otro paquete, no duplica tipos, no "arregla de paso" código ajeno.

## Flujo de trabajo

- **Ramas cortas** desde `main`: `feat/*`, `fix/*`, `chore/*`, `adr/*`, `contracts/*`. `main` siempre desplegable (Vercel).
- **Conventional commits en español**: `feat(analysis-core): agregar PeakDetector basado en tiempo`, `docs(adr): DEC-034 ...`. **commitlint** (hook `commit-msg` de husky) rechaza los mensajes que no cumplan el formato.
- **Antes de abrir el PR:** `pnpm check` (lint + typecheck + test + build) en verde. El mismo comando corre en CI (`.github/workflows/ci.yml`).
- **PR pequeño** (< 400 líneas), sin aprobación obligatoria (`DEC-070`): CI en verde y el responsable del proyecto hace el squash merge; la revisión de CODEOWNERS es opcional, plantilla `.github/PULL_REQUEST_TEMPLATE.md` con checklist DoD.
- **Definition of Done:** tests verdes; golden intactos o DEC enlazada; docs del paquete actualizadas; preview probado en celular; entrada en `docs/CHANGELOG.md` si es visible al usuario; cambio de estado anotado en la descripción del PR (`docs/STATUS.md` lo actualiza solo el líder en la review semanal, `DEC-062`).
- **Numeración de DEC:** el número es provisional hasta el merge; si al mergear ya existe en `main`, renumera quien mergea segundo (`DEC-062`).
- **Una issue, una rama, una sesión de IA**; modelo y esfuerzo por tarea en `CLAUDE.md` (`DEC-062`).
- **Antes de un cambio grande, proponer plan** (archivos a tocar, contratos afectados) y esperar aprobación.
- El trabajo se organiza en issues de GitHub con etiquetas `epic`, `historia`, `adr`, `equipo` y `ws:A-pose`..`ws:E-app` (`ws:todos` para lo transversal), agrupadas por hito (`Sprint 0 — Fundación`, `Sprint 1 — Migración y datos`). Ver `docs/STATUS.md`.

## Dónde está cada cosa

| Necesito… | Archivo |
|---|---|
| Visión, alcance, freemium, roadmap | `docs/PRODUCT.md` |
| Identidad visual, tokens, componentes y movimiento | `docs/DESIGN.md` |
| Pipeline actual y objetivo, contratos, tabla de migración por PR | `ARCHITECTURE.md` |
| Por qué se decidió algo | `docs/adr/README.md` (índice), `DECISIONS.md` (acceso rápido) |
| Definición formal de una métrica | `docs/METRICS.md` |
| Entidades y glosario | `docs/DOMAIN.md` |
| Datos, fixtures, entrenamiento, evaluación, promoción de modelos | `docs/ML-PIPELINE.md` |
| Consentimiento, retención, RLS, licencias de datasets | `docs/DATA-GOVERNANCE.md` |
| Quién posee qué, rituales, DoD | `docs/WORKSTREAMS.md` |
| Estado actual, reparto del sprint y próximos pasos | `docs/STATUS.md` |
| Lo ya entregado, por hito | `docs/CHANGELOG.md` |
| Setup local, grabar fixtures, correr tests | `CONTRIBUTING.md` |
| Entregables históricos del curso | `docs/academico/README.md` |
| Agentes, skills y hooks de Claude Code | `.claude/README.md`, `CLAUDE.md` |

## Agentes especializados (`.claude/agents/`)

Cada agente tiene una sola responsabilidad y directorios acotados; espejan los workstreams para que la regla de propiedad sea la misma para humanos (CODEOWNERS) y para IA (`DEC-032`). Definiciones completas y detalle de hooks: `.claude/README.md`.

| Agente | Responsabilidad | Posee |
|---|---|---|
| `architect-guardian` | Revisa fronteras y contratos; propone ADR ante decisiones implícitas. | Nada (solo lectura). |
| `adr-scribe` | Redacta ADR en MADR y mantiene los índices. | `docs/adr/**`, `DECISIONS.md`. |
| `pose-engine-dev` | Cámara, MediaPipe, `PoseSource`, renderer, fixtures. | `src/pose/**` → `packages/pose-engine`, `fixtures/`. |
| `analysis-dev` | Trackers, analizadores, feedback, pipeline, golden. | `src/exercises/**`, `src/geometry/**`, `src/analysis/**` → `packages/analysis-core`, `packages/ml-runtime`. |
| `ml-engineer` | Datasets, features, entrenamiento, evaluación, ONNX. | `ml/**`, `models/**`. |
| `backend-dev` | Esquema, RLS, Edge Functions, `domain`, `api-client`. | `supabase/**`, `packages/domain`, `packages/api-client`. |
| `ui-dev` | Pantallas mobile-first, PWA, accesibilidad. | `src/ui/**`, `src/App.tsx`, `index.html`, `public/**` → `apps/web`, `packages/ui`. |
| `qa-engineer` | Tests, fixtures sintéticos, Playwright, DoD. | `**/*.test.ts`, `fixtures/**`, `e2e/**`. |
| `coach-prompt-engineer` | Prompts, esquemas y evals del `CoachAssistant`. | `supabase/functions/coach/**`, `evals/coach/**`. |
| `docs-keeper` | `docs/STATUS.md`, READMEs, `AGENTS.md`/`CLAUDE.md` sincronizados. | Solo Markdown. |

Si trabajas sin estos agentes (otra herramienta), asume el rol que corresponda a los directorios que tocas y respeta el mismo límite.
