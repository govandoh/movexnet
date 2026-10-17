# MovexNet

Entrenador personal en el navegador del celular: la cámara alimenta MediaPipe Pose, y la app cuenta repeticiones, evalúa la técnica y te habla en español, sin que el video salga de tu dispositivo.

- **Demo (PWA en Vercel):** _(URL de producción pendiente de publicar; ver `docs/STATUS.md`)_
- **Video demo:** https://youtu.be/SCQXUJRCDiE
- **Repositorio:** https://github.com/govandoh/movexnet (antes `entrenador-personal-ia`; el producto se llamó Fitnet hasta `DEC-068`)

## Qué hace hoy

- Detección de pose en tiempo real (33 landmarks) con `@mediapipe/tasks-vision` en Android Chrome e iOS Safari.
- Tres ejercicios con conteo de reps y feedback de forma: sentadilla, curl de bíceps (vista frontal y lateral) y press de hombro (con alerta de seguridad por codo bajo).
- Retroalimentación visual (barra inferior verde/amarillo/rojo) y de voz sin colisiones.
- PWA instalable, funciona offline tras la primera carga, cambio de cámara frontal/trasera.

## Hacia dónde va

MovexNet evoluciona a una app de gimnasio completa: análisis de fatiga, velocidad y consistencia con modelos propios en el dispositivo; perfiles, rutinas y calendario; planes de entrenadores, marketplace y coaching 1:1 asistido por IA; métricas, rankings, retos y comunidad; modelo freemium. Visión y roadmap: `docs/PRODUCT.md`. Estado actual: `docs/STATUS.md`.

## Stack

| Capa | Tecnología |
|---|---|
| UI | React 19, TypeScript, Vite 8, PWA manual (SW + manifest) |
| Pose | MediaPipe Pose Landmarker (lite) vía `@mediapipe/tasks-vision` 0.10.35, WASM desde jsDelivr |
| Análisis | Ángulos con `atan2`, máquinas de estados con histéresis (hoy); features + modelos ONNX en el navegador (objetivo, `DEC-027`) |
| Voz | Web Speech API (`SpeechSynthesis`, `es-ES`) |
| Backend (objetivo) | Supabase `us-east-1`: Postgres + RLS, Auth, Storage, Realtime, Edge Functions (`DEC-029`) |
| IA de coaching (objetivo) | Claude vía Edge Function, salida estructurada (`DEC-033`) |
| Pagos (objetivo) | Recurrente; Paddle secundario (`DEC-030`) |
| Deploy | Vercel (deploy automático desde `main`) |

## Quickstart

```bash
git clone https://github.com/govandoh/movexnet.git
cd movexnet
corepack enable    # Node 22+; activa pnpm 12 según packageManager
pnpm install
pnpm dev           # HTTPS local expuesto a la LAN: abre https://<ip-local>:5173 en el celular
```

La prueba real es en un celular: cámara, voz y PWA no se validan en desktop. Detalle en `CONTRIBUTING.md`.

## Estructura

```
src/pose/          cámara y MediaPipe
src/geometry/      ángulos 2D y 3D, nivelación, filtro One Euro, calibración, vector de rasgos
src/analysis/      calidad de movimiento, fatiga, clasificador k-NN de posturas
src/exercises/     trackers por ejercicio (sentadilla, curl, press) y demos 3D
src/ui/            CameraView, overlay, voz, onboarding
public/            manifest, service worker, iconos
docs/              producto, dominio, métricas, ML, datos, workstreams, estado, ADRs
docs/academico/    entregables del MVP del curso IA26 (histórico)
scripts/           generación de los .docx académicos
```

Layout objetivo (monorepo pnpm con `apps/web`, `packages/@movexnet/*`, `ml/`, `supabase/`): `ARCHITECTURE.md`.

## Documentación

| Documento | Contenido |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Reglas del repo, propiedad, regla de oro (para humanos y agentes de IA) |
| [`CLAUDE.md`](CLAUDE.md) | Específico de Claude Code (skills, hooks, cómo trabajar) |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Pipeline actual, arquitectura objetivo, contratos, plan de migración |
| [`docs/PRODUCT.md`](docs/PRODUCT.md) | Visión, alcance, freemium, roadmap |
| [`docs/DOMAIN.md`](docs/DOMAIN.md) | Glosario y modelo de dominio |
| [`docs/METRICS.md`](docs/METRICS.md) | Definición formal de cada métrica |
| [`docs/ML-PIPELINE.md`](docs/ML-PIPELINE.md) | Datos, features, entrenamiento, evaluación, promoción de modelos |
| [`docs/DATA-GOVERNANCE.md`](docs/DATA-GOVERNANCE.md) | Consentimiento, retención, RLS, licencias de datasets |
| [`docs/WORKSTREAMS.md`](docs/WORKSTREAMS.md) | Workstreams, reglas de contratos, rituales, DoD |
| [`docs/STATUS.md`](docs/STATUS.md) | Estado vivo del proyecto |
| [`docs/adr/`](docs/adr/README.md) | Decisiones de arquitectura (DEC-001 … DEC-033) |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Setup, ramas, PR, fixtures, tests, `ml/` |

## Origen

Proyecto final del curso Inteligencia Artificial (IA26), Universidad Mariano Gálvez de Guatemala, mayo 2026. Los entregables académicos están en `docs/academico/`.

## Licencia

Pendiente de definir por el equipo. Hasta entonces, todos los derechos reservados.
