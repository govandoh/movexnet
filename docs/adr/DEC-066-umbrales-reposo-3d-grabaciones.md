# DEC-066 · Umbrales de reposo del motor 3D y de la calibración de pie, ajustados con grabaciones reales

- **Estado:** Aceptada (2026-10-21, por el responsable del proyecto)
- **Fecha:** 2026-10-14
- **Decisores:** lead del workstream B (Análisis & Runtime); aprueban B, D y E (`docs/adr/README.md`)
- **Etiquetas:** `analysis-core`, `umbrales`, `calibracion`

## Contexto y problema

En la prueba en celular del Sprint 1 (issue #49, iPhone 17 Pro Max con Brave), sentadilla, curl y zancadas casi no contaban repeticiones con el motor 3D. Las zancadas usan ese motor en producción (`DEC-059`). Se grabaron 14 tomas con `?engine=3d&debug=record` (de perfil, ~55 fps, condiciones `correct` y `excess_speed`) y se pasaron cuadro a cuadro por `FramePipeline`. Las grabaciones no se suben al repo, porque es público.

**1. La repetición no se cerraba.** El contador cuenta al volver a la posición de inicio (`restDeg`), y en celular esa posición se mide menos extendida de lo que suponían los umbrales:

| Ejercicio | Umbral de reposo | Inicio medido por repetición |
|---|---|---|
| Sentadilla | 160° | 146–152° (mediana 149°) |
| Zancadas | 160° | 131–170°, según la toma |
| Flexiones | 150° | 140–156° (mediana 149–156°) |
| Press (polaridad máxima) | bajar de 100° | 93–116° (mediana 101°) |
| Curl | 160° (y flexión < 60°) | 144–167° (flexión medida: ~82–86°) |

Puente y plancha funcionaron.

**2. El 3D de MediaPipe comprime el rango de movimiento.** Se comparó con el ángulo 2D de la imagen del mismo cuadro, corrigiendo la proporción de la imagen:

| Ejercicio y posición | 2D (imagen) | 3D (`worldLandmarks`) |
|---|---|---|
| Sentadilla, pierna estirada | ~163–167° | ~139–145° |
| Sentadilla, abajo | ~86–91° | ~76–79° |
| Curl, brazo estirado | ~176–178° | ~147–153° |
| Curl, brazo doblado | ~18–32° | ~91–98° |

Los umbrales venían de fitnetv2 y se probaron con poses sintéticas (de pie ≈ 173°), que no tienen esta compresión.

**3. La calibración de pie (`DEC-053`) nunca terminaba.** Exige rodillas por encima de 160°, y en las tomas de sentadilla, curl y press ningún cuadro lo cumple. Sin calibración la serie no arranca sola: el botón "Empezar serie" sigue funcionando, pero la pantalla se queda en "calibrando".

**4. La velocidad no era la causa** (se sospechaba en #49):
- Las repeticiones rápidas pero controladas duraron 1,3–2 s, por encima del mínimo de 0,6–0,8 s.
- En el puente, los tirones reales (0,5–0,8 s) se descartaron como se esperaba.

## Factores de decisión

- Contar las repeticiones reales que el 3D mide comprimidas, sobre todo en producción (zancadas, flexiones).
- No abrir la puerta a repeticiones parciales: los umbrales de esfuerzo, el recorrido mínimo y la duración mínima no cambian.
- Cambio pequeño y reversible mientras no haya datos de más personas (#16).

## Opciones consideradas

1. **Bajar los umbrales fijos de reposo y de rodilla estirada según las grabaciones** (elegida). Pro: resuelve el fallo con un cambio de constantes y pruebas de regresión. Contra: calibrado con una persona y un celular.
2. **Umbral de reposo relativo a cada persona**, aprendido en la preparación (el ángulo de inicio que mide la calibración de pie). Pro: robusto entre personas y cámaras. Contra: mecanismo nuevo. Queda como evolución si #16 muestra mucha variación.
3. **Modelo `pose_landmarker_full`**, con mejor 3D. Contra: cuesta fps en gama baja, es decisión del workstream A con su propia DEC y no evita calibrar.
4. **Ángulo 2D de la imagen en vista de perfil.** Pro: más fiel en el plano del movimiento. Contra: depende de la vista y de la proporción de la imagen. Se evalúa en #33 para el curl.
5. **No cambiar nada hasta tener los datos de #16.** Descartada: las zancadas no cuentan hoy en producción.

## Decisión

Bajamos los umbrales de vuelta al reposo del motor 3D y el de rodilla estirada de la calibración de pie. Cada umbral queda unos 5–10° por debajo del inicio medido en las tomas correctas, lejos del umbral de esfuerzo:

| Parámetro | Antes | Ahora |
|---|---|---|
| `SQUAT_3D.cycle.restDeg` | 160° | **140°** |
| `PUSHUP_3D.cycle.restDeg` | 150° | **140°** |
| `LUNGE_3D.cycle.restDeg` | 160° | **135°** |
| `STRAIGHT_KNEE_DEG` (`src/geometry/standingCalibration.ts`) | 160° | **145°** |
| `PUSHUP_GOOD_DEPTH_DEG` ("¡Buena bajada!" en pantalla y voz) | 90° | **95°** |

La profundidad buena de la flexión se ajustó tras la prueba en vivo: en el iPhone la app pedía "Baja más el pecho" estando abajo. En las 25 flexiones contadas de las grabaciones, el fondo medido dio mediana 84°, p75 90°, p90 95° y máximo 100°: con 90°, 6 de 25 recibían el aviso falso; con 95°, 2 de 25 (las de 96° y 100°, bajadas cortas). Las flexiones entre 95° y 100° se cuentan con aviso, así que la corrección de profundidad se mantiene.

No cambian:
- los umbrales de esfuerzo, el recorrido mínimo, la duración mínima y los de calidad (`GOOD_*`), salvo la profundidad de la flexión;
- el requisito de cadera recta de la calibración (155°: las tomas lo cumplen);
- el puente y la plancha;
- el curl y el press, que pasan al issue #58 (ver Consecuencias).

**El press se probó con 110° y se descartó.** Con las grabaciones de #49 mejoraba de 10 de 12 a 11 de 11, pero en la revisión del PR #56 (@govandoh, Samsung S24 Ultra con Brave) contó movimientos que no eran repeticiones y repeticiones a medias: bajar solo a 110° alcanzaba para cerrar la repetición. Vuelve a 100° y se calibra en #58, junto con el curl.

**Resultado con las mismas grabaciones:**

| Toma | Antes | Ahora |
|---|---|---|
| Sentadilla (correcta / rápida) | 0 / 0 | 10 de 10 / 12 de 12 |
| Zancadas (correctas, dos tomas / rápidas) | 0 y 5 de 11 / 8 de 14 | 7 de 13 y 11 de 11 / 13 de 16 |
| Flexiones (correctas, dos tomas) | 11 de 15 y 9 de 11 | 14 de 16 y 9 de 11 |
| Calibración de pie completada | 2 de 14 tomas | 9 de 14 tomas (1,5–14 s) |

En la segunda toma de zancadas, las repeticiones que siguen sin contar tienen recorrido corto: se descartan por `insufficient_rom`, como corresponde.

**Pruebas de regresión:**
- `src/exercises/definitions3d.test.ts` comprime la posición de inicio de las demos hasta el ángulo medido. Con el umbral nuevo cuenta 5 de 5; con el anterior, 0.
- `src/geometry/standingCalibration.test.ts` acepta como "de pie" una rodilla medida a 150° con la cadera recta, y rechaza 140°.
- En `definitions3d.test.ts`, una flexión con el fondo medido a 92° es "buena bajada" y una de 98° cuenta con aviso.

## Consecuencias

### Positivas

- Las zancadas vuelven a contar en producción, y las flexiones pierden menos repeticiones (antes algunas se juntaban en un ciclo largo y se descartaban por lentas) y ya no piden bajar más a quien está abajo.
- La sentadilla cuenta con `?engine=3d`, un paso previo para #33.
- Prueba en vivo: iPhone 17 Pro Max (@ecaldcc) y Samsung S24 Ultra (@govandoh), los dos con Brave. Zancadas, flexiones y sentadilla contaron 5 de 5.
- La calibración termina y la serie arranca sola en la mayoría de las tomas.
- Los golden del PR 1 no cambian: miden el motor 2D.

### Negativas

- **Datos de una sola persona, un celular y una sesión.** Hay que validar con las grabaciones de más personas y dispositivos (#16) antes de dar #39 por cerrada.
- **La repetición se cierra antes al subir.** Con un reposo más bajo, la duración medida del ciclo se acorta un poco, y quien no se estira del todo entre repeticiones igual cuenta. Las protecciones de profundidad y recorrido mínimo siguen igual.
- **Calibración:** acepta rodillas algo flexionadas. El eje tobillos-hombros sigue casi vertical, y `MAX_CORRECTION_DEG` (35°) limita cualquier corrección grande.
- **Curl sin resolver en 3D:** el 3D mide unos 90° con el brazo a unos 30°. Bajar el umbral de flexión a ~100° lo haría contar, pero entonces no distinguiría un curl a medias y la voz diría siempre "Sube un poco más". **No se debe pasar el curl ni el press al motor 3D (#33) hasta resolverlo en #58.** En producción siguen en 2D, que funciona.
- **Ejercicios en el suelo (flexiones, puente, plancha):** si la persona ya está en el suelo al abrir la pantalla, la calibración de pie no ocurre y la serie no arranca sola. Queda pendiente en #39.
- **Técnica de la cadera en flexiones y plancha:** la revisión notó que hay que detectar mejor la cadera caída o levantada (`PUSHUP_MIN_BODY_LINE_DEG`, sin calibrar). Se sigue en #59.
- **Repeticiones rápidas:** en sentadilla, curl y zancadas los "tirones" grabados duraron ~1,5 s y cuentan como repeticiones rápidas válidas. Es coherente con la pregunta de entrenar con intensidad (#49); el límite de duración no cambia.

## Referencias

- Issues #39 (ola 1), #49 (prueba en celular y análisis), #33 (motor 3D predeterminado), #16 (recolección con más personas).
- `DEC-010` (histéresis), `DEC-044` (confirmación del pico), `DEC-053` (calibración de pie), `DEC-055` (grabación por guion), `DEC-057` (motor 3D), `DEC-059` (motor por ejercicio).
- `src/exercises/definitions3d.ts`, `src/geometry/standingCalibration.ts` y sus pruebas.
