# DEC-080 · Recordatorios con la app cerrada: Web Push con VAPID propio, avisos por suscripción y envío con pg_cron

- **Estado:** Propuesta
- **Fecha:** 2026-10-22
- **Decisores:** @govandoh (D, responsable del proyecto); el PR sigue las aprobaciones que exige `docs/adr/README.md`
- **Etiquetas:** `backend`, `api-client`, `pwa`, `datos`, `seguridad`
- **Issue:** #88. Sigue a #35 (PR #76) y a `DEC-079` §11. Aplica `DEC-025`, `DEC-035` y las reglas duras 3, 7 y 9.

## Contexto y problema

Desde el PR #76 el recordatorio del programa se programa con `setTimeout` en `src/ui/state/reminders.ts`: llega con la app abierta o en segundo plano, no con la app cerrada. Para la app cerrada hace falta que un servidor envíe Web Push (RFC 8030) firmado con VAPID (RFC 8292) y con el contenido cifrado (RFC 8291).

Hechos que condicionan la decisión:

- `reminderTimes()` (`src/domain/calendar.ts`) ya calcula los avisos: omite los días entrenados y las sesiones Premium bloqueadas, y usa la hora local del dispositivo. El programa sale de `generateRoutine(questionnaire)`, que solo existe en TypeScript.
- El recordatorio (activado y hora) es preferencia del dispositivo, no de la cuenta (`DEC-079` §11): dos celulares de la misma cuenta pueden tener horas distintas.
- No existía `supabase/functions/`. `pg_cron` ya está en uso (`20261010000300_set_logs_partitioning.sql`); `pg_net` y Vault vienen en todos los planes de Supabase.
- El service worker (`public/sw.js`) no tiene la sesión de Supabase: no puede pedir datos ni volver a registrar una suscripción por su cuenta.
- En iOS el push web solo existe con la PWA instalada (iOS 16.4 o más) y el permiso se pide desde un toque.
- Regla dura 9: nada de dependencias nuevas sin discutirlas.

## Opciones consideradas

### Quién calcula los avisos

1. **La Edge Function, a partir de las tablas.** Descartada: duplicaría en Deno `generateRoutine`, `scheduleProgram`, `reminderTimes` y la lógica de zonas horarias, y las dos copias divergirían.
2. **El cliente** (elegida): calcula los avisos de los próximos 14 días con el dominio y los sube ya con fecha y hora absolutas (`timestamptz`). El servidor solo envía lo vencido.

### Avisos por usuario o por suscripción

1. **Por usuario** (`push_reminders.user_id`). Descartada: con dos celulares de horas distintas, cada uno pisaría los avisos del otro.
2. **Por suscripción** (elegida): `push_reminders.subscription_id` con `on delete cascade`. Cada celular maneja sus avisos; borrar la suscripción (desactivar, cerrar sesión o endpoint vencido) borra sus avisos.

### Librería de Web Push en la función

1. **`npm:web-push`.** Descartada: depende de la compatibilidad Node de Deno (`crypto.createECDH`, `https`) en Edge Runtime y trae unas cinco dependencias transitivas.
2. **`jsr:@negrel/webpush`.** Descartada: nativa de Deno, pero con un solo mantenedor para código criptográfico.
3. **Push sin contenido** (solo VAPID). Descartada: el service worker no podría mostrar la semana ni abrir el día, porque no tiene sesión para pedirlos.
4. **Implementación propia con Web Crypto** (elegida): JWT ES256 de VAPID y cifrado `aes128gcm` en unas 150 líneas, sin dependencias. Corre igual en Deno y en Node 22, así que se prueba con Vitest contra el vector del Apéndice A del RFC 8291.

### Disparo y autenticación

1. **Cron externo (GitHub Actions) que llama a la función.** Descartada: el cron de Actions se retrasa minutos u horas en horas pico y añade otro lugar con el secreto.
2. **`pg_cron` + `pg_net` con la `service_role` escrita en SQL.** Descartada: la clave quedaría en la migración o en `cron.job`.
3. **`pg_cron` + `pg_net` con un secreto propio de la función guardado en Vault** (elegida).

## Decisión

Usamos Web Push estándar desde una Edge Function de Supabase, con los avisos calculados por el cliente y guardados por suscripción:

