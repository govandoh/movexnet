# MovexNet — Estado del proyecto

> Solo lo vigente. Lo actualiza el líder (o `docs-keeper` a su pedido) en la review semanal; los PRs de los workstreams no lo editan (DEC-062). Máximo 4 KB. Historial: `docs/CHANGELOG.md`. Decisiones: `docs/adr/README.md`.

**Última actualización:** 2026-10-20

## Hito actual: cierre del Sprint 1 — Migración y datos

El sprint venció el 16-oct con 6 de 9 issues cerradas. Pasan al siguiente: #14 (PR 5, sin asignar), #15 y #16 (datos reales). En `main`: cuentas en producción (#60), anti-trampa y `coach_usage` (#66), nombre y logo MovexNet (#63, #64), pose-engine con `CameraPoseSource` y `ReplayPoseSource` (#43–#45, #50), contrato `ExerciseTracker` (#46), editor de rutinas y modo manual (#54), calendario del programa en el dominio (#55). Tests: 505 unitarios, 71 pgTAP y 6 de extremo a extremo (`pnpm e2e`).

DEC-064 aceptada; #65 cerrada (seguimiento en #73).

**Validado en celular:** motor 3D con grabaciones reales (DEC-066, iPhone 17 Pro Max y S24 Ultra); cuentas en Android (S24 Ultra). **Sin validar:** cuentas en iOS Safari con la PWA instalada y fps del mini mapa en gama baja.

## Reparto del Sprint 2 (21-oct a 3-nov, hito en GitHub)

| Dev | Workstream | Issues, en orden | Depende de |
|---|---|---|---|
| A · @ChejoUMG | Pose y captura | #15 (fixtures reales) → #58 (curl y press en 3D); #16 con C | — |
| B · @ecaldcc | Análisis | #39 (ola 1 con personas) → #33 (3D por defecto, requiere DEC) | #33 espera #15 |
| C · @christian15alda-netizen | ML | #38 → #59 → #16 (protocolo, con A) → #36 | #36 espera las grabaciones de #16 |
| D · @govandoh (líder) | Backend y transversal | #35 (pantalla del calendario y recordatorios, tomada de E) → #73 (anti-trampa); sincronización del historial con la nube; `STATUS.md` semanal | — |
| E · @eliasgregoriomp-svg | App y UI | Solo #70 (CSP), con acompañamiento de D | — |
| Edwar | Pruebas en iPhone | #75 (cuentas en iOS Safari y con la PWA instalada) | — |

Sin asignar: #14 (PR 5, `AnalysisPipeline` y store; B y E) y #37 (ST-GCN++, espera el dataset).

## Reglas vigentes

- **Merge (DEC-070):** sin aprobaciones obligatorias. CI en verde (build, commitlint y tests de RLS) y squash merge del líder. Antes de mergear PRs de auth, migraciones o varios workstreams: `architect-guardian`, y `/security-review` si toca seguridad.
- `package.json` y `pnpm-lock.yaml`: dependencia nueva solo tras discutirla (regla dura 9).
- `DEC-NNN`: el número es provisional hasta el merge; si choca, renumera quien mergea segundo. Próxima libre: DEC-071.
- Migraciones: nunca editar una ya aplicada en la nube; corregir con una nueva. Si entra una con fecha anterior a la última aplicada: `supabase db push --include-all`.

## Pendientes del líder

| Pendiente | Dónde |
|---|---|
| Activar el flujo "Item closed → Done" del tablero (no se puede por API) | GitHub Project → Workflows |
| Asignar #75 a Edwar en GitHub cuando acepte la invitación | #75 |

## Comportamiento congelado conocido

Los golden del PR 1 documentan cinco sensibilidades del análisis 2D por reglas. Detalle en `fixtures/README.md`; las resuelve el motor 3D (#33) y el PR 7.

## En producción

PWA MovexNet en Vercel (Hobby), deploy en cada push a `main`. Cuentas activas (DEC-069): Supabase Auth en `us-east-1`, correo por Brevo, captcha Turnstile; la app pide cuenta antes de entrenar. MediaPipe `@mediapipe/tasks-vision@0.10.35`, `pose_landmarker_lite`.
