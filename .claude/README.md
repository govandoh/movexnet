# Capa agéntica de Fitnet (`.claude/`)

Configuración compartida de Claude Code para el equipo. Se versiona en git; lo personal va en
`settings.local.json` (ignorado por git). Las reglas de fondo están en `AGENTS.md`; el mapa de
propiedad por workstream, en `docs/WORKSTREAMS.md`.

## Agentes (`agents/`)
Un agente = una responsabilidad = un conjunto de directorios. Espejan los workstreams para que
la regla de propiedad sea la misma para humanos (CODEOWNERS) y para IA.

| Agente | Responsabilidad | Posee | Modelo / esfuerzo |
|---|---|---|---|
| `architect-guardian` | Revisar fronteras y contratos; proponer ADR (solo lectura) | — | opus / medium |
| `adr-scribe` | Redactar ADR en MADR | `docs/adr/**`, `DECISIONS.md` | sonnet / low |
| `pose-engine-dev` | Cámara, MediaPipe, `PoseSource`, renderer, fixtures | `src/pose/**` → `packages/pose-engine`, `fixtures/` | sonnet / high |
| `analysis-dev` | Trackers, analizadores, feedback, pipeline, golden | `src/exercises/**`, `src/geometry/**`, `src/analysis/**` → `packages/analysis-core`, `packages/ml-runtime` | opus / high |
| `ml-engineer` | Datasets, features, entrenamiento, evaluación, ONNX | `ml/**`, `models/**` | sonnet / high |
| `backend-dev` | Esquema, RLS, Edge Functions, `domain`, `api-client` | `supabase/**`, `packages/domain`, `packages/api-client` | sonnet / high |
| `ui-dev` | Pantallas mobile-first, `packages/ui`, PWA, a11y | `src/ui/**`, `src/App.tsx`, `index.html`, `public/**` → `apps/web`, `packages/ui` | sonnet / medium |
| `qa-engineer` | Tests, fixtures sintéticos, Playwright, DoD | `**/*.test.ts`, `fixtures/**`, `e2e/**` | sonnet / medium |
| `coach-prompt-engineer` | Prompts, esquemas y evals del `CoachAssistant` | `supabase/functions/coach/**` (prompts/esquemas), `evals/coach/**` | sonnet / medium |
| `docs-keeper` | `docs/STATUS.md`, READMEs, `AGENTS.md`/`CLAUDE.md` | solo Markdown | sonnet / low |

Modelo y esfuerzo van en el frontmatter de cada agente (`DEC-062`). Uso: cada desarrollador
trabaja su workstream en la sesión principal (o con `claude --agent <nombre>`); los subagentes
se reservan para trabajo aislado que devuelve poco texto (revisión, ADR, docs, tests).
Regla de oro: un agente edita solo dentro de su propiedad; si
necesita algo de otro paquete, pide un cambio de contrato (issue + ADR), no lo hackea.

## Skills (`skills/`)
| Comando | Qué hace |
|---|---|
| `/adr` | Crea `docs/adr/DEC-NNN-slug.md` desde la conversación, actualiza índices, propone commit en `adr/*` |
| `/fixture` | Guía para grabar con `?debug=record`, nombrar, validar esquema v1, registrar y crear golden |
| `/promote-model` | Verifica reporte vs `ml/thresholds.yaml`, sha256, actualiza `models/manifest.json`, exige DEC |
| `/pr-ready` | Corre lint/typecheck/test/build, revisa el diff, exige DEC si toca rutas protegidas, arma el cuerpo del PR |
| `/fitnet-diseno` | Identidad visual y movimiento de Fitnet (`docs/DESIGN.md`, `DEC-058`); capa de adaptación de las skills de Emil |
| `/animate`, `/review-animations`, `/improve-animations`, `/find-animation-opportunities`, `/emil-design-eng`, `/mobile-native`, `/pick-ui-library`, `/animation-vocabulary` | Skills de Emil Kowalski (MIT) instaladas con una nota que remite a `/fitnet-diseno`; atribución y cómo actualizarlas en `skills/THIRD-PARTY.md` |

## Hooks (`settings.json` + `hooks/*.mjs`)
Scripts Node ESM sin dependencias (Windows/macOS/Linux). Leen el JSON del evento por stdin.
Se ejecutan desde la raíz del repo (cwd de la sesión).

| Evento | Script | Efecto |
|---|---|---|
| `PreToolUse` (Edit/Write/MultiEdit) | `guard-protected-paths.mjs` | Bloquea (exit 2) ediciones en `packages/contracts/**`, `src/contracts/**`, `models/manifest.json` si la rama no empieza por `adr/` o `contracts/` |
| `PostToolUse` (Edit/Write/MultiEdit) | `lint-on-edit.mjs` | `eslint --fix` sobre el `.ts/.tsx` editado si existe `node_modules/.bin/eslint`; nunca falla |
| `Stop` | `remind-status.mjs` | Recuerda actualizar `docs/STATUS.md` si hay cambios en `src/`, `packages/`, `apps/`, `ml/` o `supabase/` sin tocarlo |

Probar a mano:
```
echo '{"tool_input":{"file_path":"models/manifest.json"}}' | node .claude/hooks/guard-protected-paths.mjs ; echo exit=$?
```

### Desactivar un hook solo en tu máquina
`settings.local.json` se fusiona sobre `settings.json`; los hooks se **acumulan**, no se
reemplazan, así que la forma de desactivar uno es no ejecutar el compartido. Opciones:

1. **Desactivar todos los hooks del proyecto** en `.claude/settings.local.json`:
   ```json
   { "disableAllHooks": true }
   ```
2. **Excepción puntual para el guard** (por ejemplo, arreglar un typo en el manifest sin ADR):
   trabaja en una rama `contracts/<slug>`; el hook lo permite; la revisión es opcional (`DEC-070`).
3. **Sobrescribir el comando** (solo si sabes lo que haces): en `settings.local.json` añade el mismo
   `matcher` con un comando `node -e "process.exit(0)"`; ambos correrán, y el compartido seguirá
   bloqueando. Por eso la opción soportada es la 1 o la 2.

Las permisos de `permissions.allow` también se amplían desde `settings.local.json`
(`/permissions` en la sesión los escribe ahí).
