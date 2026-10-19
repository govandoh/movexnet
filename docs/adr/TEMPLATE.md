# DEC-NNN · Título corto de la decisión

- **Estado:** Propuesta | Aceptada | Rechazada | Reemplazada por DEC-MMM | Obsoleta
- **Fecha:** AAAA-MM-DD
- **Decisores:** roles o workstreams que aprueban (ver `docs/WORKSTREAMS.md`)
- **Etiquetas:** área afectada (`pose-engine`, `analysis-core`, `backend`, `proceso`, ...)

## Contexto y problema

Qué situación obliga a decidir. Hechos verificables (rutas de archivo, cifras, errores observados), no opiniones. Si la decisión cierra un pendiente anterior, enlazarlo.

## Opciones consideradas

1. **Opción A** — qué es, ventajas, desventajas.
2. **Opción B** — ...
3. **Opción C** — ...

Incluir siempre la opción elegida y al menos una alternativa real que se haya descartado.

## Decisión

Qué se decide, en una o dos frases, seguido del detalle técnico necesario para implementarla (parámetros, nombres, umbrales, rutas). Si hay un patrón que otros deben seguir, enunciarlo explícitamente.

## Consecuencias

### Positivas

- Qué mejora o qué riesgo se elimina.

### Negativas

- Qué se pierde, qué deuda se asume, qué habrá que revisar y cuándo.

## Referencias

- Enlaces a documentación externa, issues, PRs, otras DEC relacionadas (`DEC-016`), archivos del repo (`src/exercises/squat.ts`).

---

Convenciones:

- Nombre de archivo: `DEC-NNN-slug-corto-en-kebab-case.md` dentro de `docs/adr/`.
- Una ADR se escribe una vez y no se reescribe: si la decisión cambia, se crea una nueva DEC y la anterior pasa a `Reemplazada por DEC-MMM`.
- El estado `Aceptada` solo se asigna al hacer merge de la rama `adr/*` (`DEC-070`).
