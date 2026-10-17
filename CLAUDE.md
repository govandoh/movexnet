@AGENTS.md

# CLAUDE.md — MovexNet (específico de Claude Code)

Todo el contexto del proyecto, las reglas duras, la propiedad por workstream y la regla de oro están en `AGENTS.md` (incluido arriba). Este archivo solo añade lo que aplica a Claude Code. El estado actual del proyecto está en `docs/STATUS.md`; no se duplica aquí.

## Cómo trabajar en una sesión

1. **Ubícate antes de tocar nada.** Lee la issue que vas a trabajar y `docs/STATUS.md` (corto: hito, reparto y pendientes). Abre `ARCHITECTURE.md` o `docs/WORKSTREAMS.md` solo si la tarea toca más de un directorio. Si la tarea cruza una frontera de paquete, detente y pide un cambio de contrato (issue con la plantilla `adr` + `/adr`), no lo resuelvas con un import cruzado.
2. **Propón un plan antes de cambios grandes.** Para cualquier cambio que toque más de un módulo, un contrato, un umbral o un snapshot golden: lista archivos a tocar/crear, contratos afectados y cómo se va a probar. Espera aprobación antes de escribir código.
3. **No instalar dependencias sin avisar.** Cualquier `pnpm add`/`npm install` se discute primero y, si se aprueba, se documenta (DEC si es una tecnología nueva). No introducir frameworks ni servicios fuera de los decididos en `docs/adr/`.
4. **Documentar decisiones vía `/adr`.** Si durante la sesión se toma una decisión técnica (umbral nuevo, proveedor, patrón), invoca `/adr` para generar el borrador MADR en `docs/adr/` y añade la fila al índice. No dejes decisiones solo en comentarios de código o en el mensaje de commit.
5. **Probar en celular es la verdad.** Cualquier cambio en cámara, detección, trackers, voz o PWA se valida en un celular real (`pnpm dev` con HTTPS local o preview de Vercel). Indica explícitamente qué no pudiste probar en desktop.
6. **No cambies snapshots golden** (`fixtures/`, tests `*.test.ts` con snapshots) sin una DEC enlazada. Si un cambio legítimo los altera, crea la DEC primero.
7. **Cierra la sesión dejando rastro.** Si cambió el estado del proyecto, anótalo en la descripción del PR y en la issue. `docs/STATUS.md` lo actualiza solo el líder en la review semanal (`DEC-062`); no lo edites en PRs de workstream.
8. **Comentarios en código:** explican el "por qué" (cálculos geométricos, máquinas de estados, umbrales), citando la DEC (`// ver DEC-016`). Español o inglés, consistente dentro del archivo.

## Skills, hooks y agentes

- **Skills del repo** (`.claude/skills/`, se listan solas): `/adr`, `/fixture`, `/promote-model`, `/pr-ready` y `/fitnet-diseno`. Las de animación de Emil Kowalski se usan siempre a través de `/fitnet-diseno`, cuyas reglas prevalecen.
- **Hooks** (`.claude/settings.json`; detalle en `.claude/README.md`): `guard-protected-paths.mjs` **bloquea** ediciones en `src/contracts/**`, `packages/contracts/**` y `models/manifest.json` fuera de ramas `adr/*` o `contracts/*`; `lint-on-edit.mjs` corre `eslint --fix` sobre el archivo editado; `remind-status.mjs` solo avisa.
- `.claude/settings.local.json` es personal y está en `.gitignore`; no pongas ahí reglas que el equipo deba compartir.

## Modelos, esfuerzo y tokens (`DEC-062`)

- **Sesión principal: Sonnet con esfuerzo medio por defecto** (`/model sonnet`). Sube solo cuando un error sutil es caro:
  - `/model opusplan` (Opus planea, Sonnet escribe) para cambios de contrato, umbrales con golden o refactors de varios módulos.
  - Opus con esfuerzo alto para depurar geometría o máquinas de estados que Sonnet no resolvió.
  - Esfuerzo bajo para commits, `/pr-ready`, docs y renombres.
- **Una issue, una rama, una sesión.** `/clear` al cambiar de tarea; PR por debajo de 400 líneas. Si la issue no dice qué falta, archivos y criterio de aceptación, complétala antes de empezar.
- **Trabaja tu workstream en la sesión principal**, sin delegarlo a un subagente (duplica contexto). Para adoptar un agente completo: `claude --agent <nombre>`.
- **Subagentes solo para trabajo aislado que devuelve poco texto:** `architect-guardian` (antes del PR), `adr-scribe`, `docs-keeper`, `qa-engineer`, `Explore` para búsquedas amplias. Cada agente fija su `model` y `effort` en su frontmatter; no los cambies sin DEC. Un agente nunca redelega su tarea completa a otro.

## Tareas típicas y dónde van

Antes de editar, ubica la historia en esta tabla; si no encaja en una sola fila, es un cambio de contrato.

