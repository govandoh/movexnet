# Fitness-AQA — registro de viabilidad (Issue #38)

Estado: **documentación de viabilidad completada; el dataset NO está incorporado.**
Fitness-AQA no fue solicitado, descargado, convertido ni validado con datos reales: no
existe ningún JSON v2 derivado de él ni resultado de pruebas. Este documento solo
registra lo verificado en fuentes públicas (GitHub, publicación, PDF de licencia y
Zenodo). No resuelve por sí solo el Issue #38: el avance de MM-Fit y sus actividades
pendientes se llevan en `ml/datasets/mm-fit/`.
Registro estructurado: `dataset.json`. Marco: `DEC-065` y `docs/ML-PIPELINE.md` §5.

## Fuentes oficiales

| Fuente | Enlace |
|---|---|
| Repositorio y acceso | https://github.com/ParitoshParmar/Fitness-AQA |
| Publicación (ECCV 2022) | https://arxiv.org/abs/2202.14019 |
| DOI del artículo | https://doi.org/10.1007/978-3-031-19839-7_7 |
| Registro en Zenodo | https://zenodo.org/records/7310289 |

Cita: Parmar, Gharat, Rhodin. 2022. *Domain Knowledge-Informed Self-Supervised
Representations for Workout Form Assessment*. ECCV.

## Licencia

Documento oficial de los autores:
https://github.com/ParitoshParmar/Fitness-AQA/blob/main/fitness_aqa_dataset_license.pdf

- Licencia: **Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)**.
- Solo investigación no comercial.
- No se pueden transferir los datos a terceros sin permiso de los autores.
- Se debe proteger la privacidad de las personas que aparecen en los videos.
- No se puede incorporar el dataset a productos comerciales.

### Conflicto con el metadato de Zenodo

El registro de Zenodo declara **CC BY 4.0**, mientras que el PDF de los autores declara
**CC BY-NC 4.0**. La diferencia es relevante (la primera permitiría uso comercial). Se
aplica la licencia más restrictiva, **CC BY-NC 4.0**, y el conflicto queda sin resolver
hasta que los autores lo aclaren.

## Clasificación bajo DEC-065

`allowedFor: ["prototype"]` es una clasificación **conservadora propuesta** para
prototipos y benchmarks no comerciales. **No** es una autorización de uso comercial ni
permite que el dataset entre en un modelo de producto: la promoción de modelos exige
`allowedFor: product` (`docs/ML-PIPELINE.md` §5).

## Acceso

Por formulario de Google: https://forms.gle/PbPTX1eVxGpa3QG88. **No se solicitó acceso
en esta etapa** (falta de tiempo). El acceso no es público.

## Contenido conocido

Según la publicación y el README oficial: ejercicios BackSquat, OverheadPress y
BarbellRow, con videos e imágenes y etiquetas de errores de ejecución. Esto no se
verificó contra los archivos reales.

## Formato de archivos

**Pendiente de verificar.** Se desconoce la estructura de carpetas, los formatos y los
nombres de archivo; solo se pueden conocer con acceso al dataset.

## Compatibilidad con los siete ejercicios de MovexNet

| MovexNet | Fitness-AQA |
|---|---|
| `squat` | BackSquat (correspondencia clara) |
| `press` | OverheadPress (correspondencia clara) |
| `curl`, `pushup`, `lunge`, `bridge`, `plank` | Sin correspondencia |

La cobertura es de 2 de 7 ejercicios. La equivalencia de cada variante (barra vs.
mancuernas, vista de cámara) se debería confirmar con los datos reales.

## Conversión a JSON v2

Sería posible, en principio, procesar los videos con MediaPipe (`pose_landmarker_lite`)
y producir JSON v2 con `ml/datasets/mm-fit/convert_video_to_v2.py` y validarlo con
`ml/datasets/validate_v2.py`. **No se ejecutó**: no hay acceso, descarga ni resultados.
La viabilidad real de la conversión depende de los formatos y la calidad de video, aún
desconocidos.

## Por qué no se incorpora actualmente

- No se tiene acceso al dataset y no se solicitó.
- La licencia es no comercial: no puede alimentar un modelo de producto (DEC-065).
- Hay un conflicto de licencia sin resolver entre Zenodo y los autores.
- El formato de archivos es desconocido, por lo que no se puede planificar la conversión.
- Solo cubre 2 de los 7 ejercicios de MovexNet.
- Los videos incluyen personas: exige proteger su privacidad, y no se pueden transferir
  los datos a terceros sin permiso.

## Pendientes si se retoma

1. Solicitar acceso por el formulario con la persona responsable del proyecto.
2. Verificar estructura y formatos reales, y actualizar `dataset.json`.
3. Pedir a los autores que aclaren la licencia (Zenodo vs. PDF).
4. Solo entonces, evaluar una conversión de prueba de BackSquat y OverheadPress.

## Referencias

`dataset.json` (registro), `docs/adr/DEC-065-datasets-externos-alcance-academico.md`,
`docs/ML-PIPELINE.md` §5, `docs/DATA-GOVERNANCE.md` §6 y `ml/datasets/mm-fit/` (modelo
de registro).
