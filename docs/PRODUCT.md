# MovexNet — Producto

> Responsabilidad de este archivo: visión, alcance formal, fuera de alcance, modelo freemium y roadmap. Arquitectura en `ARCHITECTURE.md`; métricas en `METRICS.md`; entidades en `DOMAIN.md`; estado actual en `STATUS.md`.

## Visión

MovexNet convierte el celular en un entrenador que ve y entiende el movimiento. Cualquier persona con un smartphone obtiene, sin hardware adicional, conteo de repeticiones, corrección de técnica, medición de fatiga y progreso, y acceso a entrenadores reales que trabajan sobre datos objetivos en lugar de videos enviados por chat. El análisis de movimiento ocurre en el dispositivo (el video nunca sale de él); la nube guarda métricas, rutinas y relaciones, y un asistente de IA redacta coaching sobre esas métricas.

Origen: MVP del curso IA26 (UMG, mayo 2026) con tres ejercicios y análisis por reglas angulares. MovexNet amplía el alcance (`DEC-026`) manteniendo la PWA mobile-first, React + TypeScript + MediaPipe y la regla de privacidad.

Línea paralela: **fitnetv2** (`ecaldcc/07-FitNet`, desplegada en fitnetv2.netlify.app), del mismo grupo, aportó análisis 3D, validación temporal, fatiga, catálogo de 60 ejercicios, rutinas, modo manual, perfil con logros y visor 3D. Este repositorio es la base y fitnetv2 se integra por pasos (`DEC-054`); mientras tanto conviven ambas versiones desplegadas.

Nombre: el producto se llama MovexNet (`DEC-068`). Antes se llamaba Fitnet, que chocaba con la app de rutinas comercial fitnetapp.com; el diferenciador es el asistente en tiempo real (`DEC-056`).

## Alcance formal: 8 épicas

Cada épica se descompone en historias etiquetadas en GitHub. Los criterios de aceptación son de alto nivel; cada historia añade los suyos.

