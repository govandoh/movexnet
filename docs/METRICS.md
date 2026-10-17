# MovexNet — Métricas

> Responsabilidad de este archivo: definición formal (fórmula, unidad, fuente de datos, ventana) de cada métrica que calcula `analysis-core`, persiste el backend y muestra la UI. Es la fuente de verdad: si un valor se muestra en pantalla o se envía al `CoachAssistant`, su nombre y fórmula están aquí. Las metas de éxito del núcleo de IA (§8) se reflejan en `ml/thresholds.yaml`.

Convenciones:

- Nombres de métrica en `snake_case` en inglés; son los valores de `Metric.name` (`DOMAIN.md`).
- `t` en milisegundos desde el inicio de la sesión (`LandmarkFrame.t`), no en frames.
- Ángulos en grados; distancias en metros (desde `world`) o unidades normalizadas (desde `image`, se indica).
- Landmarks suavizados antes de derivar: filtro One-Euro o EMA (parámetros en `analysis-core`; el suavizado usado se registra en `RepSummary.smoothing`).
- **Estado de implementación:** en producción solo existen ángulo articular 2D, conteo de reps y feedback por umbrales (§1, §5 parcial). El paso I-1 de `DEC-054` añadió en `src/geometry/` y `src/analysis/` ángulos 3D, suavizado One Euro, validación temporal por rep y fatiga (§2–3), con tests pero **sin conectar a la UI** hasta el paso I-2. El resto es objetivo de la Fase 1 (`PRODUCT.md`) y se marca como tal.

## 1. Métricas por frame

### 1.1 Ángulo articular (`joint_angle`) — implementado

- **Fórmula:** para landmarks A (proximal), B (vértice), C (distal): `θ = |atan2(Cy−By, Cx−Bx) − atan2(Ay−By, Ax−Bx)| · 180/π`; si `θ > 180` → `θ = 360 − θ`. Rango 0–180°.
- **Fuente:** `image` (2D) hoy (`src/geometry/angles.ts`); objetivo: mismo cálculo sobre `world` (3D, vector completo) cuando la vista lo permita, guardando ambos.
- **Articulaciones:** rodilla (cadera-rodilla-tobillo, 23/24-25/26-27/28), codo (hombro-codo-muñeca, 11/12-13/14-15/16), hombro (codo-hombro-cadera), cadera (hombro-cadera-rodilla), tronco (ángulo del vector hombro→cadera respecto a la vertical).
- **Ángulo primario por ejercicio:** sentadilla = media de ambas rodillas; curl = mínimo de ambos codos; press = máximo de ambos codos. Solo se calcula si `visibility ≥ 0.5` en los tres landmarks.

### 1.2 Velocidad angular (`angular_velocity`) — objetivo

- **Fórmula:** `ω(t) = (θ(t) − θ(t−Δt)) / Δt`, en °/s, con `Δt` real entre frames (no frames).
- **Ventana:** derivada sobre la señal suavizada; ventana mínima de 2 frames.

## 2. Métricas por repetición (`RepSummary`)

Una rep se delimita por `RepWindow = [t_start, t_peak, t_end]` que produce el `RepSegmenter` (`t_peak` = extremo confirmado según `DEC-014`/`DEC-016`).

| Métrica | Fórmula | Unidad | Fuente | Estado |
|---|---|---|---|---|
| `rep_duration` | `t_end − t_start` | ms | `RepWindow` | objetivo |
| `rom` (rango de movimiento) | `|θ(t_peak) − θ(t_start)|` sobre el ángulo primario | ° | ángulos | objetivo |
| `rom_world` | distancia recorrida por el landmark distal (muñeca en curl/press, cadera en sentadilla) entre `t_start` y `t_peak` | m | `world` | objetivo |
| `eccentric_ms` | fase en la que el músculo se alarga: sentadilla y curl `t_peak − t_start` (bajada / extensión); press `t_end − t_peak` (bajada de la carga) | ms | `RepWindow` + polaridad del ejercicio | objetivo |
| `concentric_ms` | complemento: `rep_duration − eccentric_ms` | ms | idem | objetivo |
| `tempo` | par `(eccentric_ms, concentric_ms)`; se muestra como "2.1 s / 0.9 s" | ms | idem | objetivo |
| `peak_velocity` | `max ω(t)` durante la fase concéntrica, sobre el ángulo primario | °/s | ángulos suavizados | objetivo |
| `peak_velocity_world` | `max ‖v(t)‖` del landmark distal durante la fase concéntrica, `v = Δp/Δt` | m/s | `world` suavizado | objetivo (preferida para VBT cuando `world` es fiable) |
| `mean_velocity` | media de `ω(t)` en la fase concéntrica | °/s | idem | objetivo |
| `asymmetry_rep` | ver §4 | % | ambos lados | objetivo |
| `form_score` | ver §5 | 0–100 | `FormAnalyzer` | objetivo |
| `form_errors[]` | ver §5 | códigos | `FormAnalyzer` | objetivo |

