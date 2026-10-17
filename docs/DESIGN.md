# Sistema de diseño de MovexNet

Fuente de verdad de la identidad visual, los tokens, los componentes y el movimiento de la app. La decisión que lo adopta es `DEC-058`. Las maquetas navegables están en el lienzo de diseño del equipo (enlace en `DEC-058`); si una maqueta y este documento no coinciden, manda este documento.

Referencias usadas: la skill ui-ux-pro-max (paleta y tipografía para apps de fitness), las skills de animación de Emil Kowalski instaladas en `.claude/skills/` (reglas de movimiento), patrones de Cult UI rehechos en CSS (sección 8), y Apple Fitness y Samsung Health como referencia de estructura, no de estilo.

## 1. Identidad: la red de 33 puntos

MovexNet junta *move* (movimiento) y *net* (red): la cámara lee el cuerpo como una red de 33 puntos (MediaPipe Pose). Ese es el motivo visual de toda la app.

- **Anillo de 33 nodos.** El progreso se dibuja como 33 puntos en círculo que se encienden, uno por punto del cuerpo. Sustituye a los anillos concéntricos: no se usan anillos de Apple.
- **Nodos y líneas.** El esqueleto (líneas índigo, articulaciones en voltaje) aparece en la cámara y, como decoración tenue, en tarjetas destacadas.
- **Fondo de puntos.** Retícula de puntos de 1 px cada 18-20 px al 12-13 % de opacidad, solo en cabeceras y pantallas de gestión; nunca sobre la cámara.
- **Logo.** Cinco nodos voltaje unidos por líneas índigo que forman una "M", junto a la palabra `movexnet` en Barlow Condensed 800 itálica minúscula (`DEC-068`). Componente `MovexMark`; íconos de la PWA generados con `node scripts/generate-icons.mjs` a partir de la misma geometría.
- **Voz deportiva.** Títulos de pantalla y botones principales en Barlow Condensed itálica y mayúsculas ("HOY", "EMPEZAR CON ASISTENTE").

## 2. Color

Tema oscuro por defecto; la cámara manda y el fondo oscuro no compite con ella. Los nombres de variable son los que usará `src/ui/tokens.css`.

| Token | Variable | Valor | Uso |
|---|---|---|---|
| Tinta | `--color-ink` | `#0B0E14` | Fondo de la app; texto sobre voltaje |
| Tinta cámara | `--color-ink-camera` | `#0F131B` | Fondo detrás del video mientras carga |
| Pizarra | `--color-surface` | `#141925` | Tarjetas, hojas |
| Pizarra 2 | `--color-surface-2` | `#1D2433` | Controles secundarios, pistas de barras |
| Línea | `--color-line` | `#2A3345` | Bordes, nodos apagados |
| Niebla | `--color-text` | `#EEF1F7` | Texto principal |
| Acero | `--color-text-muted` | `#9AA4B8` | Texto secundario (7:1 sobre Pizarra) |
| Voltaje | `--color-volt` | `#D7FF3A` | Acción principal, repetición bien hecha, nodos encendidos |
| Índigo | `--color-indigo` | `#7B6CFF` | Asistente, red del esqueleto, técnica (rellenos y trazos) |
| Índigo claro | `--color-indigo-text` | `#A99FFF` | Texto índigo sobre fondo oscuro |
| Ámbar | `--color-amber` | `#FFB547` | Corrección de técnica, "nivelar" |
| Coral | `--color-coral` | `#FF6B57` | Error, repetición no contada |

Reglas:

- El texto sobre voltaje es siempre Tinta (nunca blanco).
- El índigo `#7B6CFF` no se usa para texto pequeño; para texto va `#A99FFF`.
- Un estado nunca se comunica solo con color: el aviso lleva ícono y texto, y la voz dice lo mismo.
- Fondos tintados de estado: el color al 14-20 % de opacidad (`rgba(215, 255, 58, 0.14)` para voltaje, `rgba(255, 181, 71, 0.16)` para ámbar, `rgba(123, 108, 255, 0.2)` para índigo).

## 3. Tipografía

- **Barlow Condensed** (600, 700; itálica 700 y 800): cifras, títulos, botones principales.
- **Barlow** (400, 500, 600, 700): texto.
- Ambas con licencia OFL, **servidas desde la propia app** (`src/ui/fonts/`, empaquetadas por Vite con hash; `font-display: swap`) para que funcione sin conexión y no haga pedidos a terceros. Respaldo: `system-ui, sans-serif`.
- Cifras con `font-variant-numeric: tabular-nums` para que el contador no baile.

| Rol | Tamaño / peso |
|---|---|
| Contador de repeticiones | 132 px, Condensed 700 |
| Título de pantalla | 44-46 px, Condensed 800 itálica, mayúsculas |
| Título de tarjeta | 26-32 px, Condensed 700 |
| Botón principal | 21 px, Condensed 800 itálica, mayúsculas |
| Texto | 16-17 px, Barlow 400-600, interlineado 1,45-1,5 |
| Etiqueta y pie | 13-14 px; nunca menos de 12 px |

## 4. Espacio y forma

