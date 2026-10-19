---
name: adr
description: Crear una ADR (Architecture Decision Record) en formato MADR a partir de la decisión discutida en la conversación. Asigna el siguiente número DEC-NNN, crea `docs/adr/DEC-NNN-<slug>.md` desde la plantilla, actualiza el índice y propone el commit en una rama `adr/*`. Úsala cuando el equipo diga "esto hay que documentarlo", cuando `architect-guardian` proponga una ADR, o antes de tocar `packages/contracts/**`, `models/manifest.json` o snapshots golden.
---

# /adr — crear una decisión de arquitectura

Se recomienda delegar la redacción al agente `adr-scribe`; estos son los pasos que debe seguir.

## 1. Recoger la decisión de la conversación
Extraer y confirmar con el usuario, en una sola pregunta si falta algo:
- **Contexto y problema**: qué obligó a decidir (síntoma, restricción, oportunidad).
- **Opciones consideradas**: mínimo dos, con su pro/contra principal.
- **Decisión**: una frase en voz activa ("Usamos X para Y").
- **Consecuencias**: positivas, negativas, riesgos; qué paquetes, contratos o golden afecta.
- **Enlaces**: PR/issue, DEC relacionadas o superadas, docs que hay que actualizar.

Si la conversación mezcla dos decisiones, crear dos ADR.

## 2. Asignar el número
1. Leer `docs/adr/README.md`; tomar el mayor `DEC-NNN` del índice.
2. Verificar con Glob `docs/adr/DEC-*.md` que no exista un archivo con número mayor sin indexar.
3. Siguiente número = mayor + 1, con tres dígitos (`DEC-034`). Nunca reutilizar ni saltar.

## 3. Crear el archivo
- Ruta: `docs/adr/DEC-NNN-<slug>.md`; slug en kebab-case, sin acentos, ≤ 6 palabras.
- Copiar `docs/adr/TEMPLATE.md` y rellenar las secciones MADR:
  `Estado`, `Fecha`, `Contexto y problema`, `Factores de decisión`, `Opciones consideradas`,
  `Decisión`, `Consecuencias`, `Enlaces`.
- Estado inicial: `propuesta` (pasa a `aceptada` en la revisión de arquitectura del sprint).
- Si supera una DEC anterior: editar solo la línea `Estado` de la vieja → `superada por DEC-NNN`.

## 4. Actualizar índices
- Añadir fila en `docs/adr/README.md`: `| DEC-NNN | [título](DEC-NNN-slug.md) | estado | fecha |`.
- Añadir entrada breve enlazada en `DECISIONS.md` (índice legado; no reescribir DEC-001..025).

## 5. Proponer commit y rama
```
git switch -c adr/<slug>
git add docs/adr/DEC-NNN-<slug>.md docs/adr/README.md DECISIONS.md
git commit -m "docs(adr): DEC-NNN <título corto>"
```
Mostrar el comando al usuario; no ejecutarlo sin confirmación. Recordar que el PR necesita
revisión de los leads B, D y E solo como recomendación; mergea el responsable (`DEC-070`).

## Salida esperada
- Ruta del archivo creado y su número.
- Diff resumido de los índices.
- Comando de commit propuesto.
- Lista de docs/paquetes que deben actualizarse como consecuencia (para `docs-keeper`).