**Implementación parcial (I-1, sin conectar):** `MovementAnalyzer` (`src/analysis/movementQuality.ts`, `DEC-037`, `DEC-045`) calcula `rep_duration`, `concentric_ms`/`eccentric_ms` según la forma del ciclo, `rom` sobre el ángulo primario, velocidad concéntrica media y `peak_velocity` en °/s sobre ventanas de 100 ms, y además `smoothness` (0–1, por inversiones con histéresis de 12°). Rechaza la rep por `too_fast`, `too_slow`, `insufficient_rom` o `erratic` con estos umbrales:

| Ejercicio | ROM mín. | Duración mín. | Concéntrica mín. | Duración máx. | Suavidad mín. |
|---|---|---|---|---|---|
| por defecto | 35° | 600 ms | 250 ms | 12 000 ms | 0.35 |
| sentadilla | 40° | 800 ms | 250 ms | 15 000 ms | 0.35 |
| curl | 50° | 700 ms | 250 ms | 10 000 ms | 0.3 |
| press | 45° | 700 ms | 250 ms | 10 000 ms | 0.3 |

Los valores por ejercicio vienen de fitnetv2 y se fijan en los trackers en el paso I-2 (`DEC-054`).

## 3. Métricas por serie (`FatigueEstimate` y agregados)

Ventana: todas las reps de un `Set` (para `rest_pause` y `dropset`, además por bloque/sub-serie; ver `DOMAIN.md`).

| Métrica | Fórmula | Unidad | Nota |
|---|---|---|---|
| `velocity_decline_pct` | `(v_best − v_last) / v_best · 100`, con `v_best = max(peak_velocity de las 3 primeras reps)` y `v_last = media de las 2 últimas reps` | % | **Umbral 20 %:** una pérdida ≥ 20 % en sentadilla equivale aproximadamente a la mitad de las reps disponibles hasta el fallo (Velocity-Based Training). Se emite aviso de fatiga. |
| `rom_decline_pct` | `(rom_best − rom_last) / rom_best · 100`, misma ventana que arriba | % | Deriva de ROM: reps que se acortan al fatigarse. |
| `tempo_cv` | `σ(rep_duration) / μ(rep_duration)` | adimensional (0–1) | Coeficiente de variación del tempo. |
| `asymmetry_set` | media de `asymmetry_rep` | % | — |
| `consistency` | `1 − clamp(mean(cv_duration, cv_rom, cv_peak_velocity), 0, 1)` | 0–1 | Regularidad de la serie; 1 = todas las reps iguales. |
| `fatigue_index` | `clamp(0.5 · velocity_decline_pct/20 + 0.3 · rom_decline_pct/15 + 0.2 · tempo_cv/0.25, 0, 1) · 100` | 0–100 | Combinación ponderada normalizada por los umbrales de referencia (20 %, 15 %, 0.25). Los pesos son iniciales; se recalibran contra RPE (§8). Opcional después: Random Forest sobre las mismas features. |
| `reps` | conteo de eventos `complete` | reps | Implementado (reglas). |
| `set_volume` | `reps · loadKg` (si hay carga) | kg | — |
| `mean_form_score` | media de `form_score` | 0–100 | — |

