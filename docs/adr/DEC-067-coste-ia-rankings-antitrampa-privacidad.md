# DEC-067 · Tope de costo del asistente IA, frescura de rankings, reglas anti-trampa y aviso de privacidad

- **Estado:** Propuesta
- **Fecha:** 2026-10-17
- **Decisores:** @govandoh (responsable del proyecto, decide en representación del equipo); el PR sigue las aprobaciones que exige `docs/adr/README.md`
- **Etiquetas:** `backend`, `coach-assistant`, `rankings`, `privacidad`, `proceso`
- **Cierra:** issue #22. Desbloquea la activación de cuentas en producción (#60).

## Contexto y problema

Cuatro pendientes de equipo del Sprint 0 llevan abiertos desde `DEC-033` y `docs/METRICS.md` §7 y bloquean trabajo de D y E:

1. **Costo del asistente IA.** `DEC-033` dejó el rate limit por tier y el tope de costo por usuario premium "pendiente de definir". `docs/PRODUCT.md` lo marca como restricción técnica real, porque la regla dura 7 (`DEC-035`) prohíbe cualquier gasto: la API de Claude no tiene plan gratuito.
2. **Frescura de rankings.** `docs/PRODUCT.md` (E6) y `METRICS.md` §7 dicen "cada 5–15 min" sin elegir.
3. **Anti-trampa.** Hoy nada garantiza que una sesión venga de análisis real: `set_logs` no distingue cámara de modo manual (`DEC-047`) y el cliente es no confiable. `METRICS.md` §7 exige definir las reglas antes de abrir rankings públicos.
4. **Aviso de privacidad.** Supabase está en `us-east-1` (`DEC-029`), se guardan datos de actividad y medidas corporales y un tercero (Anthropic) procesa métricas (`DATA-GOVERNANCE.md` §5). Sin aviso no se activan cuentas, y #60 ya lo condiciona con `VITE_ENABLE_ACCOUNTS`.

Cada una se cierra aquí con un valor por defecto, decidido por el responsable del proyecto en representación del equipo. Todas las cifras son un punto de partida, revisables con datos reales sin nueva DEC salvo que cambie el criterio.

## Opciones consideradas

### 1. Costo del asistente IA

1. **Sin tope, solo rate limit por solicitudes.** Descartada: el costo depende de tokens, no de llamadas, y un chat largo gasta mucho más que un resumen.
2. **Tope por tokens mensual y por usuario, medido con el `usage` de la respuesta, con interruptor global y modo simulado por defecto** (elegida): acota el peor caso por usuario y respeta la regla de costo cero mientras nadie apruebe un presupuesto real.
3. **Bajar a un modelo más barato para todo.** Descartada en `DEC-033`: el ahorro viene de caché y Batch, no de degradar la calidad.

### 2. Frescura de rankings

1. **5 min.** Triplica los refrescos (288/día) en Supabase Free sin beneficio perceptible: nadie compite en tiempo real.
2. **15 min** (elegida): 96 refrescos/día, la hora visible en la UI evita confusión.
3. **Bajo demanda.** Descartada: cada usuario puede disparar un refresco costoso.

### 3. Anti-trampa

1. **Firma de sesión generada en el dispositivo** (propuesta de `METRICS.md`). Descartada como control: la clave tendría que viajar en el bundle (regla dura 3) y cualquiera podría firmar datos falsos; solo da falsa seguridad.
2. **Validación en servidor por origen, plausibilidad y revisión de outliers** (elegida): no es infalsificable, pero encarece la trampa y deja rastro auditable.
3. **No validar, rankings solo entre amigos.** Descartada: el alcance incluye rankings públicos opt-in (E6/E7).

### 4. Aviso de privacidad

1. **Texto genérico de plantilla.** Descartada: no declara residencia en EE. UU. ni al proveedor de IA, que es lo que `DATA-GOVERNANCE.md` §5 exige.
2. **Aviso propio breve, versionado, con aceptación registrada** (elegida), redactado en español claro, a revisar por el responsable antes de activar cuentas.

## Decisión

### 1. Tope de costo del asistente IA

