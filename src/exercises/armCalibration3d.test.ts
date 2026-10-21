/**
 * Curl y press en el motor 3D contra grabaciones reales (DEC-073 y DEC-075, issue #58).
 *
 * Fixtures de una persona (s01, Xiaomi 15T con Chrome), con 6–8 repeticiones reales por
 * toma. Cada archivo es un recorte de menos de 2 MB de la toma completa, así que trae parte
 * de la serie: los valores esperados son los de los archivos recortados.
 *
 * Límites conocidos, sin test todavía (ver DEC-073):
 * - de frente, el curl a medias cuenta como completo (el antebrazo va hacia la cámara);
 * - los tirones del curl no se rechazan;
 * - el press de perfil bajando los codos de más casi no cuenta.
 */
import { describe, expect, it } from 'vitest';
import { FramePipeline } from '../analysis/framePipeline';
import type { LandmarkFixture } from '../testing/fixtureTypes.ts';
import { CURL_3D, PRESS_3D } from './definitions3d';
import type { ExerciseDefinition3D } from './tracker3d';

const FIXTURES = new Map(
  Object.entries(import.meta.glob('../../fixtures/landmarks/*.json', { eager: true, import: 'default' }))
    .map(([path, mod]) => [path.split('/').pop()!.replace('.json', ''), mod as LandmarkFixture]),
);

function play(name: string, def: ExerciseDefinition3D) {
  const fx = FIXTURES.get(name);
  if (!fx) throw new Error(`Fixture no encontrado: ${name}`);
  const pipeline = new FramePipeline(def);
  let reps = 0;
  let frames = 0;
  const issues = new Map<string, number>();
  for (const f of fx.frames) {
    if (!f.world) continue;
    const worldDown = f.down ? { x: f.down[0], y: f.down[1], z: f.down[2] } : null;
    const { result } = pipeline.process({ world: f.world, t: f.t, worldDown });
    reps = result.reps;
    frames++;
    if (result.formIssue) issues.set(result.formIssue, (issues.get(result.formIssue) ?? 0) + 1);
  }
  return { reps, issueRate: (code: string) => (issues.get(code) ?? 0) / frames };
}

describe('curl 3D con grabaciones reales (DEC-073)', () => {
  it.each(['curl-side-good-01', 'curl-front-good-01'])('%s: cuenta las repeticiones bien hechas', name => {
    const { reps } = play(name, CURL_3D);
    expect(reps).toBeGreaterThanOrEqual(5);
    expect(reps).toBeLessThanOrEqual(8);
  });

  it('de perfil, el curl a medias casi no cuenta', () => {
    expect(play('curl-side-partial-rom-01', CURL_3D).reps).toBeLessThanOrEqual(1);
  });

  it.each(['curl-side-good-01', 'curl-front-good-01'])('%s: sin "pega el codo" en curls bien hechos (DEC-075)', name => {
    expect(play(name, CURL_3D).issueRate('elbow_drift')).toBe(0);
  });

  it('con el codo despegado, "pega el codo" sí sale (DEC-075)', () => {
    expect(play('curl-front-elbow-drift-01', CURL_3D).issueRate('elbow_drift')).toBeGreaterThan(0);
  });
});

describe('press 3D con grabaciones reales (DEC-073)', () => {
  it.each(['press-side-good-01', 'press-front-good-02'])('%s: cuenta las repeticiones bien hechas', name => {
    const { reps } = play(name, PRESS_3D);
    expect(reps).toBeGreaterThanOrEqual(5);
    expect(reps).toBeLessThanOrEqual(8);
  });

  it.each(['press-side-partial-rom-01', 'press-front-partial-rom-01'])('%s: el press a medias no cuenta', name => {
    expect(play(name, PRESS_3D).reps).toBe(0);
  });

  it.each(['press-side-good-01', 'press-front-good-02'])('%s: sin aviso de "cuida los hombros"', name => {
    expect(play(name, PRESS_3D).issueRate('unsafe_low_elbow')).toBe(0);
  });
});
