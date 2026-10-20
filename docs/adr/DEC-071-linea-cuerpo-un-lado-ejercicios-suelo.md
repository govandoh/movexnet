# DEC-071 · Línea del cuerpo con el lado más visible y ejercicios de suelo sin esperar la calibración de pie

- **Estado:** Propuesta
- **Fecha:** 2026-10-20
- **Decisores:** lead del workstream B (Análisis & Runtime); revisión de E por `src/ui/workout/WorkoutScreen.tsx`
- **Etiquetas:** `analysis-core`, `umbrales`, `tecnica`

## Contexto y problema

En la revisión del PR #56, @govandoh notó que en flexiones y plancha la app no detecta bien la cadera caída o levantada (#59). @christian15alda-netizen grabó 11 tomas con dos personas (iPhone, de perfil): plancha y flexiones correctas, con la cadera caída (`hip_sag`) y con la cadera arriba (`hip_pike`). Reproducidas con el pipeline de la app:
- la cadera caída **no se detectaba nunca** (0% de los cuadros);
- en la plancha el tiempo corría durante la cadera caída;
- y la sospecha era que el suavizado o la calibración de pie la "borraban".

Analizamos las tomas etapa por etapa (`grabaciones.local/`, sin versionar), más las 3 tomas de flexiones de @ecaldcc de #49:

1. **El suavizado y la calibración de pie no borran nada.** La línea del cuerpo queda casi igual antes y después de cada etapa. La calibración no aprende acostada (su tope de 35° lo impide); las correcciones fueron de 4–15° y se aprendieron de pie.
2. **La causa real: se exigía ver los dos lados del cuerpo.** `bodyLine` usaba los puntos medios de hombros, cadera y tobillos, y la plancha pedía los 6 puntos visibles. De perfil el lado lejano suele estar tapado:
   - en las tomas de cadera caída solo el 13–34% de los cuadros se podían evaluar;
   - al promediar con el lado tapado, la línea "se enderezaba";
   - en la plancha la app no veía a la persona y frenaba el tiempo (3% de la sesión en una toma).
