# DEC-070 · Merge sin revisión obligatoria: CI como única puerta y el responsable hace el squash merge

- **Estado:** Propuesta
- **Fecha:** 2026-10-20
- **Decisores:** @govandoh (responsable del proyecto, decide en representación del equipo)
- **Etiquetas:** `proceso`, `repositorio`
- **Ajusta:** las reglas de revisión de `DEC-032` (CODEOWNERS como aprobación obligatoria), de `docs/WORKSTREAMS.md` §2 y §3 y de `docs/adr/README.md`.

## Contexto y problema

`main` exigía 1 aprobación de un code owner por PR, y la documentación pedía 2 para ADR y contratos. En el Sprint 1 eso no funcionó: las revisiones llegaban tarde o no llegaban, cada push nuevo anulaba la aprobación (`dismiss_stale_reviews`) y los PRs quedaban días bloqueados. En la práctica, el responsable terminaba esperando en vez de construir. El proyecto es académico, con un equipo pequeño y sin facturación (`DEC-035`).

## Factores de decisión

- No frenar la construcción por esperas de revisión.
- Mantener las protecciones que sí funcionan sin depender de personas: CI, escaneo de secretos, PR obligatorio y `main` siempre desplegable.
- Que alguien responda de cada merge.

## Opciones consideradas

1. **Mantener la revisión obligatoria.** Descartada: es el cuello de botella que motivó esta DEC.
2. **Bajar a 1 aprobación también en ADR y contratos, sin code owner.** Sigue dependiendo de que alguien apruebe a tiempo.
3. **Sin aprobación obligatoria; CI como puerta y el responsable hace el merge** (elegida).

## Decisión

1. **Protección de `main`:**
   - PR obligatorio: nadie empuja directo a `main`.
   - **0 aprobaciones requeridas** y sin revisión obligatoria de code owners.
   - Checks requeridos: `lint · typecheck · test · build`, `commitlint (mensajes del PR)` y, nuevo, `migraciones y tests de RLS`.
   - Se mantiene la resolución de conversaciones.
2. **Solo squash merge:** el repositorio desactiva el merge commit y el rebase merge.
3. **Quién mergea:** el responsable del proyecto (@govandoh) hace el *squash and merge*. Es una regla del equipo, no técnica: GitHub no permite restringir quién mergea en un repositorio de cuenta personal.
4. **La revisión pasa a ser opcional y bienvenida.** `CODEOWNERS` se conserva para pedir revisión automáticamente y para que cada quien vea lo que toca su directorio, pero no bloquea. Los comentarios que lleguen se atienden igual.
5. **ADR y contratos:** ya no exigen 2 aprobaciones. Siguen exigiendo rama `adr/*` o `contracts/*` (hook `guard-protected-paths.mjs`), la DEC enlazada y bump semver en contratos. Una DEC pasa a `Aceptada` al mergearse.
6. **Revisión automática en su lugar:** antes de mergear un PR que toque más de un workstream, contratos, migraciones o autenticación, se corre `architect-guardian` y, si toca seguridad, `/security-review`. Su resultado va en la descripción del PR.

## Consecuencias

### Positivas

- Los PRs se mergean cuando el CI está en verde, sin esperas.
- Las protecciones automáticas siguen: CI, pgTAP de RLS, GitGuardian, `check-bundle-secrets` y el hook de rutas protegidas.

### Negativas y riesgos

- Menos ojos humanos sobre cada cambio. Se compensa con CI, con los agentes de revisión y con que los integrantes pueden comentar cuando quieran.
- Un integrante con permiso de escritura podría mergear igualmente. Se acepta como regla de equipo.
- Las reglas que antes citaban "2 aprobaciones" quedan como revisión recomendada.

## Documentos actualizados en este PR

`AGENTS.md`, `CONTRIBUTING.md`, `docs/WORKSTREAMS.md`, `docs/adr/README.md`, `docs/adr/TEMPLATE.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `.claude/README.md`, `.claude/skills/adr/SKILL.md`, `.claude/agents/adr-scribe.md`.

## Referencias

- `DEC-032` (CODEOWNERS), `DEC-035` (proyecto académico), `DEC-062` (el líder actualiza el estado y coordina).
