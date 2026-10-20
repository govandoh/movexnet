# Fitnet — Historial

> Lo ya entregado, por hito. El estado vivo está en `docs/STATUS.md` y las decisiones en `docs/adr/README.md`. Se agrega una entrada cuando un PR mergeado cambia algo visible para el usuario o cierra un hito (DEC-062).

## Sprint 1 — Migración y datos (octubre 2026)

| Entregable | Contenido | Estado al cierre |
|---|---|---|
| Cuentas con Supabase Auth (#60, `DEC-069`) | Registro con puerta 18+ y aviso de privacidad impuestos en el servidor, confirmación por correo, inicio y cierre de sesión, recuperación de contraseña (PKCE), sesión persistente y estado de la cuenta en Perfil. Con las cuentas activas, la app pide iniciar sesión o registrarse antes de entrenar; detrás de `VITE_ENABLE_ACCOUNTS`, apagado en producción | Probado en local (Auth y navegador emulado); falta configurar la nube, aprobar el aviso (#22) y probar en celular |
| Umbrales del motor 3D ajustados con grabaciones reales (#39, #49, `DEC-066`) | Las zancadas vuelven a contar; las flexiones pierden menos repeticiones y ya no piden bajar más estando abajo; la sentadilla cuenta con `?engine=3d`; la calibración de postura termina y la serie arranca sola | Probado en vivo en iPhone 17 Pro Max y Samsung S24 Ultra, y con grabaciones; falta validar con más personas (#16) y resolver curl y press en 3D (#58) |

## Fase 1 — PRs #40 y #41 (septiembre 2026)

| Entregable | Contenido | Estado al cierre |
|---|---|---|
| Integración de fitnetv2, paso I-1 (`DEC-054`) y k-NN (`DEC-055`) | Motor puro en `src/geometry/{vectors3d,landmarkFilter,gravityAlign,standingCalibration,poseEmbedding}.ts` y `src/analysis/{movementQuality,fatigue,messages,poseClassifier}.ts`, `src/exercises/demoPoses.ts`, `src/testing/syntheticMotion.ts` | Mergeado (PR #40) |
| Motor 3D detrás de `?engine=3d` (I-2 + I-3, `DEC-057`) | `CycleDetector`, `Tracker3D` y definiciones, `FramePipeline` (One Euro → gravedad → calibración → contador), adaptador del acelerómetro con permiso de iOS | Mergeado (PR #40); falta el informe de prueba por ejercicio y celular |
| Ola 1 del asistente (#39) | Flexiones, zancadas, puente de glúteo (3D) y plancha (`PlankTracker`, isométrico), con demos 3D | Mergeado (PR #40); umbrales sin calibrar con personas |
| PR 4 — `FeedbackPolicy` (#13) | Política de voz de DEC-016 extraída de `CameraView` a `src/feedback/`, compartida por los dos motores | Mergeado (PR #40) |
| Grabación por guion y k-NN (#16, #36) | `?debug=record&cond=…&view=…&subject=…` guarda condición, sujeto y gravedad por frame; `pnpm knn <carpeta>` construye el modelo y lo evalúa LOSO | Mergeado (PR #40); faltan las grabaciones |
| Catálogo y generador de rutinas (#35) | `src/domain/catalog.ts` (60 ejercicios con etiquetas de equipo) y `routineGenerator.ts` (cuestionario → rutina, progresión de 8 semanas, semana 1 libre) | Mergeado (PR #40) |
| Identidad visual y movimiento (`DEC-058`) | `docs/DESIGN.md`, `src/ui/tokens.css`, skill `fitnet-diseno` y 8 skills de Emil Kowalski en `.claude/skills/` | Mergeado (PR #41), sin probar en celular |
| Pantallas (I-4 parcial, I-5, #34, #35) | Hoy (anillo de 33 nodos, semana, racha, fatiga), cuestionario de 4 pasos, programa de 8 semanas con Premium simulado (`MockPaymentProvider`), catálogo con filtros, perfil, historial local de series | Mergeado (PR #41) |
| Entrenamiento con asistente (`DEC-058`, `DEC-059`) | Preparación con nivelador y arranque automático, isla de aviso, contador, métricas, resumen de serie con velocidad y fatiga; la ola 1 usa el motor 3D sin flag | Mergeado (PR #41); sentadilla, curl y press siguen en 2D |
| Técnica en 3D y mini mapa (`DEC-061`) | Ficha de técnica de los 60 ejercicios con demo 3D giratoria; mini mapa 3D arrastrable; consejos plegables; preferencias de vista guardadas | Mergeado (PR #41), sin probar en celular; falta medir fps en gama baja |
| Responsive y áreas seguras (`DEC-060`) | Matriz de 7 tamaños, tokens `--safe-*`, `scripts/audit-responsive.cjs` | Mergeado (PR #41) |

## Sprint 0 — Fundación (septiembre 2026)

| Entregable | Contenido |
|---|---|
| PR 0 — tooling | pnpm 12 (`packageManager`), Vitest, scripts `typecheck` y `check`, CI en `.github/workflows/ci.yml`, commitlint y husky |
| Capa agéntica | `.claude/agents/*` (10), skills `adr`, `fixture`, `pr-ready`, `promote-model`, hooks, `.github/CODEOWNERS`, plantillas de PR e issues |
| Fundación documental | ADRs (DEC-001..025 migradas y DEC-026..035), `AGENTS.md`, `CLAUDE.md`, `ARCHITECTURE.md`, `docs/*`, `README.md`, `CONTRIBUTING.md`, `docs/academico/` |
| PR 1 — fixtures y golden | Flag `?debug=record`, esquema v1 (`fixtures/landmarks/SCHEMA.md`), generador determinista, 10 fixtures sintéticos, helper de replay y 32 golden tests |
| Tablero | 29 issues con etiquetas `epic`, `historia`, `adr`, `equipo`, `ws:*` e hitos. Épicas #1–#10, historias de migración #11–#17, decisiones del equipo #18–#22, integración de fitnetv2 y núcleo de IA #32–#39 |

## MVP académico (mayo 2026)

Entregado el 22/05/2026 para el curso IA26 (UMG): sentadilla, curl de bíceps y press de hombro con análisis por reglas, voz en español y PWA en Vercel. Entregables en `docs/academico/`.
