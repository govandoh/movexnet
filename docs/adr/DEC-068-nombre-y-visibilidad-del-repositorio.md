# DEC-068 · Nombre y visibilidad del repositorio: renombrar a `fitnet` y mantenerlo público

- **Estado:** Propuesta
- **Fecha:** 2026-10-17
- **Decisores:** @govandoh (responsable del proyecto, propone); aprueban B, D y E (`docs/adr/README.md`)
- **Etiquetas:** `proceso`, `repositorio`
- **Cierra:** issue #19.

## Contexto y problema

El repositorio se llama `govandoh/entrenador-personal-ia`, nombre heredado del MVP del curso, mientras el producto, la documentación y la app se llaman Fitnet (`README.md` ya anota "renombrado a `fitnet` pendiente"). Además existe el dominio fitnetapp.com (`docs/STATUS.md`), lo que obliga a decidir si el nombre del producto es un problema.

Hechos verificados el 2026-10-17:

- `govandoh/fitnet` **no existe** (la API de GitHub responde 404), así que el nombre está libre.
- El repositorio es **público**, sin licencia declarada (`license: null`) y con discusiones desactivadas (la plantilla de issues apunta a `/discussions`).
- La protección de `main` está activa: checks obligatorios `lint · typecheck · test · build` y `commitlint`, 1 revisión y revisión de CODEOWNERS. En el plan gratuito de GitHub esto solo funciona en repositorios públicos.
- El escaneo de secretos y la protección contra push de secretos están habilitados.
- No hay datos ni video de usuarios ni datasets externos versionados: `ml/data/raw`, `out` y `samples` están en `.gitignore` y `git ls-files` solo lista código y metadatos de MM-Fit (`DEC-065`). Los fixtures de `fixtures/landmarks/` son landmarks de grabaciones del equipo.
- Ningún workflow ni el `CODEOWNERS` referencian el nombre del repositorio.

## Opciones consideradas

### Nombre

1. **Mantener `entrenador-personal-ia`.** Cero trabajo, pero el nombre no describe el producto y confunde en el tablero, en los PRs y en la presentación del seminario.
2. **Renombrar a `fitnet`** (elegida): coincide con el producto, GitHub redirige el nombre viejo (web, `git` y API) y los issues, PRs, secretos y el tablero del proyecto se conservan.
3. **Renombrar a `fitnet-app`** u otro sufijo. Descartada: sin ganancia real; el conflicto con fitnetapp.com es de dominio, no de GitHub.

### Visibilidad

1. **Público** (elegida): protección de `main` y CODEOWNERS ya funcionan; no depende de que cada integrante tramite nada.
2. **Privado con GitHub Pro vía Student Developer Pack.** Cada uno de los cinco integrantes debe reclamarlo y mantenerlo vigente; si uno falla, la protección de `main` deja de aplicarse para quien pushee. Más fricción para un beneficio de confidencialidad que el proyecto no necesita (no hay código comercial ni datos de usuarios en el repo).

## Decisión

1. **Renombrar el repositorio a `govandoh/fitnet`.** El nombre del producto sigue siendo **Fitnet**. Al ser un proyecto académico sin comercialización (`DEC-035`), la coincidencia con fitnetapp.com no se considera un impedimento; no se registra ni usa ese dominio. Si el proyecto se comercializara, el nombre se revisa en una DEC nueva antes de publicar.
2. **Mantener el repositorio público.** Condiciones que ya se cumplen y que se vigilan:
   - nada de secretos en el repo ni en el bundle: solo URL y clave `publishable` de Supabase (`AGENTS.md` regla dura 3; #60 añade un grep de `service_role`/`sb_secret`);
   - nada de video, datos de usuario ni datasets externos versionados (reglas duras 2 y `DEC-065`);
   - cualquier fixture nuevo con grabaciones de personas requiere que la persona lo haya aceptado (`DATA-GOVERNANCE.md` §2);
   - el escaneo de secretos y la protección contra push siguen activos.
3. **Sin licencia por ahora.** Sin archivo `LICENSE` el código es visible pero no reutilizable, coherente con un proyecto académico. Si el equipo quiere permitir reutilización, se elige una licencia en una DEC aparte; esta no la decide.
4. **Procedimiento del renombrado** (lo ejecuta @govandoh tras la aprobación):
   1. En GitHub, *Settings → Repository name* → `fitnet`. No crear después otro repositorio llamado `entrenador-personal-ia` en la misma cuenta: rompería la redirección.
   2. Cada integrante actualiza su remoto: `git remote set-url origin https://github.com/govandoh/fitnet.git`.
   3. Verificar que Vercel sigue conectado al repositorio y que el siguiente push a `main` despliega.
   4. PR de chore (`chore/renombrar-repositorio`) con las referencias: `package.json` (`name`), `README.md`, `CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE/config.yml`, `docs/PRODUCT.md` y la fila de `docs/STATUS.md` (lo hace el líder). `supabase/config.toml` (`project_id`) es el identificador local de Docker y no se toca. Las DEC históricas no se reescriben.
   5. Activar las discusiones del repositorio o quitar el enlace de la plantilla de issues.

## Consecuencias

### Positivas

- El nombre del repositorio coincide con el del producto y deja de mostrar el nombre del MVP.
- La protección de `main` sigue funcionando sin trámites individuales.
- Issues, PRs, tablero (proyecto de usuario #2), secretos de Actions y la integración con Vercel se conservan; los enlaces viejos redirigen.

### Negativas

- Un repositorio público expone el código y el historial; el control depende de no commitear secretos ni datos, no de la privacidad.
- Las redirecciones no sustituyen actualizar los remotos locales ni las referencias en la documentación.
- Quien conserve un clon con el remoto viejo seguirá empujando por la redirección sin notarlo; funciona, pero conviene corregirlo.
- La coincidencia con fitnetapp.com queda como riesgo aceptado, no eliminado.

## Referencias

- Issue #19; `docs/STATUS.md` (pendientes de equipo); `README.md`.
- `DEC-035` (proyecto académico), `DEC-065` (datasets), `AGENTS.md` reglas duras 2 y 3, `DEC-032` (CODEOWNERS).
- GitHub: renombrar un repositorio redirige la web, `git` y la API al nombre nuevo.
