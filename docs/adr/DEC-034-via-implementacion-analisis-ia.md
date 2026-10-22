# DEC-034 · Vía de implementación del análisis por IA: features por repetición primero, esqueleto canónico COCO-17, modelos propios sin pesos contaminados

- **Estado:** Aceptada en lo vigente (2026-10-21, por el responsable del proyecto): Fase 1 y esqueleto COCO-17; Fases 2 y 3 reemplazadas por DEC-055
- **Fecha:** 2026-09-22
- **Decisores:** pendiente — aprueban los leads de los workstreams B (Análisis & Runtime) y C (ML Training)
- **Etiquetas:** analysis-core, ml, ml-runtime, legal, arquitectura

## Contexto y problema

`DEC-027` fijó **qué** arquitectura queremos (híbrida: modelos pequeños en el dispositivo, LLM en la nube solo con métricas, reglas como fallback), pero no **cómo** llegar ahí: qué modelo concreto, entrenado con qué, en qué orden. La pregunta operativa es si existe un modelo preentrenado que podamos descargar y que ya sepa juzgar la ejecución de un ejercicio.

Los golden tests del PR 1 dieron la evidencia empírica de por qué urge resolverlo. Con las reglas actuales (`fixtures/README.md`):

1. El momento del evento de fondo depende de los fps: la misma trayectoria a 30 y 60 fps dispara `atBottom` con 67 ms de diferencia, porque `RISING_THRESHOLD` compara contra el frame anterior y no contra el tiempo.
2. Un spike de ruido de un solo frame adelanta la detección del fondo hasta 12 frames, y la app felicita antes de que el usuario haya bajado.
3. Un curl parcial deja el tracker atrapado en `flexed`: cinco ciclos producen una transición y 364 frames con el mismo mensaje.
4. Una sentadilla sistemáticamente corta no genera ninguna corrección: nunca entra en `squatting`, que es la única fase donde se emite "Baja un poco más".

Ninguno de los cuatro se arregla añadiendo más umbrales: son limitaciones de evaluar un instante contra una constante en vez de evaluar una repetición completa contra ejemplos.

## Hallazgo determinante: no hay pesos preentrenados que podamos llevar a producción

La investigación (septiembre 2026) confirma dos cosas:

- **No existe ningún modelo preentrenado público que evalúe la técnica de ejercicios.** Lo que existe preentrenado son modelos de *reconocimiento de acciones* esqueléticas: ST-GCN++, CTR-GCN, HD-GCN, SkateFormer, ProtoGCN, con checkpoints descargables hoy desde PYSKL y mmaction2, y código Apache-2.0 o MIT.
- **Esos checkpoints están contaminados para uso comercial.** Todos se entrenaron sobre NTU RGB+D, que el ROSE Lab cede únicamente a instituciones académicas, para uso **no comercial**, prohibiendo redistribución y datasets derivados. La licencia Apache/MIT cubre el código, no resuelve el estatus del peso como obra derivada de datos no comerciales. SkateFormer lo dice explícitamente en su README ("commercial use requires formal permission"). Como Fitnet va a cobrar suscripciones (`DEC-026`, `DEC-030`), tratamos esos pesos como **prohibidos en producción**.

Tampoco hay benchmark alguno de un GCN esquelético corriendo en ONNX Runtime Web: sería territorio sin explorar, con el escollo conocido de que ST-GCN usa `einsum` y tensores 5D al exportar.

## Opciones consideradas

1. **Descargar un GCN preentrenado en NTU y hacerle fine-tuning.** Descartada para producción por la licencia de los datos de preentrenamiento. Admisible solo como referencia académica o techo de comparación en `ml/`, nunca publicada en `models/manifest.json`.
2. **Modelo multimodal de video en tiempo real.** Ya descartada en `DEC-027`: latencia de segundos, costo por repetición, el video saldría del dispositivo.
3. **GCN propio desde cero sobre keypoints crudos, ya.** Descartada como primer paso: con dataset inexistente necesita miles de repeticiones. La evidencia con datos escasos es contundente: 10 muestras por clase dan 52 % de accuracy, 50 muestras dan 73 %, y eso es para *identificar el ejercicio*, no para juzgar la calidad.
4. **Features por repetición + modelo pequeño, escalando a GCN propio cuando haya datos** (elegida).

## Decisión

### Principio rector

**Aprendemos sobre features derivadas antes que sobre keypoints crudos.** La literatura de rehabilitación es consistente en que los ángulos articulares rinden mejor que las posiciones 3D para juzgar calidad, porque las coordenadas son redundantes y correlacionadas. Además una vía de features entrena con cientos de repeticiones, no con miles, y corre en JavaScript puro sin runtime de inferencia.

### Fase 1 — Analizador por repetición sobre features (sin ONNX)