**Mapeo con las issues de GitHub** (etiqueta `epic`): el tablero corta el alcance en 10 épicas, separando lo que aquí va junto. E1 → [#1](https://github.com/govandoh/movexnet/issues/1); E2 → [#2](https://github.com/govandoh/movexnet/issues/2); E3 → [#3](https://github.com/govandoh/movexnet/issues/3); E4 (métodos de entrenamiento) → parte de [#3](https://github.com/govandoh/movexnet/issues/3); E5 → [#4](https://github.com/govandoh/movexnet/issues/4) (planes de entrenadores) y [#5](https://github.com/govandoh/movexnet/issues/5) (marketplace y coaching); E6 → [#6](https://github.com/govandoh/movexnet/issues/6); E7 (comunidad) → parte de [#6](https://github.com/govandoh/movexnet/issues/6); E8 → [#7](https://github.com/govandoh/movexnet/issues/7) (freemium) y [#8](https://github.com/govandoh/movexnet/issues/8) (fee de entrenadores). Las transversales son [#9](https://github.com/govandoh/movexnet/issues/9) (Núcleo de IA) y [#10](https://github.com/govandoh/movexnet/issues/10) (Plataforma y DevEx).

### E1. Perfiles de usuario

Cuenta, perfil (datos básicos, nivel, restricciones), objetivos (`Goal`) y logros (`Achievement`).

Criterios: registro e inicio de sesión con Supabase Auth; el perfil se edita desde la app y solo lo ve su dueño y sus entrenadores autorizados (RLS); los objetivos se pueden crear, cerrar y medir contra métricas de progreso (`METRICS.md` §6); el usuario puede exportar y borrar todos sus datos (`DATA-GOVERNANCE.md`).

### E2. Análisis de movimiento "3D": fatiga, patrones incorrectos, velocidad y consistencia

Ampliar el análisis actual (conteo + profundidad/extensión) con métricas por rep y por serie calculadas desde landmarks 3D, y detección de errores de forma por ejercicio.

Criterios: por cada rep se registran duración, ROM, velocidad concéntrica pico, tempo y `formScore` con códigos de error; por cada serie, pérdida de velocidad %, deriva de ROM, CV de tempo y asimetría; el conteo de reps no regresa (≥ 98 % sobre fixtures); el clasificador de ejercicio elimina el chip manual cuando supera ≥ 90 % LOSO; todo corre en el dispositivo con latencia p95 < 50 ms/frame. Definiciones y metas en `METRICS.md`; método en `ML-PIPELINE.md` y `DEC-027`.

### E3. Rutinas y calendario

Catálogo de ejercicios, rutinas con días y ejercicios (`Routine`, `RoutineDay`, `RoutineExercise`), calendario de sesiones planificadas y realizadas.

Criterios: el usuario crea o adopta una rutina, la ve en un calendario semanal y arranca la sesión del día desde ahí; la sesión guarda qué se hizo contra lo planificado (adherencia); funciona offline con cola de sincronización en `api-client`.

**Rutina personalizada (`DEC-056`).** Cuestionario libre de 4 pasos (objetivo, nivel, lugar y equipo, programa) que se guarda en `Profile`; un generador determinista por reglas (sin LLM) filtra el catálogo por etiquetas de equipo y lugar, elige la división por días y nivel, llena cada día por patrón de movimiento **prefiriendo ejercicios con asistente** y fija series, reps y descanso según el objetivo. El catálogo viene de fitnetv2 (60 ejercicios) con etiquetas de equipo, `locations`, `movementPattern` y `tracking` (`camera` se muestra como "con asistente"). El asistente crece por olas:

| Ola | Ejercicios con asistente |
|---|---|
| 0 (hoy) | sentadilla, curl de bíceps, press de hombro |
| 1 | flexiones, zancadas, puente de glúteo, plancha |
| 2 | peso muerto rumano, remo con mancuerna, elevaciones laterales, extensión sobre la cabeza, sentadilla goblet |
| 3 | peso muerto, hip thrust, sentadilla frontal |

### E4. Métodos de entrenamiento

Soporte explícito de rest-pause, dropset, división push/pull/legs y superset en la definición de rutinas y en la ejecución de la sesión (definiciones en `DOMAIN.md`).

Criterios: cada `RoutineExercise` declara su `TrainingMethod`; la pantalla de sesión guía los descansos y sub-series del método; las métricas de la serie respetan el método (una serie dropset se registra como una serie con sub-series).

### E5. Planes de entrenadores: marketplace y coaching 1:1 con asistente IA

Rol `Trainer` sobre usuario; planes (`Plan`) privados o publicados en un marketplace con precio; relación de coaching (`CoachingRelationship`) con hilo de mensajes donde participan entrenador, cliente y asistente.

Criterios: un entrenador publica un plan y un usuario lo adquiere e inscribe (`PlanEnrollment`); el entrenador ve las métricas de sus clientes (solo de ellos); el chat 1:1 es en tiempo real; el asistente (`CoachAssistant`, `DEC-033`) produce resúmenes de sesión y propuestas de ajuste que el entrenador revisa antes de que el cliente las vea; nunca da consejo médico.

### E6. Métricas, rankings y retos

Panel de progreso (volumen, 1RM estimado, adherencia, tendencia de forma), retos (`Challenge`) con entradas y rankings (`LeaderboardEntry`) por reto y globales.

Criterios: las métricas del panel coinciden con `METRICS.md`; los rankings se refrescan cada 5–15 min y la UI muestra la hora del último cálculo; las reglas anti-trampa quedan definidas antes de abrir rankings públicos (pendiente, ver `METRICS.md` §7).

### E7. Comunidad

Perfil público opcional, seguir a otros usuarios, compartir logros y retos.

Criterios: todo lo social es opt-in; por defecto nada del usuario es visible a terceros; moderación básica (reportar, bloquear).

### E8. Modelo freemium y pagos (simulados)

Suscripción premium para usuarios y fee mensual para entrenadores; entitlements derivados de la suscripción y aplicados en RLS (`DEC-029`).

**El cobro es simulado** (`DEC-035`): MovexNet es un proyecto de seminario y no factura. Se implementa el puerto `PaymentProvider` con `MockPaymentProvider`, que genera sesiones de checkout ficticias y permite forzar los estados de suscripción desde una pantalla de demostración. Todo lo demás se construye como en producción.

Criterios: el estado premium lo escribe únicamente el manejador de webhooks con clave de servicio; al vencer la suscripción las funciones premium se degradan sin perder datos; los pagos a entrenadores se registran en un ledger liquidable; la interfaz indica de forma inequívoca que el pago es simulado. Sustituir el proveedor simulado por uno real debe ser cambiar una implementación del puerto, nada más.

Épicas transversales (no funcionales): **Núcleo de IA** (pipeline de datos, modelos, gates; issue #9) y **Plataforma/DevEx** (monorepo, CI, quality gates, backend base, agentes; issue #10).

## Fuera de alcance

- **App nativa** (iOS/Android). MovexNet es una PWA; si alguna capacidad exige nativo se evalúa con DEC.
- **Procesamiento de video en servidor.** Ni para análisis ni para "segunda opinión": el video no sale del dispositivo. La única excepción prevista es una imagen clave por rep enviada bajo demanda explícita del usuario premium (`DEC-027`), y aun así nunca como fuente de métricas.
- Wearables y sensores externos.
- Nutrición y planes alimenticios.
- Cualquier funcionalidad que implique diagnóstico o consejo médico.

## Modelo freemium

| | Gratis | Premium (usuario) | Entrenador (fee mensual) |
|---|---|---|---|
| Análisis en tiempo real (conteo, técnica, voz) de los ejercicios disponibles | Sí | Sí | Sí |
| Historial de sesiones y métricas básicas | Limitado (últimas N sesiones) | Completo | Completo |
| Análisis avanzado (fatiga, consistencia, asimetría, tendencias) | No | Sí | Sí |
| Rutinas propias y las 3 plantillas de fitnetv2 | Sí (básico) | Sí | Sí |
| Cuestionario y semana 1 de la rutina generada (`DEC-056`) | Sí | Sí | Sí |
| Programa completo, calendario y progresión automática (`DEC-056`) | No | Sí | Sí |
| Métodos de entrenamiento guiados | Limitado | Sí | Sí |
| Retos y rankings | Participar | Participar + crear retos privados | Crear retos para clientes |
| Coaching 1:1 y resúmenes del asistente IA | No | Con un entrenador contratado | Herramientas de coaching, digest semanal, panel de clientes |
| Publicar planes en el marketplace | No | No | Sí (comisión por venta, pendiente de definir) |
| Segunda opinión por imagen clave (`DEC-027`) | No | Sí, bajo demanda y con tope mensual | — |

Los precios y la forma de la cuota de entrenador dejan de ser pendientes de implementación y pasan a ser **variables del análisis de rentabilidad** (`DEC-035` §4): alimentan el cálculo de margen por usuario y del punto de equilibrio. Sigue pendiente el tope de costo del asistente de IA por usuario premium al mes, que sí es una restricción técnica real porque el proyecto opera con planes gratuitos.

## Naturaleza del proyecto y análisis de negocio

MovexNet es un **proyecto de seminario universitario**. Ninguna versión sale a la venta, no hay clientes y no se factura (`DEC-035`). El modelo de negocio existe como objeto de estudio, y el trabajo incluye un análisis formal de mercado, costos, rentabilidad y proyección, que vive **fuera de este repositorio**.

El repositorio le aporta los insumos técnicos verificables:

| Insumo | De dónde sale |
|---|---|
| Escalones de precio y umbrales de migración de cada proveedor | `DEC-029` (backend y hosting) |
| Comisión del proveedor de pagos que se habría elegido | `DEC-030`, ahora estudio comparativo |
| Costo del asistente de IA por usuario según volumen de llamadas | `DEC-033` y el registro de uso de la Edge Function |
| Costo de comercializar el núcleo de IA | `DEC-034` nota posterior: lo que costaría reemplazar los pesos académicos por un modelo propio entrenado desde cero |
| Costo de cómputo del entrenamiento | `ML-PIPELINE.md` §6, horas de GPU consumidas |

## Roadmap por fases

| Fase | Contenido | Épicas | Referencia técnica |
|---|---|---|---|
| **1. Núcleo de IA + plataforma** | Tooling y CI, fixtures y golden, contratos, pipeline sin React, monorepo; motor 3D de fitnetv2 (pasos I-1 a I-3 de `DEC-054`); datos propios con etiqueta por guion y k-NN de posturas (`DEC-055`) en modo sombra; métricas de fatiga por reglas. | E2, Núcleo IA, Plataforma | PR 0–10 de `ARCHITECTURE.md` §2.4 |
| **2. Perfiles, rutinas, calendario** | Supabase (auth, esquema, RLS), sincronización de sesiones con cola offline, perfiles y objetivos, catálogo y rutinas de fitnetv2 (paso I-4), cuestionario y generador de rutinas (paso I-5, `DEC-056`), métodos, calendario. | E1, E3, E4 | PR 11+, `DEC-029`, `DEC-054` |
| **3. Entrenadores, marketplace, coaching** | Rol entrenador, planes, marketplace, relación de coaching, chat en tiempo real, Edge Function `coach` con Claude, digest semanal. | E5, E6 (panel y retos) | `DEC-033` |
| **4. Comunidad y pagos simulados** | Rankings públicos con anti-trampa, comunidad opt-in, puerto `PaymentProvider` con proveedor simulado, entitlements y ledger de liquidaciones. El hosting se queda en Vercel Hobby. | E6 (rankings), E7, E8 | `DEC-035`, `DEC-030` como estudio |

Cada fase produce releases desplegables; la app actual (3 ejercicios) sigue en producción durante toda la Fase 1.
