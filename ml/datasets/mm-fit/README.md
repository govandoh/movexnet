# MM-Fit — registro y plan de conversión (Issue #38)

Estado: **Fase 1 completada, con una limitación conocida en el smoke sintético (ver
abajo). Fase 2: video RGB real de Zenodo (CC BY 4.0) + etiquetas originales de
`w19_labels.csv`, con uso autorizado por el responsable del proyecto (ver "Etiquetas
originales" abajo; no es una licencia pública verificada). El ejemplo funcional
recomendado para reproducir el pipeline es la Fase 2, no el clip sintético.**
Sitio oficial: https://mmfit.github.io/ (Strömbäck, Huang, Radu, IMWUT 2020).

## Licencias verificadas (no son iguales entre artefactos)

| Artefacto | Licencia | Fuente |
|---|---|---|
| Código (`KDMStromback/mm-fit`) | MIT | github.com/KDMStromback/mm-fit/blob/master/LICENCE.txt |
| Video RGB (`w00`…`w20`) | CC BY 4.0 | zenodo.org/records/7672767 |
| **Paquete multimodal (etiquetas, pose, IMU)** | **Sin licencia verificada.** Uso de `w19_labels.csv` amparado en autorización puntual de `@govandoh` (ver abajo), no en una licencia pública. | No aparece LICENSE/README en el ZIP ni en el sitio/repo/Zenodo |

## Sesión elegida para la Fase 2 (video RGB)

Video `w19_rgb.mp4` (415.4 MB, el más chico de la sesión), descargado directamente de
Zenodo (DOI `10.5281/zenodo.7672767`), licencia **CC BY 4.0** verificada en la página
del registro. Se convierte un recorte corto (no el video completo) para mantener el PR
liviano; el `.mp4` nunca se sube al repositorio (`.gitignore`).

## Etiquetas originales: uso autorizado (no es licencia pública)

Las etiquetas por set (`startFrame, endFrame, repetitionCount, activityClass`, formato
confirmado en `utils/utils.py::load_labels` del repo oficial) viven en el **paquete
multimodal** (`s3.eu-west-2.amazonaws.com/vradu.uk/mm-fit.zip`, bucket de un coautor,
enlazado por terceros, no publicado hoy en una página oficial del proyecto).

**Verificación técnica (sin descargar el ZIP completo de 1.62 GiB):** se extrajo
únicamente `mm-fit/w19/w19_labels.csv` (705 bytes) mediante dos peticiones HTTP por
rango (2 MiB del directorio central del ZIP + 845 bytes del archivo puntual), y se
confirmó su integridad con CRC32 (`0xf54a2c25`, coincide con el directorio central). El
ZIP **no contiene** ningún archivo LICENSE, README ni TERMS (324 entradas inspeccionadas
por nombre) — por eso no se le atribuye una licencia SPDX ni pública.

**Autorización:** `@govandoh`, responsable del proyecto Fitnet, autorizó el 2026-10-12
el uso de `w19_labels.csv` en este proyecto académico. Es una autorización puntual del
líder del proyecto, **no una licencia pública verificada**; se documenta como tal en
`dataset.json` → `verified.labelsProvenance.authorization`. Para un uso más amplio del
dataset (más allá de este prototipo) sigue pendiente confirmar una licencia formal con
los autores (`k.d.m.stromback@gmail.com`, `valentin.radu@sheffield.ac.uk`).

**Contenido real de `w19_labels.csv`** (primeras filas, columnas
`startFrame,endFrame,repetitionCount,activityClass`):

```
1014,1510,10,squats
2469,2955,10,squats
3869,4343,10,squats
5420,6088,10,pushups
...
```

**Relación con el recorte convertido (35–43 s, 240 frames):** a 30 fps (fps real
reportado por `cv2.CAP_PROP_FPS` en la conversión), el recorte corresponde a los frames
~1050–1290, que caen **dentro** del primer set oficial de sentadillas (frames
1014–1510). El recorte confirma sentadillas, pero es un **subconjunto** del set oficial
de 10 repeticiones, no el set completo — por eso **no se registran 10 repeticiones como
ocurridas en los 240 frames procesados**. El set completo (`setStartFrame`,
`setEndFrame`, `setRepCount=10`) se anota como metadata informativa en
`meta.dataset.officialLabel` vía los flags `--official-*` de `convert_video_to_v2.py`,
sin cambiar `labels[]` ni el contrato del esquema v2.

## Mapeo MM-Fit → `exerciseId` de Fitnet (Fase 2)

`squats→squat`, `pushups→pushup`, `lunges→lunge`, `bicep_curls→curl`,
`dumbbell_shoulder_press→press`; el resto no tiene asistente en Fitnet hoy.

## Fase 1 — qué se probó (y qué no)

`make_synthetic_clip.py` genera un clip corto con una figura de palitos (sentadilla
simulada) para probar `convert_video_to_v2.py` sin MM-Fit real. **Esta parte no es un
smoke test reproducible de punta a punta:** el `PoseLandmarker` de MediaPipe no detecta
la figura de palitos como una persona, así que `convert_video_to_v2.py --synthetic`
sobre ese clip falla con `RuntimeError: No se detectó ninguna persona en ningún frame`.
No existe `ml/data/samples/synthetic_squat_smoke.json` en el repositorio por esta razón
(confirmado en la revisión del PR #48). Lo que sí se probó y valida de forma
reproducible es el validador estructural (`validate_v2.py` + `test_validate_v2.py`,
sin red ni video) y la conversión real descrita en "Fase 2" abajo, que es el ejemplo
funcional recomendado para reproducir el pipeline.

## Fase 2 — procedimiento con MM-Fit real (RGB + etiqueta oficial autorizada)

```bash
# 1. Descargar el video RGB de Zenodo (CC BY 4.0), fuera del repo.
curl -L -o ml/data/raw/w19_rgb.mp4 \
  "https://zenodo.org/records/7672767/files/w19_rgb.mp4?download=1"

# 2. Convertir el recorte de 35-43s con MediaPipe lite, anotando procedencia, licencia
#    del video y la etiqueta oficial de MM-Fit (autorizada por @govandoh, no es
#    licencia pública -ver "Etiquetas originales" arriba).
python ml/datasets/mm-fit/convert_video_to_v2.py \
  --video ml/data/raw/w19_rgb.mp4 \
  --exercise-id squat --subject-id mmfit-w19 --view front \
  --start-sec 35 --duration-sec 8 \
  --dataset-id mm-fit --source-url https://zenodo.org/records/7672767 \
  --license "CC BY 4.0" \
  --citation "Strömbäck, Huang, Radu. 2020. MM-Fit. ACM IMWUT 4(4):168. doi.org/10.1145/3432701" \
  --official-labels-source mm-fit/w19/w19_labels.csv --official-activity squats \
  --official-set-start-frame 1014 --official-set-end-frame 1510 --official-set-rep-count 10 \
  --notes "Recorte dentro del set oficial de sentadillas (frames 1014-1510); es subconjunto del set, no el set completo." \
  --out ml/data/out/mmfit_w19_squat_v2.json

# 3. Validar contra el esquema v2.
python ml/datasets/validate_v2.py ml/data/out/mmfit_w19_squat_v2.json

# 4. Tests unitarios del validador (sin red, sin video).
python -m pytest ml/datasets/test_validate_v2.py -v
```

**Resultados reales de esta ejecución:** ver `ml/README.md` §"Evidencia de la Fase 2".

### Limitaciones conocidas de esta conversión

- El recorte (35–43 s) está confirmado dentro del set oficial de sentadillas
  (frames 1014–1510 según `w19_labels.csv`), pero es un **subconjunto** de ese set:
  `labels[]` sigue teniendo una única etiqueta `exercise` por clip; el `setRepCount=10`
  oficial se anota solo como metadata informativa en `meta.dataset.officialLabel`, no
  como repeticiones ocurridas en los 240 frames procesados.
- No hay segmentación por repetición individual (el CSV oficial de MM-Fit etiqueta por
  set completo, no por rep; fuera de alcance de Sprint 1).
- El recorte es un subconjunto corto de `w19_rgb.mp4`, no la sesión completa.
- El paquete de etiquetas no tiene licencia pública verificada; su uso se ampara en la
  autorización puntual de `@govandoh` (ver `dataset.json`).