- Escala de 4 px; márgenes laterales de 16-20 px en pantallas de gestión.
- Radios: botón 18 px, tarjeta 22-26 px, chip 12 px, píldora de estado 9 px, hoja inferior 28 px arriba, isla de aviso 24 px.
- Objetivos táctiles de 44 px como mínimo; botón principal de 54 px de alto.
- **Tarjeta de borde doble:** contenedor de 1 px en `--color-line` con la tarjeta dentro y un brillo superior `inset 0 1px 0 rgba(238, 241, 247, 0.06)`. Sin sombras paralelas grandes.
- **Botón principal:** fondo voltaje, texto Tinta y un bisel inferior `inset 0 -3px 0 rgba(11, 14, 20, 0.22)`.
- Las acciones principales van en la mitad inferior de la pantalla, al alcance del pulgar.

## 5. Componentes

| Componente | Descripción |
|---|---|
| Botón principal | Voltaje, 54 px, radio 18, Condensed 800 itálica mayúsculas, ícono opcional a la izquierda |
| Botón secundario | Pizarra 2 con borde Línea, texto Niebla, Barlow 600 |
| Chip de ejercicio | 40 px, radio 12; activo en Niebla con texto Tinta, inactivo con borde Línea |
| Píldora de estado del nivelador | 28 px, radio 9: "Nivelado N°" (voltaje), "Nivelar" (ámbar, botón), "Calibrando" (índigo) |
| Insignia "Asistente" | Índigo al 20 % con texto índigo claro e ícono de tres nodos |
| Isla de aviso | Píldora negra de 48 px arriba de la cámara, con círculo de ícono tintado (ámbar para corregir, coral para error, voltaje para bien) y el mismo texto que dice la voz; `role="status"` |
| Anillo de 33 nodos | 33 círculos en circunferencia; encendidos en voltaje (r mayor), apagados en Línea; cifra al centro |
| Barra de repeticiones | Un segmento por repetición objetivo: voltaje bien, ámbar con aviso, coral no contada, Pizarra 2 pendiente |
| Navegación inferior | 5 pestañas: Hoy, Rutinas, **Entrenar** (botón voltaje central elevado), Ejercicios, Perfil |
| Hoja inferior | Pizarra, radio 28 arriba, asa de 40 x 5 px; se cierra arrastrando hacia abajo |
| Nivelador | Círculo con cruz, objetivo punteado y burbuja que sigue al acelerómetro; ámbar fuera del objetivo, voltaje dentro |

## 6. Movimiento

Aplicación de las reglas de Emil Kowalski (`.claude/skills/animate`, `review-animations`) a MovexNet. Solo se anima lo que confirma, orienta o celebra.

