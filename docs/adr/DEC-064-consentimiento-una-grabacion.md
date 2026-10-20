# DEC-064 · Un consentimiento de grabación vale para una sola grabación

- **Estado:** Aceptada (2026-10-20, por el responsable del proyecto; requisito para activar las cuentas, DEC-069)
- **Fecha:** 2026-10-10
- **Decisores:** Workstream D (@govandoh); revisan B y E (`docs/adr/README.md`)
- **Etiquetas:** `backend`, `datos`, `privacidad`

## Contexto y problema

`docs/DATA-GOVERNANCE.md` §2 exige consentimiento "explícito y separado por grabación". `docs/DOMAIN.md` define la relación `RecordingConsent 1—* Recording`, es decir, un consentimiento puede respaldar varias grabaciones. Ambas fuentes se contradicen.

`architect-guardian` lo detectó al revisar las políticas RLS del esquema inicial (`supabase/migrations/20261010000000_core_schema.sql`, issue #17): sin una restricción en `public.recordings`, un único consentimiento vigente servía para N grabaciones, lo que incumple §2.

## Factores de decisión

- Cumplir el texto de `docs/DATA-GOVERNANCE.md` §2 sin reinterpretarlo.
- Los datos son de salud y de movimiento corporal: se prefiere la opción más protectora.
- Reversibilidad: relajar una restricción `unique` en una migración es simple; endurecerla con datos ya guardados exige resolver filas que la violan.
- Fricción al grabar varias series seguidas.

## Opciones consideradas

1. **A. Relación 1—1 con `unique (consent_id)` en `public.recordings`** — cada consentimiento respalda exactamente una grabación. Pro: cumple §2 y es la más protectora; relajarla a 1—* después es una migración simple. Contra: el usuario confirma un consentimiento por cada grabación.
2. **B. Relación 1—* con un consentimiento por sesión de captura** — Pro: menos fricción al grabar varias series seguidas. Contra: contradice §2 y obliga a definir qué es una "sesión de captura" (duración, cambio de ejercicio, cierre de la pantalla).
3. **C. Relación 1—* sin más (estado actual de `docs/DOMAIN.md`)** — descartada: incumple §2, porque un consentimiento serviría para grabaciones que el usuario no autorizó una a una.

## Decisión

Se adopta la opción A: un `RecordingConsent` vale para exactamente una `Recording`. Se aplica con una restricción `unique` sobre `consent_id` en `public.recordings` (`supabase/migrations/20261010000000_core_schema.sql`).

Se elige A porque es la más protectora para datos de salud y es la única reversible sin migrar datos: pasar de 1—1 a 1—* solo exige quitar la restricción, mientras que endurecer 1—* a 1—1 con grabaciones ya guardadas obligaría a decidir qué hacer con los consentimientos compartidos.

## Consecuencias

### Positivas

- El esquema cumple `docs/DATA-GOVERNANCE.md` §2 por construcción, no solo por convención de la app.
- Revocar un consentimiento afecta a una sola grabación y la vence en ese instante: un trigger fija `retention_until = now()` (migración `20261013000000_revocacion_y_ajustes.sql`), de modo que el job nocturno de purga y la exportación para ML, que filtran por `retention_until`, la excluyen sin lógica adicional.
- Cada consentimiento revocado queda inmutable (trigger en la migración 0100).

### Negativas

- La pantalla de captura (workstream A/E, PR 8) debe pedir un consentimiento nuevo por cada grabación; más pasos al grabar varias series seguidas.
- `docs/DOMAIN.md` debe pasar la relación a `RecordingConsent 1—1 Recording` (lo edita el líder de D).
- Si más adelante se quiere la opción B, se necesita una DEC nueva que supere a esta y una migración que quite la restricción.

### Riesgos

- Alcance: afecta a `supabase/migrations`, `docs/DOMAIN.md` y la futura pantalla de captura. No toca `packages/contracts`, `models/manifest.json` ni los snapshots golden.

## Referencias

- Issue #17 (esquema inicial de Supabase).
- `docs/DATA-GOVERNANCE.md` §2 (consentimiento explícito y separado por grabación).
- `docs/DOMAIN.md` (relación `RecordingConsent`—`Recording`, por actualizar).
- `supabase/migrations/20261010000000_core_schema.sql`.
- `DEC-029` (Supabase como backend). `DEC-035` (cero costo): referenciada, no aplica a esta decisión.
- El número es provisional hasta el merge: si ya existe en `main`, renumera quien mergea segundo.
