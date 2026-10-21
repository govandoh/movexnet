# DEC-062 · Modelo y esfuerzo por agente, una issue por sesión y estado del proyecto a cargo del líder

- **Estado:** Aceptada (2026-10-21, por el responsable del proyecto)
- **Fecha:** 2026-10-05
- **Decisores:** Leads de los workstreams B, D y E
- **Etiquetas:** proceso, agentes, costo

## Contexto y problema

Hasta la Fase 1 (PRs #40 y #41) una sola persona construyó todo con sesiones de Claude Code en Opus con esfuerzo alto. Los 10 agentes de `.claude/agents/` no declaraban `model` ni `effort`, así que heredaban Opus también para tareas mecánicas (actualizar `docs/STATUS.md`, redactar una DEC, revisar el diff). Los PRs superaron con mucho el límite de 400 líneas de `AGENTS.md`, lo que obliga a sesiones largas cuyo contexto se relee en cada turno. Además, cada sesión empezaba leyendo un `docs/STATUS.md` de 15 KB con historial.

Ahora cinco desarrolladores van a trabajar en paralelo (uno por workstream). Esto trae dos fuentes de conflictos de merge: todos editaban `docs/STATUS.md` en sus PRs, y el número `DEC-NNN` se tomaba al abrir la rama, así que dos ramas `adr/*` simultáneas reciben el mismo número.

## Opciones consideradas

1. **Dejar todo en Opus.** Calidad máxima en todas las tareas, pero el gasto en tareas mecánicas es el mismo que en el diseño de un contrato, y agota los límites de uso del equipo.
2. **Todo en Sonnet o Haiku.** Es lo más barato, pero baja la calidad justo donde un error es caro: geometría y máquinas de estados de los trackers, contratos compartidos, revisión de fronteras.
3. **Modelo y esfuerzo por agente según el riesgo de la tarea, Sonnet por defecto y Opus solo donde un error sutil es caro** (elegida).

## Decisión

**Modelo y esfuerzo por agente** (frontmatter de `.claude/agents/*.md`):

| Agente | `model` | `effort` | Motivo |
|---|---|---|---|
| `analysis-dev` | opus | high | Geometría, histéresis y golden: un error sutil cambia el conteo |
| `architect-guardian` | opus | medium | Revisión de fronteras una vez por PR, solo lectura |
| `pose-engine-dev`, `ml-engineer`, `backend-dev` | sonnet | high | Refactor de cámara, evaluación LOSO y RLS piden cuidado, no el modelo mayor |
| `ui-dev`, `qa-engineer`, `coach-prompt-engineer` | sonnet | medium | Código repetitivo guiado por skills y esquemas |
| `adr-scribe`, `docs-keeper` | sonnet | low | Redacción desde una conversación o un diff |

**Sesión principal.**
- El modelo por defecto es Sonnet con esfuerzo medio.
- Para cambios de contrato (`src/contracts/`) o de umbrales con golden se usa `/model opusplan`, que planea con Opus y escribe con Sonnet, o directamente Opus con esfuerzo alto.
- Fable no se usa salvo que Opus falle dos veces en la misma tarea.

**Uso de agentes.**
- Cada desarrollador trabaja su workstream en la sesión principal, sin delegar su tarea a un subagente. Delegar duplica el contexto y se paga dos veces.
- Los subagentes se reservan para trabajo aislado que devuelve poco texto: `architect-guardian` antes del PR, `adr-scribe`, `docs-keeper`, `qa-engineer` y `Explore` para búsquedas amplias.
- Quien quiera que su sesión adopte un agente completo usa `claude --agent <nombre>`.

**Una issue, una rama, una sesión.**
- La issue lleva un brief: qué falta, archivos y criterio de aceptación.
- Entre tareas se usa `/clear`.
- El PR respeta el límite de 400 líneas.

**Estado y numeración.**
- `docs/STATUS.md` lo actualiza solo el líder (o `docs-keeper` a su pedido) en la review semanal. Los PRs de los workstreams no lo editan: anotan el cambio de estado en la descripción del PR.
- `docs/STATUS.md` se mantiene por debajo de 4 KB. El historial va a `docs/CHANGELOG.md`.
- El número `DEC-NNN` es provisional hasta el merge. Si al hacer merge ya existe ese número en `main`, quien mergea segundo renumera su DEC y las referencias.

## Consecuencias

### Positivas

- Las tareas mecánicas dejan de consumir cuota de Opus. El modelo mayor queda para análisis y contratos.
- Desaparecen dos fuentes recurrentes de conflictos de merge entre los cinco workstreams.
- Cada sesión arranca con menos contexto fijo y sin explorar el repo para averiguar qué falta.

### Negativas

- La calidad de Sonnet en `pose-engine-dev` y `backend-dev` hay que vigilarla. Si una revisión de `architect-guardian` encuentra errores de fondo en esos workstreams, se sube su modelo con una DEC nueva.
- `docs/STATUS.md` puede quedar hasta una semana desfasado. La fuente de verdad del día a día son las issues y los PRs.

## Referencias

- `DEC-032` (organización agéntica), que esta DEC complementa.
- `CLAUDE.md`, sección "Modelos, esfuerzo y tokens".
- Documentación de subagentes de Claude Code: campos `model` y `effort` del frontmatter.