| Historia | Directorio hoy (`src/`) | Directorio objetivo | Workstream / agente | Necesita DEC |
|---|---|---|---|---|
| Ajustar un umbral angular o el cooldown de un tracker | `src/exercises/*.ts` | `packages/analysis-core` | B / `analysis-dev` | Sí (cambia golden) |
| Añadir un ejercicio nuevo | `src/exercises/` + `src/ui/workout/exercises.ts` | `analysis-core` (tracker) + `contracts` (`ExerciseId`) + `ui` (chip) | B + E; contrato → issue + DEC | Sí |
| Añadir un ejercicio al asistente (ola de `DEC-056`) | `src/exercises/` (configuración) + ejemplos del k-NN (`src/analysis/poseClassifier.ts`) | `analysis-core` + `ml/` (datos) | B (+ C para grabar y etiquetar) | Solo si los umbrales cambian golden |
| Cambiar la frase de voz o la prioridad entre mensajes | `src/feedback/feedbackPolicy.ts` + `src/ui/workout/coaching.ts` | `analysis-core/feedback` (`FeedbackPolicy`) | B | Si cambia DEC-016 |
| Conservar `worldLandmarks` o cambiar el modelo de MediaPipe | `src/pose/poseDetector.ts` | `packages/pose-engine` | A / `pose-engine-dev` | Sí si cambia versión/modelo |
| Grabar o añadir un fixture | — (PR 1) | `fixtures/landmarks/` + `*.test.ts` | A (fixture) y B (golden) | No |
| Pantalla nueva, estilos, onboarding, PWA | `src/ui/`, `public/` | `apps/web`, `packages/ui` | E / `ui-dev` | No, salvo dependencia nueva |
| Tabla, política RLS, Edge Function | — | `supabase/`, `packages/domain`, `api-client` | D / `backend-dev` | Sí si cambia el modelo de dominio |
| Prompt o esquema de salida del coach | — | `supabase/functions/coach/`, `evals/coach/` | D / `coach-prompt-engineer` | No, salvo cambio de modelo |
| Entrenar, evaluar o promover un modelo | — | `ml/`, `reports/`, `models/manifest.json` | C / `ml-engineer` (+ B para manifest) | Promoción vía gate, no DEC |
| Nueva métrica visible al usuario | — | `docs/METRICS.md` primero, luego `analysis-core` y `domain` | B + D | Sí |

## Convenciones de código

- Identificadores en inglés; textos de UI y mensajes de voz en español (`es-ES`).
- Constantes de umbral en mayúsculas con unidad en el nombre o el comentario (`GOOD_DEPTH_ANGLE = 90 // grados`); las temporales nuevas van en milisegundos, no en frames (`confirmMs`, no `MIN_RISING_FRAMES`).
- Todo módulo de `analysis-core` (hoy `src/exercises`, `src/geometry`, `src/analysis`) debe ser puro: sin React, sin DOM, sin `performance.now()` interno (recibe `t` del frame).
- Prettier con configuración por defecto; ESLint del repo. No desactivar reglas inline sin comentario que lo justifique.
- Tests junto al código (`squat.test.ts` al lado de `squat.ts`); fixtures en `fixtures/landmarks/`.

## Al cerrar la sesión

1. `pnpm check` en verde (o `/pr-ready`, que además revisa el diff y arma el cuerpo del PR).
2. Si tocaste cámara, trackers, voz o PWA: confirma en el mensaje final qué probaste en celular y qué no.
3. Si hubo una decisión: DEC creada con `/adr` y fila en `docs/adr/README.md`.
4. Si cambió el estado: anótalo en la descripción del PR; `docs/STATUS.md` lo actualiza el líder (`DEC-062`). Si es visible al usuario, entrada en `docs/CHANGELOG.md`.
5. Commit con conventional commit en español — commitlint rechaza cualquier otro formato. No hagas push a `main`.

## Comandos útiles

```
pnpm install            # Node 22+, pnpm 12 (corepack enable)
pnpm dev                # Vite con HTTPS local (@vitejs/plugin-basic-ssl) y host expuesto a la LAN
pnpm build              # tsc -b && vite build
pnpm lint               # eslint .
pnpm typecheck          # tsc --noEmit (app y node)
pnpm test               # vitest run
pnpm check              # lint + typecheck + test + build (lo mismo que corre CI)
```

Ver `CONTRIBUTING.md` para el setup completo, cómo probar en celular y cómo grabar fixtures.

## Qué no hacer en este repo

- No leer ni editar `docs/academico/`: son entregables históricos del curso.
- No cambiar `public/sw.js` sin subir la constante `CACHE` (`DEC-025`).
- No enviar landmarks, métricas ni ningún dato de usuario a servicios externos desde el cliente; todo pasa por `api-client` y las Edge Functions (`DEC-029`, `DEC-033`).
- No escribir docs nuevos en la raíz: van en `docs/` con una responsabilidad por archivo (tabla en `AGENTS.md`).
