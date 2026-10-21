import { describe, expect, it } from 'vitest'
import { Tracker3D, type Tracker3DResult } from './tracker3d.ts'
import { CURL_3D, PRESS_3D, SQUAT_3D } from './definitions3d.ts'
import { DEMOS, type DemoDefinition } from './demoPoses.ts'
import { FramePipeline } from '../analysis/framePipeline.ts'
import { LM, type Landmark3D, type Vec3 } from '../geometry/vectors3d.ts'
import { jitter, playDemo, rotateCamera, seededGauss, tiltPose, type PlayOptions } from '../testing/syntheticMotion.ts'

/**
 * Pruebas del contador 3D portadas de `scripts/pruebas-motor.mjs` de fitnetv2 (DEC-048),
 * más una por cada defecto de fitnetv2 corregido en el port (DEC-054, DEC-057).
 */

const CASES = [
  { id: 'sentadilla', def: SQUAT_3D, effortPhase: 3 },
  { id: 'curl-biceps', def: CURL_3D, effortPhase: 1 },
  { id: 'press-hombro', def: PRESS_3D, effortPhase: 1 },
] as const

interface RunOptions extends PlayOptions {
  noise?: number
  /** Transforma cada pose antes del pipeline (inclinación de cámara, visibilidad...). */
  transform?: (w: Landmark3D[]) => Landmark3D[]
  worldDown?: Vec3 | null
}

function run(def: typeof SQUAT_3D, demo: DemoDefinition, opts: RunOptions = {}) {
  const pipeline = new FramePipeline(def)
  const gauss = seededGauss()
  const fps = opts.fps ?? 60
  const frames = playDemo(demo, opts)
  // 30 frames de reposo al final para cerrar el último ciclo.
  const tail = frames.length ? frames[frames.length - 1].t : 0
  for (let i = 1; i <= 30; i++) frames.push({ t: tail + (i * 1000) / fps, p: 0, cycle: -1, world: demo.pose(0) })

  const results: Tracker3DResult[] = []
  for (const f of frames) {
    const raw = jitter(opts.transform ? opts.transform(f.world) : f.world, opts.noise ?? 0, gauss)
    results.push(pipeline.process({ world: raw, t: f.t, worldDown: opts.worldDown ?? null }).result)
  }
  const last = results[results.length - 1]
  return {
    reps: last.reps,
    rejections: results.filter(r => r.rejection).map(r => r.rejection),
    issues: results.map(r => r.formIssue).filter(Boolean) as string[],
    peaks: results.filter(r => r.peak),
    last,
    results,
  }
}

describe.each(CASES)('Tracker3D: $id', ({ id, def, effortPhase }) => {
  const demo = DEMOS[id]

  it.each([15, 30, 60])('técnica correcta a %i fps cuenta 5 sin rechazos ni avisos de forma', fps => {
    const r = run(def, demo, { fps, effortPhase })
    expect(r.reps).toBe(5)
    expect(r.rejections).toEqual([])
    expect(r.issues).toEqual([])
  })

  it.each([8, 15])('con temblor de %i mm cuenta 5', mm => {
    expect(run(def, demo, { fps: 30, noise: mm / 1000, effortPhase }).reps).toBe(5)
  })

  it('ritmo rápido pero controlado cuenta 5', () => {
    expect(run(def, demo, { fps: 30, speed: 0.4, effortPhase }).reps).toBe(5)
  })

  it('un tirón brusco no cuenta y se informa como rápido o irregular', () => {
    const r = run(def, demo, { fps: 30, speed: 0.12, effortPhase })
    expect(r.reps).toBe(0)
    expect(r.rejections.length).toBeGreaterThan(0)
    // Según el ejercicio, los tirones se rechazan uno a uno (rápidos) o, si el suavizado
    // y la histéresis impiden volver al reposo entre ellos, como un único ciclo irregular.
    expect(r.rejections.every(x => x === 'too_fast' || x === 'erratic')).toBe(true)
  })

  it('un recorrido parcial no cuenta', () => {
    expect(run(def, demo, { fps: 30, pMax: 0.3, effortPhase }).reps).toBe(0)
  })

  it('una subida cada vez más lenta eleva la fatiga', () => {
    const r = run(def, demo, { fps: 30, cycles: 8, slowdown: 0.22, effortPhase })
    expect(r.reps).toBeGreaterThanOrEqual(6)
    expect(r.last.fatigue.level).not.toBe('fresh')
  })

  it('emite un frame clave por repetición, en el extremo del ciclo', () => {
    const r = run(def, demo, { fps: 30, effortPhase })
    expect(r.peaks).toHaveLength(5)
    for (const p of r.peaks) {
      expect(p.keyFrame).not.toBeNull()
      const keyAngle = demo.measure(p.keyFrame!)
      expect(Math.abs(keyAngle - p.extremeDeg)).toBeLessThan(3)
    }
  })
})

