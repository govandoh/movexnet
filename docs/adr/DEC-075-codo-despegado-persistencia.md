# DEC-075 · "Pega el codo" en el motor 3D solo si el despegue dura 400 ms

- **Estado:** Propuesta
- **Fecha:** 2026-10-20
- **Decisores:** A (pose y captura, @ChejoUMG), B (análisis, @ecaldcc)
- **Etiquetas:** `analysis-core`

## Contexto y problema

DEC-073 subió `CURL_MAX_ELBOW_DRIFT_DEG` de 25° a 50° para que "Pega el codo al cuerpo, estás usando impulso" dejara de salir en curls bien hechos. En la prueba en celular de #58 (Xiaomi 15T, `?engine=3d`, de frente) el aviso siguió apareciendo en pantalla sin despegar el codo.

El aviso se evalúa en cada frame. Con las grabaciones de #84 se ve la causa: el 3D (`lite`) da saltos de un instante en la posición del codo.

| Toma | Repeticiones con aviso | Duración de cada aviso |
|---|---|---|
| Curl de perfil, bien hecho | 3 de 5 | 0.15–0.3 s |
| Curl de frente, bien hecho | 4 de 6 | 0.1–0.3 s |
| Curl con el codo despegado | — | 0.6–1 s |

Subir más el umbral también quitaría los despegues reales, que en ángulo se parecen a los saltos.

## Opciones consideradas

1. **Exigir que el problema dure un tiempo mínimo** (elegida). Separa saltos de despegues por su duración, que es lo que los distingue en los datos.
2. **Subir el umbral a 60° o más.** Quita los saltos y también la mayor parte de los despegues reales.
3. **Medir el despegue por repetición** (máximo sostenido dentro del ciclo). Es más preciso, pero cambia la forma de `formCheck`; queda como mejora si la opción 1 no basta con más personas (#16).

## Decisión

`ExerciseDefinition3D` gana un campo opcional, `issueHoldMs`, con el tiempo mínimo por código de problema. `Tracker3D` solo informa un problema cuando lleva ese tiempo repitiéndose en frames seguidos; cualquier frame sin él, otro problema o perder de vista el cuerpo reinicia la cuenta. Sin entrada, el comportamiento es el de antes: avisa en el primer frame.

Solo el curl lo usa: `issueHoldMs: { elbow_drift: 400 }` (`CURL_ELBOW_DRIFT_HOLD_MS`). El resto de ejercicios no cambia.

Resultados con los fixtures de #84:

| Toma | Avisos antes | Avisos ahora |
|---|---|---|
| Curl de perfil, bien hecho | 3 | **0** |
| Curl de frente, bien hecho | 4 | **0** |
| Curl de frente, codo despegado | 5 | **2** |
| Curl de perfil, con tirones | — | 4 |

## Consecuencias

### Positivas

- Los curls bien hechos dejan de recibir "Pega el codo", de perfil y de frente.
- Los despegues sostenidos y los tirones siguen avisando.
- El mecanismo sirve para otros avisos con el mismo ruido, sin tocar sus reglas.

### Negativas

- El aviso llega 400 ms tarde.
- Un despegue real más corto que 400 ms no avisa.
- Validado con una sola persona y un celular; se revisa con #16. Falta una toma de codo despegado de perfil, que es la vista recomendada para el curl.

## Referencias

- DEC-073 (umbrales del curl y del press en 3D), issue #58, fixtures de #84.
