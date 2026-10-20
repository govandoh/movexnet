import { describe, expect, it } from 'vitest'
import type { ExerciseDefinition3D } from './tracker3d.ts'
import { LUNGE_3D, PUSHUP_3D, SQUAT_3D, needsStandingCalibration } from './definitions3d.ts'
import { DEMOS } from './demoPoses.ts'
import { FramePipeline } from '../analysis/framePipeline.ts'
import type { Landmark3D } from '../geometry/vectors3d.ts'
import { playDemo } from '../testing/syntheticMotion.ts'

/**
 * Umbrales de vuelta al reposo calibrados con grabaciones reales (DEC-066, issues #39 y #49).
 *
 * En celular, el 3D de MediaPipe mide la articulación en la posición de inicio menos
 * extendida de lo que está (sentadilla de pie: ~150° en vez de ~175°). Estas pruebas
 * reproducen esa compresión con las demos: acercan la posición de inicio al esfuerzo hasta
 * que el ángulo medido es el de las grabaciones, y comprueban que las 5 reps se cuentan con
 * el umbral nuevo y ninguna con el anterior (que esperaba una extensión que no llega).
 */

const CASES = [
  // `startDeg`: ángulo en la posición de inicio medido en las grabaciones (mediana o mínimo).
  { id: 'sentadilla', def: SQUAT_3D, effortPhase: 3, oldRestDeg: 160, startDeg: 148 },
  { id: 'flexiones', def: PUSHUP_3D, effortPhase: 3, oldRestDeg: 150, startDeg: 145 },
  { id: 'zancadas', def: LUNGE_3D, effortPhase: 3, oldRestDeg: 160, startDeg: 142 },
] as const

/** Ángulo primario de una pose, combinando los lados como el contador. */
function primaryAngle(def: ExerciseDefinition3D, world: Landmark3D[]): number {
  const a = [def.sideAngle(world, 'left'), def.sideAngle(world, 'right')]
  if (def.combine === 'min') return Math.min(...a)
  if (def.combine === 'max') return Math.max(...a)
  return (a[0] + a[1]) / 2
}

/** Avance `p` de la demo cuya pose mide `targetDeg` (bisección; el ángulo es monótono en `p`). */
function progressAt(def: ExerciseDefinition3D, id: string, targetDeg: number): number {
  const demo = DEMOS[id]
  const sign = Math.sign(primaryAngle(def, demo.pose(0)) - targetDeg)
  let lo = 0
  let hi = 1
  for (let i = 0; i < 40; i++) {
    const p = (lo + hi) / 2
    if (Math.sign(primaryAngle(def, demo.pose(p)) - targetDeg) === sign) lo = p
    else hi = p
  }
  return (lo + hi) / 2
}

/** 5 reps de la demo con la posición de inicio comprimida hasta `startDeg`. */
function run(def: ExerciseDefinition3D, id: string, effortPhase: number, startDeg: number) {
  const demo = DEMOS[id]
  const p0 = progressAt(def, id, startDeg)
  const timeline = playDemo(demo, { fps: 30, effortPhase }).map(f => ({ t: f.t, p: f.p }))
  // 1 s de reposo al final para cerrar la última rep, con el mismo inicio comprimido.
  const tail = timeline.length ? timeline[timeline.length - 1].t : 0
  for (let i = 1; i <= 30; i++) timeline.push({ t: tail + (i * 1000) / 30, p: 0 })
  const pipeline = new FramePipeline(def)
  let reps = 0
  for (const f of timeline) reps = pipeline.process({ world: demo.pose(p0 + (1 - p0) * f.p), t: f.t }).result.reps
  return { reps, restAngle: primaryAngle(def, demo.pose(p0)) }
}

describe('flexiones: profundidad buena con el fondo comprimido como en celular (DEC-066)', () => {
  /** Feedback en el frame en que se confirma el fondo, con la bajada hasta `bottomDeg`. */
  function levelAtBottom(bottomDeg: number) {
    const pMax = progressAt(PUSHUP_3D, 'flexiones', bottomDeg)
    const pipeline = new FramePipeline(PUSHUP_3D)
    const levels: string[] = []
    for (const f of playDemo(DEMOS.flexiones, { fps: 30, effortPhase: 3, pMax, cycles: 2 })) {
      const r = pipeline.process({ world: f.world, t: f.t }).result
      if (r.peak) levels.push(r.feedbackLevel)
    }
    return levels
  }

  it('una flexión completa que el 3D mide a 92° es "buena bajada"', () => {
    expect(levelAtBottom(92)).toEqual(['good', 'good'])
  })

  it('una bajada corta (98°) cuenta, pero sigue pidiendo bajar más', () => {
    expect(levelAtBottom(98)).toEqual(['warning', 'warning'])
  })
})

describe.each(CASES)('reposo comprimido como en celular: $id', ({ id, def, effortPhase, oldRestDeg, startDeg }) => {
  it(`con la posición de inicio a ${startDeg}° cuenta las 5 reps`, () => {
    const r = run(def, id, effortPhase, startDeg)
    expect(r.restAngle).toBeCloseTo(startDeg, 0)
    expect(r.reps).toBe(5)
  })

  it(`con el umbral anterior (${oldRestDeg}°) no se cerraba ninguna`, () => {
    const old = { ...def, cycle: { ...def.cycle, restDeg: oldRestDeg } }
    expect(run(old, id, effortPhase, startDeg).reps).toBe(0)
  })
})

describe('ejercicios de suelo: la preparación no espera la calibración de pie (#39, DEC-071)', () => {
  it('flexiones, puente y plancha no la esperan; los que empiezan de pie, sí', () => {
    expect((['pushup', 'bridge', 'plank'] as const).map(ex => needsStandingCalibration(ex))).toEqual([false, false, false])
    expect((['squat', 'curl', 'press', 'lunge'] as const).map(ex => needsStandingCalibration(ex))).toEqual([true, true, true, true])
  })
})