describe('Tracker3D: sentadilla', () => {
  const demo = DEMOS.sentadilla
  const MODEL_TILT = 20

  it('con el error de profundidad del modelo (20°), la calibración evita avisos falsos de tronco', () => {
    const tilted = run(SQUAT_3D, demo, { fps: 30, effortPhase: 3, transform: w => tiltPose(w, MODEL_TILT, 0) })
    expect(tilted.issues).toEqual([])
    expect(tilted.reps).toBe(5)
  })

  it('sin calibración ni nivelación, esa inclinación daría avisos de tronco', () => {
    const tracker = new Tracker3D(SQUAT_3D)
    const issues = playDemo(demo, { fps: 30 })
      .map(f => tracker.update(tiltPose(f.world, MODEL_TILT, 0), f.t).formIssue)
      .filter(Boolean)
    expect(issues).toContain('trunk_lean')
  })

  it('una sentadilla con el tronco muy inclinado sí dispara trunk_lean', () => {
    // Inclina solo el tronco: hombros adelantados sobre la cadera.
    const lean = (w: Landmark3D[]) => w.map((p, i) =>
      i <= LM.RIGHT_WRIST || (i >= 17 && i <= 22) ? { ...p, z: p.z - 0.35 } : p)
    const r = run(SQUAT_3D, demo, { fps: 30, effortPhase: 3, transform: lean })
    expect(r.issues).toContain('trunk_lean')
  })

  it('sin el cuerpo completo visible queda en reposo con aviso', () => {
    const tracker = new Tracker3D(SQUAT_3D)
    const hidden = demo.pose(0).map((p, i) => (i === LM.LEFT_ANKLE ? { ...p, visibility: 0.1 } : p))
    const res = tracker.update(hidden, 0)
    expect(res.visible).toBe(false)
    expect(res.feedbackMessage).toBe(SQUAT_3D.notVisibleMessage)
  })
})

describe('Tracker3D: curl de bíceps', () => {
  const demo = DEMOS['curl-biceps']
  const LEFT_ARM = [LM.LEFT_ELBOW, LM.LEFT_WRIST, 17, 19, 21]
  const RIGHT_ARM = [LM.RIGHT_ELBOW, LM.RIGHT_WRIST, 18, 20, 22]

  /** Combina el brazo izquierdo de una pose con el derecho de otra. */
  const arms = (pL: number, pR: number): Landmark3D[] => {
    const left = demo.pose(pL)
    const right = demo.pose(pR)
    return left.map((p, i) => (RIGHT_ARM.includes(i) ? right[i] : LEFT_ARM.includes(i) ? p : p))
  }

  it('curls alternos: cada brazo cuenta su repetición (6 en 3 ciclos por brazo)', () => {
    const tracker = new Tracker3D(CURL_3D)
    const g = seededGauss(3)
    let t = 0
    let last: Tracker3DResult | null = null
    for (let c = 0; c < 6; c++) {
      const leftTurn = c % 2 === 0
      for (const f of playDemo(demo, { fps: 30, cycles: 1 })) {
        const w = leftTurn ? arms(f.p, 0) : arms(0, f.p)
        last = tracker.update(jitter(w, 0.003, g), t)
        t += 1000 / 30
      }
    }
    expect(last!.reps).toBe(6)
  })

  it('curl bilateral: los dos brazos a la vez cuentan una sola repetición (cooldown en ms)', () => {
    expect(run(CURL_3D, demo, { fps: 30 }).reps).toBe(5)
  })

  it('un descenso lento cuenta igual (fitnetv2 exigía 0,5°/frame y no confirmaba la cima)', () => {
    const slow: DemoDefinition = {
      ...demo,
      phases: demo.phases.map((ph, i) => (i === 3 ? { ...ph, durationMs: 5000 } : ph)),
    }
    expect(run(CURL_3D, slow, { fps: 60 }).reps).toBe(5)
  })

  it('en vista lateral usa solo el brazo visible', () => {
    const tracker = new Tracker3D(CURL_3D)
    const w = demo.pose(0.5).map((p, i) => (RIGHT_ARM.includes(i) || i === LM.RIGHT_SHOULDER ? { ...p, visibility: 0.1 } : p))
    expect(tracker.update(w, 0).activeSides).toEqual(['left'])
  })

  it('el codo que se adelanta dispara elbow_drift', () => {
    // Despegue claro (más de CURL_MAX_ELBOW_DRIFT_DEG = 50°, DEC-073).
    const drift = (w: Landmark3D[]) => w.map((p, i) =>
      i === LM.LEFT_ELBOW || i === LM.RIGHT_ELBOW ? { ...p, z: p.z - 0.4 } : p)
    expect(run(CURL_3D, demo, { fps: 30, transform: drift }).issues).toContain('elbow_drift')
  })
})