1. **Claves VAPID.** Par P-256 generado fuera del repo (`npx web-push generate-vapid-keys`). La pública va al cliente en `VITE_VAPID_PUBLIC_KEY` (es pública por diseño). La privada solo como secreto de la función (`VAPID_PRIVATE_KEY`, junto con `VAPID_PUBLIC_KEY` y `VAPID_SUBJECT=mailto:…`). Sin `VITE_VAPID_PUBLIC_KEY` el cliente no intenta suscribirse.
2. **Tablas** (`20261022000000_web_push.sql`):
   - `push_subscriptions (id, user_id default auth.uid(), endpoint unique, p256dh, auth, user_agent, created_at)`. El endpoint debe ser `https://` de un servicio de push conocido (FCM, Mozilla, Windows, Apple); la misma lista se comprueba antes de enviar. Así la función nunca hace POST a una URL arbitraria.
   - `push_reminders (id, subscription_id → push_subscriptions on delete cascade, send_at, title, body, url, sent_at)`, con índice parcial `(send_at) where sent_at is null`. `sent_at` significa "procesado": enviado, saltado por viejo o rechazado.
   - RLS: cada usuario lee y borra solo lo suyo (los avisos, a través de su suscripción). El cliente no tiene INSERT ni UPDATE directo en ninguna de las dos: no puede fijar `user_id`, `sent_at` ni escribir en suscripciones ajenas.
3. **Funciones de la base.**
   - `register_push_subscription(endpoint, p256dh, auth, user_agent)` (`security definer`): inserta o actualiza la suscripción de `auth.uid()`. Si el endpoint estaba en otra cuenta (otra persona entró en el mismo navegador sin cerrar sesión), se borra esa fila con sus avisos y pasa a la cuenta actual: tener el endpoint prueba que es ese navegador. Máximo 10 suscripciones por cuenta; se borran las más viejas.
   - `replace_push_reminders(endpoint, items)` (`security definer`, comprueba el dueño): en una transacción borra los avisos pendientes de esa suscripción e inserta los nuevos. Máximo 30, `send_at` entre ahora y 15 días, título de 1 a 80 caracteres, cuerpo hasta 160 y `url` relativa que empieza por `/#/`.
   - `claim_due_push_reminders(limit)` (solo `service_role`): marca `sent_at` con `for update skip locked` y devuelve los avisos vencidos con su suscripción. **Como mucho una vez:** dos ejecuciones a la vez no envían el mismo aviso. Antes marca como procesados, sin devolverlos, los vencidos hace más de 2 h: si el cron estuvo caído no llega un "hoy toca" de madrugada.
4. **Envío** (`supabase/functions/send-reminders/`). La función exige el encabezado `x-cron-secret` igual a `CRON_SECRET` (comparación en tiempo constante; `verify_jwt = false`). Reclama hasta 200 avisos, cifra el contenido para cada suscripción y lo envía con `TTL: 14400` (4 h), `Urgency: normal` y `Topic: recordatorio`, para que un aviso no entregado lo reemplace el siguiente. Un 404 o 410 borra la suscripción (y sus avisos); cualquier otro error se registra sin reintentar, sin escribir el endpoint en los logs (es una URL con capacidad). La función habla con la base por PostgREST con la `service_role` que Supabase le inyecta; no usa el SDK.
5. **Disparo.** `pg_cron` ejecuta `private.dispatch_push_reminders()` cada 5 minutos. La función SQL borra los avisos procesados hace más de 7 días y, **solo si hay avisos vencidos**, llama a la Edge Function con `net.http_post`. La URL y el secreto se leen de Vault (`send_reminders_url`, `send_reminders_secret`); la migración no contiene secretos y sin ellos el job no hace nada.
6. **Cliente.**
   - Al activar en Perfil → Ajustes se pide el permiso desde el toque, se suscribe (`userVisibleOnly: true`) y se registra la suscripción.
   - Cada vez que cambian el programa, el historial, la hora o el acceso Premium, se reemplazan los avisos de los próximos **14 días**. Entrenar un día no necesita un borrado aparte: `reminderTimes` omite ese día y el reemplazo lo quita.
   - Al abrir la app con el recordatorio activo se registra de nuevo la suscripción actual (idempotente): cubre el cambio de endpoint que el service worker no puede resolver.
   - Con push activo, el `setTimeout` local no corre (evita el aviso doble). Sin cuenta o sin VAPID configurada, se mantiene el aviso local de hoy y nada sale del dispositivo.
   - Desactivar o cerrar sesión: se borra la suscripción en la base, luego `unsubscribe()` y, al cerrar sesión, `signOut`. Sin red, `unsubscribe()` se hace igual: el endpoint queda muerto y el siguiente envío recibe 410 y borra la fila.
