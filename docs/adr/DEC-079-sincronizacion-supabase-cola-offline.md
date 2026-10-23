# DEC-079 · Sincronización con Supabase: cola offline, series inmutables, última escritura gana y datos de la cuenta fuera del dispositivo al cerrar sesión

- **Estado:** Aceptada (2026-10-23, por el responsable del proyecto)
- **Fecha:** 2026-10-21
- **Decisores:** @govandoh (D, responsable del proyecto); el PR sigue las aprobaciones que exige `docs/adr/README.md`
- **Etiquetas:** `backend`, `api-client`, `domain`, `datos`, `offline`
- **Issue:** #87. Prueba en celulares reales: #108. Precisa `DEC-029` (patrones de acceso) y aplica `DEC-067` §3 y `DEC-074` (origen y duración de las series).

## Contexto y problema

Con las cuentas activas (`DEC-069`), el historial de series, el cuestionario, el inicio del programa, las rutinas y los objetivos seguían solo en `localStorage` (`src/ui/state/appStore.ts`). La base ya tenía `profiles`, `workout_sessions`, `set_logs` (particionada por mes), `metrics` y `goals`, pero no `routines` ni el inicio del programa. El cliente tenía que enviar `user_id` y podía intentar fijar `flagged` al insertar (el trigger lo sobrescribía).

Hechos que condicionan la decisión:

- `SetRecord` (`src/domain/sessionHistory.ts`) no tenía sesión, origen ni duración. Sin `duration_ms`, una serie de cámara queda `missing_duration` (`DEC-074`).
- La plancha guarda segundos en `validReps`. En `set_logs.reps`, cualquier plancha de más de 100 s quedaría marcada `reps_gt_100`.
- Cada dispositivo siembra las plantillas de rutina con ids propios (`resolveStoredRoutines`): subirlas tal cual las duplicaría en la cuenta.
- `newId()` tenía un respaldo que no es UUID y las tablas usan `uuid`.
- La cuenta es obligatoria (`DEC-069` §10): si otra persona usa el mismo celular, no debe ver el historial de la anterior.
- Una sesión abierta cuenta como activa hasta `started_at + 3 h` y marca `sessions_overlap` (`DEC-074`).

## Opciones consideradas

### Cuándo se sube

1. **Directo a la nube, sin copia local.** Descartada: sin red se pierde la serie y la app deja de funcionar en el gimnasio.
2. **Primero en el dispositivo y una cola persistente que se envía con red y sesión** (elegida), con ids del cliente para que reintentar no duplique.

### Conflictos

1. **Fusión campo a campo con relojes vectoriales.** Descartada: costo alto para un piloto con un usuario en uno o dos celulares.
2. **Reglas simples** (elegida): la serie es inmutable (solo se inserta); rutinas y objetivos con última escritura gana por `updated_at` del cliente; el perfil, con lo pendiente en el dispositivo por delante de la nube.

### Origen del historial previo

1. **`manual`.** Descartada: afirma algo que no se sabe.
2. **`camera`.** Descartada: sin duración quedarían todas `missing_duration`.
3. **`imported`** (elegida): ya está permitido por el `check` de `set_logs.source`, no puntúa y es honesto.

### Qué pasa al cerrar sesión

1. **Conservar los datos locales.** Descartada: la siguiente cuenta en el mismo celular vería el historial de la anterior.
2. **Borrar del dispositivo la cola, las marcas y los datos de la cuenta** (elegida); antes se avisa si quedan cambios sin subir. Al volver a entrar, todo baja de la nube.

## Decisión

Usamos una cola offline en el cliente que sube al Supabase de la cuenta el historial, el programa, las rutinas y los objetivos, con estas reglas:

