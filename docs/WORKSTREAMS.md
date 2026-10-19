# Fitnet — Workstreams, propiedad y proceso

> Responsabilidad de este archivo: quién posee qué, cómo se cambian los contratos compartidos, rituales ágiles y Definition of Done. Reglas duras y regla de oro: `AGENTS.md`. Fronteras técnicas: `ARCHITECTURE.md` y `DEC-028`. Agentes: `DEC-032`.

## 1. Workstreams (5 desarrolladores)

| Workstream | Dev | Posee (directorios, CODEOWNERS) | Consume (contratos) | Agentes asociados | Etiqueta |
|---|---|---|---|---|---|
| **A. Pose & Captura** | Dev A (`@ChejoUMG`) | `src/pose/` → `packages/pose-engine`, `apps/web/src/features/capture`, `fixtures/` | `contracts.pose` (`LandmarkFrame`, `PoseSource`, `SkeletonRenderer`), `contracts.recording` (`SessionRecorder`) | `pose-engine-dev` | `ws:A-pose` |
| **B. Análisis & Runtime** | Dev B (`@ecaldcc`) | `src/exercises/`, `src/geometry/`, `src/analysis/`, `src/feedback/` → `packages/analysis-core`, `packages/ml-runtime`, `models/manifest.json` | `contracts.*`, artefactos ONNX y reportes de C | `analysis-dev` | `ws:B-analysis` |
| **C. ML Training** | Dev C (`@christian15alda-netizen`) | `ml/`, `models/`, reportes de evaluación, artefactos ONNX en HF Hub | `fixtures/`, `contracts.features` (`FeatureVector`, esquema JSON v1) | `ml-engineer` | `ws:C-ml` |
| **D. Backend de producto** | Dev D (`@govandoh`, líder) | `packages/domain`, `packages/api-client`, `supabase/` (incl. Edge Function `coach`), `evals/coach/` | `contracts.domain`, `contracts.coach` (`CoachAssistant`) | `backend-dev`, `coach-prompt-engineer` | `ws:D-backend` |
| **E. App & UI** | Dev E (`@eliasgregoriomp-svg`) | `src/ui/`, `src/App.tsx`, `src/main.tsx`, `index.html`, `public/` → `apps/web` (salvo `features/capture`), `packages/ui`, `e2e/` | Todo vía interfaces; nunca implementaciones internas de otros paquetes | `ui-dev`, `qa-engineer` | `ws:E-app` |

Transversales: `architect-guardian` (revisión de fronteras, sin dueño de código), `adr-scribe` y `docs-keeper` (docs; cualquier dev puede invocarlos). Las issues que afectan a todos llevan `ws:todos`.