El cambio conceptual: se deja de evaluar **un frame contra un umbral** y se pasa a evaluar **una repetición completa contra un modelo**.

- `RepSegmenter` (la máquina de estados actual) delimita la repetición; `FeatureExtractor` produce por repetición un vector fijo: mínimos, máximos y ROM de cada ángulo relevante; velocidades angulares pico y media por fase; tempo excéntrico y concéntrico; simetría izquierda/derecha; desviación respecto a la trayectoria media del propio usuario; estadísticos por tercio del recorrido.
- Un clasificador pequeño por ejercicio (gradient boosting o MLP de dos capas) emite el multi-label de `FormErrorCode` con severidad y confianza.
- Entrenable con 300–1000 repeticiones etiquetadas. Se exporta como coeficientes en JSON o como un ONNX diminuto; en ambos casos cabe en el bundle.
- Resuelve por construcción los cuatro problemas del contexto: el vector se calcula sobre la repetición entera en unidades de tiempo real, el suavizado previo elimina el efecto del spike, y una repetición parcial produce un vector que el modelo reconoce como tal en lugar de dejar la máquina atascada.

### Fase 2 — Clasificador de ejercicio

GRU de dos capas o TCN (100k–300k parámetros) sobre ventanas deslizantes canonicalizadas, preentrenado con **MM-Fit (MIT)** e **InfiniteRep (CC BY 4.0)**, que sí permiten uso comercial, y afinado con datos propios auto-etiquetados por las reglas (etiquetar qué ejercicio es sale gratis: lo sabe el chip que el usuario seleccionó). Entregable visible: desaparece el selector manual.

### Fase 3 — GCN propio, solo cuando haya datos

Cuando el dataset propio alcance el orden de miles de repeticiones, entrenar un ST-GCN++ (≈1,4 M parámetros) **desde cero** con el código Apache-2.0 y datos propios: cero riesgo legal. Exportar a ONNX cuantizado int8 (≈1,4 MB) y ejecutar con ONNX Runtime Web en WASM, **una inferencia por repetición** y no por frame, con lo que 150–300 ms de latencia son aceptables.

### Representación canónica: COCO-17, no NTU-25

Toda la canalización de esqueletos usa **COCO-17**, que es un subconjunto exacto de los 33 landmarks de MediaPipe (nariz, ojos, orejas, hombros, codos, muñecas, caderas, rodillas, tobillos). No se inventan las articulaciones que BlazePose no tiene. Motivo: PYSKL y mmaction2 publican ST-GCN++ con esa misma convención, así que la Fase 3 no exige rehacer la representación, y el mapeo a NTU-25 obligaría a interpolar columna y cuello degradando la señal.

### Etiquetado asistido, con el humano decidiendo primero

Un modelo multimodal (Claude, Gemini) actúa como **pre-filtro y priorizador** de qué repeticiones revisar, nunca como etiquetador autónomo: el mejor resultado publicado en el benchmark FitAQA es 72 % de F1 en el juicio correcto/incorrecto. Además, un estudio de anotación híbrida muestra que enseñar la etiqueta del modelo antes del juicio humano produce sesgo de anclaje sin acelerar el trabajo. Por tanto: el anotador humano juzga primero, la sugerencia del modelo se revela después y solo en una fracción de la muestra, y la señal de calidad es el acuerdo entre dos modelos independientes y el kappa entre anotadores.

### Ampliación a ejercicios nuevos

Embeddings de secuencia más prototipos o k-NN permiten **identificar** un ejercicio nuevo con 20–50 repeticiones sin reentrenar. La **detección de sus errores** seguirá necesitando etiquetas propias: no hay evidencia de que few-shot funcione para diferencias intra-clase finas.

## Consecuencias

### Positivas

- Se puede empezar ya, con los fixtures y el segmentador que existen, sin esperar al dataset ni añadir un runtime de inferencia.
- Ninguna dependencia legal problemática: todo lo que llegue a producción se entrena con datos propios, MM-Fit o InfiniteRep.
- Los cuatro fallos documentados en los golden se atacan en la Fase 1, que es también la más barata.
- Un modelo por ejercicio se puede desplegar, medir y revertir de forma independiente (modo sombra de `DEC-027`).

### Negativas

- Las features hechas a mano tienen techo: errores que dependen de la forma global del movimiento, y no de un ángulo, quedarán para la Fase 3.
- Mantener paridad entre el extractor de TypeScript y el de Python (tolerancia 1e-3) es trabajo permanente.
- Renunciamos al atajo de partir de un backbone preentrenado, que habría reducido la necesidad de datos: el costo de la limpieza legal es un dataset propio más grande.
- La Fase 3 es territorio sin benchmarks públicos en el navegador; hay que presupuestar medición propia y posible reescritura del modelo para exportarlo.

