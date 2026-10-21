import { describe, expect, it } from 'vitest'
import { ASSISTED, createWorkoutTrackers, usesEngine3D } from './exercises'
import { DEFINITIONS_3D } from '../../exercises/definitions3d'
import type { EngineOverride } from '../engineFlag'

describe('createWorkoutTrackers', () => {
  it('da un contador por ejercicio, con su id', () => {
    const { trackers } = createWorkoutTrackers('squat')
    for (const ex of ASSISTED) expect(trackers[ex].exerciseId).toBe(ex)
  })

  // Con un frame sin landmarks 3D, el motor 3D no mide ('none') y el 2D sí ('2d').
  const engines = (override: EngineOverride) => {
    const { trackers } = createWorkoutTrackers('squat', override)
    return ASSISTED.map(ex => trackers[ex].update({ t: 0, image: [] }).detail.engine)
  }

  it('sin flag, curl y press usan el motor 2D; la sentadilla y la ola 1, el 3D (DEC-059, DEC-072)', () => {
    expect(engines(null)).toEqual(['none', '2d', '2d', 'none', 'none', 'none', 'none'])
  })

  it('con ?engine=3d, los siete usan el motor 3D', () => {
    expect(engines('3d')).toEqual(['none', 'none', 'none', 'none', 'none', 'none', 'none'])
  })

  it('con ?engine=2d, sentadilla, curl y press vuelven al 2D; la ola 1 sigue en 3D, que es el único que tiene', () => {
    expect(engines('2d')).toEqual(['2d', '2d', '2d', 'none', 'none', 'none', 'none'])
    expect(ASSISTED.filter(ex => usesEngine3D(ex, '2d'))).toEqual(['pushup', 'lunge', 'bridge', 'plank'])
  })

  it('los ejercicios 3D comparten el pipeline y se activan al reiniciarlos', () => {
    const { pipeline, trackers } = createWorkoutTrackers('pushup')
    expect(pipeline.definition).toBe(DEFINITIONS_3D.pushup)
    trackers.lunge.reset()
    expect(pipeline.definition).toBe(DEFINITIONS_3D.lunge)
    trackers.plank.reset()
    expect(pipeline.definition).toBe(DEFINITIONS_3D.squat)
  })
})
