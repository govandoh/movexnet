# Correr la conversión en Kaggle (gratis, `DEC-035`)

El ejemplo funcional recomendado es la **Fase 2** (MM-Fit RGB real): el clip sintético
de la Fase 1 no sirve como smoke test de conversión porque MediaPipe no detecta la
figura de palitos que genera `make_synthetic_clip.py` (ver limitación detallada en
`ml/datasets/mm-fit/README.md` y `ml/README.md`). Se deja documentado por si se usa
solo para generar el `.mp4` de prueba, no para validar la conversión.

## Validador (sin video, reproducible en cualquier entorno)

1. Notebook en kaggle.com (Accelerator: None; no hace falta GPU).
2. Subir, sin video ni datos de usuario: `requirements.txt`, `validate_v2.py`,
   `test_validate_v2.py`.
3. `pip install -r requirements.txt`
4. `python -m pytest test_validate_v2.py -v` (10 pruebas, sin red ni MediaPipe).

## Fase 2 (MM-Fit RGB real + etiqueta oficial autorizada) — ejemplo funcional

Licencias: el video RGB de MM-Fit (Zenodo) tiene **CC BY 4.0**. Las **etiquetas
originales** (`w19_labels.csv`) **no tienen licencia pública verificada**; su uso aquí
está autorizado únicamente para este proyecto académico por el responsable del
proyecto (`@govandoh`) — **no están aptas para uso comercial** (ver
`ml/datasets/mm-fit/dataset.json` → `verified.labelsProvenance.authorization` y
`pending.labelsLicense`).

1. Subir `w19_rgb.mp4` (descargado de Zenodo, `https://zenodo.org/records/7672767`)
   como dataset privado de Kaggle. No subir `w19_labels.csv` original ni el ZIP del
   paquete multimodal (sin licencia pública verificada).
2. Convertir el recorte real de 35–43 s, anotando procedencia, licencia del video y la
   etiqueta oficial del set (sin cambiar el contrato del esquema v2):
   ```bash
   python convert_video_to_v2.py --video /kaggle/input/mmfit-w19/w19_rgb.mp4 \
     --exercise-id squat --subject-id mmfit-w19 --view front \
     --start-sec 35 --duration-sec 8 \
     --dataset-id mm-fit --source-url https://zenodo.org/records/7672767 \
     --license "CC BY 4.0" \
     --official-labels-source mm-fit/w19/w19_labels.csv --official-activity squats \
     --official-set-start-frame 1014 --official-set-end-frame 1510 \
     --official-set-rep-count 10 \
     --out /kaggle/working/mmfit_w19_squat_v2.json
   ```
3. `python validate_v2.py /kaggle/working/mmfit_w19_squat_v2.json`
4. Descargar solo el JSON resultante. Nunca el `.mp4`.

**Resultado real de esta conversión** (ejecutada localmente, no en Kaggle): 240 frames,
validación OK — ver `ml/README.md` §"Evidencia de la Fase 2" y
`ml/datasets/mm-fit/dataset.json` para el detalle completo.