1. **Mapeo de la serie.** `validReps` va a `set_logs.reps`; en los ejercicios por tiempo `reps` queda vacío y los segundos van a la métrica `hold_seconds`. `rejectedReps`, `goodReps` y `fatigue` van a `metrics` (`scope='set'`) como `rejected_reps`, `clean_reps` y `fatigue_level` (0 baja, 1 moderada, 2 alta), definidas en `docs/METRICS.md` §3. `started_at = completedAt − durationMs`, determinista para que un reintento caiga en la misma clave y la misma partición. **No se sincronizan todavía** el método ni la carga de las series manuales: `SetRecord` no los guarda, así que van `method='normal'`, `method_params={}` y `load_kg` vacío hasta que el historial local los tenga. Las métricas van con `schema_version = 1`.
2. **Origen y duración (`DEC-074`).** Cámara: `source='camera'` y `duration_ms` del arranque al cierre de la serie. Manual: `source='manual'` y `duration_ms` vacío. Historial previo: `source='imported'`.
3. **Sesiones.** Cámara: una por visita a la pantalla de entrenamiento. Se crea con la primera serie (no hay sesiones vacías) y se cierra al salir con el **fin de la última serie**. Si la app se cerró sin salir, se cierra al volver a abrirla. Manual: una por ejercicio guardado, creada ya cerrada. Historial previo: una sesión por día local, creada ya cerrada (inicio de la primera serie, fin de la última), para que dos días seguidos no se solapen.
4. **Inmutables e idempotentes.** Sesiones, series y métricas llevan id del cliente y se insertan con `ON CONFLICT DO NOTHING` (`upsert` con `ignoreDuplicates`). Solo se actualiza `workout_sessions.ended_at`.
5. **Rutinas y objetivos.** Tabla nueva `routines` (los días en `jsonb`, validados por el cliente al leer como lo leído de `localStorage`) y `goals.updated_at`. El cliente fija `updated_at` con la hora del cambio y el trigger `private.keep_newest()` ignora un UPDATE más viejo que lo guardado; además acota la hora del cliente a un día después de la del servidor, para que un reloj adelantado no bloquee la fila para siempre. Borrar es un DELETE. Al leer de la nube, lo pendiente en la cola gana; lo demás lo decide la nube, así que lo borrado en otro dispositivo desaparece. Solo una rutina activa: si dos dispositivos activaron distintas, en el dispositivo gana la más reciente; la nube conserva las dos marcadas hasta que se vuelva a activar una. Los objetivos se recortan al tope local (6) al bajar.
6. **Programa.** El cuestionario usa las columnas que ya tenía `profiles`; `profiles.program_started_at` es nueva y vacía significa "sin cuestionario". Lo pendiente local gana; sin pendientes, manda la nube.
7. **Primera sincronización.** La primera cuenta que entra en el dispositivo reclama los datos locales (`movexnet_data_owner_v1`). Se sube una sola vez el historial, las rutinas (sin las plantillas que nadie editó si la cuenta ya tiene rutinas), los objetivos y el programa (solo si la nube no tiene uno). Primero se guarda lo local con los ids definitivos y después se encola: repetirla tras un cierre a mitad no duplica nada. Si entra otra cuenta sin que la anterior cerrara sesión desde la app, los datos de la anterior se borran antes de bajar los de la nueva.
8. **Envío.** La cola se guarda en `localStorage` por usuario (`movexnet_sync_v1:<id>`, `DEC-024`). Se procesa en orden y en lotes de hasta 100 operaciones seguidas del mismo tipo. Se dispara al iniciar sesión, al volver la red, al volver a la app y después de cada cambio. Error transitorio (red, 401, 408, 429, 5xx): la cola se detiene y reintenta con backoff de 2 s·2ⁿ, jitter entre 50 % y 100 % y tope de 5 min. Error permanente (SQLSTATE 22, 23 o 42, u otro 4xx): se reintenta de a una para aislar la operación culpable, se descarta y se cuenta como fallida. La lectura de la nube cubre un año de series (máximo 1000) y se hace como mucho cada 5 min, salvo al iniciar sesión.
9. **Lo que el cliente no envía.** `user_id` lo pone la base (`default auth.uid()`; la RLS lo sigue exigiendo). El cliente pierde el privilegio de insertar `flagged` y `flag_reasons` en `set_logs`, de mover el inicio de una sesión (solo actualiza `ended_at`) y de editar métricas.
10. **Cerrar sesión desde la app** borra la cola, la marca de dueño y los datos de la cuenta del dispositivo (historial, programa, objetivos; las rutinas vuelven a las plantillas). Si quedan cambios sin subir, Perfil lo advierte antes. Una sesión vencida o cerrada en otro lado solo detiene la cola, que se retoma si vuelve a entrar la misma cuenta.
11. **Sin cuenta** (`VITE_ENABLE_ACCOUNTS` apagado) no arranca nada y nada sale del dispositivo. Voz, vista, recordatorios y la suscripción simulada se quedan en el dispositivo.

