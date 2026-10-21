# DEC-076 · La voz dice el aviso de técnica en el pico en vez del elogio

- **Estado:** Propuesta
- **Fecha:** 2026-10-20
- **Decisores:** A (pose y captura, @ChejoUMG), B (análisis y voz, @ecaldcc), E (app)
- **Etiquetas:** `feedback`, `ui`

## Contexto y problema

En la prueba en celular de #58, con los codos abiertos hacia los lados, la pantalla mostraba "Pega el codo al cuerpo" (DEC-075), pero la voz decía "¡Excelente contracción!" en cada repetición. La frase del pico (`peakPhrase`) solo mira el ángulo alcanzado y la política de voz de DEC-016 nunca dice los avisos de técnica en los ejercicios por repeticiones. Quien entrena sin mirar la pantalla recibe un elogio por una repetición mal hecha.

## Opciones consideradas

1. **Decir en el pico el aviso de técnica activo en ese frame, en lugar del elogio, solo para avisos validados** (elegida).
2. **Decir cualquier aviso de técnica activo en el pico.** Con los fixtures de #84, el press bien hecho trae `lumbar_arch` en los 6 picos de perfil y `asymmetry` en 5 de 6 de frente; el curl bueno de frente, `asymmetry` en 4 de 7. La voz regañaría casi todas las repeticiones buenas.
3. **Avisos de técnica por voz con su propio ritmo**, como la plancha (`PLANK_WARNING_MIN_MS`). Choca con el número de la repetición en curl y press, que es lo que DEC-016 evita.

## Decisión

`spokenPeakPhrase` (`src/ui/workout/coaching.ts`) elige la frase del pico: si el frame del pico trae un aviso de `VOICED_TECHNIQUE_ISSUES`, se dice ese aviso; si no, la frase de siempre. La política de voz de DEC-016 no cambia: la frase se dice en el mismo momento (en el fondo, o junto con el número en curl y press).

`VOICED_TECHNIQUE_ISSUES` empieza solo con `elbow_drift`, validado en DEC-075. Un aviso se suma cuando sus grabaciones muestran que no sale en repeticiones bien hechas.

Se usa el frame del pico porque es el mismo con el que el resumen de la serie marca la calidad de la repetición: la voz y el resumen coinciden.

## Consecuencias

### Positivas

- Con los codos despegados, la voz deja de felicitar y dice el aviso: "3. Pega el codo al cuerpo, estás usando impulso".
- La lista de avisos por voz es explícita y crece con datos.

### Negativas

- Los demás avisos siguen solo en pantalla, incluidos los que sí son correctos (tronco inclinado en la sentadilla).
- `lumbar_arch` y `asymmetry` del press dan falsos positivos en repeticiones bien hechas también en pantalla. Queda como pendiente de calibración del press.
- El motor 2D no cambia: no tiene avisos de técnica separados del pico.

## Referencias

- DEC-016 (política de voz), DEC-075 ("pega el codo" con abducción y 400 ms), issue #58, fixtures de #84.
