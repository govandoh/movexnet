# MovexNet — Plan comercial y modelo propio

> Resultado de la sesión de investigación y definición del 2026-10-30 (govandoh con Claude). Fija la ruta para continuar construyendo con enfoque comercial. No sustituye a `docs/PRODUCT.md` (visión y épicas) ni a `docs/ML-PIPELINE.md` (cómo se entrena); los complementa y, donde choca con una DEC vigente, lo dice y pide la DEC nueva. Las decisiones de este documento se formalizan en `docs/adr/` antes de tocar código.

## 1. Decisión

MovexNet pasa de MVP de seminario a producto comercial, construido por govandoh con Claude. El repo y el proyecto de Supabase se conservan (sus datos son de prueba); la UMG no retiene nada. Los demás integrantes firmarán cesión de sus contribuciones o su parte se reescribe.

Lo que **no** cambia: la app sigue siendo una PWA mobile-first, el video nunca sale del celular, las claves viven solo en Edge Functions y el análisis corre en el dispositivo.

Lo que cambia:

| Antes (seminario) | Ahora (producto) |
|---|---|
| Reglas escritas a mano por ejercicio (`src/exercises/definitions3d.ts`) | Modelo aprendido sobre landmarks de MediaPipe; las reglas quedan como respaldo y como etiquetador (nivel 1 de DEC-027) |
| Datasets externos solo académicos (DEC-065) | Solo datos con derechos comerciales o propios; el resto se descarta del producto |
| Sin facturación (DEC-035), pagos simulados (regla dura 8) | Freemium real; se mantiene el simulador hasta tener pasarela y figura fiscal |
| Claude solo como coach planificado (DEC-033) | Claude como coach y como segunda opinión tras la serie, desde el inicio |

"Dejar atrás el motor 3D" significa dejar atrás las **reglas**, no el motor: MediaPipe (ojo), filtro One Euro, nivelación por gravedad y calibración de pie (`src/geometry/`) siguen siendo el preprocesamiento que alimenta al modelo.

## 2. Qué existe en el mercado y qué no

Investigado el 2026-10-30; resumen de lo que condiciona la ruta.

- **No existe un modelo preentrenado de técnica de ejercicio con licencia comercial.** Los pesos públicos (ST-GCN y similares) vienen de NTU RGB+D, prohibido en producto (DEC-034). MediaPipe Pose es la única pieza preentrenada usable.
- **No existe un catálogo de videos de ejercicio etiquetados para comprar a escala pequeña.** Shaip, Defined.ai, Nexdata y similares hacen recolección a medida con precios de empresa (desde ~US$70 000). Shutterstock y Getty licencian para IA solo a empresas. El marketplace de Infinity AI cerró.
- **SDKs de pago (Sency, KinesteX)** venden por cotización y sustituirían al producto, no lo acelerarían.
- **Sí existen datasets con derechos comerciales** (sección 4) y es viable grabar personas por internet (Prolific, ~US$5,70 por participante de 20 minutos) usando la PWA con `?debug=record`, que captura solo landmarks.

## 3. Criterios de técnica: cómo se etiqueta sin ser entrenador

Preocupación: que "bueno/malo" dependa del criterio personal. Respuesta de la literatura y de los datasets del campo:

- La biomecánica publica **medidas y bandas**, no veredictos. Sentadilla: profundidad por flexión de rodilla (parcial 0-90°, media 90-110° o muslo paralelo, profunda 110-135°), inclinación tronco-tibia neutra en ±10°, relación apertura de pies y valgo (revisión IJSPT). Valgo de rodilla en 2D: FPPA, fiabilidad ICC 0,72-0,91 y error mínimo detectable de 2 a 10° (Munro, Herrington y Carolan 2012); **no hay un corte de FPPA validado** para declarar valgo.
- Flexiones, zancadas, curl y press **no tienen criterios de ángulo publicados**; lo que hay es consenso de entrenadores.
- Los datasets serios (Fitness-AQA, FLEX, QEVD, FitAQA) usan **taxonomías de error definidas por entrenadores**, aplicadas por guion (la persona ejecuta el error a propósito) o por anotación de entrenadores. FitAQA (2026) formaliza 38 errores en seis dimensiones: alineación, simetría, estabilidad, coordinación, tempo y completitud.

