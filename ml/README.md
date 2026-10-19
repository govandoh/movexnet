# `ml/` — Pipeline de datasets (workstream C)

> Propiedad: workstream C (`ml-engineer`). Esquema: `docs/ML-PIPELINE.md` §2.

## Alcance (Issue #38, dos fases)

- **Fase 1 (completada, con una limitación conocida):** scaffold mínimo, conversor
  video → v2, validador estructural. El generador de clip sintético
  (`make_synthetic_clip.py`) dibuja una figura de palitos que **MediaPipe no detecta**
  (`convert_video_to_v2.py` lanza `RuntimeError: No se detectó ninguna persona en
  ningún frame`); no es un smoke test reproducible — ver "Qué no hacer aquí" y
  "Cómo correr" más abajo.
- **Fase 2 (completada para Sprint 1):** MM-Fit real, video RGB de Zenodo (CC BY 4.0,
  licencia verificada) **más** la etiqueta oficial de `w19_labels.csv` (set de
  sentadillas, frames 1014–1510), con uso autorizado por `@govandoh` para este
  proyecto académico — **no** es una licencia pública verificada del paquete de
  etiquetas (ver `ml/datasets/mm-fit/README.md` y `ml/datasets/mm-fit/dataset.json`).

El criterio mínimo del Sprint 1 (un dataset externo convertido y validado, con
licencia verificada y anotada) se cumple con el RGB; la etiqueta oficial del set se
anota como metadata adicional (`meta.dataset.officialLabel`) sin cambiar el contrato
del esquema v2. Cargar plantillas al k-NN, Fitness-AQA y segmentación por repetición
individual quedan fuera de esta entrega.

## Evidencia de la Fase 2

Ejecutado manualmente (no en CI) el 2026-10-12, en la rama `feat/ml-datasets`.

- **Dataset:** MM-Fit, video RGB `w19_rgb.mp4`, descargado de Zenodo
  (`https://zenodo.org/records/7672767`), licencia CC BY 4.0.
- **Recorte convertido:** segundos 35–43 (8 s), sentadillas identificadas visualmente
  (no hay segmentación oficial por rep; ver limitaciones en
  `ml/datasets/mm-fit/README.md`).
- **Conversión MediaPipe:** exitosa, **240 frames** generados en
  `ml/data/out/mmfit_w19_squat_v2.json` (archivo local, ignorado por git).
- **Validación (`validate_v2.py`):** `OK ml/data/out/mmfit_w19_squat_v2.json (240 frames)`.
- **Pruebas unitarias (`test_validate_v2.py`):** `10 passed in 0.03s`
  (Python 3.11.9, pytest 9.1.1; re-ejecutado el 2026-10-19 en `docs/ml-pr48-followup`
  tras agregar `test_dataset_official_label_metadata_does_not_break_validation`).
- **Etiquetas originales de MM-Fit:** el clip se confirmó, contra `w19_labels.csv`
  (`mm-fit/w19/`, extraído por rango HTTP sin descargar el ZIP completo, integridad
  verificada por CRC32), dentro del set oficial de sentadillas (frames 1014–1510,
  33.8–50.33 s). El recorte de 35–43 s es un **subconjunto** de ese set, no el set
  completo: no se registran las 10 repeticiones oficiales como ocurridas en los 240
  frames procesados; el set completo se anota solo como metadata informativa en
  `meta.dataset.officialLabel`. Uso autorizado por `@govandoh` el 2026-10-12 para este
  proyecto académico — el paquete de etiquetas **no tiene licencia pública verificada**
  (ver `ml/datasets/mm-fit/dataset.json` → `verified.labelsProvenance`).
- **Nada de lo anterior se subió al repositorio:** el `.mp4`, el `.json` de salida y el
  CSV original están fuera del repo (`ml/data/raw/`, `ml/data/out/`, archivos
  temporales locales), todos cubiertos por `.gitignore` o nunca escritos en el
  workspace del repositorio.

## Qué no hacer aquí

No subir video ni datos de usuario (regla dura 2, `AGENTS.md`). No inventar licencias ni
resultados de conversión real. No tocar `src/**`, contratos ni `models/manifest.json`.
No presentar `make_synthetic_clip.py` como un smoke test reproducible de principio a
fin: MediaPipe no detecta la figura de palitos que genera (ver limitación arriba).

## Cómo correr (gratis, `DEC-035`)

El camino funcional y verificado end-to-end es el validador (sin red ni video) más la
conversión real de MM-Fit (Fase 2, abajo). El clip sintético solo sirve para generar un
`.mp4` de prueba del propio generador; **no completa una conversión MediaPipe válida**.

```bash
pip install -r ml/datasets/mm-fit/requirements.txt

# Validador y pruebas unitarias: sin red, sin video, sin MediaPipe.
python -m pytest ml/datasets/test_validate_v2.py -v

# Conversión funcional real (MM-Fit w19, recorte 35-43s): ver comando completo y
# resultados reales en ml/datasets/mm-fit/README.md §"Fase 2".
```

Si se quiere generar el clip sintético igualmente (por ejemplo, para iterar sobre el
propio `make_synthetic_clip.py`):

```bash
python ml/datasets/mm-fit/make_synthetic_clip.py --out ml/data/raw/synthetic.mp4
```

**No se continúa con `convert_video_to_v2.py --synthetic` sobre ese clip**: la figura de
palitos no es una persona real y el `PoseLandmarker` de MediaPipe no la detecta
(`RuntimeError: No se detectó ninguna persona en ningún frame; no se escribe JSON
vacío.`); no hay `ml/data/samples/synthetic_squat_smoke.json` resultante porque esa
conversión nunca llegó a producir un JSON válido.

Pasos de Kaggle: `ml/datasets/mm-fit/kaggle.md`. Procedimiento de Fase 2 (MM-Fit RGB
real, el ejemplo funcional recomendado): `ml/datasets/mm-fit/README.md`.

## MediaPipe: Kaggle (Python) vs la app (JavaScript)

La app usa `@mediapipe/tasks-vision@0.10.35` (JS/WASM). Kaggle usa el paquete Python
`mediapipe`: no es el mismo paquete. La compatibilidad se ancla en que ambos cargan el
mismo modelo `pose_landmarker_lite.task` (float16, variante 1).

## Estructura

| Ruta | Contenido |
|---|---|
| `ml/datasets/mm-fit/` | Registro de licencia, conversor, guía Kaggle |
| `ml/datasets/validate_v2.py` | Validador estructural del esquema v2 |
| `ml/data/samples/` | Muestras versionadas (vacío hoy: el clip sintético de Fase 1 no produce un JSON válido, ver limitación arriba) |
| `ml/data/raw/`, `ml/data/out/` | Video y salidas, ignorados por git |
