# DEC-078 · Los siete ejercicios usan el motor 3D por defecto, con `?engine=2d` de respaldo

- **Estado:** Propuesta
- **Fecha:** 2026-10-21
- **Decisores:** A (pose y captura, @ChejoUMG, por delegación de #33), B (análisis, @ecaldcc), D (@govandoh)
- **Etiquetas:** `analysis-core`, `ui`, `producto`
- **Reemplaza en parte a:** DEC-059 (curl y press ya no siguen en 2D) y DEC-072 (amplía a curl y press lo que hizo con la sentadilla)

## Contexto y problema

Desde DEC-072 la sentadilla y la ola 1 usan el motor 3D, pero curl y press seguían en los contadores 2D del MVP hasta resolver #58. Ya está resuelto, con grabaciones reales y prueba en celular (Xiaomi 15T con Chrome):

| Decisión | Qué resolvió |
|---|---|
| DEC-073 | Umbrales del ciclo: el curl cuenta en 3D y el press de frente deja de contar de más |
| DEC-075 | "Pega el codo" sin avisos de un instante y también al abrir los codos hacia los lados |
| DEC-076 | La voz dice el aviso del codo en vez de felicitar |
| DEC-077 | Sin avisos falsos de arqueo ni de asimetría en repeticiones bien hechas |

Mantener dos motores por defecto obliga a duplicar frases, umbrales y pruebas, y la UI ya decidía el umbral del curl según el motor (deuda de DEC-073).

## Opciones consideradas

1. **Los siete en 3D por defecto, `?engine=2d` como respaldo y el código 2D conservado** (elegida). Si el 3D falla en algún celular, se recupera el 2D con la URL, sin desplegar.
2. **Los siete en 3D y borrar el código 2D.** Simplifica el código, pero el 3D está validado con una sola persona por ejercicio de brazos; si falla con otras, no hay vuelta atrás rápida.
3. **Solo el curl en 3D por defecto.** Se descartó al resolver los avisos falsos del press en DEC-077.

## Decisión

- `usesEngine3D` (`src/ui/workout/exercises.ts`) devuelve 3D para los siete ejercicios. Con `?engine=2d`, sentadilla, curl y press vuelven a los contadores 2D; la ola 1 no tiene versión 2D. `?engine=3d` se acepta por compatibilidad y no cambia nada.
- La ficha de técnica del curl cita el umbral 3D (70°, `CURL_GOOD_CONTRACTION_3D_DEG`).
- **Golden del motor 3D** (`src/exercises/golden3d.test.ts`): un snapshot por cada fixture real de sentadilla, curl y press (15 hoy), con repeticiones, descartes, avisos y el aviso en cada pico. Cambiar uno exige DEC, como en el 2D.
- Los golden 2D (`golden.test.ts`) y el código 2D se conservan mientras exista `?engine=2d`.
- La etiqueta de git `motor-2d-final` marca el último `main` con curl y press en 2D por defecto.

## Consecuencias

### Positivas

- Un solo motor por defecto: calibración de postura, velocidad, fatiga, repeticiones descartadas y avisos de técnica en los siete ejercicios.
- El curl deja de pedir contracciones que el 2D medía mal de frente, y el press deja de contar movimientos sueltos.
- Vuelta atrás inmediata con `?engine=2d`, y completa con `motor-2d-final`.

### Negativas

- **Validado con una persona y un celular** en curl y press. #16 lo confirma con más personas antes de borrar el código 2D.
- Límites conocidos, congelados en los golden:
  - de frente, el curl a medias cuenta como completo (6 de 6), porque el antebrazo va hacia la cámara. El curl debe hacerse de perfil;
  - el press de perfil con los codos bajos casi no cuenta (0 de 6–8);
  - los tirones del curl no se descartan (8 de 8).
- Arqueo lumbar y asimetría del press no tienen grabaciones de casos reales; la detección positiva solo está probada con datos sintéticos (DEC-077).
- Se mantienen dos motores en el código hasta que #16 permita retirar el 2D.

## Referencias

- Issues #33, #58, #16. PRs #84, #85, #89, #91–#94.
- DEC-057 (motor 3D), DEC-059, DEC-072, DEC-073, DEC-075, DEC-076, DEC-077.