Procedimiento adoptado, para que ninguna etiqueta dependa del ojo de una persona:

1. **`docs/TECHNIQUE-CRITERIA.md`** (pendiente): por ejercicio, cada error con definición, cómo se mide en ángulos de MediaPipe, umbral y fuente. Donde no hay paper se marca "umbral provisional, sin fuente", como ya hace el código. Los códigos de error parten de DEC-027: `shallow_depth`, `knee_valgus`, `trunk_lean`, `partial_rom`, `asymmetry`, `unsafe_low_elbow`, `excess_speed`.
2. **La etiqueta se calcula, no se juzga.** El guion dice qué error se pidió; los ángulos medidos confirman si ocurrió y en qué repeticiones. Lo que cae dentro del error de medida del umbral se marca "ambiguo" y se excluye del entrenamiento.
3. **Un entrenador certificado valida los criterios y una muestra** (2-3 horas de trabajo), no todas las grabaciones. Si discrepa con el criterio medido, se ajusta el criterio, no la etiqueta. Se registra el acuerdo entre ambos.

Los umbrales actuales de `definitions3d.ts` (por ejemplo `GOOD_DEPTH_ANGLE = 90`, `SQUAT_MAX_TRUNK_LEAN_DEG = 55`, `PUSHUP_GOOD_DEPTH_DEG = 95`) son este mismo enfoque sin calibrar; se revisan contra el documento de criterios, no se tiran.

## 4. Datos

### Usables en producto

| Fuente | Licencia | Qué aporta |
|---|---|---|
| Mendeley "Multi-View Raw Video Dataset of Seven Fitness Exercises with Good/Bad Form Labels" (DOI 10.17632/kgbb3yn47p.2) | CC BY 4.0 | 26 personas, vistas frontal, lateral y diagonal; curl, flexión, press, sentadilla, remo, flexión lateral, extensión de tríceps; etiqueta buena/mala |
| InfiniteRep (github.com/toinfinityai/InfiniteRep) | CC BY 4.0 | 1 000 videos sintéticos, 10 ejercicios, landmarks 2D y 3D |
| Kaggle Exercise Detection | CC0 | Ángulos de MediaPipe en flexiones y sentadillas |
| Fit3D | Comercial negociable (licenses@imar.ro, asunto "[Fit3D Commercial Use]") | 611 secuencias, 37 ejercicios, esqueletos 3D; solo si hace falta más variedad |
| Grabaciones propias | Consentimiento con cláusula comercial | Errores por guion, personas reales, celulares reales |

### Prohibidos en producto

FLAG3D, FLEX, M3GYM, QEVD, Fitness-AQA, EC3D, RepCount, MotionBank, etiquetas de MM-Fit, pesos derivados de NTU y cualquier dataset de Kaggle sacado de YouTube. Siguen sirviendo para leer sus taxonomías y protocolos, no para entrenar.

### Grabaciones propias

- Video normal con el celular, no con la app: lateral y frontal, 8-10 repeticiones por serie, guion de errores por ejercicio. Nombre `ejercicio_vista_condicion_persona_NN.mp4`.
- Meta para el primer modelo: ~300 repeticiones por ejercicio de 5 personas; ~2 500 repeticiones en total, 4-5 horas de grabación.
- Claude convierte video a landmarks con MediaPipe en Python (dependencia nueva solo en `ml/`, con DEC) y aplica la etiqueta por guion; la validación es el procedimiento de la sección 3.
- Antes de grabar a nadie: plantilla de consentimiento con cláusula de uso comercial (la actual, `docs/CONSENTIMIENTO-GRABACION.md`, dice "no comercial").
- Escalar después con Prolific, con la PWA en modo `?debug=record`.

