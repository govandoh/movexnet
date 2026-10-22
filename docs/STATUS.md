# MovexNet — Estado del proyecto

> Solo lo vigente. Lo actualiza el líder (o `docs-keeper` a su pedido) en la review semanal; los PRs de los workstreams no lo editan (DEC-062). Máximo 4 KB. Historial: `docs/CHANGELOG.md`. Decisiones: `docs/adr/README.md`.

**Última actualización:** 2026-10-21

## Hito actual: Sprint 2 — Datos reales, calendario y seguridad (21-oct a 3-nov)

7 de 17 issues cerradas (#15, #33, #35, #39, #58, #73, #75). En `main`: los siete ejercicios con motor 3D por defecto y `?engine=2d` de respaldo (#98, DEC-078), avisos de curl y press sin falsos positivos (#94, DEC-077), anti-trampa v1.1 (DEC-074), calendario y recordatorios con la app abierta (#76), CSP en Report-Only (#78). Tests: 578 unitarios, 71 pgTAP y 6 de extremo a extremo (`pnpm e2e`).

DEC-034 (en lo vigente), DEC-062, DEC-063 y DEC-065 a DEC-076 aceptadas el 21-oct.

**Validado en celular:** motor 3D con grabaciones reales (iPhone 17 Pro Max y S24 Ultra); cuentas en Android (S24 Ultra) y en iOS Safari con la PWA instalada (#75). Curl y press en 3D probados en celular antes del merge de #94 y #98. **Sin validar:** fps del mini mapa en gama baja.

## Reparto del Sprint 2

| Dev | Workstream | Issues, en orden | Depende de |
|---|---|---|---|
| A · @ChejoUMG (Sergio) | Pose y captura | #16 con C (grabar a 3 a 5 personas) → fixtures reales de la ola 1 | Retirar el código 2D espera a #16 |
| B · @ecaldcc (Edwar) | Análisis | #82 (rodilla hacia dentro en zancadas) → decidir voz y conteo de flexiones con mala cadera (#59); revisar el código de análisis de A | — |
| C · @christian15alda-netizen | ML | #59 (cierre tras la decisión de B) → #38 → #16 (protocolo, con A) → #36 | #36 espera las grabaciones de #16 |
| D · @govandoh (líder) | Backend y transversal | #95 (seguimiento de #75, falta probar en iPhone) → #87 (sincronización con la nube) → #88 (Web Push); `STATUS.md` semanal | #88 espera a #87 |
| E · @eliasgregoriomp-svg | App y UI | #70 (CSP estricta tras una semana en Report-Only, hacia el 27-oct) → #86 (avisos de audit-responsive) | — |

Sin asignar: #14 (PR 5, `AnalysisPipeline` y store; B y E), #37 (ST-GCN++, espera #16 y #36), fixtures reales de la ola 1 en el repo y los PR 6 a 10 de la migración (sin issue).

## Reglas vigentes

- **Merge (DEC-070):** sin aprobaciones obligatorias. CI en verde (build, commitlint y tests de RLS) y squash merge del líder. Antes de mergear PRs de auth, migraciones o varios workstreams: `architect-guardian`, y `/security-review` si toca seguridad.
- `package.json` y `pnpm-lock.yaml`: dependencia nueva solo tras discutirla (regla dura 9).
- `DEC-NNN`: el número es provisional hasta el merge; si choca, renumera quien mergea segundo. Próxima libre: DEC-079.
- Migraciones: nunca editar una ya aplicada en la nube; corregir con una nueva. Si entra una con fecha anterior a la última aplicada: `supabase db push --include-all`.

## Pendientes del líder

| Pendiente | Dónde |
|---|---|
| Aceptar o pedir cambios en DEC-077 y DEC-078 | `docs/adr/` |
| Activar el flujo "Item closed → Done" del tablero (no se puede por API) | GitHub Project → Workflows |

## Comportamiento congelado conocido

Los golden del PR 1 documentan cinco sensibilidades del análisis 2D por reglas. Detalle en `fixtures/README.md`; el motor 3D ya es el de por defecto (DEC-078) y los golden 3D de #98 cubren su comportamiento; los del 2D se conservan hasta retirarlo después de #16.

## En producción

PWA MovexNet en Vercel (Hobby), deploy en cada push a `main`. Cuentas activas (DEC-069): Supabase Auth en `us-east-1`, correo por Brevo, captcha Turnstile; la app pide cuenta antes de entrenar. MediaPipe `@mediapipe/tasks-vision@0.10.35`, `pose_landmarker_lite`.