`.github/CODEOWNERS` ya codifica esta tabla, incluidas las rutas objetivo que aún no existen. La co-propiedad de contratos es de los leads B (`@ecaldcc`) y D (`@govandoh`). GitHub ignora a quien no tenga permiso de escritura, así que cada handle cuenta desde que acepta la invitación al repositorio (issue #18).

`src/contracts/` (que crea el PR 2) y `packages/contracts/` son co-propiedad de `@ecaldcc` (B) y `@govandoh` (D); `models/manifest.json`, de B y C. Los tests (`**/*.test.ts`) y `e2e/` los cubre además `qa-engineer`.

## 2. `packages/contracts`: reglas de cambio

`packages/contracts` (`@fitnet/contracts`) es **co-propiedad de B y D**. Es el único lugar donde se definen tipos y esquemas zod compartidos entre paquetes, con `ml/` (espejo pydantic) y con las Edge Functions.

1. Todo cambio va en rama `contracts/*` o `adr/*`. En Claude Code lo impone el hook `PreToolUse` `guard-protected-paths.mjs`, que bloquea con exit 2 las ediciones de `packages/contracts/**`, `src/contracts/**` y `models/manifest.json` fuera de esas ramas.
2. Requiere la DEC correspondiente enlazada si el cambio nace de una decisión. La revisión de B y D es recomendada, no obligatoria (`DEC-070`).
3. **Semver:** parche = documentación o validación más laxa; menor = campos opcionales nuevos; mayor = cambio rompiente.
4. Todo dato persistido o serializado (fixtures, `Recording`, `Metric`, `Report`, mensajes de Worker) lleva `schemaVersion`.
5. Los cambios rompientes conviven como `v2` junto a `v1` con un adaptador durante al menos un release; se elimina `v1` con DEC.
6. Quien necesite un cambio de contrato desde otro workstream abre un issue con la plantilla `adr` y propone la DEC; no modifica el paquete por su cuenta.

`models/manifest.json` sigue la misma regla de ramas y además el gate de promoción (`ML-PIPELINE.md` §9).

## 3. Proceso ágil

- **Sprints de 2 semanas.** El trabajo vive en issues de GitHub con etiquetas `epic`, `historia`, `adr`, `equipo` y `ws:A-pose`..`ws:E-app` (`ws:todos` para lo transversal), agrupadas por hito: `Sprint 0 — Fundación` y `Sprint 1 — Migración y datos`. Épicas = las 8 de `PRODUCT.md` + "Núcleo de IA" + "Plataforma/DevEx" (issues #1–#10). El tablero GitHub Projects con columnas Backlog → Ready → In progress → In review → Done está pendiente: crear el proyecto requiere el scope `project` en el token de `gh` (issue #21). Hasta entonces, el filtro por etiqueta e hito hace de tablero.
- **Trunk-based con ramas cortas:** `feat/*`, `fix/*`, `chore/*`, `adr/*`, `contracts/*`. PR pequeño (< 400 líneas), squash merge, `main` siempre desplegable (Vercel).
- **Revisión:** opcional (`DEC-070`). CODEOWNERS pide revisión al dueño del directorio sin bloquear. El responsable del proyecto hace el squash merge con el CI en verde; en PRs que cruzan workstreams, contratos, migraciones o autenticación, antes corre `architect-guardian` (y `/security-review` si toca seguridad).
- **Conventional commits** en español: `feat(analysis-core): ...`, `fix(pose-engine): ...`, `docs(adr): ...`, `chore(ci): ...`. commitlint + husky ya activos: el hook `commit-msg` rechaza los mensajes fuera de formato.
- **Branch protection en `main`:** PR obligatorio, CI verde (build, commitlint y tests de RLS), solo squash merge, sin aprobaciones requeridas (`DEC-070`). En el plan gratuito de GitHub solo funciona en repos públicos; si el equipo elige privado, cada integrante reclama el GitHub Student Developer Pack.

### Rituales

| Ritual | Cuándo | Contenido |
|---|---|---|
| Planning | Lunes de la semana 1 | Historias del sprint por épica; cada historia con workstream dueño y contratos afectados identificados. |
| Daily asíncrono | Cada día, canal del equipo | Qué hice, qué haré, bloqueos (especialmente cambios de contrato pendientes). |
| Revisión de arquitectura | 30 min por sprint | Se aprueban las ADR pendientes (`docs/adr/` con estado Propuesta); `architect-guardian` presenta fronteras violadas detectadas en PRs. |
| Review + retro | Viernes de la semana 2 | Demo en celular de lo mergeado; retro; actualización de `STATUS.md`. |

## 4. Definition of Done

Una historia está terminada cuando:

1. `pnpm check` (lint + typecheck + test + build) verde en local y en CI (`.github/workflows/ci.yml`).
2. Golden intactos, o DEC enlazada en el PR que justifica el cambio de snapshot.
3. Cobertura del paquete no baja del mínimo (`analysis-core` ≥ 80 %).
4. Docs del paquete (`packages/*/README.md`) actualizadas si cambió la API pública; `METRICS.md`/`DOMAIN.md` si cambió una métrica o entidad.
5. Preview de Vercel probado en un celular real (Android o iOS) para cualquier cambio de cámara, detección, feedback, voz o PWA.
6. Entrada en CHANGELOG si el cambio es visible al usuario.
7. `docs/STATUS.md` actualizado si cambió el hito, el estado de un PR de migración o una decisión.
8. Sin secretos, sin video ni datos de usuario en el repo, sin dependencias nuevas no discutidas.

La skill `/pr-ready` verifica los puntos 1–3 y genera la descripción del PR con este checklist.