## Metas de verificación

| Fase | Meta | Cómo se mide |
|---|---|---|
| 1 | F1 macro ≥ 0.75 LOSO por código de error en sentadilla; acuerdo ≥ 95 % con las reglas en casos claros | `ml/eval.py`, gate de `ml/thresholds.yaml` |
| 1 | Los cuatro fallos del contexto no se reproducen sobre los fixtures existentes | golden ampliados |
| 2 | ≥ 90 % accuracy LOSO en los 3 ejercicios; p95 < 15 ms | reporte de evaluación |
| 3 | Mejora sobre la Fase 1 en al menos dos códigos de error, con latencia por repetición < 300 ms en gama media | comparación contra el modelo promovido |

## Nota posterior (2026-09-22) — el bloqueo comercial desaparece (`DEC-035`)

El argumento para descartar los checkpoints preentrenados era el uso comercial. Fitnet **no saldrá a la venta**: es un proyecto de seminario, y la cesión de NTU RGB+D contempla precisamente el uso académico y de investigación. Los pesos de ST-GCN++, CTR-GCN, HD-GCN y ProtoGCN quedan **permitidos en el prototipo**, con tres condiciones: este repositorio no los redistribuye, todo modelo derivado se marca en `models/manifest.json` con `provenance: "academic-pretrained"` y `commercialUse: false`, y cada entrenamiento registra su checkpoint de partida y su licencia.

Efecto sobre las tres fases, que se conservan en el mismo orden:

- **Fase 1** no cambia y sigue siendo la primera. Es el piso comparativo, el respaldo en ejecución y lo que resuelve los cuatro fallos del contexto con el menor esfuerzo.
- **Fase 2** no cambia.
- **Fase 3** pasa de "entrenar una red de grafos desde cero con miles de repeticiones" a **afinar un backbone preentrenado con cientos**, congelando el backbone y entrenando cabezas ligeras por ejercicio. Eso la vuelve alcanzable dentro del plazo del seminario. La representación canónica sigue siendo COCO-17, que es la que usan los checkpoints publicados por PYSKL y mmaction2, así que la decisión de no mapear a NTU-25 se mantiene y además se refuerza.

Queda un entregable nuevo derivado de esto: **el costo de comercializar**, es decir, lo que costaría sustituir los pesos académicos por un modelo entrenado desde cero. Se cuantifica en repeticiones adicionales de dataset propio, horas de cómputo y tiempo de ingeniería, y es una línea del análisis de rentabilidad.

## Nota posterior (2026-09-24): enfoque y datos cerrados en `DEC-055`

`DEC-055` concreta la vía:

- **Fase 1:** el analizador por repetición se apoya en la geometría 3D integrada desde fitnetv2 (`DEC-054`) y en un clasificador k-NN de posturas en TypeScript puro sobre el frame clave de cada repetición, con una red densa pequeña como segunda iteración.
- **Fase 2** (GRU/TCN para identificar el ejercicio): **reemplazada** por el mismo k-NN con suavizado temporal.
- **Fase 3** (afinar un GCN preentrenado): pasa a ser un **experimento acotado a 3 días**, fuera de la app, que se ejecuta cuando exista el dataset propio mínimo.

Las fuentes de datos (grabaciones propias con etiqueta por guion, MM-Fit, Fitness-AQA, síntesis) y las metas quedan en `DEC-055`. La representación COCO-17 se mantiene.

## Referencias

- `DEC-035` (proyecto académico sin facturación real).
- `DEC-027` (arquitectura híbrida), `DEC-031` (runtime de inferencia), `DEC-026` (alcance y reglas), `DEC-030` (estudio de proveedores de pago).
- `fixtures/README.md` (los cuatro comportamientos congelados), `docs/METRICS.md` §5 (códigos de error), `docs/ML-PIPELINE.md` (licencias de datasets y gate de promoción).
- NTU RGB+D, términos de uso: https://rose1.ntu.edu.sg/dataset/actionRecognition/
- PYSKL (ST-GCN++, Apache-2.0): https://github.com/kennymckormick/pyskl
- SkeletonX, rendimiento con muestras limitadas: https://arxiv.org/abs/2504.11749
- FitAQA, benchmark de modelos multimodales en calidad de ejercicio: https://arxiv.org/html/2608.08736
- Clasificación de corrección en ejercicios de rehabilitación (ángulos frente a coordenadas): https://arxiv.org/pdf/2108.01375
- Sesgo de anclaje en anotación asistida: https://arxiv.org/pdf/2510.21798
- ONNX Runtime Web, diagnóstico de rendimiento y cuantización: https://onnxruntime.ai/docs/tutorials/web/performance-diagnosis.html
