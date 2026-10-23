# MovexNet — Plantilla de consentimiento de grabación

> **Estado: plantilla propuesta — pendiente de revisión del responsable del proyecto.** No
> usar en una sesión de grabación real hasta que se resuelvan los puntos marcados como
> "Pendiente de confirmar" en este documento.

> Responsabilidad de este archivo: plantilla reutilizable del consentimiento explícito y
> separado por grabación que exige `docs/DATA-GOVERNANCE.md` §2, formalizado por `DEC-064`
> (un `RecordingConsent` vale para exactamente una `Recording`). Preparada para el Issue #16
> (sprint de recolección de datos). No contiene datos de ningún participante: se imprime o
> copia una vez **por cada grabación** que se vaya a realizar.

**Importante — cómo se usa:** este documento autoriza **una sola grabación**. Si una persona
va a grabar varias tomas (distintos ejercicios, vistas o condiciones), se completa y firma
una copia de esta plantilla por cada toma, antes de grabarla. No se reutiliza una misma firma
para varias grabaciones salvo que el responsable del proyecto lo apruebe expresamente por
escrito (hoy no existe esa aprobación).

---

## MovexNet — Consentimiento para una grabación de puntos corporales (landmarks)

**Versión de este consentimiento:** `consent-2026-10-v1`

### 1. Qué es MovexNet

MovexNet es un proyecto académico de seminario (UMG). No es un producto comercial: no vende
nada y los pagos dentro de la app son simulados. Responsable del proyecto: Gerardo Ovando
(`govandoh@miumg.edu.gt`).

### 2. Qué se te pide

Autorizar **una** grabación en la que, usando la cámara de un celular, se capturan puntos de
tu cuerpo en movimiento mientras realizas un ejercicio, en una vista de cámara y una
condición específicas (identificadas en la sección 5).

### 3. Qué se guarda y qué NO se guarda

| Se guarda en esta grabación | NO se guarda |
|---|---|
| Coordenadas numéricas de los puntos del cuerpo (landmarks) por cuadro, en un archivo de texto (JSON) | **Video.** La cámara no graba ni transmite imagen en ningún momento |
| La etiqueta de la toma: ejercicio, vista y condición declarados antes de grabar (sección 5) | Fotografías o capturas de pantalla |
| El modelo de dispositivo (celular) usado para grabar | Tu nombre, tu correo o cualquier dato que te identifique directamente |
| Tu esfuerzo percibido (RPE, escala 1–10), si lo compartes para esta toma | Datos médicos o de salud distintos de tu movimiento durante el ejercicio |
| El vector de orientación del celular (gravedad/acelerómetro), para corregir la inclinación del teléfono al analizar la grabación | — |

A partir de este punto, esta grabación se identifica únicamente por tu **código anónimo** de
participante (sección 4) y el **nombre de archivo** de la grabación (sección 5). El equipo
mantiene en un lugar aparte y de acceso restringido la relación entre tu identidad y tu código
anónimo, solo para poder atender una solicitud de borrado.

*(Trato de los datos: aunque la legislación aplicable no siempre clasifique los datos de
actividad física como dato de salud, el equipo los trata con ese nivel de protección,
siguiendo `docs/DATA-GOVERNANCE.md`.)*

### 4. Identificación del participante

Esta grabación solo puede autorizarse si el participante es **mayor de 18 años**, siguiendo
la misma edad mínima que exige `docs/DATA-GOVERNANCE.md` §2 para las cuentas de MovexNet
(`DEC-067`). Este documento no define ni agrega un mecanismo propio de verificación de edad
(no pide documento de identidad ni fecha exacta de nacimiento); se basa en la declaración del
participante al firmar en la sección 9.

| Campo | Valor |
|---|---|
| Código anónimo del participante | `s0__` |
| Declara ser mayor de 18 años | ☐ Sí |
| Fecha | ______ / ______ / __________ |

No se escribe el nombre del participante en este documento salvo en la firma (sección 9),
que se conserva por separado del archivo de la grabación.

### 5. Identificación de la grabación autorizada

Esta sección identifica **una única grabación**; si se va a grabar otra toma, se usa una
copia nueva de esta plantilla.

| Campo | Valor |
|---|---|
| Ejercicio | ______________________ |
| Vista de cámara | `side` (perfil) \| `front` (frente) \| `45` *(tachar las que no apliquen)* |
| Condición declarada | `correct` (correcta) o código de error de `docs/METRICS.md` §5.2 (p. ej. `knee_valgus`): ______________________ |
| Nombre de archivo de la grabación | ______________________ |
| Dispositivo usado | ______________________ |

El nombre de archivo sigue el patrón real de `fixtures/landmarks/SCHEMA.md`:
`<ejercicio>-<vista>-<calidad>-<nn>.json`, donde la **calidad** es `good` si la condición
declarada fue `correct`, o el código de error en formato con guiones (p. ej. `knee_valgus` →
`knee-valgus`) si fue un error — así lo genera la app automáticamente
(`src/testing/fixtureRecorder.ts`, ejemplo: `squat-side-knee-valgus-01.json`). El nombre debe
copiarse **exactamente** como lo descarga la app (o como quede tras renombrarlo, ver nota
abajo), para poder relacionar este consentimiento con su archivo sin ambigüedad. El código
anónimo del participante (sección 4) no forma parte del nombre de archivo: se registra aparte,
junto con este consentimiento, en `docs/REGISTRO-GRABACIONES.md`.