## 5. IA provisional: Claude mientras existe el modelo propio

Hay US$100 de crédito en la API de Claude. El saldo solo se ve en la consola de Anthropic; no hay clave configurada en el repo ni en el entorno de desarrollo y debe vivir únicamente en una Edge Function (regla dura 3).

Evidencia que condiciona el diseño: el benchmark FitAQA muestra que los modelos multimodales **evalúan mal la técnica a partir de video**, cerca o por debajo de líneas base simples. Por eso Claude **no juzga la técnica**: recibe ángulos y métricas ya calculados por MediaPipe y el motor 3D, más 2-3 cuadros clave reducidos, y explica, prioriza y aconseja. Los números dan el veredicto; el modelo lo comunica.

Usos, en orden de valor:

1. **Segunda opinión tras la serie** (premium): métricas + cuadros clave → JSON estructurado en español con qué mejorar y por qué. Con `claude-opus-5-5` y cuadros de 512 px, ~US$0,015-0,02 por serie; con caché del prompt, menos. US$100 cubren 5 000-6 000 series.
2. **Coach de DEC-033**: resúmenes de sesión, ajustes de rutina, reporte semanal al entrenador; solo texto y métricas; Batch API a mitad de precio para lo nocturno.
3. **Pre-etiquetado asistido** en la fase 1: Claude propone etiqueta y punto dudoso a partir de cuadros + ángulos; una persona valida. Nunca decide solo.

Condiciones: consentimiento explícito en cada envío de cuadros, cuadros reducidos y sin persistir, cara difuminada opcional antes de salir del celular, clave solo en la Edge Function, tope de costo (DEC-067). Requiere su propia DEC (DATA-GOVERNANCE lo tiene "pendiente de DEC propia").

## 6. Versión inicial vendible

MediaPipe + reglas en vivo en los tres ejercicios validados (sentadilla, curl, press) + Claude tras la serie y como coach + el modelo propio entrando por detrás, ejercicio por ejercicio, en modo sombra hasta superar a las reglas. Canal recomendado: entrenadores y gimnasios en Guatemala (épica 5) antes que usuario final. Ciclismo: experimento corto más adelante, no frente paralelo.

## 7. Roadmap del modelo propio

| Fase | Semanas | Entregables | Criterio de salida |
|---|---|---|---|
| **F0. Base** | 1 | Diagnóstico de las 25 fixtures (reps, avisos, tiempos y márgenes contra lo esperado; definir `expected` en las 15 que no lo tienen). Conversor Python video → landmarks con MediaPipe. Descarga y conversión de Mendeley, InfiniteRep y Kaggle CC0. `docs/TECHNIQUE-CRITERIA.md` y guía de grabación. DECs de la sección 8. | Datasets externos en esquema v2; criterios de sentadilla con fuente |
| **F1. Datos propios** | 2-3 | Grabar 5 personas con guion; etiquetar por cálculo; herramienta de revisión; validación con entrenador. Segunda opinión con Claude en Edge Function (usos 1 y 3). | ~300 reps etiquetadas por ejercicio; acuerdo con el entrenador registrado |
| **F2. Primer modelo** | 4-6 | Extractor de rasgos canónicos (paridad TS/Python). Modelo pequeño (GRU/TCN, 100k-300k parámetros) para errores de sentadilla por repetición. Evaluación LOSO. Export ONNX y `models/manifest.json`. Modo sombra en la app. | Supera a las reglas en LOSO; latencia aceptable en celular de gama media |
| **F3. Siete ejercicios** | 7-10 | Un modelo por ejercicio o multitarea; segmentador de repeticiones aprendido donde las reglas fallan; Prolific para variedad; retiro de reglas por ejercicio al superar el gate. | Reglas retiradas en al menos tres ejercicios |
| **F4. Volante** | continuo | Datos desde la app con consentimiento (DEC-064), reentrenamiento periódico, evaluación por cohorte, Claude con menos peso a medida que el modelo mejora. | Pipeline repetible sin intervención manual |

