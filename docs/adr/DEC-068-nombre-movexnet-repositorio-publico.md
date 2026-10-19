# DEC-068 · Nombre del producto MovexNet y repositorio `movexnet`, que se mantiene público

- **Estado:** Propuesta
- **Fecha:** 2026-10-17
- **Decisores:** @govandoh (responsable del proyecto, decide en representación del equipo); el PR sigue las aprobaciones que exige `docs/adr/README.md`
- **Etiquetas:** `proceso`, `repositorio`, `marca`
- **Cierra:** issue #19.

## Contexto y problema

El repositorio se llama `govandoh/entrenador-personal-ia` (nombre heredado del MVP del curso) y el producto, la documentación y la app se llaman Fitnet. Existe el dominio fitnetapp.com (`docs/STATUS.md`) y el responsable prefiere dejar de usar ese nombre. Además hay que decidir si el repositorio sigue siendo público.

Hechos verificados el 2026-10-17:

- `govandoh/movexnet` **no existe** (404 de la API de GitHub). Una búsqueda web de "MovexNet" no encontró una app ni una marca con ese nombre (sí hay marcas parecidas, "Movex", en otros rubros). No se consultaron los registros oficiales de marcas (USPTO, WIPO).
- Se descartó **MoveNet**: es el nombre de un modelo de estimación de pose de Google, el mismo campo técnico de este producto, y aparece como marca en el registro de Justia (serie 74701411, estado no verificado).
- El repositorio es público y la protección de `main` (checks `lint · typecheck · test · build` y `commitlint`, 1 revisión, CODEOWNERS) y el escaneo de secretos funcionan sin costo. Hay un fork público de @ChejoUMG.
- No hay datos ni video de usuarios ni datasets externos versionados (`ml/data/*` en `.gitignore`, `DEC-065`).
- "Fitnet" aparece en 35 archivos de `src/` y 43 de `docs/` (sin `docs/academico/`), en `public/manifest.json` y en `index.html`.

## Opciones consideradas

### Nombre

1. **Mantener Fitnet.** Cero trabajo, pero conserva el conflicto con fitnetapp.com.
2. **MoveNet.** Descartada: coincide con el modelo de Google y con una marca registrada, riesgo de confusión.
3. **MovexNet** (elegida por el responsable): distinto de MoveNet y de Fitnet, sin coincidencias exactas encontradas.

### Visibilidad

1. **Mantener público** (elegida): protección de `main`, CODEOWNERS y escaneo de secretos sin costo ni trámites, y el proyecto no se comercializa a corto plazo (`DEC-035`).
2. **Privado con GitHub Pro.** Descartada por ahora: se perdería el escaneo de secretos gratuito, el fork público de @ChejoUMG quedaría desconectado, habría que verificar Vercel Hobby y dar acceso a los evaluadores del curso. Sin una necesidad real de confidencialidad, es trabajo que no construye producto.

## Decisión

### 1. Nombre

- El producto pasa a llamarse **MovexNet** y el repositorio a `govandoh/movexnet`.
- **Alcance, escalonado para no frenar la construcción:**
  1. Renombrar el repositorio en GitHub cuando se apruebe esta DEC. Conserva issues, PRs, secretos de Actions, el tablero y la integración con Vercel, y redirige los enlaces viejos (no crear luego un repositorio con el nombre viejo). Cada integrante ejecuta `git remote set-url origin https://github.com/govandoh/movexnet.git`.
  2. Un PR de documentación (`docs-keeper`): `README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/PRODUCT.md`, `docs/STATUS.md`, `CONTRIBUTING.md`, `ARCHITECTURE.md`, plantilla de issues y `package.json` (`name`).
  3. Un PR de UI y PWA a cargo de E (`ui-dev`): `public/manifest.json` (`name`, `short_name`), `index.html`, onboarding y textos visibles; subir la constante `CACHE` de `public/sw.js` (`DEC-025`).
  4. Los paquetes futuros pasan de `@fitnet/*` a **`@movexnet/*`** al crearse en el PR 6 de `ARCHITECTURE.md`. Como aún no existen no hay migración; `DEC-028` se matiza en este punto.
  5. Las DEC y `docs/academico/` **no se reescriben**: conservan el nombre con el que se escribieron. `fitnetv2` (repositorio de @ecaldcc) conserva el suyo (`DEC-054`).
- Los pasos 2 y 3 no son urgentes; se hacen cuando no interrumpan una historia en curso.
- Antes de cualquier comercialización se verifica el nombre en los registros oficiales de marcas y se revisa en una DEC nueva.

### 2. Visibilidad

El repositorio **se mantiene público**. Condiciones que ya se cumplen y se vigilan: nada de secretos en el repo ni en el bundle (solo URL y clave `publishable` de Supabase, `AGENTS.md` regla dura 3), nada de video ni datos de usuario ni datasets externos versionados (regla dura 2, `DEC-065`) y el escaneo de secretos y la protección contra push siguen activos. Cualquier fixture nuevo con grabaciones de personas requiere su aceptación (`DATA-GOVERNANCE.md` §2). Sigue sin licencia: el código es visible pero no reutilizable; si se quisiera abrir, se elige una en una DEC aparte.

Pasar a privado se reevalúa con una DEC nueva si cambia el alcance (por ejemplo, comercialización).

## Consecuencias

### Positivas

- El producto deja de depender del nombre Fitnet y evita el choque con MoveNet.
- No hay trabajo de visibilidad: la protección de `main` y el escaneo de secretos siguen como están.
- El equipo puede seguir construyendo; el renombrado se reparte en dos PR pequeños.

### Negativas

- El cambio de nombre toca ~80 archivos y deja el nombre mezclado hasta que terminen los dos PR.
- El código y el historial siguen siendo públicos; el control depende de no commitear secretos ni datos.
- El nombre no está verificado en registros oficiales de marcas.

## Referencias

- Issue #19; `docs/STATUS.md`; `README.md`.
- `DEC-025`, `DEC-028`, `DEC-035`, `DEC-054`, `DEC-065`, `AGENTS.md` reglas duras 2 y 3.
- Marca MOVENET (Justia): https://trademarks.justia.com/747/01/movenet-74701411.html
