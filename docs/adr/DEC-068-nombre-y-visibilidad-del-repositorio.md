# DEC-068 · Nombre del producto MoveNet, repositorio `movenet` y visibilidad privada

- **Estado:** Propuesta
- **Fecha:** 2026-10-17
- **Decisores:** @govandoh (responsable del proyecto, decide en representación del equipo); el PR sigue las aprobaciones que exige `docs/adr/README.md`
- **Etiquetas:** `proceso`, `repositorio`, `marca`
- **Cierra:** issue #19.

## Contexto y problema

El repositorio se llama `govandoh/entrenador-personal-ia` (nombre heredado del MVP del curso) y el producto, la documentación y la app se llaman Fitnet. Existe el dominio fitnetapp.com (`docs/STATUS.md`), y el responsable prefiere no seguir usando el nombre Fitnet. Además hay que decidir si el repositorio se mantiene público.

Hechos verificados el 2026-10-17:

- `govandoh/movenet` **no existe** (404 de la API de GitHub).
- El repositorio es público, sin licencia y con un fork público de @ChejoUMG (`ChejoUMG/entrenador-personal-ia`).
- La protección de `main` está activa: checks `lint · typecheck · test · build` y `commitlint`, 1 revisión y revisión de CODEOWNERS. En el plan gratuito eso solo funciona en repositorios públicos.
- El escaneo de secretos y la protección contra push de secretos están habilitados (gratis en repositorios públicos).
- La cuenta propietaria (@govandoh) tiene GitHub Pro (Student Developer Pack, confirmado por el responsable). La disponibilidad de las reglas de rama en un repositorio de cuenta personal depende del plan del **propietario**, no del de cada colaborador (los cinco integrantes tienen permiso de escritura).
- No hay datos ni video de usuarios ni datasets externos versionados (`ml/data/*` en `.gitignore`, `DEC-065`).
- "Fitnet" aparece en 35 archivos de `src/` y 43 de `docs/` (sin contar `docs/academico/`), en `public/manifest.json` y en `index.html`.

## Opciones consideradas

### Nombre

1. **Mantener Fitnet.** Cero trabajo, pero conserva el conflicto con fitnetapp.com que el responsable quiere evitar.
2. **MoveNet** (elegida por el responsable): corto, descriptivo del producto, GitHub lo tiene libre.
3. **Otro nombre.** No se evaluó: el responsable ya eligió.

### Visibilidad

1. **Público.** Protección de `main` y escaneo de secretos sin costo, pero expone el código y el historial.
2. **Privado con GitHub Pro del propietario** (elegida por el responsable): el código deja de ser visible a terceros, a cambio de perder el escaneo de secretos gratuito y de ciertas obligaciones (ver Consecuencias).

## Decisión

### 1. Nombre

- El producto pasa a llamarse **MoveNet**. El repositorio pasa a `govandoh/movenet`.
- **Alcance del cambio de nombre** (escalonado para no bloquear a nadie):
  1. Ahora: renombrar el repositorio en GitHub.
  2. Chore de documentación (`docs-keeper`, un PR): `README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/PRODUCT.md`, `docs/STATUS.md`, `CONTRIBUTING.md`, `ARCHITECTURE.md`, plantilla de issues y `package.json` (`name`).
  3. UI y PWA (lo hace E, `ui-dev`, en su propio PR): nombre visible en `public/manifest.json` (`name`, `short_name`), `index.html`, onboarding y textos de la app; subir la constante `CACHE` de `public/sw.js` (`DEC-025`) y revisar el ícono/título.
  4. Los paquetes futuros pasan de `@fitnet/*` a **`@movenet/*`** al crearse en el PR 6 de `ARCHITECTURE.md`; como aún no existen, no hay migración. `DEC-028` se matiza en este punto.
  5. Las DEC y `docs/academico/` **no se reescriben**: conservan el nombre con el que se escribieron; el nombre de producto vigente es el de esta DEC. `fitnetv2` (repositorio de @ecaldcc) conserva su nombre, es otro proyecto (`DEC-054`).
