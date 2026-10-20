# DEC-059 · La ola 1 del asistente usa el motor 3D sin flag; sentadilla, curl y press siguen en 2D

- **Estado:** Aceptada; la parte de la sentadilla la reemplaza DEC-072 (pasa al motor 3D)
- **Fecha:** 2026-09-24
- **Decisores:** Workstreams B (Análisis) y E (App & UI)
- **Etiquetas:** analysis-core, ui, producto

## Contexto y problema

`DEC-057` dejó todo el motor 3D detrás de `?engine=3d` hasta validarlo en celular. Con la Fase 1 la app tiene programa de entrenamiento (`DEC-056`): en casa sin equipo, el generador propone flexiones, zancadas, puente de glúteo y plancha con la insignia "con asistente". Esos cuatro ejercicios (ola 1) solo existen en el motor 3D; sin el flag, el programa ofrecería ejercicios con asistente que la app no puede analizar.

El equipo ya abrió el preview con `?engine=3d` en celular, pero no hay todavía un informe de prueba por ejercicio ni fixtures con `world` para los golden (issue #33).

## Opciones consideradas

1. **Mantener todo detrás del flag** — no cambia nada en producción, pero el programa pierde el asistente en 4 de sus 7 ejercicios y la ola 1 no se puede usar sin conocer el parámetro.
2. **Pasar todo al motor 3D** — un solo motor, pero cambia el comportamiento congelado de sentadilla, curl y press sin fixtures `world` ni DEC de golden (regla dura 5).
3. **Motor por ejercicio (elegida)** — la ola 1 usa siempre el motor 3D, que es el único que tiene; sentadilla, curl y press siguen en el 2D de producción y pasan al 3D con `?engine=3d`.

## Decisión

El motor se elige por ejercicio en `src/ui/workout/exercises.ts` (`usesEngine3D`):

- Flexiones, zancadas, puente de glúteo y plancha usan siempre el motor 3D (`FramePipeline`, `PlankTracker`).
- Sentadilla, curl y press usan el motor 2D (`SquatTracker`, `BicepCurlTracker`, `ShoulderPressTracker`) salvo con `?engine=3d`.
- El nivelador de la preparación usa el acelerómetro en los dos motores; la calibración de pie solo se pide en el 3D.

El cambio de sentadilla, curl y press al 3D sigue pendiente de su propia DEC con fixtures `world` (issue #33).

## Consecuencias

### Positivas

- El programa sin equipo tiene asistente en todos sus ejercicios de fuerza.
- Los golden del PR 1 siguen intactos: el comportamiento de los tres ejercicios originales no cambia.

### Negativas

- Conviven dos motores en la misma pantalla: métricas como la duración de la subida y la fatiga solo aparecen en los ejercicios del 3D.
- Los umbrales de la ola 1 siguen sin calibrar con personas (`DEC-057`); los errores de conteo se verán en producción, no solo en el preview.

## Referencias

- `DEC-056` (catálogo por olas y programa), `DEC-057` (motor 3D detrás del flag), `DEC-058` (pantalla de entrenamiento).
- `src/ui/workout/exercises.ts`, `src/ui/workout/WorkoutScreen.tsx`; issue #33.