Implementación: `supabase/migrations/20261021100000_sincronizacion.sql`, `src/domain/sync.ts` (puro), `src/api-client/syncEngine.ts` y adaptadores `supabase*Repository.ts`, `src/ui/state/syncStore.ts`.

## Consecuencias

### Positivas

- Una serie hecha sin red llega a la nube al volver la red, sin duplicados.
- Las series de cámara llevan origen y duración y entran a las reglas anti-trampa. El historial previo no puntúa ni queda marcado por error.
- Cerrar la sesión de cámara con el fin de la última serie evita el falso positivo de solapamiento que advierte `DEC-074`.
- Cambiar de celular conserva historial, programa, rutinas y objetivos.
- Menos superficie en la base: el cliente ya no puede enviar `user_id`, marcas anti-trampa ni mover sesiones.

### Negativas y riesgos

- **Cerrar sesión con cambios sin subir los pierde.** Se avisa antes, pero se puede confirmar.
- **Última escritura gana con relojes de dispositivos distintos:** un reloj adelantado puede imponer una versión vieja de una rutina. Se acepta para el piloto.
- **Una operación rechazada por la nube** (dato inválido) queda solo en el dispositivo y se cuenta como fallida, sin reintentar. Si la rechazada es una sesión, sus series fallan después por RLS y cada una suma al contador de fallidas; siguen en el historial local.
- Si dos dispositivos activan rutinas distintas a la vez, la nube puede quedar con dos activas (no hay restricción única). Cada dispositivo muestra solo la más reciente, y la nube se corrige la próxima vez que se active una.
- La lectura baja como mucho 1000 series de un año: un historial mayor queda solo en la nube hasta que exista paginación en la UI.
- Formatos persistidos nuevos: `movexnet_data_owner_v1`, `movexnet_sync_v1:<id>`, y en `SetRecord` los campos opcionales `sessionId`, `source` y `durationMs`. El historial viejo sigue siendo válido.
- La migración cambia una prueba pgTAP existente (`rls.test.sql`): insertar `flagged` desde el cliente pasa de sobrescribirse en silencio a fallar con `42501`.

## Documentos a actualizar tras aprobarse (`docs-keeper`)

- `docs/DOMAIN.md`: entidad `Routine` en la nube y `Profile.programStartedAt`.
- `docs/DATA-GOVERNANCE.md`: ya hay datos de usuario en la nube (encabezado y §1); qué se borra del dispositivo al cerrar sesión.
- `ARCHITECTURE.md`: `src/api-client/` con datos y cola offline.

## Referencias

- Issue #87 y su comentario (`source`, `duration_ms`, `ended_at`); #88 (Web Push) queda desbloqueada.
- `DEC-024`, `DEC-029`, `DEC-033`, `DEC-052`, `DEC-067` §3, `DEC-069`, `DEC-074`.
- `docs/METRICS.md` §3 (`rejected_reps`, `clean_reps`, `fatigue_level`, `hold_seconds`).
- `supabase/tests/sincronizacion.test.sql`, `src/domain/sync.test.ts`, `src/api-client/syncEngine.test.ts`, `e2e/sincronizacion.spec.ts`.
