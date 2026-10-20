# Contribuir a Fitnet

Guía práctica. Las reglas del proyecto están en `AGENTS.md`; la propiedad por directorio y la Definition of Done en `docs/WORKSTREAMS.md`; el estado actual en `docs/STATUS.md`.

## 1. Setup local

Requisitos: **Node 22 o superior**, **pnpm 12** (`corepack enable` lo activa desde `packageManager` del `package.json`), Git, un celular Android o iOS en la misma red Wi-Fi que tu equipo.

```bash
git clone https://github.com/govandoh/entrenador-personal-ia.git fitnet
cd fitnet
pnpm install          # instala dependencias y los hooks de husky (script "prepare")
pnpm dev
```

`pnpm dev` levanta Vite con `host: true` y HTTPS local (`@vitejs/plugin-basic-ssl`, `DEC-020`). La consola muestra una URL `https://192.168.x.x:5173`.

### Probar en el celular (obligatorio para cámara, detección, voz y PWA)

1. Abre esa URL en el celular. El navegador avisará "sitio no seguro" por el certificado autofirmado; acéptalo una vez.
2. iOS Safari rechaza certificados autofirmados con más severidad: si no carga, usa la URL de preview de Vercel del PR.
3. Concede permiso de cámara. Para forzar el onboarding de nuevo, borra `localStorage` del sitio (o la clave `ob_complete_v1`).
4. El primer `speak()` requiere un gesto del usuario en iOS: el botón "Comenzar a entrenar" del onboarding lo desbloquea.
5. Prueba con la PWA **instalada** (Añadir a pantalla de inicio) cuando toques cámara o Service Worker: hay bugs que solo aparecen en modo standalone (`DEC-021`).