3. **Con un solo lado aparece un error geométrico.** El ancho de los hombros frente a la cadera tuerce la línea hacia un costado: en una demo perfectamente recta, el ángulo 3D completo da −9°. Medido en el plano vertical que contiene la recta hombro-tobillo, da −0,2°.
4. **En las flexiones, los avisos falsos salen arriba, entre repeticiones.** En las flexiones correctas de @ecaldcc, "cadera arriba" aparecía en el 25–36% de los cuadros. Durante la flexión la línea está recta (mediana −1° a −3°); los avisos salen arriba, cuando la persona descansa con la cadera alta.
5. **Los ejercicios de suelo no arrancaban solos (#39).** La preparación esperaba la calibración de pie, que no se completa si la persona ya está en el suelo.
6. **Ninguna grabación de #59 tiene el acelerómetro** (en iPhone no se tocó "Nivelar"). No es la causa: la plancha igual se reconoce como horizontal en el 85–91% de los cuadros.

## Factores de decisión

- Detectar la cadera caída y levantada de perfil, que es la vista que recomiendan las fichas.
- No dar avisos falsos con el cuerpo recto.
- Que el tiempo de la plancha no se frene por un lado tapado.
- Cambios pequeños, con datos de al menos dos personas.

## Opciones consideradas

1. **Solo bajar el umbral de 20°, con los dos lados.** No sirve: el problema es que la mayoría de los cuadros no se evaluaban y que el promedio enderezaba la línea.
2. **Lado más visible con el ángulo 3D completo.** Detecta mucho mejor, pero arrastra el error lateral de ~9°: una plancha recta parecería algo levantada y obliga a umbrales artificiales.
3. **Lado más visible, medido en el plano vertical de la recta, con umbral asimétrico** (elegida).
4. **Un modelo (k-NN de DEC-055 o el clasificador de #36).** Queda como evolución: hacen falta más grabaciones etiquetadas.

## Decisión

**Línea del cuerpo** (`bodyLine` y `hipIssue` en `src/exercises/definitions3d.ts`):
- se usa el lado más visible (hombro, cadera y tobillo); basta con que ese lado se vea;
- el ángulo se mide en el plano vertical que contiene la recta hombro-tobillo, con desviación con signo: positiva = cadera abajo, negativa = arriba;
- **cadera caída** con una desviación de **8°** o más (`HIP_SAG_MIN_DEG`), y **cadera arriba** con **18°** o más (`HIP_PIKE_MIN_DEG`). Reemplazan a `PUSHUP_MIN_BODY_LINE_DEG` (20° en los dos sentidos). La caída es más sutil que la levantada: con el cuerpo recto la desviación queda entre −5° y +4°.

**Plancha** (`plankTracker.ts`): pide ver un lado. La inclinación (`MIN_HORIZONTAL_DEG`, 55°) se mide con la recta hombro-tobillo de ese lado.

**Flexiones:** la cadera se revisa solo durante la flexión (fase de esfuerzo), no arriba entre repeticiones.

**Ejercicios de suelo** (flexiones, puente, plancha): la preparación no espera la calibración de pie (`needsStandingCalibration`) y arranca con el celular nivelado y el cuerpo en cuadro. La calibración sigue aprendiendo si la persona se para frente a la cámara antes de bajar.

**Resultado con las grabaciones** (porcentaje de cuadros):

| Toma | Antes | Ahora |
|---|---|---|
| Plancha correcta, personas 1 y 2: el tiempo corre | 87% y 68% | 89% y 76%, sin avisos (0–4%) |
| Plancha con cadera caída, personas 1 y 2 | aviso 0% y 0%; el tiempo corría | aviso 52% y 58%; el tiempo se pausa |
| Plancha con cadera arriba, personas 1 y 2 | 50% y 54% | 83% y 60% |
| Flexiones correctas (@ecaldcc, 3 tomas), durante la flexión | — | "arriba" 0–1%, "caída" 0–2% |
| Flexiones correctas (persona 1), durante la flexión | — | "arriba" 0%, "caída" 3% |
| Flexiones con cadera arriba (persona 1), durante la flexión | — | 48%; las 3 repeticiones contadas quedan marcadas |
| Flexiones con cadera caída, personas 1 y 2, durante la flexión | ~0% | 48% y 100% |

**Pruebas:**
- `wave1.test.ts`:
  - la línea recta mide ~180° con un lado;
  - una caída leve de 6 cm (~10°) avisa;
  - con el lado lejano tapado se sigue evaluando;
  - arriba, descansando con la cadera alta, no avisa;
  - una cadera apenas levantada (~−10°) no avisa.
- `plankTracker.test.ts`: con el lado lejano tapado el tiempo corre y se detecta una caída leve.
- `definitions3d.test.ts`: qué ejercicios esperan la calibración de pie.

Las 5 pruebas nuevas fallan con el código anterior.

## Consecuencias

### Positivas

- La cadera caída se detecta en flexiones y plancha de perfil, y la plancha deja de contar tiempo con la cadera caída.
- El tiempo de la plancha no se frena porque el lado lejano esté tapado.
- Desaparecen los avisos de cadera mientras se descansa arriba en las flexiones.
- Flexiones, puente y plancha arrancan solos aunque la persona ya esté en el suelo (#39).
- El HUD de la plancha ("Línea") muestra el ángulo en el plano vertical: ~180° con el cuerpo recto.

### Negativas

- **Datos de dos personas, con el mismo modelo de celular y sin acelerómetro** (más las tomas de @ecaldcc). Hay que validar en vivo y con más personas (#16).
- **Una flexión con la cadera tan arriba que nunca baja lo suficiente** no se cuenta y tampoco recibe aviso de cadera, porque solo se revisa durante la flexión. Si el equipo quiere avisar también arriba, hará falta un umbral aparte para el descanso.
- **Avisos sueltos:** en flexiones correctas, 1–2 repeticiones por serie muestran un aviso breve de cadera en algún cuadro. El resumen de la serie solo cuenta el aviso del fondo de la repetición, donde casi no aparecen.
- **Quedan pendientes dos decisiones de producto (#59):** si los avisos de técnica de las flexiones van por voz, y si una repetición con mala técnica debe contar.

## Referencias

- Issues #59 (cadera en flexiones y plancha), #39 (ola 1), #49 (grabaciones de @ecaldcc), #16 (más personas).
- `DEC-050` (nivelación), `DEC-053` (calibración de pie), `DEC-055` (k-NN), `DEC-066` (umbrales de reposo).
- `src/exercises/definitions3d.ts`, `src/exercises/plankTracker.ts`, `src/ui/workout/WorkoutScreen.tsx` y sus pruebas.