**Fatiga de fitnetv2 (implementada, pendiente de reconciliar).** `FatigueDetector` (`src/analysis/fatigue.ts`, `DEC-038`) usa otra fórmula: `score = min(100, velDrop% · 2 + romLoss% · 1.5 + asymEMA · 40)`, con línea base en las 3 primeras reps y media de las 3 últimas. Niveles: `moderate` si caída de velocidad ≥ 10 % o score ≥ 22; `high` si ≥ 20 % o ≥ 45; `critical` si ≥ 30 % o ≥ 70. Difiere de `fatigue_index` (pesos, normalización y ventanas). **Roles fijados en `DEC-057`:** `FatigueDetector` da el nivel en tiempo real durante la serie (feedback y sugerencia de descanso) y su `score` no se persiste; `fatigue_index` es la métrica persistida por serie, calculada al cerrarla. El término de asimetría recibe ahora la asimetría del punto de esfuerzo (`Tracker3D`), no la del frame de cierre.

## 4. Asimetría izquierda/derecha

- **Por rep:** `asymmetry_rep = |m_L − m_R| / max(m_L, m_R) · 100`, donde `m` es, según el ejercicio, ROM (sentadilla: ángulo de rodilla; curl/press: ángulo de codo) o `peak_velocity` del lado. Solo cuando ambos lados tienen `visibility ≥ 0.5` (vista frontal o 45°); en vista lateral se reporta `null`.
- **Umbral de aviso:** ≥ 15 % sostenido en 3 reps consecutivas produce el error de forma `asymmetry`.

## 5. Score de forma y códigos de error

### 5.1 `form_score` (0–100)

- **Reglas (hoy y fallback):** `100` si la rep alcanza el umbral bueno del ejercicio (`GOOD_DEPTH_ANGLE=90`, `GOOD_FORM_ANGLE=50`, `GOOD_LOCKOUT_ANGLE=145`), `70` si queda en zona "warning", `30` si aparece un nivel "bad" (`SAFE_LOW_ANGLE=80` en press). Es el mapeo del `feedbackLevel` actual (`good`/`warning`/`bad`).
- **ML/ensamble (objetivo):** `form_score = 100 · (1 − Σ_e severity_e · w_e)` acotado a [0, 100], con `w_e` peso por código (tabla abajo) y `severity_e ∈ [0,1]` del `FormAnalyzer`. `FormAssessment.confidence` acompaña siempre al score; si `confidence < τ` (por ejercicio, en `ml/thresholds.yaml`) se usa el score de reglas.

### 5.2 Códigos de error (`FormErrorCode`)

| Código | Descripción | Ejercicios | Evidencia mínima (`evidence`) | Peso `w_e` |
|---|---|---|---|---|
| `shallow_depth` | Profundidad insuficiente: ángulo de rodilla en el fondo > 100° | sentadilla | `minKneeAngle` | 0.4 |
| `knee_valgus` | Rodillas colapsan hacia dentro: distancia entre rodillas / distancia entre tobillos < 0.85 en el fondo | sentadilla | `kneeAnkleRatio` | 0.6 |
| `trunk_lean` | Inclinación de tronco > 55° respecto a la vertical durante la bajada y el fondo (`DEC-057`; antes 45°) | sentadilla | `trunkAngle` | 0.5 |
| `partial_rom` | ROM < 70 % del ROM de referencia del ejercicio (curl: extensión inicial < 130° o contracción > 60°; press: lockout < 145°) | todos | `rom`, `refRom` | 0.4 |
| `asymmetry` | `asymmetry_rep ≥ 15 %` sostenido (§4) | todos con ambos lados visibles | `asymmetry_rep` | 0.3 |
| `unsafe_low_elbow` | Codo por debajo de la línea del hombro con carga: ángulo < 80° en fase `lowered` | press | `minElbowAngle` | 0.8 |
| `excess_speed` | `peak_velocity` > percentil 95 del usuario o `concentric_ms < 300 ms` con carga | todos | `peak_velocity`, `concentric_ms` | 0.3 |
| `elbow_drift` | El codo se adelanta: ángulo del brazo (hombro→codo) respecto a la vertical > 25°. Origen: reglas de fitnetv2 | curl | `upperArmAngle` | 0.4 (propuesto) |
| `lumbar_arch` | Arqueo lumbar: inclinación del tronco respecto a la vertical > 25°, evaluada solo con cadera visible y en fase de empuje (fitnetv2 la mide sin esas condiciones; se corrige en I-2). Origen: reglas de fitnetv2 | press | `trunkAngle` | 0.6 (propuesto) |

