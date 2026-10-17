# MovexNet — Pipeline de datos y modelos (`ml/`)

> Responsabilidad de este archivo: cómo se capturan los datos, cómo se transforman en features, cómo se entrenan, evalúan, publican y despliegan los modelos. Decisión de fondo: `DEC-027` (arquitectura híbrida) y `DEC-031` (ONNX Runtime Web + Hugging Face Hub). Métricas y metas: `METRICS.md`. Consentimiento y licencias: `DATA-GOVERNANCE.md`. Propiedad: workstream C (`ml/`, reportes, artefactos) y B (`ml-runtime`, `models/manifest.json`).

**Estado:** existen `fixtures/landmarks/` (esquema v1, desde el PR 1), la canonicalización y el k-NN de posturas en TypeScript (`src/geometry/poseEmbedding.ts`, `src/analysis/poseClassifier.ts`, paso I-1 de `DEC-054`, aún sin conectar a la UI). No existen `ml/` ni `models/`: el scaffold de `ml/` llega en el PR 9 (`ARCHITECTURE.md` §2.4). El resto de lo descrito es objetivo. El núcleo de IA sigue `DEC-055`.

## 1. Captura con consentimiento

- Modo `/capture` en la app (PR 8), detrás de feature flag. Antes de grabar, pantalla de consentimiento que crea un `RecordingConsent` (texto versionado); sin consentimiento no se guarda nada.
- Se graba `LandmarkFrame[]` (2D + 3D + `t`) y etiquetas: ejercicio, límites de rep propuestos por el tracker de reglas y corregidos a mano, tags de error de forma, RPE de la serie.
- **Nunca video en servidor.** Opcionalmente se guarda video **local** en el dispositivo para etiquetar y se borra al terminar; no se sube.
- Mientras no exista auth, el modo dev `?debug=record` (PR 1) descarga el JSON al dispositivo y el desarrollador lo copia a `fixtures/landmarks/` (guía `/fixture`, `CONTRIBUTING.md`).
- Cada grabación guarda el **vector de gravedad** del dispositivo y la **corrección de calibración de pie** aplicada (`DEC-050`, `DEC-053`), para que el dataset no herede la inclinación del teléfono.

### Etiqueta por guion (`DEC-055`)

