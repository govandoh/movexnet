# DEC-077 · Avisos de técnica del press y del curl en 3D sin falsos positivos

- **Estado:** Propuesta
- **Fecha:** 2026-10-21
- **Decisores:** A (pose y captura, @ChejoUMG), B (análisis, @ecaldcc)
- **Etiquetas:** `analysis-core`

## Contexto y problema

Antes de pasar curl y press al motor 3D por defecto (#33), los avisos de técnica no pueden salir en repeticiones bien hechas. Con los fixtures reales de #84 salían en casi todas:

| Toma bien hecha | Aviso | Repeticiones con el aviso en el pico |
|---|---|---|
| Press de perfil | `lumbar_arch` ("estás arqueando la espalda") | 6 de 6 |
| Press de frente | `asymmetry` ("un brazo sube más que el otro") | 5 de 6 |
| Curl de frente | `asymmetry` ("un brazo va adelantado") | 4 de 7 |

Las causas, medidas en las mismas tomas:

- **Arqueo:** de perfil el 3D marca 35–44° de inclinación del tronco con el cuerpo recto, también con los brazos abajo. Es un sesgo fijo de la vista, y el límite absoluto de 25° avisaba siempre. El press no ve los tobillos, así que la calibración de pie no lo corrige.
- **Asimetría del press:** de frente, el 3D da 0.20–0.27 en el pico de presses bien hechos, justo encima del límite de 0.2. Con los codos bajos se midió 0.45–0.94.
- **Asimetría del curl:** de frente, el curl bien hecho dio 0.03–0.73 en el pico, porque el antebrazo va hacia la cámara. No se distingue de un curl desparejo.

## Opciones consideradas

1. **Medir el arqueo como cambio respecto al reposo, subir el límite de asimetría del press y quitar la del curl en 3D** (elegida).
2. **Subir el límite absoluto de inclinación a 45°.** Dejaría pasar arqueos reales de frente, donde la inclinación base es menor (18–29°).
3. **Desactivar todos los avisos del press en 3D.** Pierde la seguridad lumbar, que es el aviso más importante del ejercicio.

## Decisión

- `ExerciseDefinition3D` gana `restBaseline`, una medida de la postura que `Tracker3D` promedia durante el reposo (constante de tiempo de 1 s, independiente de los fps) y pasa a `formCheck` como `ctx.restBaseline`.
- **Press:** `lumbar_arch` avisa cuando el tronco se inclina **15° más** que en el reposo (`PRESS_MAX_ARCH_DELTA_DEG`), con la cadera visible y los brazos arriba. En presses bien hechos el cambio llegó a 9°, y a 12° en los parciales.
- **Press:** `asymmetry` sube de 0.2 a **0.35** (`PRESS_MAX_ASYMMETRY`).
- **Press:** los dos avisos se sostienen **400 ms** antes de salir (`issueHoldMs`, DEC-075).
- **Curl:** sin aviso de asimetría en 3D, como "cuida los hombros" en DEC-073. El motor 2D no cambia.

Resultado con los fixtures de #84: **0 avisos** en las 4 tomas bien hechas de curl y press, de perfil y de frente. Los avisos de codo despegado de DEC-075 siguen igual.

## Consecuencias

### Positivas

- Curl y press pueden pasar al 3D por defecto sin avisos falsos en repeticiones bien hechas.
- El arqueo deja de depender de la vista y de la inclinación del celular: un sesgo fijo se cancela.
- `restBaseline` sirve para otros avisos con el mismo problema (por ejemplo, la inclinación de la sentadilla).

### Negativas

- **No hay grabaciones de arqueo real ni de press desparejo.** La detección positiva está probada solo con datos sintéticos (`tracker3d.test.ts`): el tronco que se va hacia atrás al empujar dispara el aviso. Hay que grabar `cond=lumbar-arch` y `cond=asymmetry` con #16.
- Si alguien ya empieza arqueado con los brazos abajo, la base lo incluye y no avisa.
- El curl en 3D pierde el aviso de asimetría; vuelve cuando haya una medida que funcione de frente.
- Una sola persona y un celular.

## Referencias

- DEC-073 (umbrales de curl y press), DEC-075 (`issueHoldMs`), DEC-076 (avisos por voz), issues #58 y #33, fixtures de #84.
