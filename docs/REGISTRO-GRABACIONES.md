# MovexNet — Hoja de registro de grabaciones

> **Estado: plantilla propuesta — pendiente de revisión del responsable del proyecto.** No
> usar en una sesión de grabación real hasta que se resuelvan los puntos marcados como
> "Pendiente de confirmar" en este documento.

> Responsabilidad de este archivo: plantilla reutilizable para registrar cada grabación del
> sprint de recolección de datos (Issue #16), relacionando cada archivo JSON con su
> participante anónimo, su consentimiento y los metadatos exigidos por
> `docs/DATA-GOVERNANCE.md` §2 y `docs/adr/DEC-064-consentimiento-una-grabacion.md`. Se usa
> junto con `docs/CONSENTIMIENTO-GRABACION.md` (un consentimiento por grabación).

**Esta plantilla se mantiene vacía en el repositorio.** La hoja de registro real, completada
con datos de las sesiones, **no se sube a GitHub**: se guarda en el Drive privado del equipo
MovexNet, igual que las grabaciones. En el repositorio solo vive la plantilla y las
instrucciones de uso.

## Cómo registrar cada toma

1. Antes de grabar, verifica que el participante es **mayor de 18 años** y que firmó una
   copia de `docs/CONSENTIMIENTO-GRABACION.md` para la toma que vas a hacer (ese documento
   declara la mayoría de edad en su sección 9). Luego asigna o confirma el **código anónimo**
   del participante (`s01`, `s02`, `s03`…). Nunca se escribe el nombre real en esta hoja ni en
   los archivos.
2. Graba con el flag `?debug=record&engine=3d&cond=<condición>&view=<side|front|45>&subject=<sNN>`
   (`docs/ML-PIPELINE.md` §1), donde `cond` es `correct` o un código de error de
   `docs/METRICS.md` §5.2 (p. ej. `knee_valgus`). El ejercicio, la vista y la condición
   determinan el nombre del archivo que descarga la app, siguiendo el patrón de
   `fixtures/landmarks/SCHEMA.md`: `<ejercicio>-<vista>-<calidad>-<nn>.json`, donde la
   **calidad** es `good` si la condición fue `correct`, o el código de error con guiones si no
   (p. ej. `knee_valgus` → `knee-valgus`), tal como lo genera la app automáticamente
   (`src/testing/fixtureRecorder.ts`; ejemplo: `squat-side-knee-valgus-01.json`). El código
   anónimo del participante **no** forma parte del nombre de archivo; se registra aparte en la
   columna "Código anónimo" de la tabla.
3. Inmediatamente después de guardar el archivo, completa una fila nueva en la tabla de la
   sección siguiente con sus datos exactos.
4. En **"Código de grabación"**, copia **exactamente** el nombre de archivo que generó la app.
   Si lo renombras después (por ejemplo al corregir `view` o `quality` con la skill
   `/fixture`), actualiza esta columna **y** el campo "Nombre de archivo de la grabación" de la
   sección 5 del consentimiento correspondiente, para que la fila, el consentimiento y el
   archivo guardado en el Drive coincidan siempre.
5. En **"Consentimiento verificado"**, marca la casilla solo después de confirmar que existe
   una copia firmada de `docs/CONSENTIMIENTO-GRABACION.md` cuya sección 5 identifica **el
   mismo nombre de archivo** que esta fila. Si no hay consentimiento firmado para esa toma, no
   se completa la fila como válida y el archivo no debe conservarse.
6. Guarda el archivo JSON y esta hoja (cuando tenga datos) únicamente en la carpeta privada
   del Drive del equipo. **Nunca en el repositorio de GitHub**, que es público.

## Tabla de registro

| Código anónimo | Código de grabación | Ejercicio | Vista | Condición | Dispositivo | Reps | RPE | Fecha | Consentimiento verificado | Observaciones |
|---|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | ☐ | |

*(Tabla intencionalmente vacía. Agregar una fila por cada grabación realizada; no se incluyen
datos de ejemplo con valores inventados porque podrían confundirse con registros reales.)*

### Significado de cada columna

| Columna | Contenido esperado |
|---|---|
| Código anónimo | Identificador del participante (`s01`, `s02`, `s03`…), nunca su nombre |
| Código de grabación | Nombre de archivo real de la grabación, patrón `<ejercicio>-<vista>-<calidad>-<nn>.json` (`fixtures/landmarks/SCHEMA.md`), p. ej. `squat-side-knee-valgus-01.json`; debe coincidir exactamente con el campo "Nombre de archivo de la grabación" del consentimiento asociado (sección 5) |
| Ejercicio | Uno de los 7 ejercicios con tracker de cámara: sentadilla, curl de bíceps, press de hombro, flexiones, zancadas, puente de glúteo, plancha |
| Vista | `side` (perfil), `front` (frente) o `45` |
| Condición | Condición **declarada** antes de grabar (parámetro `cond` de la URL): `correct` o un código de error (`docs/METRICS.md` §5.2 para sentadilla/curl/press; **pendiente de confirmar** para flexiones, plancha, puente y zancada, ver nota abajo). No confundir con la "calidad" del nombre de archivo (`good` o el código en kebab-case), que la app deriva automáticamente de esta condición |
| Dispositivo | Modelo de celular usado para grabar |
| Reps | Repeticiones completadas en la toma |
| RPE | Esfuerzo percibido (1–10), si el participante lo comparte; opcional |
| Fecha | Fecha de la sesión |
| Consentimiento verificado | Casilla marcada solo si existe la copia firmada de `docs/CONSENTIMIENTO-GRABACION.md` para esa grabación exacta |
| Observaciones | Cualquier incidencia de la toma (reencuadre, repetición descartada, etc.) |

## Pendiente de confirmar

- Los códigos de condición de error para flexiones, plancha, puente de glúteo y zancada no
  están documentados en `docs/METRICS.md` §5.2 (solo cubre sentadilla, curl y press). No se
  inventan aquí: deben confirmarse con el responsable del proyecto o el workstream B antes de
  completar filas con esos ejercicios en condición distinta de `correct`.
- La ubicación exacta de la carpeta del Drive del equipo y su estructura de subcarpetas no
  están definidas en ningún documento del repositorio; se usa el término genérico "Drive
  privado del equipo" hasta que se confirme.
- El canal formal para que un participante pida el borrado de una grabación en este flujo
  manual sigue sin definirse (ver `docs/CONSENTIMIENTO-GRABACION.md` §7); mientras tanto, el
  correo del responsable del proyecto es el único medio disponible, pero no está confirmado
  como canal formal.

## Referencias

- Issue #16 (sprint de recolección de datos, protocolo, consentimiento y voluntarios).
- `docs/DATA-GOVERNANCE.md` §2 (consentimiento explícito y separado por grabación).
- `docs/adr/DEC-064-consentimiento-una-grabacion.md` (un consentimiento por grabación).
- `docs/CONSENTIMIENTO-GRABACION.md` (plantilla de consentimiento asociada a cada fila).
- `docs/ML-PIPELINE.md` §1 (protocolo de captura, flag `?debug=record`).
- `fixtures/landmarks/SCHEMA.md` (formato del nombre de archivo de cada grabación).
