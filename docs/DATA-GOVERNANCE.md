# Fitnet — Gobernanza de datos

> Responsabilidad de este archivo: qué datos se recolectan y cuáles no, consentimiento, retención y borrado, seguridad de acceso (RLS), residencia y uso de datasets externos. Decisiones: `DEC-026` (regla de privacidad), `DEC-029` (Supabase `us-east-1`), `DEC-033` (qué recibe el LLM). Esquema JSON de grabaciones: `ML-PIPELINE.md` §2.

**Estado:** la app en producción no recolecta ningún dato (todo ocurre en el cliente; solo usa `localStorage` para `ob_complete_v1` y `preferred_camera`). Lo que sigue aplica desde que exista backend (Fase 2) y captura con consentimiento (PR 8).

## 1. Qué datos se recolectan y cuáles no

| Dato | ¿Se recolecta? | Dónde | Condición |
|---|---|---|---|
| **Video de la cámara** | **Nunca.** No se transmite, no se sube, no se guarda en servidor. | Solo en memoria del dispositivo durante la sesión. | Regla dura (`AGENTS.md`). En modo captura puede guardarse **localmente** para etiquetar y se borra al terminar. |
| Imagen clave por rep (segunda opinión) | Solo bajo petición explícita del usuario premium, una imagen, con aviso en pantalla. | Edge Function; no se persiste tras responder. | `DEC-027`. Pendiente de DEC propia antes de implementarse. |
| Landmarks (`LandmarkFrame[]`) | Solo con `RecordingConsent` activo. | Supabase Storage (bucket privado) + tabla `recordings`. | Consentimiento explícito por grabación (§2). |
| Métricas por rep/serie/sesión (`Rep`, `Set`, `Metric`) | Sí, para usuarios autenticados. | Postgres. | Base del historial, progreso y coaching. Sin cuenta, nada sale del dispositivo. |
| Perfil (nombre, año de nacimiento, altura, peso, nivel) | Opcional salvo nombre. | Postgres. | Editable y borrable por el usuario. |
| RPE y notas de sesión | Opcional. | Postgres. | — |
| Mensajes de coaching | Sí, entre entrenador, cliente y asistente. | Postgres + Realtime. | Visibles solo a las partes de la `CoachingRelationship`. |
| Datos de pago (tarjeta) | **Nunca en Fitnet.** | Recurrente/Paddle (checkout alojado). | Fitnet guarda solo `externalId`, plan y estado. |
| Telemetría técnica (errores, latencias del pipeline, versiones de modelo) | Sí, anonimizada (sin landmarks ni identificadores directos). | Postgres (`daily_user_stats`) o proveedor de logs. | Para gates de modelo y soporte. |
| Contenido enviado al `CoachAssistant` | Solo `Metric`/`RepSummary` agregados + perfil y objetivos. | Edge Function `coach` → API de Claude. | Nunca video ni landmarks crudos (`DEC-033`). |

Datos de actividad física y medidas corporales son datos sensibles de salud a efectos de comunicación con el usuario: se tratan con el nivel de protección de esta sección aunque la legislación aplicable no los clasifique así.

## 2. Consentimiento

- **Cuenta:** al registrarse, el usuario acepta términos y aviso de privacidad (versión registrada en `Profile.privacyVersion`).
- **Grabación de landmarks para el dataset:** consentimiento **explícito y separado por grabación** (`RecordingConsent` con `textVersion`, `grantedAt`). La pantalla de captura explica qué se guarda (landmarks, etiquetas, dispositivo, RPE), qué no (video), para qué (entrenar modelos de Fitnet) y cómo borrarlo. Sin consentimiento, el modo captura no guarda nada.
- **Compartir métricas con un entrenador:** implícito al aceptar la `CoachingRelationship`; revocable al terminarla (el entrenador pierde acceso a datos futuros y pasados salvo los reportes ya generados, que se anonimizan).
- **Perfil público / comunidad / rankings:** opt-in explícito (`Profile.publicProfile`); por defecto nada es visible a terceros.
- **Segunda opinión por imagen:** confirmación por petición, no persistente.
- Menores de edad: v1 solo para mayores de 18 años, declarado al registrarse con el año de nacimiento (`profiles.birth_year`); quien no cumpla no puede crear cuenta. No hay verificación documental (`DEC-067`).

## 3. Retención y borrado

