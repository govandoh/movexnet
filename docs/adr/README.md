# Registro de decisiones de arquitectura (ADR)

## Qué es una ADR

Una *Architecture Decision Record* documenta una decisión técnica relevante: qué problema había, qué opciones se consideraron, qué se eligió y qué consecuencias se aceptan. Fitnet usa el formato **MADR 4.0** adaptado al español (`TEMPLATE.md`). Cada decisión tiene un identificador `DEC-NNN` estable que se cita en código, commits y PRs (por ejemplo `// ver DEC-016`).

Las ADR son inmutables: si una decisión cambia, se escribe una DEC nueva y la anterior pasa a estado `Reemplazada por DEC-MMM`. Las DEC-001 a DEC-025 provienen del MVP académico y se migraron 1:1 desde el antiguo `DECISIONS.md` conservando fecha y contenido.

## Cuándo se necesita una ADR

- Introducir o quitar una dependencia, servicio externo o proveedor.
- Cambiar un contrato de `packages/contracts` o un esquema persistido (`schemaVersion`).
- Cambiar un umbral, constante o algoritmo que altere los snapshots golden de `analysis-core`.
- Cambiar la dirección de dependencias entre paquetes o la propiedad de un directorio.
- Cualquier decisión que un revisor (humano o `architect-guardian`) detecte como implícita en un PR.

## Cómo proponer una

1. Crear una rama `adr/<slug>` desde `main`.
2. Copiar `TEMPLATE.md` a `DEC-NNN-<slug>.md` con el siguiente número libre de la tabla; estado `Propuesta`.
3. Rellenar contexto, opciones (mínimo dos reales), decisión y consecuencias. Enlazar código, DEC previas y fuentes externas.
4. Añadir la fila en la tabla de este README y, si el estado cambia a `Aceptada`, en `DECISIONS.md` (índice corto de la raíz).
5. Abrir PR con título `docs(adr): DEC-NNN <título>`. La revisión de los leads de B, D y E es recomendada, no obligatoria; mergea el responsable del proyecto (`DEC-070`).
6. La ADR se discute en la revisión de arquitectura de 30 min del sprint; al hacer merge el estado pasa a `Aceptada`.

En Claude Code, la skill `/adr` genera el borrador a partir de la conversación (`.claude/skills/adr`); el agente `adr-scribe` mantiene este índice.

## Índice