7. **Service worker.** Evento `push`: muestra la notificación con título, cuerpo, ícono, `tag` fijo y `data.url`. `notificationclick` enfoca la app y la lleva a `data.url` (`/#/rutinas?semana=N`), o la abre ahí. `CACHE` sube a `entrenador-ia-v10` (`DEC-025`).
8. **Privacidad del aviso.** El texto es solo el día del programa: título "Hoy toca entrenar" y cuerpo "Semana N · <nombre del día>". Nada de métricas, peso, fatiga ni historial. El contenido viaja cifrado de punta a punta (RFC 8291): el servicio de push del navegador no puede leerlo. En la base quedan el endpoint, las claves públicas de la suscripción y el texto del aviso, borrados en cascada con la cuenta.
9. **Costo: cero** (regla dura 7, `DEC-035`).
   - Edge Functions en Supabase Free: 500 000 invocaciones al mes. El cron solo llama si hay avisos vencidos; aun llamando cada 5 minutos serían 8 640 al mes (1,7 % del cupo).
   - `pg_cron`, `pg_net` y Vault: incluidos en el plan, sin cobro aparte. La base suma unas 30 filas por celular activo.
   - Servicios de push (FCM, Mozilla Autopush, WNS, Apple Web Push): gratis y sin cuenta de desarrollador para Web Push estándar.
   - CSP: sin cambios en `vercel.json`. La suscripción la gestiona el navegador y la página no llama a la función.

## Consecuencias

### Positivas

- El aviso llega con la app cerrada en Android, y en iOS con la PWA instalada.
- Una sola copia de la lógica del programa: el servidor no sabe de rutinas ni de zonas horarias.
- Sin dependencias nuevas: la criptografía usa Web Crypto y se prueba contra el vector del RFC.
- Cada celular controla sus avisos; desactivar, cerrar sesión o perder el endpoint limpia todo por cascada.
- Ningún secreto en el repo, en el bundle ni en `cron.job`.

### Negativas y riesgos

- **Criptografía propia.** Un error rompería el envío (los navegadores descartan lo que no descifran), no la privacidad. Se mitiga con el vector del RFC 8291 y la prueba en celulares reales.
- **Entrenar sin red:** si el historial no llegó a subir el reemplazo, el aviso de ese día llega igual.
- **Ventana de 14 días:** quien no abre la app en dos semanas deja de recibir avisos. Se acepta: no insiste a quien dejó de usarla.
- **Cambio de zona horaria:** los avisos subidos conservan la hora absoluta hasta que se abre la app.
- **Como mucho una vez:** un error transitorio del servicio de push pierde ese aviso.
- **Quien conozca un endpoint ajeno** podría registrarlo en su cuenta con claves inválidas y dejar a ese navegador sin avisos. El endpoint no se expone a terceros (RLS, logs sin endpoint); se acepta para el piloto.
- iOS sin la PWA instalada, o con el permiso bloqueado, sigue sin avisos; Perfil lo explica (PR #76).

## Documentos a actualizar tras aprobarse (`docs-keeper`)

- `docs/DATA-GOVERNANCE.md` §1: suscripción de push y texto del aviso en Postgres.
- `ARCHITECTURE.md`: `supabase/functions/send-reminders` y el flujo cron → función → servicio de push.
- `CONTRIBUTING.md`: cómo probar el envío en local.

## Referencias

- RFC 8030 (Web Push), RFC 8291 (cifrado, vector del Apéndice A), RFC 8292 (VAPID), RFC 8188 (`aes128gcm`).
- Issue #88, PR #76, `DEC-025`, `DEC-035`, `DEC-069`, `DEC-079`.
- `supabase/migrations/20261022000000_web_push.sql`, `supabase/functions/send-reminders/`, `supabase/tests/web_push.test.sql`, `src/api-client/supabasePushRepository.ts`, `src/ui/state/reminders.ts`, `public/sw.js`.