1. Antes de grabar, la toma se declara como `{ejercicio, vista, condición}` (p. ej. "sentadilla, lateral, rodillas hacia dentro"); el sujeto hace 6–8 reps así. La etiqueta sale del guion.
2. La vista la confirma `getBodyOrientation` (`src/geometry/vectors3d.ts`).
3. Las reglas 3D pre-etiquetan cada rep; una persona **confirma o descarta la toma** (juicio humano primero, `DEC-034`).
4. Meta mínima por ejercicio: 5 sujetos × 2 vistas × (1 correcta + 2–3 errores) × 8 reps ≈ 250–320 reps (el espejado las duplica).
5. Primero graba el equipo; después se suman voluntarios (#16).

**Cómo se graba hoy.** Abrir la app con `?debug=record&engine=3d&cond=<condición>&view=<side|front|45>&subject=<sNN>`:

- `cond` es `correct` o un código de `METRICS.md` §5.2 (`knee_valgus`, `trunk_lean`, `elbow_drift`, `lumbar_arch`…);
- `subject` es un identificador anónimo (nunca un nombre).

Hacer las 6–8 repeticiones y pulsar "Guardar grabación". El archivo sale con la vista y la condición en el nombre (`squat-side-knee-valgus-01.json`), el vector de gravedad por frame (`down`) y los datos de la toma en `meta.capture` (`fixtures/landmarks/SCHEMA.md`). En iPhone, pulsar "Nivelar con el sensor" si aparece, para conceder el permiso del acelerómetro.

### Sprint de recolección (2 semanas, tras PR 8)

≥ 20 voluntarios, 3 ejercicios, errores guiados con guion (para cada código de `METRICS.md` §5.2), 2–3 ángulos de cámara, celulares distintos. Meta: ≥ 30 reps por clase de error por sujeto-ángulo. Amplía la meta mínima de la etiqueta por guion; no la sustituye.

## 2. Esquemas JSON: v1 (golden, implementado) y v2 (dataset, objetivo)

Hay **dos esquemas y no compiten**: v1 congela comportamiento, v2 entrena modelos.

**v1 — implementado hoy** (`src/testing/fixtureTypes.ts`, descrito en `fixtures/landmarks/SCHEMA.md`, validado por los golden tests y por `pnpm fixtures:check`). Es el que produce el flag `?debug=record` y el que consumen los tests de reglas:

```jsonc
{
  "meta": { "schemaVersion": 1, "exercise": "squat", "view": "side", "quality": "good",
            "source": "phone", "device": "…", "fps": 30, "recordedAt": "…", "notes": "…" },
  "frames": [ { "t": 0, "image": [ /* 33 × {x,y,z,visibility} */ ], "world": [ /* … */ ] } ]
}
```
Nombre de archivo: `fixtures/landmarks/<ejercicio>-<vista>-<calidad>-<nn>.json`, con vistas `side` | `front` | `45`.

**v2 — objetivo del dataset de entrenamiento.** Extiende v1 con lo que el ML necesita y los golden no: `labels[]`, `consentId`, `subjectId`, `rpe`, `seq`, metadatos de dispositivo y de versión de MediaPipe, y codificación compacta de landmarks como tuplas. Un fixture v1 es un v2 sin etiquetas. La conversión v1 → v2 es mecánica y vive en `ml/schemas.py`; **no se mezclan ambos en el mismo archivo**. Se define en `@movexnet/contracts` (zod) y `ml/schemas.py` (pydantic) con test de paridad, antes del PR 9.

```json
{
  "schemaVersion": "2",
  "meta": {
    "id": "squat_side_good_001",
    "exerciseId": "squat",
    "view": "side",
    "device": { "model": "Pixel 7", "os": "Android 14", "browser": "Chrome 128" },
    "fps": { "nominal": 30, "measuredMean": 29.4 },
    "camera": "environment",
    "mediapipe": { "package": "@mediapipe/tasks-vision", "version": "0.10.35", "model": "pose_landmarker_lite" },
    "synthetic": false,
    "consentId": "uuid-o-null-para-fixtures-sinteticos",
    "recordedAt": "2026-10-01T15:04:05Z",
    "subjectId": "anon-7f3a",
    "rpe": 7,
    "notes": "texto libre"
  },
  "frames": [
    { "t": 0,     "seq": 0, "image": [[0.51, 0.22, -0.31, 0.99], "…33 entradas [x, y, z, visibility]"], "world": [[0.02, -0.55, -0.10, 0.99], "…33 entradas en metros"] },
    { "t": 33.4,  "seq": 1, "image": ["…"], "world": ["…"] }
  ],
  "labels": [
    { "kind": "rep",   "start": 0, "peak": 43, "end": 78, "source": "rules|manual", "errors": ["shallow_depth"] },
    { "kind": "error", "code": "knee_valgus", "start": 40, "end": 46, "severity": 0.6 },
    { "kind": "exercise", "exerciseId": "squat", "start": 0, "end": 900 }
  ]
}
```

- `image`: 33 × `[x, y, z, visibility]` normalizados 0–1 (`z` relativo a cadera, misma escala que `x`).
- `world`: 33 × `[x, y, z, visibility]` en metros, origen en el centro de cadera; `null` si MediaPipe no lo devolvió.
- `labels[].start/peak/end` son índices de `frames` (`seq`), no tiempos.
- Los fixtures **sintéticos** (PR 1) llevan `synthetic: true` y `consentId: null`; se usan solo para golden de reglas, nunca para entrenar.
- Nombre de archivo: el mismo patrón de v1, `fixtures/landmarks/<ejercicio>-<vista>-<calidad>-<nn>.json`; las grabaciones etiquetadas del dataset viven en `ml/data/` con el `meta.id` como nombre.

## 3. Canonicalización (lo que más importa, más que la arquitectura del modelo)

Aplicada de forma idéntica en `analysis-core` (TS; hoy `src/geometry/`) y `ml/features/` (Python), con **test de paridad** (tolerancia 1e-3) sobre los mismos fixtures.

1. **Nivelar por gravedad y calibración de pie:** rotar `world` para que Y sea la vertical real con el vector de gravedad del dispositivo (`src/geometry/gravityAlign.ts`, `DEC-050`) y aplicar la corrección residual medida con la postura de pie (`src/geometry/standingCalibration.ts`, `DEC-053`). Va primero porque el giro del paso 4 solo tiene sentido si Y es la vertical.
2. **Centrar en cadera:** restar el punto medio de 23/24.
3. **Escalar por torso:** dividir por la distancia entre el punto medio de hombros (11/12) y el de caderas (23/24).
4. **Alinear yaw:** rotar alrededor del eje vertical para que el vector entre caderas quede paralelo al eje X (solo con `world`; con `image` se omite). Pasos 2–4: `normalizePose` en `src/geometry/poseEmbedding.ts`.
5. **Vector de rasgos:** coordenadas del subconjunto COCO-17 + 8 ángulos articulares + inclinación del tronco (60 valores, `embedPose`, versionado con `POSE_EMBEDDING_VERSION`).
6. **Espejar izquierda/derecha:** duplicar cada muestra intercambiando índices L/R y negando X (`mirrorPose`); duplica el dataset y elimina sesgo de lado.
7. El k-NN clasifica frames sueltos y el frame clave de cada rep, sin ventanas. Las ventanas de **60 frames** y el resampling de `RepWindow` a 64 muestras solo aplican a modelos secuenciales (experimento con preentrenado, §6).

## 4. Aumento de datos (solo en entrenamiento)

- Rotación sobre el eje vertical ±30° (nuevos puntos de vista).
- Escala y shear moderados (proporciones corporales).
- Jitter gaussiano por joint (σ proporcional a `1 − visibility`).
- Time-warping y resampling (cadencias distintas, 24/30/60 fps).
- **Síntesis guiada por error:** perturbar reps correctas hacia patrones conocidos (p. ej. acercar rodillas para `knee_valgus`, inclinar tronco para `trunk_lean`), etiquetadas como sintéticas y con peso reducido.

## 5. Datasets externos y licencias

| Dataset | Licencia | Uso permitido en MovexNet |
|---|---|---|
| MM-Fit | Código MIT; video RGB CC BY 4.0; etiquetas y sensores sin licencia pública verificada (`DEC-065`) | Identificar el ejercicio: se convierte offline (Kaggle) a landmarks de MediaPipe y se añade como ejemplos al k-NN (`DEC-055`); cubre ejercicios de las olas 1 y 2 de `DEC-056`. Formato de keypoints y etiquetas por verificar antes de convertir. Video RGB: producto con atribución. Etiquetas y sensores: solo uso académico por autorización del responsable (`DEC-065`). |
| InfiniteRep | CC BY 4.0 | Preentrenar el clasificador; producto, con atribución en `DATA-GOVERNANCE.md` y en la app. |
| EC3D | Sin licencia comercial explícita | **Solo prototipos y benchmarks**; ningún peso entrenado con él se publica en `models/manifest.json`. |
| REHAB24-6 | No comercial | Solo prototipos y benchmarks. |
| Fitness-AQA | No comercial | Solo prototipos y benchmarks; fuente de ejemplos de errores en gimnasio real (`DEC-055`, permitido por `DEC-035`). |
| FLEX | No comercial, acceso por solicitud | Solo prototipos y benchmarks. |
| **Checkpoints preentrenados sobre NTU RGB+D** (ST-GCN++, CTR-GCN, HD-GCN, SkateFormer, ProtoGCN…) | Código Apache-2.0 o MIT; los **pesos** derivan de datos de uso académico y de investigación | **Permitidos en el prototipo** (`DEC-035`: MovexNet no se comercializa). Este repositorio no los redistribuye: se descargan de su origen al entrenar. Todo modelo derivado se marca `provenance: "academic-pretrained"` y `commercialUse: false` en `models/manifest.json`. Prohibidos en un hipotético producto comercial. |

Cada entrada de `ml/datasets/` declara `license` y `allowedFor: ["prototype"] | ["academic"] | ["product"]`. `academic` es para datos sin licencia pública verificada que se usan amparados por la autorización del responsable del proyecto (`DEC-065`); `ml/train` rechaza mezclar datasets `prototype` o `academic` en un run marcado `--for-product`. La misma regla aplica a pesos de partida: un run `--for-product` solo admite inicialización aleatoria o checkpoints propios. Mientras el proyecto sea académico no hay runs `--for-product`; la bandera existe para que la frontera quede explícita y para poder cuantificar el costo de comercializar (`DEC-035` §4).

## 6. Entrenamiento

- Framework: PyTorch. Cómputo: Kaggle (≈ 30 h GPU/semana); CPU en GitHub Actions para modelos pequeños o re-entrenos.
- Modelos (`DEC-055`, que reemplaza la Fase 2 de `DEC-034` y convierte su Fase 3 en experimento):
  - **k-NN de posturas** en TypeScript puro (`src/analysis/poseClassifier.ts`) sobre el vector de §3. Clasifica el **frame clave** de cada rep (fondo o pico, lo entrega el tracker) para los errores de forma, y **frames sueltos** con `ScoreSmoother` para identificar el ejercicio. Añadir un ejercicio o un error es añadir ejemplos, sin reentrenar.
  - **MLP pequeño** como segunda iteración: se entrena en `ml/` y exporta sus pesos a JSON; la inferencia es TypeScript. Sustituye al k-NN de un ejercicio solo si lo supera en F1 LOSO.
  - **Capa temporal sin ML:** tempo, ROM, velocidad, pérdida de velocidad y fatiga salen de `src/analysis/movementQuality.ts` y `src/analysis/fatigue.ts` (`METRICS.md` §2–3).
  - **Sin TensorFlow.js ni ONNX** para estos modelos.
- **Experimento con preentrenado (≤ 3 días, fuera de la app, solo tras tener el dataset mínimo de §1):** día 1, PYSKL en Kaggle + checkpoint ST-GCN++ COCO-17 + conversión de grabaciones propias; día 2, backbone congelado + cabeza logística o k-NN, comparado en LOSO contra el k-NN; día 3, reporte `ml/reports/spike-stgcnpp@0.1.json`, prueba de export a ONNX y latencia. Condiciones de `DEC-035` (`provenance: "academic-pretrained"`).
- Representación de esqueleto: **COCO-17**, subconjunto exacto de los 33 landmarks de MediaPipe. No se mapea a NTU-25 (exigiría interpolar columna y cuello).
- Cada run registra: commit de `ml/`, `featureSchemaVersion`, datasets y licencias usados, semilla, hiperparámetros, hash de los datos.
- Export del k-NN y del MLP: JSON (ejemplos o pesos + `embeddingVersion`). Export ONNX (solo para el experimento con preentrenado): `ml/export_onnx.py` con **opset fijo** (declarado en `ml/thresholds.yaml`), verificación de que la salida ONNX coincide con PyTorch sobre un batch de prueba.

## 7. Evaluación (LOSO obligatoria) y reporte

- **Leave-One-Subject-Out** por `subjectId`; nunca se evalúa sobre sujetos vistos en entrenamiento.
- Reporte `reports/<task>@<version>.json` generado por `ml/eval.py`:

```json
{
  "task": "form_errors", "exerciseId": "squat", "version": "0.3.0",
  "featureSchemaVersion": "1", "opset": 17, "sha256": "…",
  "datasets": [{ "id": "own-2026-10", "license": "internal" }, { "id": "infinite-rep", "license": "CC BY 4.0" }],
  "loso": { "accuracy": 0.91, "f1_macro": 0.78,
            "perClass": { "shallow_depth": { "f1": 0.83 }, "knee_valgus": { "f1": 0.72 } },
            "perView": { "side": { "f1_macro": 0.81 }, "front": { "f1_macro": 0.74 } } },
  "agreementWithRules": 0.96,
  "latency": { "runtime": "onnxruntime-web-wasm", "device": "mid-range-android", "p50Ms": 6.1, "p95Ms": 11.8 },
  "trainedAt": "2026-11-02T10:00:00Z", "mlCommit": "abc123"
}
```

- Resultados por ejercicio × vista × clase; la comparación con la versión promovida anterior se incluye en el reporte.

## 8. `models/manifest.json`

Propiedad del workstream B; se edita solo en ramas `adr/*` o `contracts/*` (hook y CI).

| Campo | Descripción |
|---|---|
| `task` | `exercise_classifier` \| `form_errors` \| `rep_segmenter` \| `fatigue` |
| `exerciseId` | ejercicio o `"*"` para el clasificador |
| `version` | semver del artefacto |
| `url` | URL en Hugging Face Hub (commit fijo, no rama) |
| `sha256` | hash del `.onnx`; la PWA lo verifica antes de usarlo |
| `sizeBytes` | tamaño para presupuesto de descarga |
| `opset` | opset ONNX |
| `inputShape` / `outputSchema` | forma de entrada y semántica de salida (clases, orden) |
| `featureSchemaVersion` | versión de `FeatureVector` con la que se entrenó; `ModelRegistry` rechaza desajustes |
| `reportPath` | ruta del reporte aprobado en `reports/` |
| `mode` | `shadow` \| `ensemble` \| `primary` (por ejercicio) |
| `confidenceThreshold` | `τ` bajo el cual se usa el fallback de reglas |
| `promotedAt`, `promotedBy` | trazabilidad |

## 9. Gate de promoción

Un PR que modifica `models/manifest.json` solo pasa CI si:

1. Existe `reports/<task>@<version>.json` con `sha256` igual al del manifest.
2. Cada métrica del reporte supera `ml/thresholds.yaml` (metas de `METRICS.md` §8) en todas las celdas relevantes (ejercicio × vista × clase).
3. No hay regresión frente a la versión promovida anterior (mismas métricas ± tolerancia declarada).
4. Los datasets usados son todos `allowedFor: product`.
5. El PR está en rama `adr/*` o `contracts/*` y tiene la aprobación de B (y C como autor del reporte).

La skill `/promote-model` automatiza la verificación local; el CI la repite.

## 10. Despliegue progresivo por ejercicio

| Modo | Quién decide | Qué hace el ML | Salida de modo |
|---|---|---|---|
| `shadow` (sombra) | Reglas | Infiere y registra `agreementWithRules` y `confidence` en `StoreSink` (sin efecto en UI) | Acuerdo ≥ 95 % en casos claros durante ≥ 2 semanas de uso real |
| `ensemble` | Ponderado: `score = w·ml + (1−w)·rules`, `w` en manifest | Contribuye al `FormAssessment` con `source: 'ensemble'` | Sin regresión de golden ni de quejas |
| `primary` | ML | Decide; si `confidence < τ` o falla la carga, `RuleBasedAnalyzer` | — |

Los cambios de modo son cambios en `models/manifest.json` (mismo gate). Cada ejercicio avanza por separado; el clasificador de ejercicio solo reemplaza el chip manual cuando esté en `primary` para los tres ejercicios.

## 11. Inferencia en el cliente (`@movexnet/ml-runtime`)

**Artefactos JSON sin ONNX (`DEC-055`).** El k-NN y el MLP se publican como JSON (ejemplos o pesos, con `embeddingVersion`) y se ejecutan en TypeScript puro en el hilo de análisis; no cargan runtime de inferencia. `KnnPoseClassifier` rechaza un modelo cuyo `embeddingVersion` no coincida con `POSE_EMBEDDING_VERSION`. Lo que sigue aplica solo si el experimento con preentrenado (§6) llega a producción.

ONNX Runtime Web build WASM en un Web Worker; `ModelRegistry.resolve(task, exerciseId)` descarga el artefacto, verifica `sha256`, lo guarda en Cache Storage y devuelve una `InferenceSession`. `MlAnalyzer.analyzeRep(RepWindow)` envía la ventana canonicalizada al Worker y devuelve `FormAssessment` con `source: 'ml'`. Detalle en `DEC-031`.