| DEC | Título | Fecha | Estado |
|---|---|---|---|
| [DEC-001](DEC-001-framework-ui-react.md) | Framework UI: React | 2026-04-29 | Aceptada |
| [DEC-002](DEC-002-build-tool-vite.md) | Build tool: Vite | 2026-04-29 | Aceptada |
| [DEC-003](DEC-003-lenguaje-typescript.md) | Lenguaje: TypeScript | 2026-04-29 | Aceptada |
| [DEC-004](DEC-004-mediapipe-tasks-vision.md) | API de MediaPipe: `@mediapipe/tasks-vision` (Tasks API) | 2026-04-29 | Aceptada |
| [DEC-005](DEC-005-wasm-mediapipe-cdn-jsdelivr.md) | Carga del WASM de MediaPipe: CDN (jsDelivr) | 2026-04-29 | Aceptada |
| [DEC-006](DEC-006-pwa-manual-sin-plugin.md) | PWA implementada manualmente (sin vite-plugin-pwa) | 2026-05-15 | Aceptada |
| [DEC-007](DEC-007-directorio-desarrollo-fuera-onedrive.md) | Directorio de desarrollo: `C:\Dev-AI` (fuera de OneDrive) | 2026-04-29 | Aceptada |
| [DEC-008](DEC-008-onboarding-react-css-nativo.md) | Onboarding: implementado en React con CSS nativo | 2026-05-06 | Aceptada |
| [DEC-009](DEC-009-angulos-atan2-point2d.md) | Cálculo de ángulos: `atan2` con tipo propio `Point2D` | 2026-05-06 | Aceptada |
| [DEC-010](DEC-010-sentadilla-histeresis-umbral-doble.md) | Máquina de estados de sentadilla: histéresis de umbral doble | 2026-05-06 | Aceptada |
| [DEC-011](DEC-011-feedback-overlay-dom.md) | Feedback de ejercicio: overlay DOM sobre canvas | 2026-05-06 | Aceptada |
| [DEC-012](DEC-012-overlay-barra-inferior.md) | Overlay de feedback: barra inferior de ancho completo | 2026-05-06 | Aceptada |
| [DEC-013](DEC-013-voz-speech-synthesis.md) | Retroalimentación por voz: Web Speech API (`SpeechSynthesis`) | 2026-05-06 | Aceptada |
| [DEC-014](DEC-014-fondo-real-minimo-local.md) | Detección de fondo real: mínimo local por giro de ángulo | 2026-05-06 | Aceptada |
| [DEC-015](DEC-015-curl-cima-inversion-tendencia-vistas.md) | Curl de bíceps: detección de cima por inversión de tendencia + soporte frontal/lateral | 2026-05-15 | Aceptada |
| [DEC-016](DEC-016-feedback-voz-confirmacion-frames-prioridad.md) | Arquitectura de feedback de voz: confirmación por frames y prioridad sin colisiones | 2026-05-15 | Aceptada |
| [DEC-017](DEC-017-conteo-reps-gate-confirmacion.md) | Conteo de reps: gate obligatorio por confirmación de cima/fondo | 2026-05-15 | Aceptada |
| [DEC-018](DEC-018-press-hombro-angulos-polaridad-pico.md) | Press de hombro: ángulos seguros, polaridad invertida y detección de pico | 2026-05-15 | Aceptada |
| [DEC-019](DEC-019-deploy-vercel.md) | Plataforma de deploy: Vercel | 2026-05-15 | Aceptada |
| [DEC-020](DEC-020-https-local-basic-ssl.md) | HTTPS en desarrollo local: `@vitejs/plugin-basic-ssl` | 2026-05-15 | Aceptada |
| [DEC-021](DEC-021-delay-450ms-cambio-camara.md) | Delay de 450 ms al cambiar de cámara en PWA instalada | 2026-05-15 | Aceptada |
| [DEC-022](DEC-022-curl-conteo-unificado-cooldown.md) | Curl de bíceps: conteo unificado con cooldown | 2026-05-15 | Aceptada |
| [DEC-023](DEC-023-press-conteo-unificado-cooldown.md) | Press de hombro: conteo unificado con cooldown | 2026-05-16 | Aceptada |
| [DEC-024](DEC-024-localstorage-defensivo.md) | `localStorage` defensivo: try/catch y validación de valor | 2026-05-16 | Aceptada |
| [DEC-025](DEC-025-service-worker-network-first.md) | Service Worker: network-first para HTML, cache-first para assets | 2026-05-16 | Aceptada |
| [DEC-026](DEC-026-levantamiento-restricciones-mvp-alcance-fitnet.md) | Levantamiento de las restricciones del MVP y alcance de Fitnet | 2026-09-19 | Aceptada |
| [DEC-027](DEC-027-arquitectura-hibrida-ia.md) | Arquitectura híbrida de IA (on-device + LLM solo con métricas; reglas como fallback) | 2026-09-19 | Aceptada |
| [DEC-028](DEC-028-monorepo-pnpm-fronteras-paquetes.md) | Monorepo pnpm, paquetes `@fitnet/*` y fronteras de dependencias | 2026-09-19 | Aceptada |
| [DEC-029](DEC-029-supabase-backend.md) | Supabase (`us-east-1`) como backend de producto | 2026-09-19 | Aceptada |
| [DEC-030](DEC-030-recurrente-pagos-v1.md) | Recurrente como proveedor de pagos v1 (Paddle secundario) | 2026-09-19 | Aceptada |
| [DEC-031](DEC-031-onnx-runtime-web-wasm-hf-hub.md) | ONNX Runtime Web (WASM) + Hugging Face Hub para modelos | 2026-09-19 | Aceptada |
| [DEC-032](DEC-032-organizacion-agentica-workstreams-codeowners.md) | Organización agéntica, workstreams y CODEOWNERS | 2026-09-19 | Aceptada |
| [DEC-033](DEC-033-claude-coach-assistant-edge-function.md) | Claude `claude-opus-5` para `CoachAssistant` vía Edge Function | 2026-09-19 | Aceptada |
| [DEC-034](DEC-034-via-implementacion-analisis-ia.md) | Vía de implementación del análisis por IA: features por repetición y COCO-17 (ajustada por DEC-035; Fases 2 y 3 reemplazadas por DEC-055) | 2026-09-22 | **Propuesta** |
| [DEC-035](DEC-035-proyecto-academico-sin-facturacion-real.md) | Proyecto académico de seminario: sin facturación real, pagos simulados, pesos preentrenados permitidos | 2026-09-22 | Aceptada |
| [DEC-036](DEC-036-analisis-3d-world-landmarks.md) | Migración del análisis a 3D con `worldLandmarks` (fitnetv2 DEC-026) | 2026-09-19 | Aceptada en fitnetv2; rige al integrarse (DEC-054) |
| [DEC-037](DEC-037-validacion-temporal-repeticiones.md) | Validación temporal de repeticiones (fitnetv2 DEC-027) | 2026-09-19 | Aceptada en fitnetv2; rige al integrarse (DEC-054) |
| [DEC-038](DEC-038-fatiga-degradacion-movimiento.md) | Detección de fatiga por degradación del patrón de movimiento (fitnetv2 DEC-028) | 2026-09-19 | Aceptada en fitnetv2; rige al integrarse (DEC-054) |
| [DEC-039](DEC-039-visor-3d-threejs.md) | Visor 3D del esqueleto con Three.js (fitnetv2 DEC-029) | 2026-09-19 | Aceptada en fitnetv2; rige al integrarse (DEC-054) |
| [DEC-040](DEC-040-catalogo-ejercicios-modelo-rutinas.md) | Catálogo de ejercicios y modelo de rutinas (fitnetv2 DEC-030) | 2026-09-19 | Aceptada en fitnetv2; rige al integrarse (DEC-054) |
| [DEC-041](DEC-041-perfil-progreso-logros-derivados.md) | Perfil, progreso y logros derivados del historial (fitnetv2 DEC-031) | 2026-09-19 | Aceptada en fitnetv2; rige al integrarse (DEC-054) |
| [DEC-042](DEC-042-navegacion-hashrouter-contexto.md) | Navegación: HashRouter y contexto de React (fitnetv2 DEC-032) | 2026-09-19 | Aceptada en fitnetv2; rige al integrarse (DEC-054) |
| [DEC-043](DEC-043-tutorial-tecnica-por-ejercicio.md) | Tutorial de técnica por ejercicio (fitnetv2 DEC-033) | 2026-09-22 | Aceptada en fitnetv2; rige al integrarse (DEC-054) |
| [DEC-044](DEC-044-sentadilla-fondo-independiente-fps.md) | Sentadilla: confirmación del fondo independiente de la velocidad de cuadros (fitnetv2 DEC-034) | 2026-09-22 | Aceptada en fitnetv2; rige al integrarse (DEC-054) |
| [DEC-045](DEC-045-analizador-histeresis-forma-ciclo.md) | Analizador de movimiento: histéresis, forma del ciclo y fase de esfuerzo mínima (fitnetv2 DEC-035) | 2026-09-22 | Aceptada en fitnetv2; rige al integrarse (DEC-054) |
| [DEC-046](DEC-046-filtro-one-euro-landmarks.md) | Filtro One Euro sobre los landmarks (fitnetv2 DEC-036) | 2026-09-22 | Aceptada en fitnetv2; rige al integrarse (DEC-054) |
| [DEC-047](DEC-047-modo-manual-sin-camara.md) | Modo manual para los ejercicios sin cámara (fitnetv2 DEC-037) | 2026-09-22 | Aceptada en fitnetv2; rige al integrarse (DEC-054) |
| [DEC-048](DEC-048-banco-pruebas-motor-sin-camara.md) | Banco de pruebas del motor sin cámara (fitnetv2 DEC-038) | 2026-09-22 | Aceptada en fitnetv2; rige al integrarse (DEC-054) |
| [DEC-049](DEC-049-registro-interfaz-tuteo.md) | Registro de la interfaz: tuteo (fitnetv2 DEC-039) | 2026-09-22 | Aceptada en fitnetv2; rige al integrarse (DEC-054) |
| [DEC-050](DEC-050-nivelacion-acelerometro.md) | Nivelación con el acelerómetro y partes del cuerpo estimadas (fitnetv2 DEC-040) | 2026-09-23 | Aceptada en fitnetv2; rige al integrarse (DEC-054) |
| [DEC-051](DEC-051-iconos-sin-emojis.md) | Íconos en lugar de emojis (fitnetv2 DEC-041) | 2026-09-23 | Aceptada en fitnetv2; rige al integrarse (DEC-054) |
| [DEC-052](DEC-052-editor-rutinas-guardado-explicito.md) | Editor de rutinas con guardado explícito (fitnetv2 DEC-042) | 2026-09-23 | Aceptada en fitnetv2; rige al integrarse (DEC-054) |
| [DEC-053](DEC-053-calibracion-vertical-postura-pie.md) | Calibración de la vertical con la postura de pie (fitnetv2 DEC-043) | 2026-09-23 | Aceptada en fitnetv2; rige al integrarse (DEC-054) |
| [DEC-054](DEC-054-integracion-fitnetv2.md) | Integración de fitnetv2 por pasos y por workstream (tabla de equivalencias de numeración) | 2026-09-24 | Aceptada |
| [DEC-055](DEC-055-clasificador-ligero-datos-por-guion.md) | Núcleo de IA: k-NN/MLP en TypeScript sobre landmarks, datos propios con etiqueta por guion, preentrenado como experimento de 3 días | 2026-09-24 | Aceptada |
| [DEC-056](DEC-056-rutina-personalizada-catalogo-paywall.md) | Rutina personalizada: cuestionario libre, generador por reglas, catálogo por olas, paywall en el programa completo | 2026-09-24 | Aceptada |
| [DEC-057](DEC-057-motor-3d-configurable-flag.md) | Motor de conteo 3D configurable por ejercicio, activable con `?engine=3d`; `trunk_lean` 55°, roles de la fatiga | 2026-09-24 | Aceptada |
| [DEC-058](DEC-058-identidad-visual-movimiento.md) | Identidad visual "la red de 33 puntos", sistema de movimiento en CSS y skills de animación de Emil Kowalski adaptadas (reemplaza la sección de diseño de DEC-008) | 2026-09-24 | Aceptada |
| [DEC-059](DEC-059-ola1-motor3d-sin-flag.md) | La ola 1 del asistente usa el motor 3D sin flag; sentadilla, curl y press siguen en 2D hasta el issue #33 | 2026-09-24 | Aceptada |
| [DEC-060](DEC-060-responsive-areas-seguras.md) | Responsive y áreas seguras como regla de diseño y funcionalidad: matriz de dispositivos, tokens `--safe-*` y auditoría automática | 2026-09-24 | Aceptada |
| [DEC-061](DEC-061-tecnica-3d-y-mini-mapa.md) | Ficha de técnica con modelo 3D, mini mapa arrastrable y preferencias de vista | 2026-09-24 | Aceptada |
| [DEC-062](DEC-062-modelo-esfuerzo-y-trabajo-en-paralelo.md) | Modelo y esfuerzo por agente, una issue por sesión y estado del proyecto a cargo del líder | 2026-10-05 | Propuesta |
| [DEC-063](DEC-063-contrato-exercise-tracker.md) | Contrato `ExerciseTracker` v1.0.0 y adaptadores de los contadores | 2026-10-07 | Propuesta |
| [DEC-064](DEC-064-consentimiento-una-grabacion.md) | Un consentimiento de grabación vale para una sola grabación (`unique` sobre `consent_id`) | 2026-10-10 | Aceptada |
| [DEC-065](DEC-065-datasets-externos-alcance-academico.md) | Datasets externos: licencias de MM-Fit corregidas (código MIT, video CC BY 4.0, etiquetas sin licencia pública) y alcance solo académico | 2026-10-13 | Propuesta |
| [DEC-066](DEC-066-umbrales-reposo-3d-grabaciones.md) | Umbrales de reposo del motor 3D y de la calibración de pie, ajustados con grabaciones reales | 2026-10-14 | Propuesta |
| [DEC-067](DEC-067-coste-ia-rankings-antitrampa-privacidad.md) | Tope de costo del asistente IA (USD 2/usuario/mes, modo simulado por defecto), rankings cada 15 min, reglas anti-trampa v1 y aviso de privacidad versionado | 2026-10-17 | Propuesta |
| [DEC-068](DEC-068-nombre-movexnet-repositorio-publico.md) | Nombre del producto MovexNet, repositorio `movexnet` y visibilidad pública | 2026-10-17 | Propuesta |
| [DEC-069](DEC-069-cuentas-supabase-auth.md) | Cuentas con Supabase Auth: correo y contraseña, SMTP de Brevo, Turnstile y puerta 18+ en el servidor | 2026-10-19 | Propuesta |
| [DEC-070](DEC-070-merge-sin-revision-obligatoria.md) | Merge sin revisión obligatoria: CI como única puerta y el responsable hace el squash merge | 2026-10-20 | Propuesta |

Próximo número libre: **DEC-071** (provisional hasta el merge, ver DEC-062).

**Decisiones importadas de fitnetv2.** DEC-036..053 son las DEC-026..043 de `ecaldcc/07-FitNet` renumeradas con +10 (tabla completa en `DEC-054`). Conservan su contenido literal y añaden notas de integración.

## Decisiones que ya se sabe que harán falta

- Hosting comercial de la PWA al lanzar planes de pago (Cloudflare Pages vs. Vercel Pro), ver `DEC-029`.
- Migración de constantes en frames a tiempo real con actualización de golden: la cubre el paso I-2 de `DEC-054` (trackers 3D de fitnetv2 con cooldown y confirmación en ms), junto con `DEC-044`.
- Reglas anti-trampa y frescura de rankings, ver `docs/METRICS.md`.
- Renombrado del repositorio a `fitnet` y visibilidad pública/privada, ver `docs/STATUS.md`.
