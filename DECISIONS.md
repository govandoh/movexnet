# Decisiones técnicas — índice

Las decisiones viven en **`docs/adr/`** en formato MADR, una por archivo. Este archivo se conserva porque el código y el historial de commits citan `DECISIONS.md` y los identificadores `DEC-NNN`; los identificadores no cambian.

- Cómo proponer una decisión, plantilla y reglas de aprobación: [`docs/adr/README.md`](docs/adr/README.md).
- Plantilla: [`docs/adr/TEMPLATE.md`](docs/adr/TEMPLATE.md).

| Rango | Origen | Enlace |
|---|---|---|
| DEC-001 … DEC-025 | MVP académico IA26 (abril–mayo 2026), migradas 1:1 | [`docs/adr/`](docs/adr/README.md#índice) |
| DEC-026 … DEC-033 | Fundación de Fitnet (2026-09-19) | [`docs/adr/`](docs/adr/README.md#índice) |

Acceso rápido a las más citadas desde el código:

| DEC | Tema | Archivo |
|---|---|---|
| DEC-009 | `calculateAngle` con `atan2` y `Point2D` | [docs/adr/DEC-009-angulos-atan2-point2d.md](docs/adr/DEC-009-angulos-atan2-point2d.md) |
| DEC-010 | Histéresis de umbral doble (sentadilla) | [docs/adr/DEC-010-sentadilla-histeresis-umbral-doble.md](docs/adr/DEC-010-sentadilla-histeresis-umbral-doble.md) |
| DEC-016 | Feedback de voz: confirmación por frames, sin colisiones | [docs/adr/DEC-016-feedback-voz-confirmacion-frames-prioridad.md](docs/adr/DEC-016-feedback-voz-confirmacion-frames-prioridad.md) |
| DEC-017 | Gate de conteo por confirmación de cima/fondo | [docs/adr/DEC-017-conteo-reps-gate-confirmacion.md](docs/adr/DEC-017-conteo-reps-gate-confirmacion.md) |
| DEC-021 | Delay de 450 ms al cambiar de cámara | [docs/adr/DEC-021-delay-450ms-cambio-camara.md](docs/adr/DEC-021-delay-450ms-cambio-camara.md) |
| DEC-022 / DEC-023 | Conteo unificado con cooldown (curl / press) | [DEC-022](docs/adr/DEC-022-curl-conteo-unificado-cooldown.md), [DEC-023](docs/adr/DEC-023-press-conteo-unificado-cooldown.md) |
| DEC-025 | Service Worker network-first para HTML | [docs/adr/DEC-025-service-worker-network-first.md](docs/adr/DEC-025-service-worker-network-first.md) |
| DEC-027 | Arquitectura híbrida de IA | [docs/adr/DEC-027-arquitectura-hibrida-ia.md](docs/adr/DEC-027-arquitectura-hibrida-ia.md) |
| DEC-028 | Monorepo pnpm y fronteras de paquetes | [docs/adr/DEC-028-monorepo-pnpm-fronteras-paquetes.md](docs/adr/DEC-028-monorepo-pnpm-fronteras-paquetes.md) |
| DEC-034 | Vía de implementación del análisis por IA (propuesta) | [docs/adr/DEC-034-via-implementacion-analisis-ia.md](docs/adr/DEC-034-via-implementacion-analisis-ia.md) |
| DEC-035 | Proyecto académico: sin facturación real, pagos simulados | [docs/adr/DEC-035-proyecto-academico-sin-facturacion-real.md](docs/adr/DEC-035-proyecto-academico-sin-facturacion-real.md) |
| DEC-036 | Migración del análisis a 3D con `worldLandmarks` (fitnetv2 DEC-026) | [docs/adr/DEC-036-analisis-3d-world-landmarks.md](docs/adr/DEC-036-analisis-3d-world-landmarks.md) |
| DEC-037 | Validación temporal de repeticiones (fitnetv2 DEC-027) | [docs/adr/DEC-037-validacion-temporal-repeticiones.md](docs/adr/DEC-037-validacion-temporal-repeticiones.md) |
| DEC-038 | Detección de fatiga por degradación del patrón de movimiento (fitnetv2 DEC-028) | [docs/adr/DEC-038-fatiga-degradacion-movimiento.md](docs/adr/DEC-038-fatiga-degradacion-movimiento.md) |
| DEC-039 | Visor 3D del esqueleto con Three.js (fitnetv2 DEC-029) | [docs/adr/DEC-039-visor-3d-threejs.md](docs/adr/DEC-039-visor-3d-threejs.md) |
| DEC-040 | Catálogo de ejercicios y modelo de rutinas (fitnetv2 DEC-030) | [docs/adr/DEC-040-catalogo-ejercicios-modelo-rutinas.md](docs/adr/DEC-040-catalogo-ejercicios-modelo-rutinas.md) |
| DEC-041 | Perfil, progreso y logros derivados del historial (fitnetv2 DEC-031) | [docs/adr/DEC-041-perfil-progreso-logros-derivados.md](docs/adr/DEC-041-perfil-progreso-logros-derivados.md) |
| DEC-042 | Navegación: HashRouter y contexto de React (fitnetv2 DEC-032) | [docs/adr/DEC-042-navegacion-hashrouter-contexto.md](docs/adr/DEC-042-navegacion-hashrouter-contexto.md) |
| DEC-043 | Tutorial de técnica por ejercicio (fitnetv2 DEC-033) | [docs/adr/DEC-043-tutorial-tecnica-por-ejercicio.md](docs/adr/DEC-043-tutorial-tecnica-por-ejercicio.md) |
| DEC-044 | Sentadilla: confirmación del fondo independiente de la velocidad de cuadros (fitnetv2 DEC-034) | [docs/adr/DEC-044-sentadilla-fondo-independiente-fps.md](docs/adr/DEC-044-sentadilla-fondo-independiente-fps.md) |
| DEC-045 | Analizador de movimiento: histéresis, forma del ciclo y fase de esfuerzo mínima (fitnetv2 DEC-035) | [docs/adr/DEC-045-analizador-histeresis-forma-ciclo.md](docs/adr/DEC-045-analizador-histeresis-forma-ciclo.md) |
| DEC-046 | Filtro One Euro sobre los landmarks (fitnetv2 DEC-036) | [docs/adr/DEC-046-filtro-one-euro-landmarks.md](docs/adr/DEC-046-filtro-one-euro-landmarks.md) |
| DEC-047 | Modo manual para los ejercicios sin cámara (fitnetv2 DEC-037) | [docs/adr/DEC-047-modo-manual-sin-camara.md](docs/adr/DEC-047-modo-manual-sin-camara.md) |
| DEC-048 | Banco de pruebas del motor sin cámara (fitnetv2 DEC-038) | [docs/adr/DEC-048-banco-pruebas-motor-sin-camara.md](docs/adr/DEC-048-banco-pruebas-motor-sin-camara.md) |
| DEC-049 | Registro de la interfaz: tuteo (fitnetv2 DEC-039) | [docs/adr/DEC-049-registro-interfaz-tuteo.md](docs/adr/DEC-049-registro-interfaz-tuteo.md) |
| DEC-050 | Nivelación con el acelerómetro y partes del cuerpo estimadas (fitnetv2 DEC-040) | [docs/adr/DEC-050-nivelacion-acelerometro.md](docs/adr/DEC-050-nivelacion-acelerometro.md) |
| DEC-051 | Íconos en lugar de emojis (fitnetv2 DEC-041) | [docs/adr/DEC-051-iconos-sin-emojis.md](docs/adr/DEC-051-iconos-sin-emojis.md) |
| DEC-052 | Editor de rutinas con guardado explícito (fitnetv2 DEC-042) | [docs/adr/DEC-052-editor-rutinas-guardado-explicito.md](docs/adr/DEC-052-editor-rutinas-guardado-explicito.md) |
| DEC-053 | Calibración de la vertical con la postura de pie (fitnetv2 DEC-043) | [docs/adr/DEC-053-calibracion-vertical-postura-pie.md](docs/adr/DEC-053-calibracion-vertical-postura-pie.md) |
| DEC-054 | Integración de fitnetv2 por pasos y por workstream (tabla de equivalencias de numeración) | [docs/adr/DEC-054-integracion-fitnetv2.md](docs/adr/DEC-054-integracion-fitnetv2.md) |
| DEC-055 | Núcleo de IA: k-NN/MLP en TypeScript sobre landmarks, datos propios con etiqueta por guion, preentrenado como experimento de 3 días | [docs/adr/DEC-055-clasificador-ligero-datos-por-guion.md](docs/adr/DEC-055-clasificador-ligero-datos-por-guion.md) |
| DEC-056 | Rutina personalizada: cuestionario libre, generador por reglas, catálogo por olas, paywall en el programa completo | [docs/adr/DEC-056-rutina-personalizada-catalogo-paywall.md](docs/adr/DEC-056-rutina-personalizada-catalogo-paywall.md) |
| DEC-057 | Motor de conteo 3D configurable por ejercicio, activable con `?engine=3d` | [docs/adr/DEC-057-motor-3d-configurable-flag.md](docs/adr/DEC-057-motor-3d-configurable-flag.md) |
| DEC-058 | Identidad visual "la red de 33 puntos", sistema de movimiento y skills de animación | [docs/adr/DEC-058-identidad-visual-movimiento.md](docs/adr/DEC-058-identidad-visual-movimiento.md) |
| DEC-059 | La ola 1 del asistente usa el motor 3D sin flag; sentadilla, curl y press siguen en 2D | [docs/adr/DEC-059-ola1-motor3d-sin-flag.md](docs/adr/DEC-059-ola1-motor3d-sin-flag.md) |
| DEC-060 | Responsive y áreas seguras como regla de diseño y funcionalidad | [docs/adr/DEC-060-responsive-areas-seguras.md](docs/adr/DEC-060-responsive-areas-seguras.md) |
| DEC-061 | Ficha de técnica con modelo 3D, mini mapa arrastrable y preferencias de vista | [docs/adr/DEC-061-tecnica-3d-y-mini-mapa.md](docs/adr/DEC-061-tecnica-3d-y-mini-mapa.md) |
| DEC-064 | Un consentimiento de grabación vale para una sola grabación | [docs/adr/DEC-064-consentimiento-una-grabacion.md](docs/adr/DEC-064-consentimiento-una-grabacion.md) |
| DEC-065 | Datasets externos: licencias de MM-Fit corregidas y alcance solo académico (propuesta) | [docs/adr/DEC-065-datasets-externos-alcance-academico.md](docs/adr/DEC-065-datasets-externos-alcance-academico.md) |
| DEC-069 | Cuentas con Supabase Auth: correo y contraseña, Brevo, Turnstile y puerta 18+ en el servidor (propuesta) | [docs/adr/DEC-069-cuentas-supabase-auth.md](docs/adr/DEC-069-cuentas-supabase-auth.md) |
| DEC-073 | Curl y press en el motor 3D: umbrales calibrados con grabaciones reales (propuesta) | [docs/adr/DEC-073-calibracion-brazos-3d.md](docs/adr/DEC-073-calibracion-brazos-3d.md) |
| DEC-074 | Anti-trampa v1.1: series de cámara sin duración, día en hora de Guatemala y solapamiento en las dos sesiones (propuesta) | [docs/adr/DEC-074-antitrampa-v1-1.md](docs/adr/DEC-074-antitrampa-v1-1.md) |

No agregar decisiones nuevas a este archivo: crear `docs/adr/DEC-NNN-*.md` y actualizar el índice de `docs/adr/README.md`.
