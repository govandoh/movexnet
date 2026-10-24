# MovexNet — Hoja de registro de grabaciones

> Responsabilidad de este archivo: plantilla reutilizable para registrar cada grabación del
> sprint de recolección de datos (issue #16), relacionando cada archivo JSON con su
> participante anónimo y su consentimiento, y con la fecha hasta la que se conserva
> (`docs/DATA-GOVERNANCE.md` §2 y §3, `docs/adr/DEC-064-consentimiento-una-grabacion.md`). Se
> usa junto con `docs/CONSENTIMIENTO-GRABACION.md` (un consentimiento por grabación).

**Estado:** aprobada por el responsable del proyecto (`@govandoh`) el 2026-10-23.

**Esta plantilla se mantiene vacía en el repositorio.** La hoja real, con los datos de las
sesiones, **no se sube a GitHub**: vive como `registro.xlsx` en la carpeta
`MovexNet-grabaciones/` del Drive del equipo, junto a las grabaciones. En el repositorio solo
están la plantilla y las instrucciones. La estructura completa de carpetas está en
`docs/CONSENTIMIENTO-GRABACION.md` (instrucciones para el equipo, punto 7).

## Cómo registrar cada toma

1. Antes de grabar, verifica que el participante tiene 18 años o más y que firmó una hoja de
   `docs/CONSENTIMIENTO-GRABACION.md` para la toma que vas a hacer. Asigna o confirma su
   **código anónimo** (`s01`, `s02`, `s03`…). El nombre real no se escribe en esta hoja ni en
   los archivos.
2. Graba con
   `?engine=3d&debug=record&cond=<condición>&view=<side|front|45>&subject=<sNN>`
   (`docs/ML-PIPELINE.md` §1), donde `cond` es `correct` o un código de error de
   `docs/METRICS.md` §5.2 (p. ej. `knee_valgus`).
3. Al guardar el archivo, aplica la regla de nombre del punto 5 de las instrucciones del
   consentimiento: carpeta `grabaciones/<sNN>/`, correlativo `nn` propio de ese sujeto y calidad
   acorde con la condición. Con `hip_sag` o `hip_pike` hay que renombrar a mano a `hip-sag` o
   `hip-pike`, porque la app todavía nombra esos archivos como `good`.
4. Completa de inmediato una fila nueva de la tabla.
5. En **"Archivo"** escribe el nombre exacto con el que quedó en el Drive. El **identificador
   de la toma** es `<Código anónimo>/<Archivo>` y debe coincidir con el campo "Identificador de
   la toma" de la sección 5 de la hoja firmada. Si renombras el archivo, corrige la fila, la
   hoja firmada y el Drive.
6. Marca **"Consentimiento verificado"** solo después de comprobar que la hoja firmada, ya
   subida a `consentimientos/<sNN>/`, tiene el mismo identificador. Sin hoja firmada no se
   registra la fila como válida y el archivo no se conserva.
7. **"Conservar hasta"** es la fecha de la grabación más 24 meses. Cada seis meses se revisa la
   columna y se borra lo vencido (`docs/DATA-GOVERNANCE.md` §3).
8. Si el participante pide el borrado, la fila pasa a **"Revocada"** al borrar los archivos, y a
   **"Borrada"** cuando la solicitud queda cerrada (procedimiento en el punto 9 de las
   instrucciones del consentimiento).

## Tabla de registro

| Código anónimo | Archivo | Ejercicio | Vista | Condición | Dispositivo | Reps | RPE | Fecha | Conservar hasta | Consentimiento verificado | Estado | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | | [ ] | | |

*(Tabla intencionalmente vacía: no se incluyen filas de ejemplo con valores inventados porque
podrían confundirse con registros reales.)*

### Significado de cada columna

| Columna | Contenido esperado |
|---|---|
| Código anónimo | Identificador del participante (`s01`, `s02`…), nunca su nombre |
| Archivo | Nombre del archivo en `grabaciones/<sNN>/`, patrón `<ejercicio>-<vista>-<calidad>-<nn>.json` (`fixtures/landmarks/SCHEMA.md`), p. ej. `squat-side-knee-valgus-01.json` |
| Ejercicio | Id del ejercicio, como aparece en el nombre del archivo: `squat` (sentadilla), `curl` (curl de bíceps), `press` (press de hombro), `pushup` (flexiones), `lunge` (zancadas), `bridge` (puente de glúteo), `plank` (plancha) |
| Vista | `side` (perfil), `front` (frente) o `45` |
| Condición | Condición **declarada** antes de grabar (parámetro `cond`): `correct` o un código de `docs/METRICS.md` §5.2. No confundir con la "calidad" del nombre de archivo (`good` o el código con guiones), que se deriva de esta condición |
| Dispositivo | Modelo del celular usado |
| Reps | Repeticiones completadas en la toma (en la plancha, segundos sostenidos) |
| RPE | Esfuerzo percibido (1 a 10), solo si el participante lo comparte; opcional |
| Fecha | Fecha de la sesión (`AAAA-MM-DD`) |
| Conservar hasta | Fecha + 24 meses |
| Consentimiento verificado | Casilla marcada solo si existe la hoja firmada con el mismo identificador de toma |
| Estado | `Vigente`, `Revocada` o `Borrada` |
| Observaciones | Incidencias de la toma (reencuadre, repetición descartada, etc.) |

## Condiciones disponibles por ejercicio

- `squat`, `curl` y `press`: los códigos de `docs/METRICS.md` §5.2 según su columna
  "Ejercicios".
- `pushup` y `plank`: `hip_sag` (cadera caída) y `hip_pike` (cadera levantada).
- `lunge`: `trunk_lean` (tronco inclinado hacia adelante).
- `bridge`: solo `correct` por ahora, porque el motor 3D no emite códigos de error para el
  puente.

Otros errores (profundidad insuficiente en flexiones, zancada y puente, o rodilla hacia dentro en
la zancada, issue #82) no se graban con código hasta que el workstream B los confirme en
`docs/METRICS.md` §5.2.

## Referencias

- Issue #16 (sprint de recolección de datos).
- `docs/DATA-GOVERNANCE.md` §2 (consentimiento), §3 (retención y borrado) y §4 (anonimización).
- `docs/adr/DEC-064-consentimiento-una-grabacion.md` (un consentimiento por grabación).
- `docs/CONSENTIMIENTO-GRABACION.md` (consentimiento asociado a cada fila).
- `docs/ML-PIPELINE.md` §1 (protocolo de captura y flag `?debug=record`).
- `docs/METRICS.md` §5.2 (códigos de error).
- `fixtures/landmarks/SCHEMA.md` (formato del nombre de archivo).
