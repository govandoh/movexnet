import type { Landmark3D } from '../geometry/vectors3d.ts';
import { bodyLine, hipIssue } from './definitions3d.ts';
import type { FeedbackLevel } from './tracker3d.ts';

/**
 * Plancha: ejercicio isométrico, sin repeticiones (ola 1 de DEC-056, issue #39).
 *
 * No encaja en `Tracker3D` porque no hay ciclo: se mide el TIEMPO sostenido en posición
 * correcta. El tiempo solo corre mientras:
 * - el cuerpo está en horizontal: la recta hombro-tobillo a más de `MIN_HORIZONTAL_DEG` de
 *   la vertical. Se usa esa recta y no el tronco porque con la cadera caída el tronco se
 *   endereza y una plancha hundida parecería "de pie"; y
 * - la línea hombro-cadera-tobillo está recta (`bodyLine` y `hipIssue`, el mismo criterio que
 *   la flexión).
 *
 * Basta con ver un lado del cuerpo: de perfil el lado lejano suele estar tapado, y exigir los
 * dos frenaba el tiempo y ocultaba la cadera caída (#59, DEC-071).
 *
 * Con la cadera caída o levantada el tiempo se pausa y se avisa (`hip_sag` / `hip_pike`).
 * Supone landmarks nivelados (DEC-050): la horizontal se mide contra la gravedad.
 */

/** Inclinación mínima de la recta hombros-tobillos respecto a la vertical para estar en plancha, en grados. */
const MIN_HORIZONTAL_DEG = 55;
/** Hueco máximo entre frames que suma al tiempo sostenido, en ms (una pausa no cuenta). */
const MAX_FRAME_GAP_MS = 200;

export interface PlankResult {
  exerciseId: 'plank';
  visible: boolean;
  /** true mientras el tiempo corre (posición correcta). */
  holding: boolean;
  /** Tiempo sostenido en posición correcta, en ms. */
  heldMs: number;
  /** Segundos enteros sostenidos (lo que muestra el overlay). */
  heldSeconds: number;
  formIssue: 'hip_sag' | 'hip_pike' | null;
  bodyLineDeg: number;
  feedbackLevel: FeedbackLevel;
  feedbackMessage: string;
}

export class PlankTracker {
  private heldMs = 0;
  private lastTimeMs: number | null = null;

  update(world: readonly Landmark3D[], timeMs: number): PlankResult {
    const gap = this.lastTimeMs === null ? 0 : timeMs - this.lastTimeMs;
    this.lastTimeMs = timeMs;

    const line = bodyLine(world);
    if (!line) {
      return this.result(false, false, null, 0, 'idle', 'Ponte de perfil, con el cuerpo completo a la vista');
    }
    if (line.inclineDeg < MIN_HORIZONTAL_DEG) {
      return this.result(true, false, null, line.angle, 'idle', 'Colócate en plancha para empezar');
    }

    const issue = hipIssue(line);
    if (issue === 'hip_sag') return this.result(true, false, 'hip_sag', line.angle, 'bad', 'Aprieta el abdomen, la cadera se cae');
    if (issue === 'hip_pike') return this.result(true, false, 'hip_pike', line.angle, 'warning', 'Baja la cadera, cuerpo en línea recta');

    if (gap > 0 && gap <= MAX_FRAME_GAP_MS) this.heldMs += gap;
    return this.result(true, true, null, line.angle, 'good', 'Así, mantén la línea');
  }

  reset(): void {
    this.heldMs = 0;
    this.lastTimeMs = null;
  }

  private result(
    visible: boolean, holding: boolean, formIssue: PlankResult['formIssue'], bodyLineDeg: number,
    feedbackLevel: FeedbackLevel, feedbackMessage: string,
  ): PlankResult {
    return {
      exerciseId: 'plank', visible, holding,
      heldMs: this.heldMs, heldSeconds: Math.floor(this.heldMs / 1000),
      formIssue, bodyLineDeg, feedbackLevel, feedbackMessage,
    };
  }
}