**Si el archivo se renombra después de grabarlo** (por ejemplo, al corregir `view` o `quality`
según la skill `/fixture`), debe actualizarse el nombre en este campo y en la fila
correspondiente de `docs/REGISTRO-GRABACIONES.md`, de modo que el consentimiento, el registro
y el archivo guardado en el Drive coincidan siempre.

### 6. Para qué se usa

Exclusivamente para **entrenar y evaluar modelos de inteligencia artificial de MovexNet** que
reconocen el ejercicio grabado y detectan errores de forma. No se usa con fines comerciales
ni se comparte con nadie fuera del equipo del proyecto.

### 7. Dónde se guarda, cuánto tiempo y cómo pedir el borrado

- **Almacenamiento:** mientras el modo de captura con cuenta de usuario (`docs/ML-PIPELINE.md`
  §1, PR 8) no exista en la app, el archivo de esta grabación se guarda en una carpeta privada
  del Drive del equipo MovexNet, con acceso restringido a los integrantes del proyecto.
  **Nunca se sube al repositorio de código en GitHub**, que es público.
- **Conservación:** **Pendiente de confirmar.** `docs/DATA-GOVERNANCE.md` §3 fija 24 meses
  como retención por defecto para el futuro backend con borrado automático; no hay una
  decisión documentada de que ese mismo plazo aplique a archivos guardados manualmente en
  Drive, sin ese mecanismo de purga. El responsable del proyecto debe confirmar el plazo
  aplicable a esta grabación antes de usar este documento en una sesión real.
- **Revocación y borrado:** puedes pedir el borrado de esta grabación en cualquier momento,
  sin dar explicación, escribiendo a **Pendiente de confirmar** (canal de contacto para este
  flujo manual sin cuenta de usuario; `docs/DATA-GOVERNANCE.md` no define uno específico para
  grabaciones fuera del backend) e indicando el código anónimo y el nombre de archivo de la
  grabación (sección 5). El correo del responsable del proyecto (sección 1) sirve para
  cualquier pregunta sobre el proyecto, pero **no está confirmado como el canal formal de
  borrado** de grabaciones de este flujo manual; mientras no se defina uno específico, es el
  único medio de contacto disponible para pedirlo. Si ya se usó esta grabación para entrenar
  un modelo antes del borrado, el modelo ya entrenado no se reentrena retroactivamente, pero la grabación deja de usarse en cualquier
  entrenamiento o evaluación futura (criterio de `docs/DATA-GOVERNANCE.md` §3 para el backend;
  aplicado aquí por analogía, pendiente de confirmación explícita para el flujo manual).

### 8. Participación voluntaria

Autorizar esta grabación es voluntario. Puedes detener la toma en cualquier momento, incluso
a mitad del ejercicio, sin dar ninguna razón; si lo pides, lo grabado hasta ese punto se borra
y no se guarda.

### 9. Autorización y firma

Declaro que leí y entendí este documento, que soy mayor de 18 años, que mi participación en
esta grabación es voluntaria, y que autorizo únicamente la grabación identificada en la
sección 5, bajo las condiciones descritas arriba.

| Campo | |
|---|---|
| Código anónimo del participante | `s0__` |
| Firma | ___________________________ |
| Fecha | ______ / ______ / __________ |
| Versión de este consentimiento | `consent-2026-10-v1` |

---

## Puntos marcados como pendientes en esta plantilla

- **Plazo de conservación para grabaciones guardadas manualmente en Drive** (sección 7):
  `docs/DATA-GOVERNANCE.md` §3 solo define 24 meses para el backend con purga automática, que
  todavía no existe para este flujo.
- **Canal de contacto para solicitar la revocación/borrado en el flujo manual** (sección 7):
  no hay un correo o procedimiento definido específicamente para grabaciones hechas con
  `?debug=record` sin cuenta de usuario. El correo del responsable del proyecto (sección 1)
  se usa hoy como único medio disponible, pero no está confirmado como el canal formal de
  borrado de este flujo.

Ninguno de estos puntos se completó con un supuesto propio: quedan como
**Pendiente de confirmar** hasta que el responsable del proyecto los defina.

## Referencias

- `docs/DATA-GOVERNANCE.md` §2 (consentimiento explícito y separado por grabación) y §3
  (retención y borrado).
- `docs/adr/DEC-064-consentimiento-una-grabacion.md` (un consentimiento vale para una sola
  grabación).
- `docs/ML-PIPELINE.md` §1 (captura con consentimiento; flag `?debug=record` mientras no
  exista el modo de captura con cuenta).
- `fixtures/landmarks/SCHEMA.md` (formato del nombre de archivo y `meta.capture`).
- `docs/REGISTRO-GRABACIONES.md` (hoja de registro asociada a cada consentimiento firmado).
- Issue #16 (sprint de recolección de datos, protocolo, consentimiento y voluntarios).
