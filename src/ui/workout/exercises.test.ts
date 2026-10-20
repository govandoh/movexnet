import { describe, expect, it } from 'vitest'
import { ASSISTED, createWorkoutTrackers } from './exercises'
import { DEFINITIONS_3D } from '../../exercises/definitions3d'

describe('createWorkoutTrackers', () => {
  it('da un contador por ejercicio, con su id', () => {
    const { trackers } = createWorkoutTrackers('squat')
    for (const ex of ASSISTED) expect(trackers[ex].exerciseId).toBe(ex)
  })

  it('sin ?engine=3d, curl y press usan el motor 2D; la sentadilla y la ola 1, el 3D (DEC-059, DEC-072)', () => {
    const { trackers } = createWorkoutTrackers('squat')
    // Con un frame sin landmarks 3D, el motor 3D no mide ('none') y el 2D sí ('2d').
    const engines = ASSISTED.map(ex => trackers[ex].update({ t: 0, image: [] }).detail.engine)
    expect(engines).toEqual(['none', '2d', '2d', 'none', 'none', 'none', 'none'])
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
