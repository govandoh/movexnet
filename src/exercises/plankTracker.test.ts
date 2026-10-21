import { describe, expect, it } from 'vitest'
import { PlankTracker } from './plankTracker.ts'
import { DEMOS } from './demoPoses.ts'
import { LM, type Landmark3D } from '../geometry/vectors3d.ts'
import { jitter, seededGauss } from '../testing/syntheticMotion.ts'

/** Plancha alta: la posición inicial de la flexión. */
const plank = DEMOS.flexiones.pose(0)
const moveHips = (w: Landmark3D[], dy: number) => w.map((p, i) =>
  i === LM.LEFT_HIP || i === LM.RIGHT_HIP ? { ...p, y: p.y + dy } : p)

function hold(t: PlankTracker, w: Landmark3D[], fromMs: number, toMs: number, fps = 30, noise = 0) {
  const g = seededGauss(5)
  let last = t.update(w, fromMs)
  for (let ms = fromMs + 1000 / fps; ms <= toMs; ms += 1000 / fps) last = t.update(jitter(w, noise, g), ms)
  return last
}

describe('PlankTracker', () => {
  it('suma el tiempo sostenido con el cuerpo recto, a cualquier fps', () => {
    for (const fps of [15, 60]) {
      const r = hold(new PlankTracker(), plank, 0, 10_000, fps)
      expect(r.holding).toBe(true)
      expect(r.heldSeconds).toBeGreaterThanOrEqual(9)
      expect(r.heldSeconds).toBeLessThanOrEqual(10)
    }
  })

  it('tolera el temblor de 8 mm', () => {
    expect(hold(new PlankTracker(), plank, 0, 5_000, 30, 0.008).heldSeconds).toBeGreaterThanOrEqual(4)
  })

  it('con la cadera caída pausa el tiempo y avisa', () => {
    const t = new PlankTracker()
    const before = hold(t, plank, 0, 3_000).heldMs
    expect(before).toBeCloseTo(3_000, -2)
    // 15 cm: en plancha alta el cuerpo va inclinado ~21°, así que la caída vertical se proyecta menos.
    const r = hold(t, moveHips(plank, 0.15), 3_033, 6_000)
    expect(r.formIssue).toBe('hip_sag')
    expect(r.holding).toBe(false)
    expect(r.heldMs).toBe(before)
  })

  it('con la cadera levantada avisa hip_pike', () => {
    expect(hold(new PlankTracker(), moveHips(plank, -0.14), 0, 1_000).formIssue).toBe('hip_pike')
  })

  describe('con el lado lejano tapado, como de perfil (#59, DEC-071)', () => {
    const hideRight = (w: Landmark3D[]) => w.map((p, i) =>
      i === LM.RIGHT_SHOULDER || i === LM.RIGHT_HIP || i === LM.RIGHT_ANKLE ? { ...p, visibility: 0.1 } : p)

    it('el tiempo sigue corriendo', () => {
      const r = hold(new PlankTracker(), hideRight(plank), 0, 3_000)
      expect(r.visible).toBe(true)
      expect(r.holding).toBe(true)
      expect(r.heldSeconds).toBeGreaterThanOrEqual(2)
    })

    it('detecta una cadera caída leve (8 cm, ~13°)', () => {
      expect(hold(new PlankTracker(), hideRight(moveHips(plank, 0.08)), 0, 1_000).formIssue).toBe('hip_sag')
    })
  })

  it('de pie no cuenta tiempo', () => {
    const r = hold(new PlankTracker(), DEMOS.sentadilla.pose(0), 0, 3_000)
    expect(r.holding).toBe(false)
    expect(r.heldMs).toBe(0)
  })

  it('una pausa larga entre frames (persona perdida) no suma tiempo', () => {
    const t = new PlankTracker()
    t.update(plank, 0)
    const r = t.update(plank, 5_000)
    expect(r.heldMs).toBe(0)
  })
})
