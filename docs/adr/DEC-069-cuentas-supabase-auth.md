# DEC-069 · Cuentas con Supabase Auth: correo y contraseña, SMTP de Brevo, Turnstile y puerta 18+ en el servidor

- **Estado:** Propuesta
- **Fecha:** 2026-10-19
- **Decisores:** @govandoh (D, responsable del proyecto); el PR sigue las aprobaciones que exige `docs/adr/README.md`
- **Etiquetas:** `backend`, `auth`, `seguridad`, `privacidad`, `dependencia`
- **Issue:** #60. Depende de `DEC-067` (aviso `privacy-2026-10-v1` y regla 18+) para activar cuentas en producción.

## Contexto y problema

La app no tiene cuentas: todo vive en `localStorage`. El esquema y RLS por `auth.uid()` ya están en la nube (#17). La historia #60 pide registro, inicio y cierre de sesión, recuperación de contraseña y sesión persistente en la PWA. Hay que decidir el método de acceso, cómo se envían los correos, cómo se frena el abuso automatizado y dónde se impone la puerta de edad, sin gastar nada (regla dura 7) y sin exponer claves (regla dura 3).

Hechos verificados el 2026-10-19 en la documentación de Supabase:

- El correo integrado de Supabase solo envía a miembros del equipo del proyecto, unos **2 correos por hora**, sin SLA y "solo para uso no productivo" (`docs/guides/auth/auth-smtp`). No alcanza ni para confirmar registros ni para recuperar contraseñas.
- La protección contra contraseñas filtradas (HaveIBeenPwned) es **solo del plan Pro**; en Free quedan la longitud mínima y los tipos de carácter obligatorios.
- Supabase Auth valida captchas de **hCaptcha y Cloudflare Turnstile** en registro, inicio de sesión y recuperación; el cliente pasa `captchaToken` en `options`.
- Resend (gratis 100/día) exige un dominio propio verificado y no tenemos uno. Brevo (gratis 300/día por SMTP) funciona sin dominio propio, con un remitente verificado; las reglas exactas de verificación del remitente están **a verificar** en el panel.

## Factores de decisión

- Seguridad: que ninguna regla de negocio sensible (edad, privacidad) dependa solo del cliente.
- Cero costo y cero claves en el bundle.
- Correo suficiente para confirmación y recuperación en un piloto académico.
- Poco trabajo de UI para E y funcionamiento en la PWA instalada (Android Chrome, iOS Safari).

## Opciones consideradas

### Método de acceso

1. **Correo y contraseña con confirmación obligatoria** (elegida). Universal, sin terceros; la confirmación evita que alguien registre el correo de otra persona y hace que Supabase no revele si un correo ya existe.
2. **Solo enlace mágico u OTP por correo.** Sin contraseñas que filtrar, pero cada inicio de sesión gasta un correo del cupo y abrir el enlace en la PWA instalada de iOS no vuelve a la PWA (abre Safari). Descartada para v1.
3. **OAuth social (Google, Apple).** Requiere registrar apps con cada proveedor y Apple exige cuenta de pago. Fuera de alcance de #60.

### Envío de correo

1. **Correo integrado de Supabase.** Descartado: 2/h y solo al equipo.
2. **Resend gratis.** Descartado: requiere dominio propio.
3. **Brevo gratis por SMTP** (elegida): 300 correos/día, sin dominio propio.

### Abuso automatizado

1. **Solo límites de tasa de Supabase.** Por IP; no frena bots distribuidos ni el relleno de credenciales.
2. **Cloudflare Turnstile** (elegida): gratis, sin rompecabezas en la mayoría de los casos, validado por Supabase Auth con la clave secreta guardada en el panel (nunca en el repo).
3. **hCaptcha.** Equivalente, pero con más fricción visual.

### Puerta 18+ y aviso de privacidad

1. **Solo en el formulario.** Descartada: se salta llamando a `/auth/v1/signup` con la clave publicable.
2. **En el servidor** (elegida): un trigger sobre `auth.users` crea el perfil y rechaza el alta si falta el mes o el año de nacimiento, si la edad declarada es menor de 18 o si no se aceptó la versión vigente del aviso. Un trigger sobre `profiles` vuelve inmutables los campos de aceptación y no deja declarar después una edad menor.
3. **Verificación documental.** Descartada por `DEC-067`: no hay presupuesto ni base legal clara para tratar documentos de identidad.

**Precisión de la edad** (revisión de #67 y #68). Con solo el año, "cumple 18 este año" deja entrar a quien todavía tiene 17. Opciones: (a) solo año con margen (19 años de diferencia), que excluye a parte de los de 18; (b) fecha completa, que guarda el día sin necesitarlo; (c) **mes y año con regla conservadora** (elegida): sin el día, el mes de nacimiento todavía no cuenta, así que se exigen 217 meses (18 años y un mes). Nacido en octubre de 2008, entra desde el 1 de noviembre de 2026. Precisa la regla 18+ de `DEC-067`.

### Enlaces del correo

1. **`{{ .ConfirmationURL }}` con PKCE.** Solo se canjea en el navegador que pidió el enlace. En iOS, el correo abre Safari y la PWA instalada tiene otro almacenamiento: la confirmación y la recuperación fallarían ahí (revisión de #67).
2. **Plantillas con `token_hash` y `verifyOtp`** (elegida): el enlace va directo a la app (`?token_hash=…&type=email|recovery`) y la app lo canjea en cualquier navegador. Un solo uso, vence en una hora. Además, los antivirus de correo que abren los enlaces por adelantado no lo consumen: abrir la página no canjea nada, el canje lo hace la app con una llamada aparte.

## Decisión

1. **Acceso v1:** correo y contraseña, confirmación de correo obligatoria. Los enlaces de confirmación y recuperación usan las plantillas de `supabase/templates/` con `token_hash`, que la app canjea con `verifyOtp`; el cliente sigue en flujo **PKCE** para cualquier otro enlace. Sin acceso anónimo, enlace mágico ni OAuth.
2. **Contraseñas:** mínimo **10 caracteres** con minúsculas, mayúsculas y dígitos (`lower_upper_letters_digits`), igual en `supabase/config.toml` y en el panel. El cliente valida lo mismo solo para dar un mensaje temprano; manda el servidor.
3. **Correo:** SMTP de **Brevo** (plan gratis) configurado en el panel de Supabase; la clave SMTP vive solo allí. Remitente: una cuenta de correo del proyecto, no personal.
4. **Captcha:** **Cloudflare Turnstile** en registro, inicio de sesión y recuperación. La *site key* (pública) va en `VITE_TURNSTILE_SITE_KEY`; la clave secreta solo en el panel de Supabase. El script de Turnstile se carga solo en las pantallas de cuenta.
5. **Puerta 18+ y privacidad en el servidor**, como en la opción 2, con **mes y año** y la regla conservadora de 217 meses (columna nueva `profiles.birth_month`, hora de Guatemala). El mes, el año y la versión del aviso viajan en `options.data` del registro y el trigger los valida; la versión vigente es `privacy-2026-10-v1` (`DEC-067`). Las columnas nuevas son `profiles.privacy_version` y `profiles.privacy_accepted_at` (la fecha la pone el servidor, no el cliente).
6. **Dependencia nueva:** `@supabase/supabase-js`, importable solo desde `src/api-client/` (carpeta interina hasta `packages/api-client` en el PR 6), con una regla de ESLint que lo impida en el resto. Va en el mismo PR de #60, como la excepción de #17.
7. **Configuración del cliente:** `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` (públicas por diseño). El cliente rechaza al arrancar cualquier clave con prefijo `sb_secret_` o un JWT con rol `service_role`, y un script de CI falla si el bundle contiene `service_role`, `sb_secret` o `eyJhbGci`.
8. **Interruptor:** `VITE_ENABLE_ACCOUNTS`; apagado en producción hasta publicar el texto del aviso. Apagado, la app funciona exactamente como hoy, sin cuentas.
9. **Sesión:** se guarda en el almacenamiento del navegador, como exige el SDK en una SPA sin servidor propio. Mitigación del robo por XSS: no registrar tokens ni contraseñas, sin HTML no confiable en la UI y una política CSP con cabeceras de seguridad en Vercel, primero en modo `Report-Only` porque MediaPipe y three.js necesitan WASM y workers. La CSP es la historia #70 de E (`vercel.json`); debe permitir el dominio de Supabase y `challenges.cloudflare.com`.
10. **Cuenta obligatoria para usar la app** (decisión del responsable, 2026-10-20): con las cuentas activas, después de la bienvenida la app pide **iniciar sesión o registrarse antes de entrenar**. No se puede entrar primero y buscar la cuenta en Perfil. Sin sesión solo se llega a la bienvenida de la cuenta (`#/cuenta`), al registro, al inicio de sesión, a la recuperación y al aviso de privacidad. Quien ya tiene sesión entra directo aunque no haya red, porque la sesión se lee del dispositivo. Descartado: cuenta opcional (el plan inicial de #60), porque no tiene sentido entrenar sin cuenta y luego tener que buscarla en Perfil.

### Ajustes del panel de Supabase (los aplica D; no viven en el repo)

| Ajuste | Valor |
|---|---|
| Site URL | URL de producción de Vercel |
| Redirect URLs | Solo URLs exactas: producción y `https://localhost:5173`; sin comodines en producción |
| Confirm email | Activado |
| Secure password change | Activado (pide sesión reciente para cambiar la contraseña) |
| Contraseña | Mínimo 10, `lower_upper_letters_digits` |
| SMTP | Brevo, remitente del proyecto |
| Captcha | Turnstile, clave secreta solo aquí |
| Plantillas de correo | *Confirm signup* y *Reset password* con el contenido de `supabase/templates/confirmation.html` y `recovery.html` |
| Rate limits | Correos 30/h; registro e inicio 30 cada 5 min por IP; verificaciones 30 cada 5 min |
| Anonymous sign-ins, OAuth | Desactivados |
| JWT | Expiración 3600 s, rotación de refresh token activa |

## Consecuencias

### Positivas

- La edad y la aceptación del aviso no dependen del cliente: la API directa tampoco las salta.
- Confirmación obligatoria más mensajes genéricos cierran la enumeración de usuarios y el registro con correos ajenos.
- Cero costo: Brevo gratis, Turnstile gratis, Supabase Free.

### Negativas y riesgos

- Dos servicios externos nuevos (Brevo y Cloudflare) y un SDK nuevo; más superficie que mantener.
- Sin protección contra contraseñas filtradas (Pro). Se compensa con la longitud mínima y el captcha.
- 300 correos/día limita un lanzamiento masivo; suficiente para el piloto.
- La sesión en el navegador es vulnerable a XSS hasta que la CSP pase a modo estricto.
- Con la cuenta obligatoria, quien no quiera registrarse no puede usar la app, y el historial que ya existía en `localStorage` queda en el dispositivo hasta que exista la sincronización (historia aparte).
- Se guarda un dato personal más (el mes de nacimiento) a cambio de no admitir menores de 17; quien cumple 18 en el mes en curso espera hasta el mes siguiente.
- Con `token_hash`, quien tenga acceso al buzón puede canjear el enlace en cualquier navegador durante una hora. Es el mismo modelo de confianza que la recuperación por correo en general.
- En iOS, Safari puede borrar el almacenamiento tras días sin uso: el usuario tendría que volver a iniciar sesión. Se prueba con la PWA instalada.
- Correos de un remitente sin dominio propio pueden caer en spam; a verificar en la prueba en celular.
- El trigger de alta falla cerrado: rechaza cualquier fila nueva de `auth.users` sin nombre, año y aviso, incluidas las invitaciones desde el panel y un OAuth futuro. Añadir otro método de acceso exige ajustar el trigger (y una DEC).
- Quien llame a la API sin la UI puede distinguir un correo nuevo con datos inválidos (500) de uno ya registrado (éxito simulado). Es una enumeración marginal que exige saltarse la validación de la UI; se acepta y la frenan los límites de tasa y el captcha.
- Formatos persistidos nuevos: la sesión en `localStorage` bajo la clave `movexnet-auth` y las columnas `privacy_*`. Una configuración inválida deja las cuentas apagadas (falla cerrado) y `pnpm build` incluye `scripts/check-bundle-secrets.mjs` como paso obligatorio.

## Documentos a actualizar tras aprobarse (`docs-keeper`)

- `docs/DATA-GOVERNANCE.md` §2: la puerta 18+ ya tiene mecanismo (mes y año declarados, impuesto en el servidor).
- `docs/DOMAIN.md`: `Profile.privacyVersion`, `privacyAcceptedAt`.
- `CONTRIBUTING.md`: variables de entorno y cómo probar la cuenta en local.
- `ARCHITECTURE.md`: `src/api-client/` interina.

## Referencias

- Issue #60; `DEC-029` (Supabase), `DEC-035` (cero costo), `DEC-067` (privacidad y 18+), `AGENTS.md` reglas duras 3, 7 y 9.
- Supabase, SMTP propio: https://supabase.com/docs/guides/auth/auth-smtp
- Supabase, seguridad de contraseñas: https://supabase.com/docs/guides/auth/password-security
- Supabase, captcha: https://supabase.com/docs/guides/auth/auth-captcha
- Brevo, SMTP gratis: https://www.brevo.com/free-smtp-server
- Resend, límites: https://resend.com/docs/knowledge-base/resend-sending-limits
