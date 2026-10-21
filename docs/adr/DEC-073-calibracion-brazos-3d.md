# DEC-073 · Curl y press en el motor 3D: umbrales calibrados con grabaciones reales

- **Estado:** Propuesta
- **Fecha:** 2026-10-20
- **Decisores:** B (análisis, @ecaldcc), A (pose y captura, @ChejoUMG), D (@govandoh)
- **Etiquetas:** `analysis-core`

## Contexto y problema

Para pasar curl y press al motor 3D por defecto (#33), el issue #58 pide que cuenten 5 de 5 repeticiones bien hechas y 0 a medias, y que los avisos correspondan a lo que se hizo. Con los umbrales vigentes no se cumplía:

- **Curl:** el 3D (`worldLandmarks`, modelo `lite`) comprime el ángulo del codo. Un curl completo que en la imagen va de unos 178° a 25° mide de unos 150° a 60° en 3D. El ciclo pedía reposo por encima de 160° y esfuerzo por debajo de 60°, así que casi no contaba: 1 de 6–8 de perfil y 0 de 6–8 de frente.
- **Press:** de frente contaba de más (13 sobre 6–8 en la toma completa), porque los dos brazos desfasados producían recorridos entrecortados que se validaban como repeticiones.
- **Avisos:** "Pega el codo al cuerpo" salía en el 38–50 % de los frames de curls bien hechos, y "No bajes tanto, cuida los hombros" en el 45 % del press de perfil bien hecho.

Datos: 12 tomas en un Xiaomi 15T con Chrome, `?engine=3d&debug=record` y el guion de DEC-055. Un sujeto (`s01`), vistas lateral y frontal, condiciones correcta, recorrido parcial y errores, de 6 a 8 repeticiones reales cada una. Los recortes están en `fixtures/landmarks/` (#84); las tomas completas, en la carpeta privada del equipo.

## Opciones consideradas

1. **Ajustar los umbrales del 3D** (elegida). Un barrido de reposo de 135 a 160° y esfuerzo de 60 a 110° muestra que, con 140°/70°, el 3D separa el curl completo del parcial de perfil.
2. **Medir el curl con el ángulo 2D de la imagen de perfil.** Funciona en las tomas (7 de 6–8 bien hechas y 1 a medias), pero obliga a mantener código de imagen dentro del motor 3D, cuando #33 busca retirar el 2D. Queda como alternativa si la opción 1 falla con más personas.
3. **Modelo `pose_landmarker_full`.** Podría medir mejor la profundidad, pero cuesta fps en gama baja y es un cambio de pose-engine con su propia DEC. Queda como experimento aparte.

## Decisión

Se ajustan las definiciones 3D de curl y press en `src/exercises/definitions3d.ts`:

| Parámetro | Antes | Ahora |
|---|---|---|
| `CURL_3D.cycle.restDeg` | 160° | **140°** |
| `CURL_3D.cycle.effortDeg` | 60° | **70°** |
| `CURL_3D.cycle.minStartDeg` | 130° | **125°** |
| Contracción completa en 3D (`CURL_GOOD_CONTRACTION_3D_DEG`, panel y voz) | 50° (umbral 2D) | **70°** |
| `CURL_MAX_ELBOW_DRIFT_DEG` | 25° | **50°** |
| `PRESS_3D.quality.minSmoothness` | 0.3 | **0.4** |
| Aviso `unsafe_low_elbow` en 3D | por debajo de 80° | **desactivado** |

`peakPhrase` (`src/ui/workout/coaching.ts`) recibe el motor: en 3D, la frase del curl usa el umbral de 70°. El motor 2D no cambia.

**El curl se mide de perfil.** De frente, el antebrazo se mueve hacia la cámara y ni el 2D ni el 3D ven el recorrido: la toma frontal a medias contó 6, igual que la completa. Pedir la vista lateral y avisar si la persona está de frente queda para el PR que pasa curl y press al 3D por defecto (#33).

**Criterio en los tests.** `src/exercises/armCalibration3d.test.ts` acepta de 5 a 8 repeticiones en las tomas bien hechas, porque los fixtures son recortes de menos de 2 MB y no siempre contienen la serie entera. El criterio de #58 (5 de 5 bien hechas y 0 a medias) se comprueba en celular.

Resultados en las tomas completas, con la decisión aplicada:

| Toma | Antes | Ahora | Reales |
|---|---|---|---|
| Curl de perfil, bien hecho | 1 | 6 | 6–8 |
| Curl de perfil, a medias | 0 | 1 | 0 |
| Curl de frente, bien hecho | 0 | 7 | 6–8 |
| Press de frente, bien hecho | 13 | 8 | 6–8 |
| Press de perfil, bien hecho | 6 | 6 | 6–8 |
| Press a medias (perfil y frente) | 0 | 0 | 0 |

## Consecuencias

### Positivas

- El curl cuenta en 3D, y de perfil distingue el recorrido completo del parcial.
- El press de frente deja de contar movimientos falsos.
- Los avisos de codo y hombros dejan de salir en repeticiones bien hechas.
- `src/exercises/armCalibration3d.test.ts` fija el comportamiento contra los fixtures reales.

### Negativas

- **Una sola persona y un solo celular.** Los umbrales se validan con #16 antes de retirar el motor 2D.
- **"Cuida los hombros" no existe en 3D.** Abajo, el codo 3D midió 9–55° en presses bien hechos de perfil y no se separa de bajar de más. Vuelve cuando haya una medida que distinga los dos casos.
- **"Pega el codo" con 50° solo detecta despegues claros.** En la toma de codo despegado salió en el 9 % de los frames; distinguirlo bien requiere una medida por repetición, no por frame.
- **Los tirones del curl no se rechazan:** la toma con tirones contó 9. Hace falta un límite de velocidad pico, que hoy no existe en `QualityThresholds`.
- **El press de perfil bajando los codos de más casi no cuenta** (1 de 6–8). Queda pendiente con más datos.
- `src/analysis/setSummary.ts` conserva la etiqueta de `unsafe_low_elbow` para el motor 2D, que sí emite ese aviso.
- `peakPhrase` decide el umbral del curl según el motor dentro de la UI. Es deuda: la frase debería salir de la definición del ejercicio, y se corrige al retirar el 2D (#33).
- La ficha de técnica del curl (`demoPoses.ts`) sigue citando el umbral 2D de 50°. Se actualiza cuando el curl pase al 3D por defecto.

## Referencias

- Issues #58 (brazos en 3D), #33 (3D por defecto), #15 (fixtures reales), #16 (recolección con más personas).
- PR #84 (fixtures), DEC-066 (umbrales de reposo con grabaciones reales), DEC-055 (protocolo por guion), DEC-057 (motor 3D), DEC-017 y DEC-018 (ciclos de curl y press).
