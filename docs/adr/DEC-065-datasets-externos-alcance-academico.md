# DEC-065 · Datasets externos: licencias de MM-Fit corregidas y alcance académico

- **Estado:** Aceptada (2026-10-21, por el responsable del proyecto)
- **Fecha:** 2026-10-13
- **Decisores:** @govandoh (responsable del proyecto); revisan B, D y E (`docs/adr/README.md`)
- **Etiquetas:** `ml`, `datos`, `licencias`, `proceso`

## Contexto y problema

La documentación dice que MM-Fit tiene licencia MIT y que está "permitido en producto" (`docs/DATA-GOVERNANCE.md` §6, `docs/ML-PIPELINE.md` §5, `DEC-027`, `DEC-034`, `DEC-055`). El issue #38 (PR #48) verificó las licencias por artefacto y no coinciden:

| Artefacto | Licencia verificada | Fuente |
|---|---|---|
| Código (`KDMStromback/mm-fit`) | MIT | `LICENCE.txt` del repositorio |
| Video RGB (`w00`…`w20`) | CC BY 4.0 (exige atribución) | zenodo.org/records/7672767 |
| Paquete multimodal (etiquetas, pose, IMU) | Ninguna encontrada: el ZIP no trae LICENSE, README ni TERMS | `ml/datasets/mm-fit/dataset.json` |

El uso de `w19_labels.csv` descansa en una autorización puntual del responsable del proyecto (2026-10-12), no en una licencia pública. El 2026-10-13 el responsable decidió que los datasets externos se usan solo con fines académicos, sin buscar un uso más amplio. Falta dejar escrita esa decisión y corregir lo que sobrestima la licencia.

## Opciones consideradas

1. **Confirmar con los autores una licencia pública para el paquete de etiquetas.** Habilita producto, pero exige contacto externo sin fecha y no aporta nada al alcance actual (seminario, `DEC-035`).
2. **Dejar la documentación como está.** Sin trabajo, pero afirma una licencia MIT que no cubre video ni etiquetas y podría llevar a publicar un modelo sin base legal.
3. **Corregir la documentación y fijar el alcance académico** (elegida). Costo bajo, deja el límite explícito y reabrible.

## Decisión

Los datasets externos (MM-Fit, Fitness-AQA, etc.) se usan **solo con fines académicos** dentro del proyecto. No se persigue una licencia pública formal. Sigue siendo obligatorio registrar en `ml/datasets/<nombre>/dataset.json` la procedencia, la licencia por artefacto y `allowedFor`.

Para MM-Fit:

- Código: MIT. Video RGB: CC BY 4.0, con atribución. Etiquetas y sensores: sin licencia pública verificada; uso amparado en la autorización del responsable (2026-10-12), solo para este proyecto académico.
- `allowedFor` de MM-Fit en `dataset.json` pasa a `["academic"]`; `verified.rgbVideoLicense.allowedFor` conserva `["product"]` por su CC BY 4.0.
- `academic` se añade al esquema de `allowedFor` (`docs/ML-PIPELINE.md` §5) junto a `prototype` y `product`: datos sin licencia pública verificada, amparados por la autorización del responsable. `ml/train` rechazará mezclarlo en un run `--for-product`, igual que `prototype`.
- Se corrigen `docs/DATA-GOVERNANCE.md` §6, `docs/ML-PIPELINE.md` §5 (tabla, esquema `allowedFor` y ejemplo de manifest, que pasa a usar InfiniteRep) y `.claude/agents/ml-engineer.md`. Las ADR previas no se reescriben: `DEC-027`, `DEC-034` y `DEC-055` quedan matizadas por esta DEC en lo que dicen de MM-Fit ("MIT", "permiten uso comercial").

**Qué cambiaría el alcance:** publicar un modelo en `models/manifest.json` o usar la app fuera del curso. Antes habría que (a) confirmar la licencia del paquete de etiquetas con los autores (`k.d.m.stromback@gmail.com`, `valentin.radu@sheffield.ac.uk`) o excluir esos datos del entrenamiento, y (b) añadir MM-Fit a la sección "Créditos" de la app. El gate de promoción (`docs/ML-PIPELINE.md` §9, punto 4) bloqueará modelos con datasets que no declaren `allowedFor: product`.

## Consecuencias

### Positivas

- La documentación deja de afirmar una licencia que no existe y no hay riesgo de promover un modelo con datos sin base legal.
- El alcance queda escrito y se reabre con un criterio claro.

### Negativas

- Un modelo entrenado con las etiquetas de MM-Fit no se puede publicar hasta resolver su licencia o reentrenar sin ellas.
- `DEC-027`, `DEC-034` y `DEC-055` siguen diciendo "MM-Fit (MIT)"; hay que leer esta DEC junto con ellas.

### Pendiente

- `ml/train` y el CI todavía no implementan el rechazo de `academic` y `prototype` en `--for-product` ni el gate de promoción; hay que hacerlo cuando exista el pipeline (workstream C).

## Referencias

- Issue #38 y PR #48 (`ml/datasets/mm-fit/dataset.json`, `ml/datasets/mm-fit/README.md`).
- `docs/DATA-GOVERNANCE.md` §6, `docs/ML-PIPELINE.md` §5, `DEC-035` (cero costo), `DEC-055`.
- Strömbäck, Huang, Radu. 2020. MM-Fit. ACM IMWUT 4(4):168. https://mmfit.github.io/
