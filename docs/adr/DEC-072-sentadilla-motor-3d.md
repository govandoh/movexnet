# DEC-072 · La sentadilla pasa al motor 3D por defecto

- **Estado:** Propuesta
- **Fecha:** 2026-10-20
- **Decisores:** lead del workstream B (Análisis & Runtime); revisión de E por `src/ui/workout/exercises.ts`
- **Etiquetas:** `analysis-core`, `ui`, `producto`
- **Reemplaza en parte a:** DEC-059 (la sentadilla ya no sigue en 2D)

## Contexto y problema

DEC-059 dejó la sentadilla, el curl y el press en el motor 2D de producción hasta que el motor 3D se validara en celular (#33). La sentadilla ya cumple esa condición. El curl y el press no (#58).

**La sentadilla 3D está validada:**
- **Grabaciones de #49** (iPhone 17 Pro Max, de perfil): con los umbrales de DEC-066 cuenta 10 de 10 y 12 de 12, **sin ningún aviso de técnica falso** (`trunk_lean`, `asymmetry`) en las 22 repeticiones.
- **En vivo:** @ecaldcc en su iPhone (con otra persona, al cerrar #39) y @govandoh en un Samsung S24 Ultra contaron 5 de 5 (revisión del #56).

**El motor 2D tiene un defecto que se ve en producción.** En #49, la sentadilla 2D pedía "Baja un poco más" estando abajo. El 2D calcula los ángulos sobre la imagen sin corregir su proporción (ancho y alto), así que se deforman según cómo esté la cámara. Corregirlo cambiaría los golden del PR 1, y el plan de #33 es retirar el 2D, no repararlo.

## Opciones consideradas

1. **Esperar a que curl y press estén listos (#58) para pasar los tres juntos**, como pedía #33. Contra: la sentadilla seguiría con el defecto del 2D, que ya tiene arreglo.
2. **Pasar la sentadilla ahora y dejar curl y press en 2D** (elegida).
3. **Pasar los tres ahora.** Descartada: el curl 3D no cuenta (el 3D no ve el curl completo) y el press contó repeticiones a medias (#58).

## Decisión

La sentadilla usa el motor 3D por defecto (`usesEngine3D` en `src/ui/workout/exercises.ts`). Curl y press siguen en 2D, con `?engine=3d` para probarlos, hasta resolver #58.

- **Respaldo:** `?engine=2d` en la URL devuelve la sentadilla, el curl y el press al motor 2D, por si el 3D falla en algún celular. La ola 1 no tiene versión 2D y sigue en 3D. Es el mismo respaldo que tendrán curl y press al pasar al 3D por defecto (#58).

- **Se mantienen:** el código 2D de la sentadilla (`src/exercises/squat.ts`), sus golden del PR 1 y el adaptador `squat2D`. Siguen documentando el comportamiento congelado y sirven a las pruebas del contrato (DEC-063). Se retiran con el curl y el press al completar #33.
- **Cambios para quien entrena sentadillas:**
  - la preparación pide la calibración de pie (DEC-053) y nivelar el celular;
  - la serie muestra la velocidad de subida, la fatiga y los motivos de repeticiones descartadas;
  - aparecen los avisos de técnica del 3D (tronco inclinado, asimetría);
  - las frases de la voz y del fondo de la repetición no cambian (DEC-016).

## Consecuencias

### Positivas

- Desaparece en la sentadilla el defecto del 2D ("Baja un poco más" estando abajo).
- La sentadilla gana métricas (velocidad, fatiga, repeticiones descartadas) y avisos de técnica que el 2D no tenía.
- #33 queda resuelta para la sentadilla; lo pendiente se limita a curl y press (#58) y a retirar el 2D.

### Negativas

- **Datos de pocas personas:** dos en vivo y una en grabaciones. Hay que vigilar los avisos de técnica con más personas (#16).
- **El motor 3D exige más al celular** que el 2D (suavizado, nivelación y calibración). En gama baja falta medir los fps (pendiente desde DEC-061).
- **Conviven dos motores** hasta que curl y press pasen al 3D.

## Referencias

- Issues #33 (motor 3D por defecto), #49 (prueba en celular), #58 (curl y press en 3D), #39 (ola 1, validación con otra persona).
- `DEC-016`, `DEC-053`, `DEC-057`, `DEC-059`, `DEC-063`, `DEC-066`.
- `src/ui/workout/exercises.ts`, `src/ui/engineFlag.ts`.