Comandos:

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo con HTTPS y HMR. |
| `pnpm build` | `tsc -b && vite build` → `dist/`, y falla si el bundle contiene una clave secreta (`scripts/check-bundle-secrets.mjs`). |
| `pnpm preview` | Sirve `dist/` para probar el build (y el SW) localmente. |
| `pnpm lint` | ESLint (incluirá la regla de fronteras entre paquetes tras el PR 6). |
| `pnpm typecheck` | `tsc --noEmit` sobre `tsconfig.app.json` y `tsconfig.node.json`. |
| `pnpm test` | `vitest run`, incluidos los golden tests. |
| `pnpm test:watch` | Vitest en modo watch. |
| `pnpm check` | `lint + typecheck + test + build`. **Es lo que corre CI**; pásalo antes de abrir el PR. |
| `pnpm test -u` | Actualiza snapshots. **Solo con una DEC enlazada en el PR.** |
| `pnpm e2e` | Pruebas de extremo a extremo con Playwright (`e2e/`) contra Supabase local: requiere `pnpm db:start`. Hoy cubre las cuentas (#60). La primera vez: `pnpm exec playwright install chromium`. |

### Cuentas en local (issue #60, `DEC-069`)

Sin variables, la app funciona sin cuentas, como en producción. Para probarlas:

1. `pnpm db:start` (Docker) y `pnpm db:reset` para aplicar las migraciones.
2. Copia `.env.example` a `.env.local` (ignorado por git) y ajústalo:
   ```
   VITE_ENABLE_ACCOUNTS=true
   VITE_SUPABASE_URL=http://127.0.0.1:54321
   VITE_SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY que imprime db:start>
   VITE_TURNSTILE_SITE_KEY=
   ```
3. Los correos de confirmación y recuperación llegan a Mailpit: `http://127.0.0.1:54324`.

Todo lo que empieza por `VITE_` es público. Nunca pongas la `service_role` ni una clave `sb_secret_` en un `.env` del cliente: las cuentas no arrancan y `pnpm build` falla. Los ajustes de la nube (SMTP, captcha, URLs de redirección) están en la tabla de `DEC-069` y se cambian en el panel de Supabase.

## 2. Ramas y commits

- Rama corta desde `main`: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`, `adr/<slug>`, `contracts/<slug>`. Nunca commits directos a `main`.
- **Conventional commits en español**, verificados por **commitlint** (`@commitlint/config-conventional`) desde el hook `commit-msg` de husky: un mensaje que no empiece por `tipo(scope): ` en minúscula, o cuyo encabezado pase de 100 caracteres, es **rechazado** y el commit no se crea. Los hooks se instalan con `pnpm install`. Scope = paquete o área:
  - `feat(analysis-core): agregar PeakDetector basado en tiempo`
  - `fix(pose-engine): liberar srcObject al detener cámara`
  - `docs(adr): DEC-034 hosting comercial de la PWA`
  - `chore(ci): agregar job de golden`
  - `test(exercises): fixtures sintéticos para press`
- Un commit por bloque lógico; el cuerpo explica el "por qué" y cita DEC cuando aplica.
- Tipos admitidos: `feat`, `fix`, `docs`, `chore`, `test`, `refactor`, `perf`, `build`, `ci`, `style`, `revert`.

## 3. PR y revisión

1. Antes de abrir el PR: `pnpm check` en verde (o `/pr-ready` en Claude Code). CI corre lo mismo en `.github/workflows/ci.yml`.
2. Título con el mismo formato de conventional commit. Cuerpo con la plantilla `.github/PULL_REQUEST_TEMPLATE.md`: qué, por qué, cómo se probó (dispositivo real), checklist DoD, DEC enlazadas, issue que cierra.
3. PR pequeño (< 400 líneas). Si crece, divídelo.
4. Revisión opcional (`DEC-070`): CODEOWNERS pide revisión al dueño del directorio, pero no bloquea. Mergea el responsable del proyecto cuando el CI está en verde.
5. Solo squash merge (el repositorio no permite otro). Vercel publica un preview por PR; enlázalo en la descripción y confirma que lo probaste en celular.
6. Si el PR cambia el hito, el estado de la migración o una decisión, anótalo en la descripción del PR. `docs/STATUS.md` lo actualiza el líder en la review semanal (`DEC-062`); no lo edites en tu PR.

Definition of Done completa: `docs/WORKSTREAMS.md` §4.

## 4. Grabar un fixture de landmarks

Los fixtures (`fixtures/landmarks/*.json`) congelan el comportamiento actual y alimentan `ml/`. Esquema JSON v1 en `docs/ML-PIPELINE.md` §2.

1. Abre la app en el celular con `?debug=record` en la URL (flag de desarrollo del PR 1, en curso; no aparece en producción sin el flag).
2. Elige el ejercicio, colócate en la vista deseada (lateral, frontal, 45°) y ejecuta 5–10 reps del caso que quieres capturar: buena forma, ROM corto, ruidosa (cámara en mano), error concreto.
3. Detén la grabación: el navegador descarga un JSON con `{t, landmarks, worldLandmarks}[]` por frame y metadata del dispositivo.
4. Renómbralo `<exerciseId>_<view>_<condición>_<nnn>.json` (p. ej. `squat_side_shallow_002.json`) y cópialo a `fixtures/landmarks/`.
5. Añade el caso al test de replay del tracker correspondiente (`exercises/*.test.ts`) con las expectativas de `{reps, transiciones, frames de pico}`; la primera ejecución crea el snapshot golden.
6. Si el fixture contiene datos de una persona real, necesita `consentId` (ver `docs/DATA-GOVERNANCE.md`); los fixtures del equipo grabándose a sí mismo llevan el consentimiento del propio desarrollador. Nunca subas video.

En Claude Code, `/fixture` guía estos pasos.

## 5. Correr tests y golden

- `pnpm test` ejecuta unit tests y replays de fixtures. Un golden roto significa que cambió el comportamiento observable de un tracker, política o analizador.
- Si el cambio es un bug fix o una decisión deliberada: crea la DEC (`docs/adr/TEMPLATE.md`), enlázala en el PR y entonces actualiza el snapshot. El CI rechaza snapshots cambiados sin DEC enlazada.
- Si no era intencional: revisa el diff del snapshot antes de tocar nada.
- Fixtures sintéticos (senoidales con ruido) se generan con el script de PR 1; sirven para golden, no para entrenar.

## 6. Correr `ml/` (pendiente: se crea en el PR 9)

Objetivo (ver `docs/ML-PIPELINE.md`):

```bash
cd ml
uv sync                       # o pip install -e .
python -m ml.datasets.ingest ../fixtures/landmarks   # JSON → Parquet
pytest tests/test_feature_parity.py                   # paridad TS vs Python (tolerancia 1e-3)
python -m ml.train --task exercise_classifier --for-product
python -m ml.eval  --task exercise_classifier --loso  # escribe reports/<task>@<version>.json
python -m ml.export_onnx --task exercise_classifier
```

Entrenamientos largos corren en Kaggle; los notebooks viven en `ml/notebooks/` y solo llaman al código del paquete. La promoción de un modelo (`models/manifest.json`) sigue el gate de `docs/ML-PIPELINE.md` §9 y se hace en rama `adr/*` o `contracts/*`.

## 7. Proponer una ADR

1. Rama `adr/<slug>`.
2. Copia `docs/adr/TEMPLATE.md` a `docs/adr/DEC-NNN-<slug>.md` (siguiente número libre en `docs/adr/README.md`), estado `Propuesta`.
3. Contexto con hechos verificables, al menos dos opciones reales, decisión, consecuencias positivas y negativas, referencias.
4. Añade la fila al índice de `docs/adr/README.md`.
5. PR `docs(adr): DEC-NNN <título>`; se comenta en la revisión de arquitectura del sprint si hace falta; al mergear pasa a `Aceptada` (`DEC-070`).

Si la decisión nace de una necesidad de otro workstream, abre primero la issue con la plantilla `adr` (`.github/ISSUE_TEMPLATE/adr.yml`). En Claude Code, `/adr` genera el borrador desde la conversación. No agregues decisiones a `DECISIONS.md` (es solo un índice).

## 8. Qué no hacer

- No edites `docs/academico/`: son los entregables históricos del curso.
- No instales dependencias sin discutirlo; si se aprueba, documenta la decisión.
- No toques `packages/contracts` ni `models/manifest.json` fuera de ramas `adr/*`/`contracts/*`.
- No subas video, claves ni datos de usuarios al repo.