describe('Tracker3D: press de hombro', () => {
  const demo = DEMOS['press-hombro']
  const PHONE_TILT = 32
  const tilted = (w: Landmark3D[]) => tiltPose(w, PHONE_TILT, 0)

  it('con el celular inclinado 32° y sin nivelar da avisos falsos de arqueo', () => {
    // Sin acelerómetro ni calibración (el press no ve los tobillos): la inclinación pasa tal cual.
    const tracker = new Tracker3D(PRESS_3D)
    const issues = playDemo(demo, { fps: 30 }).map(f => tracker.update(tilted(f.world), f.t).formIssue)
    expect(issues).toContain('lumbar_arch')
  })

  it('nivelado con la gravedad no da avisos falsos y cuenta igual', () => {
    const down = rotateCamera({ x: 0, y: 1, z: 0 }, PHONE_TILT, 0)
    const r = run(PRESS_3D, demo, { fps: 30, transform: tilted, worldDown: down })
    expect(r.issues.filter(i => i === 'lumbar_arch')).toEqual([])
    expect(r.reps).toBe(5)
  })

  it('sin la cadera visible no evalúa el arqueo (fitnetv2 lo evaluaba con puntos estimados)', () => {
    const noHips = (w: Landmark3D[]) => tilted(w).map((p, i) =>
      i === LM.LEFT_HIP || i === LM.RIGHT_HIP ? { ...p, visibility: 0.2 } : p)
    const tracker = new Tracker3D(PRESS_3D)
    const issues = playDemo(demo, { fps: 30 }).map(f => tracker.update(noHips(f.world), f.t).formIssue)
    expect(issues).not.toContain('lumbar_arch')
  })

  it('en reposo con los brazos a la altura de los hombros no avisa de arqueo', () => {
    const tracker = new Tracker3D(PRESS_3D)
    const res = tracker.update(tilted(demo.pose(0)), 0)
    expect(res.phase).toBe('rest')
    expect(res.formIssue).not.toBe('lumbar_arch')
  })

  it('bajar el codo por debajo de 80° no da aviso en 3D: no se distingue de un press bien hecho (DEC-073)', () => {
    const low = (w: Landmark3D[]) => w.map((p, i) =>
      i === LM.LEFT_WRIST || i === LM.RIGHT_WRIST ? { ...p, y: p.y + 0.12, x: p.x * 0.6 } : p)
    const tracker = new Tracker3D(PRESS_3D)
    const res = tracker.update(low(demo.pose(0)), 0)
    expect(res.primaryAngle).toBeLessThan(80)
    expect(res.formIssue).not.toBe('unsafe_low_elbow')
  })
})

describe('FramePipeline', () => {
  it('press: la calibración no aprende con la serie empezada; startNewSet la reabre', () => {
    // Press de cuerpo completo (con piernas) para que la calibración de pie pueda aprender.
    const demo = DEMOS['press-hombro']
    const pipeline = new FramePipeline(PRESS_3D)
    let t = 0
    const feed = (tilt: number, cycles: number) => {
      let out = null
      for (const f of playDemo(demo, { fps: 30, cycles })) {
        out = pipeline.process({ world: tiltPose(f.world, tilt, 0), t })
        t += 1000 / 30
      }
      return out!
    }
    const first = feed(20, 2)
    expect(first.result.reps).toBeGreaterThanOrEqual(1)
    const calibrated = first.diagnostics.calibrationDeg!
    expect(calibrated).toBeCloseTo(20, 0)

    const frozen = feed(5, 2)
    expect(frozen.diagnostics.calibrationDeg).toBeCloseTo(calibrated, 6)

    pipeline.startNewSet()
    for (let i = 0; i < 120; i++, t += 1000 / 30) {
      pipeline.process({ world: tiltPose(demo.pose(0), 5, 0), t })
    }
    expect(pipeline.process({ world: tiltPose(demo.pose(0), 5, 0), t }).diagnostics.calibrationDeg!).toBeLessThan(12)
  })

  it('informa la inclinación del teléfono y si no pudo nivelar', () => {
    const pipeline = new FramePipeline(SQUAT_3D)
    const pose = DEMOS.sentadilla.pose(0)
    const ok = pipeline.process({ world: pose, t: 0, worldDown: rotateCamera({ x: 0, y: 1, z: 0 }, 20, 0) })
    expect(ok.diagnostics.phoneTiltDeg).toBeCloseTo(20, 6)
    expect(ok.diagnostics.leveled).toBe(true)
    const bad = pipeline.process({ world: pose, t: 33, worldDown: rotateCamera({ x: 0, y: 1, z: 0 }, 75, 0) })
    expect(bad.diagnostics.leveled).toBe(false)
  })

  it('cambiar de ejercicio reinicia el conteo', () => {
    const pipeline = new FramePipeline(SQUAT_3D)
    let t = 0
    for (const f of playDemo(DEMOS.sentadilla, { fps: 30, cycles: 2 })) {
      pipeline.process({ world: f.world, t })
      t += 33
    }
    pipeline.setExercise(CURL_3D)
    expect(pipeline.definition.id).toBe('curl')
    expect(pipeline.process({ world: DEMOS['curl-biceps'].pose(0), t }).result.reps).toBe(0)
  })
})