Los umbrales de evidencia son los iniciales de la implementación por reglas y se ajustan con datos propios; cualquier cambio que altere golden exige DEC. Los dos últimos códigos entran con el paso I-2 de `DEC-054` y son clases del k-NN de `DEC-055`.

**Resuelto en `DEC-057`:** `trunk_lean` pasa de 45° a **55°**, el valor que fitnetv2 ajustó en campo (45° marcaba como error sentadillas legítimas de barra baja o fémur largo). En el press, la inclinación del tronco se evalúa como `lumbar_arch` (> 25°). Los pesos de `elbow_drift` (0.4) y `lumbar_arch` (0.6) quedan aceptados.

## 6. Métricas de progreso (por usuario, ventana temporal)

| Métrica | Fórmula | Unidad | Ventana |
|---|---|---|---|
| `volume` | `Σ set_volume` (o `Σ reps` si no hay carga) por ejercicio | kg (o reps) | día / semana / 4 semanas |
| `estimated_1rm` | Epley: `loadKg · (1 + reps/30)` sobre la mejor serie con `reps ≤ 10` y `mean_form_score ≥ 70` | kg | por ejercicio, mejor de la ventana |
| `adherence` | `sesiones realizadas / sesiones planificadas` en la rutina activa | % | semana / 4 semanas |
| `form_trend` | pendiente de regresión lineal de `mean_form_score` por sesión | puntos/semana | 4 semanas |
| `fatigue_trend` | media de `fatigue_index` por sesión | 0–100 | 4 semanas |
| `streak` | días consecutivos con al menos una sesión | días | — |

Estas métricas se agregan de noche en `daily_user_stats` (`DEC-029`) y son la entrada del `CoachAssistant` junto con los agregados por serie.

## 7. Puntuación de retos y rankings

- **Puntuación de reto** (`challenge_score`): definida por `Challenge.metricName` y `Challenge.rules`; v1 admite `reps` totales del ejercicio del reto, `volume` y `adherence`, siempre ponderadas por calidad: `score = Σ_reps 1[form_score ≥ 60]` para reps, o `volume · mean_form_score/100` para volumen.
- **Ranking global** (`leaderboard_score`): `0.5 · adherence + 0.3 · norm(volume) + 0.2 · norm(mean_form_score)` en la ventana del periodo, con `norm` = percentil dentro de la cohorte (nivel del perfil).
- **Frescura:** vistas materializadas refrescadas por `pg_cron` cada 5–15 min; la UI muestra "ranking a las HH:MM".
- **Anti-trampa (pendiente):** hoy no hay validación de que una sesión provenga de análisis real. Antes de abrir rankings públicos el equipo debe definir: firma de sesión generada en el dispositivo, límites de plausibilidad (reps/min, `peak_velocity`), exigencia de `source ≠ 'manual'`, y revisión de outliers. Registrado en `STATUS.md` como pendiente del equipo.

## 8. Metas de éxito del núcleo de IA

Fuente: plan aprobado 2026-09-19 y `DEC-027`. Se codifican en `ml/thresholds.yaml` y las verifica el gate de modelo (`ML-PIPELINE.md`).

| Componente | Meta | Método de evaluación |
|---|---|---|
| Clasificador de ejercicio | accuracy ≥ 90 % LOSO en los 3 ejercicios; latencia p95 < 15 ms en WASM en gama media | `ml/eval.py`, Leave-One-Subject-Out; latencia medida en el Worker |
| Errores de forma (sentadilla) | F1 macro ≥ 0.75 LOSO por clase; acuerdo con reglas ≥ 95 % en casos claros (no regresión) | idem + comparación contra `RuleBasedAnalyzer` sobre fixtures |
| Conteo de reps | exactitud ≥ 98 % sobre fixtures (igual o mejor que hoy) | golden tests |
| Fatiga | correlación (`velocity_decline_pct`, RPE reportado) ≥ 0.6 en el dataset propio | Spearman sobre series con RPE |

Reporte por ejercicio × vista de cámara × clase; un modelo no se promueve si alguna celda relevante cae por debajo del umbral.