Cómputo: Kaggle (gratis, ~30 h GPU/semana). Entrenamiento y evaluación según `docs/ML-PIPELINE.md`; promoción por gate (`/promote-model`), no por DEC.

## 8. Decisiones que se formalizan en DEC

Números provisionales (DEC-062); se escriben con `/adr` en rama `adr/*` como primer paso de F0.

| DEC | Decisión | Sustituye o amplía |
|---|---|---|
| DEC-081 | Giro comercial: producto con facturación futura, datos solo con derechos comerciales, Claude en producción desde el inicio | DEC-035, DEC-065; reglas duras 7 y 8 pasan a transitorias |
| DEC-082 | Segunda opinión tras la serie con cuadros clave en Claude: consentimiento por envío, sin persistencia, Edge Function, tope de costo | Amplía DEC-027 y DEC-033; cierra el pendiente de DATA-GOVERNANCE |
| DEC-083 | Criterios de técnica con fuente y etiqueta calculada con validación de entrenador | Amplía DEC-055; sustituye la validación "como experto" de una sola persona |
| DEC-084 | MediaPipe en Python dentro de `ml/` para convertir video externo y propio a landmarks | Dependencia nueva (regla dura 9) |

## 9. Pendientes no técnicos

- LICENSE del repo y acuerdo de cesión con Sergio (trackers 3D), Edwar (ola 1 y sentadilla 3D), Elias (CSP, SW) y Christian (docs, datasets). Sin cesión, la parte de Sergio se reescribe.
- Repo privado al comercializar; revisión de marca "MovexNet".
- Plantilla de consentimiento con cláusula comercial y aviso de privacidad (`docs/DATA-GOVERNANCE.md` §5).
- Figura fiscal (SAT) y pasarela real antes de cobrar; hasta entonces, `MockPaymentProvider`.
- Precio y plan freemium definitivos (`docs/PRODUCT.md`).

## 10. Primera sesión de construcción

La cola completa, tarea por tarea y con su modelo, estado y dependencias, está en `docs/ROADMAP-COMERCIAL.md`; cada sesión abre con la primera fila pendiente de ese archivo. En resumen:

1. Rama `adr/giro-comercial`: DEC-081 a DEC-084 con `/adr` y filas en `docs/adr/README.md`.
2. Rama `feat/f0-base`: diagnóstico de fixtures y `docs/TECHNIQUE-CRITERIA.md` (sentadilla primero).
3. Rama `feat/f0-conversor`: conversor Python y descarga de los tres datasets libres a `ml/datasets/` con sus `dataset.json` (`allowedFor: product`).
4. Configurar la clave de Claude como secreto de Supabase y hacer una llamada de prueba desde la Edge Function (sin cuadros) para confirmar el crédito.

## Fuentes

- Biomechanical Review of the Squat Exercise (IJSPT): https://ijspt.scholasticahq.com/article/94600
- Munro, Herrington, Carolan (2012), fiabilidad del FPPA en video 2D: https://salford-repository.worktribe.com/output/1437145
- Kinetic analysis of push-up exercises, revisión sistemática: https://ro.ecu.edu.au/ecuworkspost2013/11189
- FitAQA, benchmark de calidad de técnica para modelos multimodales: https://arxiv.org/abs/2608.08736
- FLEX dataset: https://arxiv.org/abs/2506.03198
- Fitness-AQA: https://arxiv.org/abs/2202.14019
- QEVD (Qualcomm): https://arxiv.org/abs/2305.08191
- Mendeley kgbb3yn47p: https://doi.org/10.17632/kgbb3yn47p.2
- InfiniteRep: https://github.com/toinfinityai/InfiniteRep
- Prolific, pago recomendado: https://www.prolific.com/pricing