- **Unidad:** USD, calculado en la Edge Function `coach` con los tokens que devuelve la API (`usage`) y los precios de `claude-opus-5` ($5/$25 por millón de tokens de entrada/salida, lectura de caché al 10 %, Batch −50 %; `claude-opus-5-5` cuesta $4/$20, así que usar el primero es conservador).
- **Tope por usuario premium:** **USD 2,00 al mes.** Estimación del peor caso con los límites de abajo, a validar con el registro de uso real (#32):

| Uso mensual máximo | Cálculo | USD |
|---|---|---|
| 20 resúmenes de sesión (Batch) | ~0,027 c/u | 0,54 |
| 30 mensajes de chat en línea | ~0,046 c/u | 1,38 |
| 5 segundas opiniones por imagen | ~0,02 c/u | 0,10 |
| **Total** | | **2,02** |

  Como el total roza el tope, el tope manda: al llegar al 100 % la función responde con el fallback.
- **Límites por tier** (rate limit, además del tope):

| Tier | Chat en línea | Resúmenes (Batch) | Imagen clave | Digest / ajustes |
|---|---|---|---|---|
| Gratis | no | no | no | no |
| Premium con entrenador | 30/mes, 5/día | 1 por sesión, máx. 20/mes | 5/mes | — |
| Entrenador | — | — | — | digest 1/semana; 20 sugerencias de ajuste/mes; tope USD 3,00/mes |

- **Avisos:** al 80 % del tope el usuario ve un aviso; al 100 % se desactiva lo que gasta y la app muestra el fallback de plantillas deterministas (`DEC-033`, opción 2). Las métricas siguen calculándose en el dispositivo.
- **Cuenta de uso:** tabla `coach_usage` (`user_id`, `period`, `calls`, `input_tokens`, `output_tokens`, `cost_micro_usd`), escrita solo por la Edge Function con `service_role`; el usuario lee la suya por RLS. Antes de cada llamada se reserva el costo máximo estimado; después se corrige con el `usage` real.
- **Modo simulado por defecto (regla dura 7):** la Edge Function arranca en `COACH_MODE=mock`, que usa las plantillas y no llama a la API de Claude. Pasar a `live` exige que el responsable apruebe por escrito un presupuesto real y una DEC o nota que lo registre; en `live` rige además un tope global `COACH_GLOBAL_BUDGET_USD` (por defecto 0). El coaching sigue siendo demostrable sin gastar.

### 2. Frescura de rankings

- Vistas materializadas del ranking global y de cada reto, refrescadas con `REFRESH MATERIALIZED VIEW CONCURRENTLY` por un único job de `pg_cron` **cada 15 minutos**. Al cierre de un reto se hace un refresco adicional.
- La UI muestra "ranking a las HH:MM" con el `computedAt` de la fila (`DOMAIN.md`, `LeaderboardEntry`).
- **Se revisa** (nueva DEC) si el refresco dura más del 20 % del intervalo o si un reto necesita tiempo casi real.

### 3. Reglas anti-trampa (v1)

La puntuación (`METRICS.md` §7) solo cuenta sesiones que cumplan **todas** estas condiciones; las que no, se guardan en el historial del usuario pero no entran al ranking.

1. **Origen:** el set tiene `source = 'camera'`. Los modos manual (`DEC-047`) e importado no puntúan. Requiere columna `source` en `set_logs` (hoy no existe).
2. **Plausibilidad por servidor** (función SQL que marca `flagged = true`, sin rechazar el guardado):
   - repetición de menos de 800 ms (coincide con la duración mínima de una repetición de sentadilla, `DEC-037`);
   - más de 100 repeticiones en una serie;
   - más de 3 horas de actividad contada en un día;
   - sesiones del mismo usuario que se solapan en el tiempo;
   - `peak_velocity` por encima del percentil 99 de su ejercicio y cohorte (`METRICS.md`).
3. **Revisión de outliers:** un puntaje semanal mayor que la mediana de su cohorte más 5·MAD queda `flagged` hasta que el responsable lo revise. Lo `flagged` no cuenta; revisar y liberar es manual.
4. **Participación:** solo con `Profile.publicProfile = true` (opt-in, `DATA-GOVERNANCE.md` §2) y botón "reportar" en cada fila pública.
5. **Límite asumido:** un usuario decidido puede falsear landmarks. La v1 no pretende impedirlo, solo detectarlo cuando es burdo. Los rankings públicos se abren con esta advertencia en la ayuda del reto.

Los umbrales numéricos son un punto de partida y se calibran con sesiones reales antes de abrir el ranking público.

### 4. Aviso de privacidad

- **Versión:** el aviso se identifica como `privacy-2026-10-v1`. Se guarda en `profiles.privacy_version` junto con `privacy_accepted_at` (migración de #60). Cualquier cambio de fondo sube la versión y pide re-aceptación.
- **Contenido mínimo**, en español claro y accesible desde registro, Perfil y pie de la app:
  1. Qué datos se guardan (perfil, sesiones y métricas, landmarks solo con consentimiento por grabación) y cuáles nunca (el video, `AGENTS.md` regla dura 2).
  2. **Residencia: Estados Unidos** (Supabase, `us-east-1`).
  3. Los datos de actividad física y medidas corporales se tratan como **sensibles de salud**, aunque la ley aplicable no los clasifique así.
  4. **Proveedor de IA:** el asistente envía a Anthropic solo métricas agregadas y objetivos, nunca video ni landmarks crudos (`DEC-033`); mientras `COACH_MODE=mock` no se envía nada.
  5. Derechos: ver, exportar (JSON) y borrar sus datos y su cuenta (≤ 30 días), retirar consentimientos (`DATA-GOVERNANCE.md` §3).
  6. Retención, rankings opt-in y contacto del responsable.
  7. Aclaración de que es un **proyecto académico** (`DEC-035`) y los pagos son simulados.
- **Edad:** v1 solo para mayores de 18 años, declarado al registrarse con el año de nacimiento (ya está en `profiles.birth_year`). Quien no cumpla no puede crear cuenta. No hay verificación documental.
- **Marco legal:** el equipo revisa el texto contra la legislación guatemalteca aplicable (a verificar: no se encontró una ley general de protección de datos personales vigente) y buenas prácticas internacionales; la verificación la hace el responsable, no esta DEC.
- **Condición para activar cuentas en producción:** texto aprobado, versión publicada en la app y `VITE_ENABLE_ACCOUNTS=true` solo después. El borrador del texto se escribe en la historia #60 con estos puntos.

## Consecuencias

### Positivas

- Se desbloquea #60 (activación en producción) y E6/E7 (rankings con reglas claras) sin esperar más reuniones.
- El costo del asistente tiene techo conocido por usuario y global; el proyecto sigue en cero costo.
- Las reglas anti-trampa dejan rastro auditable y el límite queda dicho sin vender seguridad que no existe.

### Negativas

- Un tope de USD 2,00 limita el chat a ~30 mensajes al mes; si la demo necesita más, hay que subir el tope con DEC.
- Las cifras de costo son estimaciones por llamada; el registro de uso real (`coach_usage`) puede obligar a ajustar los límites.
- El refresco de 15 min hace que un usuario no vea sus repeticiones en el ranking al instante.
- Anti-trampa v1 exige trabajo de D: columna `source` en `set_logs`, columna `flagged`, función de validación, `coach_usage` y los jobs de `pg_cron` (historias nuevas, ninguna es parte de #60).
- Aviso 18+ excluye a menores de forma declarativa, no verificada.

## Documentos a actualizar tras aprobarse (`docs-keeper`)

`METRICS.md` §7 (cerrar "Anti-trampa (pendiente)" y elegir 15 min), `DATA-GOVERNANCE.md` §5 (quitar "Pendiente del equipo"), `PRODUCT.md` (tope de costo pendiente), `docs/adr/README.md` ("Decisiones que ya se sabe que harán falta"), `DECISIONS.md` (fila al pasar a Aceptada).

## Referencias

- Issue #22; #60 (cuentas), #32 (insumos de costo).
- `DEC-029`, `DEC-033`, `DEC-035`, `DEC-047`, `DEC-064`; `docs/METRICS.md` §7; `docs/DATA-GOVERNANCE.md` §2, §3, §5; `docs/PRODUCT.md` (freemium).
