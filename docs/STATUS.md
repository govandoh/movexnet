# MovexNet — Estado del proyecto

> Solo lo vigente. Lo actualiza el líder (o `docs-keeper` a su pedido) en la review semanal; los PRs de los workstreams no lo editan (DEC-062). Máximo 4 KB. Historial: `docs/CHANGELOG.md`. Decisiones: `docs/adr/README.md`.

**Última actualización:** 2026-10-05

## Hito actual: Sprint 1 — Migración y datos

La Fase 1 está en `main` (PRs #40 y #41, detalle en `docs/CHANGELOG.md`). 289 tests en verde. Siguen abiertos los pendientes de equipo del Sprint 0 (#18–#22).

**Sin validar en celular:** el motor 3D (`?engine=3d`, 7 ejercicios), las pantallas de la Fase 1, la técnica en 3D y los fps del mini mapa en gama baja. Es el requisito para predeterminar el 3D (#33).

## Reparto del sprint

Una persona por workstream y carpetas exclusivas. Cada issue tiene su brief (qué falta, archivos, criterio de aceptación) y su asignado.

| Dev | Workstream | Issues, en orden | Carpetas exclusivas | Depende de |
|---|---|---|---|---|
| A · @ChejoUMG | Pose y captura | #12 → #15 (fixtures reales con `world`) | `src/pose/**`, `fixtures/` | — |
| B · @ecaldcc | Análisis | #11 (rama `contracts/*`) → #33 (golden, requiere DEC) | `src/exercises/**`, `src/geometry/**`, `src/analysis/**`, `src/feedback/**`, `src/contracts/` | #33 espera #15 y las pruebas en celular |
| C · @christian15alda-netizen | ML | #38 → #16 (protocolo, con A) → #36 | `ml/` (nueva) | #36 necesita grabaciones de #16 |
| D · @govandoh (líder) | Backend y transversal | #17 → datos de #35 (calendario); #19, #21, #22, #32; `STATUS.md` semanal | `supabase/` (nueva), `src/domain/` | — |
| E · @eliasgregoriomp-svg | App y UI | Lo que falta de #34 (editor de rutinas, modo manual, tutoriales, logros) | `src/ui/**`, `public/**` | — |

**Primera semana, todos:** probar en su celular los 7 ejercicios con `?engine=3d` y una serie completa de la Fase 1. Resultados en una issue por dispositivo.

**Siguiente sprint:** #14 (PR 5, `AnalysisPipeline` y store; toca B y E, espera #11 y #12) y #37 (ST-GCN++, espera el dataset).

## Reglas para no chocar

- `package.json` y `pnpm-lock.yaml`: las dependencias nuevas van en un PR aparte, discutidas antes.
- `DEC-NNN`: el número es provisional hasta el merge; si choca, renumera quien mergea segundo.
- `src/App.tsx` y la navegación: los edita solo E; los demás piden la ruta o el chip en su issue.

## Pendientes que solo el equipo puede resolver

| Pendiente | Issue |
|---|---|
| Que ChejoUMG, ecaldcc y eliasgregoriomp-svg acepten la invitación al repositorio (sin eso CODEOWNERS no los cuenta ni se les puede asignar issues) | #18 |
| Crear el GitHub Project (`gh auth refresh -s project`) | #21 |
| Tope de costo del asistente IA, frescura de rankings, anti-trampa y aviso de privacidad | #22 |
| Precios teóricos y comisión para el análisis de rentabilidad (pagos simulados por DEC-035) | #20 |

## Comportamiento congelado conocido

Los golden del PR 1 documentan cinco sensibilidades del análisis 2D por reglas (fondo dependiente de los fps, spike de ruido, curl parcial atrapado en `flexed`, sentadilla corta sin feedback, curl bilateral y lateral indistinguibles). Detalle en `fixtures/README.md`; las resuelve el motor 3D (#33) y el PR 7.

## En producción

PWA en Vercel (Hobby), deploy en cada push a `main`. Sin backend ni cuentas. MediaPipe `@mediapipe/tasks-vision@0.10.35`, `pose_landmarker_lite`. fitnetv2 sigue en fitnetv2.netlify.app mientras se integra (DEC-054).