| Dato | Retención | Borrado |
|---|---|---|
| Grabaciones (`Recording`) | Hasta `retentionUntil` (por defecto 24 meses desde la grabación) o hasta revocación del consentimiento (al revocar, la base fija `retentionUntil` en ese instante, DEC-064). | El usuario borra desde la app; job nocturno purga Storage y tabla. Los modelos ya entrenados no se re-entrenan retroactivamente, pero la grabación deja de usarse en runs futuros. |
| Métricas y sesiones | Mientras exista la cuenta. | Borrado de cuenta = borrado en cascada (Postgres `ON DELETE CASCADE`) + purga de Storage, en ≤ 30 días; exportación previa disponible en JSON. |
| Mensajes de coaching | Mientras exista la relación o la cuenta. | Cascada con la cuenta; el entrenador conserva reportes anonimizados. |
| Agregados anonimizados (`daily_user_stats` sin `userId` tras borrado) | Indefinida. | No reversible; no identifican al usuario. |
| Logs técnicos | 30 días. | Automático. |
| Cuentas inactivas | Aviso a los 12 meses; borrado a los 18 sin respuesta. | Job programado. |

El usuario puede en cualquier momento: ver qué grabaciones existen, borrar una o todas, exportar sus datos y eliminar la cuenta. Estas acciones son funcionalidades de producto (E1), no procesos manuales.

## 4. Seguridad de acceso (RLS)

- **Row Level Security en todas las tablas.** Política por defecto: el dueño (`auth.uid() = user_id`) lee y escribe lo suyo; nadie más lee nada.
- **Entrenadores:** acceso de lectura a métricas y sesiones del cliente solo si existe `coaching_relationships` activa (`status = 'active'`); las políticas de `sets`, `reps`, `metrics`, `messages` derivan de esa tabla.
- **Premium:** funciones y vistas premium comprueban `is_premium(auth.uid())`, función SQL que lee `subscriptions`; esa tabla solo la escribe el webhook con `service-role` (`DEC-030`).
- **Storage:** buckets privados; las grabaciones se leen con URLs firmadas de corta duración; el pipeline de ML accede con una clave de servicio desde Kaggle/CI, nunca desde el cliente.
- **Claves:** API de Claude, claves de pagos y `service-role` solo en Edge Functions y secretos de CI. El cliente usa la `anon key` + JWT del usuario.
- **Anonimización para ML:** las grabaciones se exportan al dataset con `subjectId` pseudónimo (hash con sal por proyecto) y sin `userId`, nombre ni email; el mapeo vive en una tabla con acceso restringido para poder atender borrados.

## 5. Residencia de datos y aviso pendiente

- Supabase en `us-east-1` (Virginia, EE. UU.): todos los datos de usuarios (mayoritariamente en Guatemala) residen en EE. UU.
- Los datos enviados al `CoachAssistant` se procesan en la infraestructura del proveedor del LLM.
- Los artefactos de modelos en Hugging Face Hub no contienen datos personales.
- **Pendiente del equipo:** aviso de privacidad que declare explícitamente la residencia en EE. UU., el tratamiento de datos de salud/actividad, el proveedor de IA y los derechos de acceso, exportación y borrado, conforme a la legislación guatemalteca aplicable y buenas prácticas internacionales. Hasta tenerlo, no se activan registro de cuentas ni captura con consentimiento en producción.

## 6. Datasets externos

Uso condicionado a licencia (tabla en `ML-PIPELINE.md` §5):

- **Permitidos en producto:** InfiniteRep (CC BY 4.0, exige atribución: se incluye en la sección "Créditos" de la app y en este archivo) y el video RGB de MM-Fit (CC BY 4.0, misma atribución).
- **Solo uso académico (`DEC-065`):** las etiquetas y sensores del paquete multimodal de MM-Fit no tienen licencia pública verificada; su uso se ampara en la autorización del responsable del proyecto (2026-10-12). Ningún modelo publicado en `models/manifest.json` puede haberse entrenado con ellos hasta resolver su licencia.
- **Solo prototipos y benchmarks (no comercial o sin licencia clara):** EC3D, REHAB24-6, Fitness-AQA. Ningún modelo publicado en `models/manifest.json` puede haberse entrenado o afinado con ellos; el gate de promoción lo verifica por la declaración `allowedFor` de cada dataset.
- Los datasets externos se descargan desde sus fuentes originales en el entorno de entrenamiento; no se redistribuyen en el repo ni en Storage.

Atribuciones:

- InfiniteRep — Infinity AI, licencia CC BY 4.0.
- MM-Fit — Strömbäck, Huang y Radu (2020). Código MIT; video RGB CC BY 4.0; etiquetas y sensores sin licencia pública verificada (`DEC-065`).
