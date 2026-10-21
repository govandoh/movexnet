# DEC-074 · Anti-trampa v1.1: series de cámara sin duración, día en hora de Guatemala y solapamiento en las dos sesiones

- **Estado:** Propuesta
- **Fecha:** 2026-10-20
- **Decisores:** @govandoh (D, responsable del proyecto); el PR sigue las aprobaciones que exige `docs/adr/README.md`
- **Etiquetas:** `backend`, `anti-trampa`, `rankings`
- **Issue:** #73 (revisión del PR #66). Precisa `DEC-067` §3 sin reemplazarla.

## Contexto y problema

La migración `20261018000000_antitrampa_y_coach_usage.sql` (ya aplicada en la nube) implementa las reglas de plausibilidad de `DEC-067` §3 con el trigger `private.flag_set_log()` y `private.flag_overlapping_sessions()`. La revisión del PR #66 encontró tres huecos:

1. Una serie con `source = 'camera'` y `duration_ms` nulo se salta las reglas de 800 ms por repetición y de 3 h al día; solo le queda el tope de 100 repeticiones.
2. La regla de 3 h corta el día en UTC, que en Guatemala es a las 18:00. Una sesión que cruza esa hora reparte su tiempo en dos días y nunca llega a 3 h.
3. El solapamiento solo se evalúa al cerrar una sesión y solo marca las series de la sesión que se cierra. Las series de la otra sesión del par quedan limpias, y una sesión que nunca se cierra no se compara con nada.

## Opciones consideradas

### Serie de cámara sin duración

1. **`check (source <> 'camera' or duration_ms is not null)`** — garantiza el dato, pero rechaza el guardado: una versión vieja de la app o una cola offline perdería la serie del historial del usuario.
2. **Marca `missing_duration`** (elegida) — la serie se guarda y queda fuera del ranking. Sigue la filosofía de `DEC-067`: marcar, no rechazar.

### Fin de una sesión abierta

1. **No comparar sesiones abiertas** (comportamiento de v1) — quien nunca cierra sesión nunca se marca.
2. **Fin efectivo = fin de la última serie** — menos falsos positivos con sesiones abandonadas, pero el rango crece con cada serie y la detección depende del orden de llegada.
3. **Fin efectivo = `started_at + 3 h`** (elegida) — usa el mismo tope de actividad diaria de `DEC-067` y es fácil de explicar y de probar.

### Sesiones sin series

1. **Participan como cualquier otra** — una sesión abierta por error y abandonada marcaría a la siguiente durante 3 h.
2. **Solo participan sesiones con al menos una serie** (elegida) — una sesión vacía no aporta puntos ni es indicio de trampa.

## Decisión

Una migración nueva, `supabase/migrations/20261021000000_antitrampa_v1_1.sql`, reemplaza las dos funciones con `create or replace` y añade un trigger. No cambian columnas.

1. **`missing_duration`:** `private.flag_set_log()` marca la serie cuando `source = 'camera' and duration_ms is null`. Marca, no rechaza. La base espera que la app envíe `source = 'camera'` y `duration_ms` en cada serie contada por la cámara (#87).
2. **Día local:** la regla de más de 3 h suma las series del mismo día en hora de Guatemala: `day_from := (date_trunc('day', started_at at time zone 'America/Guatemala')) at time zone 'America/Guatemala'`. Es la misma referencia que la puerta 18+ (`DEC-069`). Como en v1, el total suma las series de cualquier origen (también `manual`) y también las ya marcadas: el tope mide actividad declarada, no actividad que puntúa.
3. **Solapamiento:**
   - Rango de una sesión: `[started_at, coalesce(ended_at, started_at + interval '3 hours'))`.
   - Solo participan sesiones con al menos una serie.
   - Si dos sesiones del mismo usuario se solapan, se marcan con `sessions_overlap` las series de **las dos**.
   - Se evalúa al crear o cerrar una sesión (trigger `workout_sessions_flag_overlap`, ya existente) y al insertar una serie o cambiar su `session_id` o `started_at` (trigger nuevo `set_logs_flag_overlap`), para que mover una serie a una sesión solapada no la deje sin marca. Como una sesión recién creada todavía no tiene series, la comparación real ocurre con su primera serie; así se detectan también las sesiones que nunca se cierran.
   - `private.flag_overlapping_sessions()` sigue siendo `security definer`: su UPDATE corre como el dueño de la función, no como `authenticated`, así que no entra en la rama del cliente de `flag_set_log()` y las marcas se conservan.
4. **Marcas pegajosas:** el cliente no puede liberar `flagged` ni quitar `missing_duration` o `sessions_overlap`, ni cambiar `source`. El origen se fija antes de evaluar las reglas, para que un UPDATE que cambie `source` no altere la evaluación. Liberar sigue siendo manual con `service_role`.

## Consecuencias

### Positivas

- Ninguna serie de cámara se salta las reglas de duración: o las cumple o queda marcada.
- El total del día coincide con el día que vive el usuario.
- Un par de sesiones solapadas queda fuera del ranking completo, no a medias, y abrir sesiones sin cerrarlas ya no sirve para esquivar la regla.
- Cubierto por `supabase/tests/antitrampa.test.sql` (16 casos).

### Negativas y riesgos aceptados

- **`source = 'camera'` lo declara el cliente.** Un cliente modificado puede declarar cámara con duraciones plausibles. La verificación fuerte del origen queda pendiente para antes de abrir los rankings públicos (épica 6), como ya advierte `DEC-067` §3.5.
- **Inserciones concurrentes pueden sumar mal el total del día.** El trigger no bloquea: dos series del mismo día insertadas a la vez no se ven entre sí y pueden quedar las dos por debajo de 3 h. Se acepta porque no rechaza nada y el cliente guarda las series en orden; se revisa si los rankings detectan totales diarios por encima de 3 h sin marca.
- **Falso positivo con sesiones abandonadas con series.** Si la app se cierra sin terminar la sesión y el usuario empieza otra dentro de las 3 h siguientes, las dos quedan marcadas. La serie no se pierde, solo sale del ranking hasta la revisión manual. Se mitiga cuando la app cierre la sesión al salir (#87).
- Cada serie insertada ejecuta una consulta de solapamiento sobre las sesiones del usuario (índice `workout_sessions_user_started_idx`); costo despreciable con los volúmenes del piloto. Su UPDATE vuelve a disparar `flag_set_log()`, que recalcula las reglas de la serie sin aplicarlas (no corre como `authenticated`): trabajo de más, sin efecto.
- Las series marcadas antes de esta migración no se recalculan. Hoy no hay series de cámara en la nube.

## Referencias

- `DEC-067` §3 (reglas anti-trampa v1), `DEC-069` (hora de Guatemala en la puerta 18+).
- Issue #73, revisión del PR #66, sincronización de series en #87.
- `supabase/migrations/20261018000000_antitrampa_y_coach_usage.sql`, `supabase/migrations/20261021000000_antitrampa_v1_1.sql`, `supabase/tests/antitrampa.test.sql`.
- `docs/METRICS.md` (anti-trampa).
