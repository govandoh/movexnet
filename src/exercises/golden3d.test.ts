/**
 * Golden tests del motor 3D, el predeterminado desde DEC-078.
 *
 * Cada fixture real de `fixtures/landmarks/` (`source: phone`, con `world`) se reproduce
 * por `FramePipeline` con la definición de su ejercicio, y el resumen queda en un snapshot:
 * repeticiones, descartes, avisos de técnica y el aviso en cada pico. Congelan el
 * comportamiento que se validó en celular (DEC-073, DEC-075, DEC-077) antes de seguir
 * cambiando el motor.
 *
 * Reglas, las mismas que `golden.test.ts` (motor 2D):
 * - Cambiar un snapshot existente exige una DEC enlazada en el PR.
 * - Un fixture nuevo agrega su snapshot sin DEC.
 *
 * Los golden del motor 2D (`golden.test.ts`) se mantienen mientras exista `?engine=2d`.
 */
import { describe, expect, it } from 'vitest';
import { FramePipeline } from '../analysis/framePipeline';
import type { FixtureIndex, LandmarkFixture } from '../testing/fixtureTypes.ts';
import { DEFINITIONS_3D } from './definitions3d';

const MODULES = import.meta.glob('../../fixtures/landmarks/*.json', { eager: true, import: 'default' }) as Record<
  string,
  unknown
>;
const INDEX = MODULES['../../fixtures/landmarks/index.json'] as FixtureIndex;
const load = (file: string) => MODULES[`../../fixtures/landmarks/${file}`] as LandmarkFixture;

/** Ejercicios con definición 3D que tienen grabaciones reales. */
const REAL = INDEX.fixtures.filter(
  e => e.source === 'phone' && (e.exercise === 'squat' || e.exercise === 'curl' || e.exercise === 'press'),
);

function summarize(fx: LandmarkFixture, exercise: 'squat' | 'curl' | 'press') {
  const pipeline = new FramePipeline(DEFINITIONS_3D[exercise]);
  const rejections: Record<string, number> = {};
  const warnings: Record<string, number> = {};
  const issueAtPeak: string[] = [];
  let reps = 0;
  let frames = 0;
  let previous: string | null = null;
  for (const f of fx.frames) {
    if (!f.world) continue;
    frames++;
    const worldDown = f.down ? { x: f.down[0], y: f.down[1], z: f.down[2] } : null;
    const { result } = pipeline.process({ world: f.world, t: f.t, worldDown });
    reps = result.reps;
    if (result.rejection) rejections[result.rejection] = (rejections[result.rejection] ?? 0) + 1;
    // Un aviso cuenta una vez por tramo seguido, que es como lo ve la persona.
    if (result.formIssue && result.formIssue !== previous) {
      warnings[result.formIssue] = (warnings[result.formIssue] ?? 0) + 1;
    }
    previous = result.formIssue;
    if (result.peak) issueAtPeak.push(result.formIssue ?? '-');
  }
  // En una línea por toma: el snapshot se lee de un vistazo y el diff queda corto.
  return { frames, reps, rejections, warnings, issueAtPeak: issueAtPeak.join(' ') };
}

describe('motor 3D con grabaciones reales (golden, DEC-078)', () => {
  it('hay grabaciones reales de sentadilla, curl y press', () => {
    for (const ex of ['squat', 'curl', 'press']) expect(REAL.some(e => e.exercise === ex)).toBe(true);
  });

  it.each(REAL.map(e => [e.file.replace('.json', ''), e] as const))('%s', (_name, entry) => {
    const s = summarize(load(entry.file), entry.exercise as 'squat' | 'curl' | 'press');
    expect(s.frames).toBe(entry.frames);
    expect(s).toMatchSnapshot();
  });
});