- **Riesgo aceptado:** MoveNet es también el nombre de un modelo de estimación de pose de Google (TensorFlow/TF Hub), el mismo dominio técnico que este producto. Puede causar confusión al buscar y, si el proyecto se comercializara, un conflicto de marca. No se verificó el registro de marca. Mitigación: el proyecto es académico y no se comercializa (`DEC-035`); el README aclara que la detección usa **MediaPipe Pose**, no MoveNet de Google; si hubiera comercialización, el nombre se revisa en una DEC nueva antes de publicar.

### 2. Visibilidad

- El repositorio pasa a **privado**, condicionado a que se cumplan estas verificaciones, en este orden, antes de cambiar la visibilidad:
  1. @govandoh tiene GitHub Pro vigente (confirmado). Debe renovarse cada año; si caduca, las reglas de rama de un repositorio privado dejan de aplicarse.
  2. **Fork público de @ChejoUMG:** al volverse privado el repositorio, ese fork queda público y desconectado. @ChejoUMG lo borra o lo hace privado y trabaja desde ramas del repositorio principal (tiene permiso de escritura).
  3. **Escaneo de secretos:** al ser privado se pierde el escaneo y la protección de push gratuitos (en repositorios privados de cuentas personales son parte de una oferta de pago; a verificar). Mitigación obligatoria, sin costo: no se versionan secretos (`AGENTS.md` regla dura 3), solo URL y clave `publishable` de Supabase, y #60 añade el grep de `service_role`/`sb_secret`/`eyJhbGci` en CI. Añadir un escáner (por ejemplo `gitleaks` como paso de CI) requiere aprobación previa como cualquier dependencia nueva.
  4. **Vercel Hobby:** confirmar que sigue desplegando `main` y los previews de los colaboradores con el repositorio privado; si no, se vuelve a público o se decide otra vía (nueva DEC).
  5. **Docente y evaluadores:** quien deba revisar el código (el curso, el seminario) necesita invitación explícita como colaborador de solo lectura. `docs/academico/` enlaza al repositorio y no se edita.
  6. **Minutos de Actions:** 3000/mes en repositorios privados con Pro (ilimitados hoy por ser público). El CI y los dos pings semanales de Supabase caben de sobra; se revisa si el uso supera el 60 %.
  7. Tras el cambio: comprobar en *Settings → Branches* que las reglas de `main` siguen vigentes.
- Sigue sin licencia. En un repositorio privado no hace falta; si algún día se abre, se elige una en una DEC aparte.

### 3. Orden

Renombrar a `movenet` primero y volver privado después, para no mezclar dos causas si algo falla. El renombrado conserva issues, PRs, secretos de Actions, el tablero y la integración con Vercel, y redirige los enlaces viejos (no crear luego un repositorio con el nombre viejo). Cada integrante ejecuta `git remote set-url origin https://github.com/govandoh/movenet.git`.

## Consecuencias

### Positivas

- El producto deja de depender del nombre Fitnet y del conflicto con fitnetapp.com.
- El código y el historial dejan de ser públicos.
- La protección de `main` y CODEOWNERS se mantienen mientras Pro esté vigente.

### Negativas

- **Colisión de nombre con el modelo MoveNet de Google** (riesgo aceptado arriba).
- Se pierde el escaneo de secretos gratuito; el control pasa a depender de la disciplina del equipo y del grep de CI.
- Dependencia de que Pro siga vigente; hay que acordarse de renovarlo.
- El cambio de nombre toca ~80 archivos entre código y documentación; se reparte en dos PR (documentación y UI/PWA) y deja el nombre mezclado hasta que terminen.
- Los evaluadores del curso ya no ven el repositorio sin invitación.

### Qué se actualiza como consecuencia

`docs-keeper`: la lista del punto 1.2. `ui-dev` (E): el punto 1.3. `docs/STATUS.md` (líder): quitar la fila de #19. `DEC-028` no se reescribe: se anota el cambio de scope al ejecutar el PR 6.

## Referencias

- Issue #19; `docs/STATUS.md`; `README.md`.
- `DEC-025` (service worker y `CACHE`), `DEC-028` (paquetes), `DEC-035` (proyecto académico), `DEC-054` (fitnetv2), `DEC-065` (datasets), `AGENTS.md` reglas duras 2 y 3.
