# MovexNet — Plantilla de consentimiento de grabación

> Responsabilidad de este archivo: plantilla reutilizable del consentimiento explícito y
> separado por grabación que exige `docs/DATA-GOVERNANCE.md` §2, formalizado por `DEC-064`
> (un consentimiento vale para exactamente una grabación). Preparada para el sprint de
> recolección de datos (issue #16). No contiene datos de ningún participante.

**Estado:** aprobada por el responsable del proyecto (`@govandoh`) el 2026-10-23.

**Versión del texto:** `consent-2026-10-v1` (no se había usado en ninguna sesión real antes de esta
revisión, por eso no cambia).

El documento tiene dos partes: las **instrucciones para el equipo** (no se imprimen) y la
**hoja para el participante** (se imprime una copia por cada toma).

---

## Instrucciones para el equipo (no imprimir)

1. **Una hoja por toma.** Cada toma (ejercicio + vista + condición) necesita su propia hoja
   firmada antes de grabar (`DEC-064`). No se reutiliza una firma para varias tomas.
2. **Mayoría de edad.** Solo se graba a personas de 18 años o más, por declaración al firmar
   (`DEC-067`, `docs/DATA-GOVERNANCE.md` §2). No se pide documento de identidad.
3. **Código anónimo.** Se asigna un código correlativo (`s01`, `s02`…), nunca iniciales. La
   relación nombre ↔ código se anota solo en `mapeo-codigos.xlsx`, dentro de la carpeta de
   consentimientos (ver punto 7).
4. **Grabar con el guion completo en la URL**, siempre con `subject`:
   `?engine=3d&debug=record&cond=<condición>&view=<side|front|45>&subject=<sNN>`
   (`docs/ML-PIPELINE.md` §1). Así el código también queda dentro del archivo
   (`meta.capture.subjectId`).
5. **Nombrar el archivo.** La app descarga siempre con correlativo `-01`, así que dos tomas de la
   misma combinación se llamarían igual. Al guardar en el Drive:
   - se mueve a `grabaciones/<sNN>/` y se ajusta el correlativo `nn` de la combinación
     `<ejercicio>-<vista>-<calidad>` dentro de ese sujeto (`fixtures/landmarks/SCHEMA.md`);
   - se verifica que la calidad del nombre corresponda a la condición declarada. Hoy la app solo
     reconoce como calidad los códigos de error que ya tenía registrados; con `hip_sag` o
     `hip_pike` el archivo sale con `good` en el nombre y hay que renombrarlo a mano a
     `hip-sag` o `hip-pike`.
   - El **identificador de la toma** es `<sNN>/<nombre del archivo>` (por ejemplo
     `s03/squat-side-knee-valgus-01.json`). Debe ser idéntico en la hoja firmada (sección 5), en
     el registro y en el Drive; si se renombra el archivo, se corrige en los tres.
6. **Guardar la hoja firmada.** Se escanea o se fotografía y se sube a
   `consentimientos/<sNN>/` con el mismo nombre del archivo y extensión `.pdf` o `.jpg`. Nunca va
   al repositorio, que es público.
7. **Carpetas del Drive** (los enlaces no se escriben en el repositorio):
   ```
   MovexNet-grabaciones/        acceso: todo el equipo
     grabaciones/<sNN>/<ejercicio>-<vista>-<calidad>-<nn>.json
     registro.xlsx              copia de docs/REGISTRO-GRABACIONES.md con datos
   MovexNet-consentimientos/    acceso: el responsable del proyecto y quien él designe por escrito
     <sNN>/<archivo>.pdf
     mapeo-codigos.xlsx         nombre <-> código anónimo
   ```
   El nombre del participante vive solo en esta segunda carpeta.
8. **Retención.** Cada grabación se conserva 24 meses desde su fecha (`docs/DATA-GOVERNANCE.md`
   §3). El registro tiene la columna "Conservar hasta"; cada seis meses se revisa y se borra
   lo vencido.
9. **Si alguien pide el borrado**, en máximo 30 días: se ubica su código en el mapeo, se
   borran sus archivos de `grabaciones/<sNN>/` y de cualquier índice o conjunto de datos
   derivado, se marca "Revocada" la fila del registro y se responde confirmando. La hoja
   firmada y el mapeo se conservan hasta cerrar la solicitud y luego se borran también. Los
   modelos ya entrenados no se reentrenan, pero la grabación no se usa en entrenamientos
   futuros (criterio de `docs/DATA-GOVERNANCE.md` §3, aplicado a mano porque este flujo no
   tiene el trigger de `DEC-064`).
10. **Si la persona detiene la toma**, lo grabado hasta ese momento se descarta y no se registra.
11. **Fuera del repositorio.** Ni el nombre, ni el correo, ni un enlace del Drive con datos de
    participantes se escriben en issues, PR ni archivos del repositorio.

---

## Hoja para el participante (imprimir desde aquí)

### MovexNet — Consentimiento para una grabación de puntos corporales

**Versión de este consentimiento:** `consent-2026-10-v1`

#### 1. Qué es MovexNet

MovexNet es un proyecto académico de seminario (UMG). No vende nada y los pagos dentro de la
app son simulados. Responsable del proyecto: `@govandoh` (workstream D). Contacto:
`govandoh@miumg.edu.gt`.

#### 2. Qué se te pide

Autorizar **una** grabación en la que, con la cámara de un celular, se capturan puntos de tu
cuerpo mientras haces un ejercicio, en una vista de cámara y una condición concretas
(sección 5).

#### 3. Qué se guarda y qué NO se guarda

| Se guarda en el archivo de la grabación | NO se guarda |
|---|---|
| Coordenadas numéricas de los puntos del cuerpo (landmarks) por cuadro, en un archivo de texto (JSON) | **Video.** Ninguna imagen ni video se guarda ni sale del celular |
| La etiqueta de la toma: ejercicio, vista y condición declaradas antes de grabar | Fotografías ni capturas de pantalla |
| Tu código anónimo (`sNN`) | Tu nombre, tu correo o cualquier dato que te identifique directamente |
| La fecha y hora de la toma y los datos del celular que informa el navegador (modelo y versión del sistema) | Datos médicos o de salud distintos de tu movimiento durante el ejercicio |
| El vector de gravedad del celular y la corrección de inclinación, para nivelar la grabación al analizarla | |

Aparte del archivo, el equipo anota en una hoja de registro: repeticiones hechas, fecha y,
**solo si tú quieres compartirlo**, tu esfuerzo percibido (RPE, escala 1 a 10). El RPE no va
dentro del archivo de la grabación.

Tu nombre aparece únicamente en esta hoja firmada y en una lista que relaciona nombres con
códigos; ambas se guardan en una carpeta aparte, de acceso restringido. Se usan solo para
poder atender una solicitud de borrado.

*(Aunque la legislación aplicable no siempre trate los datos de actividad física como datos
de salud, el equipo les da ese nivel de protección, según `docs/DATA-GOVERNANCE.md`.)*

#### 4. Identificación del participante

| Campo | Valor |
|---|---|
| Código anónimo del participante | `s0__` |
| Declaro tener 18 años o más | [ ] Sí |
| Fecha | ______ / ______ / __________ |

#### 5. Grabación que autorizas

Esta hoja autoriza **una única grabación**. Para otra toma se usa otra hoja.

| Campo | Valor |
|---|---|
| Ejercicio (`squat`, `curl`, `press`, `pushup`, `lunge`, `bridge` o `plank`) | ______________________ |
| Vista de cámara | `side` (perfil) \| `front` (frente) \| `45` *(tachar las que no apliquen)* |
| Condición declarada | `correct` (correcta) o el error que se va a simular: ______________________ |
| Identificador de la toma (`<sNN>/<archivo>.json`) | ______________________ |
| Celular usado | ______________________ |

#### 6. Para qué se usa

Solo para **entrenar y evaluar los modelos de inteligencia artificial de MovexNet** que
reconocen el ejercicio y detectan errores de técnica, en el marco del seminario.

- El modelo resultante puede publicarse dentro de la app y en un repositorio de modelos. Puede
  contener valores numéricos derivados de movimientos (por ejemplo ángulos y posturas
  normalizados), pero no tu nombre, tu correo ni ninguna imagen.
- Las grabaciones en sí no se publican, no se venden y no se comparten con nadie fuera del
  equipo del proyecto.

#### 7. Dónde se guarda, cuánto tiempo y cómo borrarlo

- **Dónde:** en una carpeta privada del Drive del equipo MovexNet. **Nunca** en el repositorio
  de código de GitHub, que es público.
- **Cuánto tiempo:** 24 meses desde la fecha de la grabación. Después se borra.
- **Cómo pedir el borrado:** en cualquier momento y sin dar explicación, escribe a
  `govandoh@miumg.edu.gt` con tu **nombre completo y la fecha de la sesión**. El equipo
  encuentra tu grabación con esos datos. Se borra en un máximo de **30 días** y te responden
  confirmándolo.
- **Qué pasa al pedirlo:** la grabación se borra y deja de usarse en cualquier entrenamiento o
  evaluación futura. Si ya se usó para entrenar un modelo, ese modelo no se reentrena.

#### 8. Participación voluntaria

Autorizar esta grabación es voluntario. Puedes detener la toma en cualquier momento, incluso a
mitad del ejercicio, sin dar razón; si lo pides, lo grabado hasta ese punto se descarta.

#### 9. Autorización y firma

Declaro que leí y entendí esta hoja, que tengo 18 años o más, que mi participación es
voluntaria y que autorizo únicamente la grabación identificada en la sección 5, bajo las
condiciones descritas.

| Campo | |
|---|---|
| Nombre completo (letra clara) | ___________________________ |
| Código anónimo del participante | `s0__` |
| Firma | ___________________________ |
| Fecha | ______ / ______ / __________ |
| Versión de este consentimiento | `consent-2026-10-v1` |

---

## Referencias

- `docs/DATA-GOVERNANCE.md` §2 (consentimiento explícito y separado por grabación), §3
  (retención y borrado) y §4 (anonimización).
- `docs/adr/DEC-064-consentimiento-una-grabacion.md` (un consentimiento vale para una sola
  grabación).
- `docs/adr/DEC-067-coste-ia-rankings-antitrampa-privacidad.md` (edad mínima de 18 años).
- `docs/ML-PIPELINE.md` §1 (captura con consentimiento y flag `?debug=record`).
- `fixtures/landmarks/SCHEMA.md` (formato del nombre de archivo y `meta.capture`).
- `docs/REGISTRO-GRABACIONES.md` (hoja de registro asociada a cada consentimiento).
- Issue #16 (sprint de recolección de datos).
