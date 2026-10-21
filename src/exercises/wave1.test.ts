import { describe, expect, it } from 'vitest'
import { Tracker3D, type Tracker3DResult } from './tracker3d.ts'
import { BRIDGE_3D, DEFINITIONS_3D, LUNGE_3D, PUSHUP_3D, bodyLine, type Exercise3DId } from './definitions3d.ts'
import { DEMOS } from './demoPoses.ts'
import { FramePipeline } from '../analysis/framePipeline.ts'
import { LM, type Landmark3D } from '../geometry/vectors3d.ts'
import { jitter, playDemo, seededGauss, type PlayOptions } from '../testing/syntheticMotion.ts'

/** Ola 1 del asistente (DEC-056, issue #39): flexiones, zancadas y puente de glúteo. */

const CASES = [
  { id: 'flexiones', def: PUSHUP_3D, effortPhase: 3 },
  { id: 'zancadas', def: LUNGE_3D, effortPhase: 3 },
  { id: 'puente-gluteo', def: BRIDGE_3D, effortPhase: 1 },
] as const

function run(def: typeof PUSHUP_3D, id: string, opts: PlayOptions & { noise?: number; transform?: (w: Landmark3D[]) => Landmark3D[] } = {}) {
  const demo = DEMOS[id]
  const pipeline = new FramePipeline(def)
  const g = seededGauss()
  const fps = opts.fps ?? 30
  const frames = playDemo(demo, opts)
  const tail = frames.length ? frames[frames.length - 1].t : 0
  for (let i = 1; i <= 30; i++) frames.push({ t: tail + (i * 1000) / fps, p: 0, cycle: -1, world: demo.pose(0) })
  const results: Tracker3DResult[] = frames.map(f =>
    pipeline.process({ world: jitter(opts.transform ? opts.transform(f.world) : f.world, opts.noise ?? 0, g), t: f.t }).result)
  return {
    reps: results[results.length - 1].reps,
    issues: results.map(r => r.formIssue).filter(Boolean) as string[],
    results,
  }
}

describe.each(CASES)('ola 1: $id', ({ id, def, effortPhase }) => {
  it.each([15, 30, 60])('técnica correcta a %i fps cuenta 5 sin avisos de forma', fps => {
    const r = run(def, id, { fps, effortPhase })
    expect(r.reps).toBe(5)
    expect(r.issues).toEqual([])
  })

  it('con temblor de 10 mm sigue contando 5', () => {
    expect(run(def, id, { noise: 0.01, effortPhase }).reps).toBe(5)
  })

  it('un tirón brusco no cuenta', () => {
    expect(run(def, id, { speed: 0.12, effortPhase }).reps).toBe(0)
  })

  it('un recorrido del 30 % no cuenta', () => {
    expect(run(def, id, { pMax: 0.3, effortPhase }).reps).toBe(0)
  })

  it('el feedback en el esfuerzo es de técnica buena con la demo completa', () => {
    const r = run(def, id, { effortPhase })
    expect(r.results.some(x => x.phase === 'effort' && x.feedbackLevel === 'good')).toBe(true)
  })
})

describe('flexiones: alineación del cuerpo', () => {
  /** Desplaza la cadera en y: positiva = hacia el suelo (cadera caída). */
  const moveHips = (dy: number) => (w: Landmark3D[]) => w.map((p, i) =>
    i === LM.LEFT_HIP || i === LM.RIGHT_HIP ? { ...p, y: p.y + dy } : p)

  /** Lado derecho tapado, como de perfil con la cámara a la izquierda. */
  const hideRight = (w: Landmark3D[]) => w.map((p, i) =>
    i === LM.RIGHT_SHOULDER || i === LM.RIGHT_HIP || i === LM.RIGHT_ANKLE ? { ...p, visibility: 0.1 } : p)

  it('la tabla recta mide ~180° con un solo lado, en el plano vertical (DEC-071)', () => {
    const line = bodyLine(DEMOS.flexiones.pose(0))!
    expect(line.angle).toBeGreaterThan(178)
    expect(Math.abs(line.deviationDeg)).toBeLessThan(1)
  })

  it('una cadera caída leve (6 cm, ~10°) dispara hip_sag; con el umbral anterior de 20° pasaba', () => {
    expect(run(PUSHUP_3D, 'flexiones', { effortPhase: 3, transform: moveHips(0.06) }).issues).toContain('hip_sag')
  })

  it('con el lado lejano tapado sigue evaluando la cadera', () => {
    const r = run(PUSHUP_3D, 'flexiones', { effortPhase: 3, transform: w => hideRight(moveHips(0.12)(w)) })
    expect(r.issues).toContain('hip_sag')
  })

  it('arriba, descansando entre repeticiones, la cadera alta no avisa: solo se revisa durante la flexión', () => {
    const pipeline = new FramePipeline(PUSHUP_3D)
    const restingPiked = moveHips(-0.2)(DEMOS.flexiones.pose(0))
    const issues: string[] = []
    for (let t = 0; t <= 1000; t += 33) {
      const r = pipeline.process({ world: restingPiked, t }).result
      if (r.formIssue) issues.push(r.formIssue)
    }
    expect(issues).toEqual([])
  })

  it('una cadera apenas levantada (6 cm, ~−10°) no avisa', () => {
    expect(run(PUSHUP_3D, 'flexiones', { effortPhase: 3, transform: moveHips(-0.06) }).issues).toEqual([])
  })

  it('la cadera caída dispara hip_sag', () => {
    expect(run(PUSHUP_3D, 'flexiones', { effortPhase: 3, transform: moveHips(0.12) }).issues).toContain('hip_sag')
  })

  it('la cadera levantada dispara hip_pike', () => {
    expect(run(PUSHUP_3D, 'flexiones', { effortPhase: 3, transform: moveHips(-0.14) }).issues).toContain('hip_pike')
  })
})

describe('zancadas: tronco', () => {
  it('inclinar el tronco hacia adelante dispara trunk_lean', () => {
    const lean = (w: Landmark3D[]) => w.map((p, i) =>
      i <= LM.RIGHT_WRIST || (i >= 17 && i <= 22) ? { ...p, z: p.z - 0.4 } : p)
    expect(run(LUNGE_3D, 'zancadas', { effortPhase: 3, transform: lean }).issues).toContain('trunk_lean')
  })

  it('funciona con una sola pierna visible (vista lateral)', () => {
    const tracker = new Tracker3D(LUNGE_3D)
    const hidden = DEMOS.zancadas.pose(0.9).map((p, i) =>
      [LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE].includes(i as 24 | 26 | 28) ? { ...p, visibility: 0.1 } : p)
    expect(tracker.update(hidden, 0).activeSides).toEqual(['left'])
  })
})

describe('puente de glúteo: extensión', () => {
  it('una extensión incompleta cuenta pero avisa de subir más la cadera', () => {
    // 72 % del recorrido: la cadera llega a ~162°, por encima de 158° (cuenta) y por debajo de 165° (buena).
    const r = run(BRIDGE_3D, 'puente-gluteo', { effortPhase: 1, pMax: 0.72 })
    expect(r.reps).toBe(5)
    expect(r.results.some(x => x.feedbackMessage.includes('sube más la cadera'))).toBe(true)
  })
})

it('los seis ejercicios con conteo 3D están registrados con su id', () => {
  const ids = Object.keys(DEFINITIONS_3D) as Exercise3DId[]
  expect(ids).toEqual(['squat', 'curl', 'press', 'pushup', 'lunge', 'bridge'])
  for (const id of ids) expect(DEFINITIONS_3D[id].id).toBe(id)
})