### Tokens

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);       /* entradas y salidas */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);   /* movimiento en pantalla */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);    /* hojas inferiores */
--dur-press: 140ms;
--dur-fast: 180ms;
--dur-base: 240ms;
--dur-sheet: 380ms;
--stagger: 40ms;
```

### Catálogo de momentos

| Momento | Frecuencia | Propósito | Herramienta | Qué se anima | Curva y duración | Con movimiento reducido |
|---|---|---|---|---|---|---|
| Presionar un botón | Muchas veces | Respuesta | Transición CSS en `:active` | `scale(0.97)` | `--ease-out`, 140 ms | Sin escala |
| Repetición contada | Decenas por sesión | Estado | Transición CSS o WAAPI | Número sale `translateY(-40%)` + opacidad; entra desde `translateY(40%)`; el nodo del anillo pasa de `scale(0.6)` a `1` | `--ease-out`, 180 ms, sin rebote | Solo fundido |
| Isla de aviso | Varias por serie | Estado | Transición CSS | `scaleX` de la píldora desde 0,34 y opacidad del texto con 60 ms de retraso | `--ease-in-out`, 240 ms | Solo fundido |
| Nivelador | Continuo en preparación | Estado | `requestAnimationFrame` con interpolación suave sobre `transform` | Posición de la burbuja; color al centrarse y vibración de 10 ms (`navigator.vibrate`, donde exista) | Resorte suave, sin rebote | Posición sin interpolar |
| Hoja inferior | Ocasional | Espacial | Transición CSS + arrastre con puntero | `translateY(100%)` a `0`; cierre por el mismo camino | `--ease-drawer`, 380 ms | Fundido |
| Serie completada | Rara | Celebración | Animación CSS | Los 33 nodos se encienden en cadena, 30 ms entre uno y otro | `--ease-out`, 180 ms por nodo | Anillo lleno sin cadena |
| Abrir un ejercicio del catálogo | Varias por visita | Estado | Transición CSS | Chevron `rotate(90deg)` | `--ease-out`, 180 ms | Sin transición |
| Tarjetas al entrar a una pantalla | Ocasional | Evitar salto brusco | `@starting-style` | Opacidad y `translateY(8px)`, escalonado de 40 ms, máximo 6 | `--ease-out`, 240 ms | Solo fundido |
| Cambiar de pestaña o de ejercicio | Muchas veces | — | — | Nada; como mucho un fundido de 150 ms | — | — |
| Pestañas de la ficha de técnica | Varias por ficha | Espacial | Transición CSS | Indicador `translateX` bajo la pestaña (Direction Aware Tabs); el panel entra con opacidad y `translateY(6px)` | `--ease-in-out`, 240 ms (indicador); `--ease-out`, 240 ms (panel) | Sin transición |
| Demo 3D de la técnica | Continuo con la ficha abierta | Explicación | three.js en un `requestAnimationFrame` propio, solo con la ficha abierta | Esqueleto de 33 puntos en bucle y giro lento de la cámara hasta que el usuario lo toca | Suavizado 0,25 por cuadro | Sin giro automático ni suavizado |
| Mini mapa 3D: soltar tras arrastrar | Ocasional | Espacial | `transform` directo al arrastrar; transición CSS al soltar | El panel se ancla al borde más cercano | `--ease-drawer`, 380 ms | Salto sin transición |
| Consejos de la serie | Ocasional | Estado | `@starting-style` | Opacidad y `translateY(-6px)` al aparecer | `--ease-out`, 180 ms | Solo aparición |

### Reglas

- Solo `transform` y `opacity` (y `clip-path` si hace falta). Nunca `width`, `height`, `top`, `left`, `margin` ni `transition: all`.
- Nunca `ease-in` en la interfaz ni entradas desde `scale(0)`: desde 0,95 como mínimo.
- Menos de 300 ms en la interfaz, salvo hojas (380 ms) y la celebración.
- Transiciones, no keyframes, para lo que se dispara seguido (isla, contador): se retoman desde el valor actual.
- `@media (prefers-reduced-motion: reduce)` acompaña a cada animación desde el primer commit.
- Efectos de `:hover` solo dentro de `@media (hover: hover) and (pointer: fine)`.
- **Presupuesto de la cámara.** Durante el entrenamiento el hilo principal es del bucle de detección. Sobre la cámara solo se animan elementos DOM con `transform`/`opacity`; nada provoca un render de React por cuadro, y el esqueleto se sigue dibujando en el canvas, sin animaciones CSS.

## 7. Móvil, responsive y accesibilidad

Regla de diseño y de funcionalidad (`DEC-060`): la app es responsiva y funcional en cualquier celular, vertical u horizontal, con notch, Dynamic Island o barra de gestos.

- **Matriz mínima:** Android 320×568, 360×740 y 412×915; iPhone SE 375×667; iPhone 15 Pro 393×852 y 15 Pro Max 430×932 con Dynamic Island; iPhone 15 Pro en horizontal 852×393.
- **Áreas seguras solo con tokens:** `--safe-top/right/bottom/left` y `--gutter-left/right`. Nunca `env(safe-area-inset-*)` fuera de `tokens.css`.
- **Pantallas con scroll:** `height: 100dvh` (o `flex: 1` dentro del contenedor), nunca `min-height`, con `overflow-y: auto`; los hijos llevan `flex-shrink: 0`.
- **Texto:** el botón principal va en una línea con `font-size: clamp(16px, 5.2vw, 21px)`; las filas etiqueta–valor llevan separación y la etiqueta se corta con puntos suspensivos; los títulos usan interlineado de 1,1 como mínimo.
- **Tamaños que escalan:** anillo `min(150px, 38vw)`, nivelador `clamp(112px, 24dvh, 176px)`, contador `clamp(84px, 16dvh, 132px)`; paneles de la cámara con ancho máximo de 560 px en horizontal.
- **Verificación:** `node scripts/audit-responsive.cjs` debe terminar en "SIN PROBLEMAS", además de la prueba en un celular real.
- `100dvh` y `viewport-fit=cover`.
- `-webkit-tap-highlight-color: transparent` y `touch-action: manipulation` en controles; `user-select: none` en botones.
- Campos de texto a 16 px como mínimo (evita el zoom de iOS).
- `aria-live="polite"` en el contador y la isla de aviso; foco visible en todos los controles; contraste AA.
- Probar en celular real (Android Chrome e iOS Safari) antes de pedir revisión: la skill `mobile-native` tiene la lista de síntomas.

## 8. Patrones de Cult UI, rehechos sin dependencias

Cult UI depende de Tailwind, shadcn y la librería `motion`, que MovexNet no usa (regla dura 9 y `DEC-008`). Se toman sus ideas y se implementan con CSS y WAAPI:

| Patrón de Cult UI | En MovexNet |
|---|---|
| Dynamic Island | Isla de aviso de técnica sobre la cámara |
| Texture Card | Tarjeta de borde doble con brillo superior |
| Animated Number | Contador de repeticiones con salida y entrada vertical |
| Family Drawer / Side Panel | Hoja inferior de Premium, selector de ejercicio y descanso |
| Fractal dot grid | Fondo de puntos estático (sin animación) |
| Direction Aware Tabs | Semanas del programa y secciones de la ficha de técnica (indicador que se desplaza con `transform`) |

Se descartan los efectos con shaders o canvas animado (liquid metal, lens blur, dithering): compiten por la GPU con la detección de pose.

Si una interacción necesita resortes con velocidad (arrastre con inercia), se propone `motion` con su propia DEC antes de instalarlo.
