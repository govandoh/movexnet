import { describe, expect, it } from 'vitest'
import {
  BACKOFF_MAX_MS, BATCH_MAX, backoffMs, enqueue, isUntouchedTemplate, isUuid, mergeById, mergeHistory, nextBatch,
  pendingIds, pendingSets, planHistoryUpload, profileToProgram, programToProfile, setFromCloud, setOps, setToCloud,
  singleActive, type SyncOp,
} from './sync.ts'
import type { SetRecord } from './sessionHistory.ts'
import type { Profile } from './ports.ts'
import { ROUTINE_TEMPLATES, instantiateTemplate, type Routine } from './routines.ts'
import type { Goal } from './progress.ts'

let n = 0
/** UUID determinista para las pruebas. */
function uuid(): string {
  n++
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

const S1 = '11111111-1111-4111-8111-111111111111'

function rec(extra: Partial<SetRecord> = {}): SetRecord {
  return {
    id: uuid(), completedAt: '2026-10-05T16:00:30.000Z', exerciseId: 'sentadilla',
    validReps: 10, rejectedReps: 2, goodReps: 8, timed: false, fatigue: 'moderada', ...extra,
  }
}

describe('series ↔ nube', () => {
  it('una serie de cámara manda reps, origen, duración e inicio = cierre − duración', () => {
    const r = rec({ sessionId: S1, source: 'camera', durationMs: 30_000 })
    const { set, metrics } = setToCloud({ ...r, sessionId: S1 }, uuid)
    expect(set).toMatchObject({
      id: r.id, sessionId: S1, source: 'camera', durationMs: 30_000, reps: 10, startedAt: '2026-10-05T16:00:00.000Z',
    })
    expect(metrics.map(m => [m.name, m.value, m.unit])).toEqual([
      ['rejected_reps', 2, 'reps'], ['clean_reps', 8, 'reps'], ['fatigue_level', 1, 'level'],
    ])
    expect(metrics.every(m => m.setId === r.id && m.scope === 'set' && isUuid(m.id))).toBe(true)
    expect(setFromCloud(set, metrics)).toEqual(r)
  })

  it('la plancha no guarda segundos en reps (reps_gt_100): van en hold_seconds', () => {
    const r = rec({ timed: true, validReps: 120, goodReps: 120, rejectedReps: 0, fatigue: null, sessionId: S1, source: 'camera', durationMs: 121_000 })
    const { set, metrics } = setToCloud({ ...r, sessionId: S1 }, uuid)
    expect(set.reps).toBeNull()
    expect(metrics.map(m => [m.name, m.value])).toEqual([['hold_seconds', 120]])
    expect(setFromCloud(set, metrics)).toEqual(r)
  })

  it('sin origen la serie es imported y sin duración el inicio es el cierre', () => {
    const r = rec()
    const { set } = setToCloud({ ...r, sessionId: S1 }, uuid)
    expect(set).toMatchObject({ source: 'imported', durationMs: null, startedAt: r.completedAt })
  })

  it('descarta filas sin trabajo y acota las repeticiones limpias', () => {
    const { set, metrics } = setToCloud({ ...rec(), sessionId: S1 }, uuid)
    expect(setFromCloud({ ...set, reps: 0 }, metrics)).toBeNull()
    const clean = metrics.map(m => (m.name === 'clean_reps' ? { ...m, value: 50 } : m))
    expect(setFromCloud(set, clean)?.goodReps).toBe(10)
  })

  it('setOps abre la sesión solo la primera vez', () => {
    const r = { ...rec({ source: 'camera', durationMs: 30_000 }), sessionId: S1 }
    expect(setOps(r, false, uuid).map(o => o.op)).toEqual(['session', 'set'])
    expect(setOps(r, true, uuid).map(o => o.op)).toEqual(['set'])
    const [open] = setOps(r, false, uuid, '2026-10-05T16:10:00.000Z')
    expect(open).toMatchObject({ session: { id: S1, startedAt: '2026-10-05T16:00:00.000Z', endedAt: '2026-10-05T16:10:00.000Z' } })
  })
})

describe('cola', () => {
  const setOp = (id: string): SyncOp => ({ op: 'set', set: { id } as never, metrics: [] })
  const routine = (id: string, name: string): Routine => ({ id, name, active: false, createdAt: 1, updatedAt: 1, days: [] })

  it('no repite inserciones y deja solo la última versión de rutinas, objetivos y perfil', () => {
    let q = enqueue([], [setOp('a'), setOp('a')])
    q = enqueue(q, [{ op: 'routine', routine: routine('r1', 'A') }, { op: 'profile', patch: { daysPerWeek: 3 } }])
    q = enqueue(q, [{ op: 'routine', routine: routine('r1', 'B') }, { op: 'profile', patch: { daysPerWeek: 4 } }])
    expect(q.map(o => o.op)).toEqual(['set', 'routine', 'profile'])
    expect(q[1]).toMatchObject({ routine: { name: 'B' } })
    expect(q[2]).toMatchObject({ patch: { daysPerWeek: 4 } })
    q = enqueue(q, [{ op: 'routine_delete', id: 'r1' }])
    expect(q.map(o => o.op)).toEqual(['set', 'profile', 'routine_delete'])
    expect(pendingIds(q, 'routine')).toEqual(new Set(['r1']))
    expect(pendingSets(q)).toBe(1)
  })

  it('agrupa operaciones seguidas del mismo tipo, con tope', () => {
    const many = Array.from({ length: BATCH_MAX + 5 }, (_, i) => setOp(`s${i}`))
    expect(nextBatch(many)).toHaveLength(BATCH_MAX)
    const q: SyncOp[] = [setOp('a'), setOp('b'), { op: 'session_end', sessionId: S1, endedAt: 'x' }, setOp('c')]
    expect(nextBatch(q)).toHaveLength(2)
    expect(nextBatch(q.slice(2))).toHaveLength(1)
    expect(nextBatch([])).toEqual([])
  })

  it('backoff exponencial con jitter y tope de 5 min', () => {
    expect(backoffMs(0, 1)).toBe(2_000)
    expect(backoffMs(1, 1)).toBe(4_000)
    expect(backoffMs(3, 0)).toBe(8_000)
    expect(backoffMs(30, 1)).toBe(BACKOFF_MAX_MS)
    expect(backoffMs(30, 0)).toBe(BACKOFF_MAX_MS / 2)
  })
})

describe('primera subida del historial', () => {
  it('una sesión cerrada por día local, imported, con ids UUID; sesiones antes que series', () => {
    const history = [
      rec({ id: 'abc-viejo', completedAt: new Date(2026, 9, 5, 9, 0).toISOString() }),
      rec({ completedAt: new Date(2026, 9, 5, 18, 0).toISOString() }),
      rec({ completedAt: new Date(2026, 9, 6, 9, 0).toISOString() }),
    ]
    const plan = planHistoryUpload(history, uuid)
    expect(plan.records.every(r => isUuid(r.id) && r.source === 'imported' && r.durationMs === null)).toBe(true)
    expect(plan.records[0].id).not.toBe('abc-viejo')
    expect(plan.records[0].sessionId).toBe(plan.records[1].sessionId)
    expect(plan.records[2].sessionId).not.toBe(plan.records[0].sessionId)
    expect(plan.ops.map(o => o.op)).toEqual(['session', 'session', 'set', 'set', 'set'])
    expect(plan.ops[0]).toMatchObject({ session: { startedAt: history[0].completedAt, endedAt: history[1].completedAt } })
  })

  it('respeta sesión y origen de las series nuevas y es idempotente', () => {
    const cam = rec({ sessionId: S1, source: 'camera', durationMs: 30_000 })
    const first = planHistoryUpload([cam], uuid)
    expect(first.records[0]).toEqual(cam)
    expect(first.ops[0]).toMatchObject({ session: { id: S1, startedAt: '2026-10-05T16:00:00.000Z', endedAt: cam.completedAt } })
    const again = planHistoryUpload(first.records, uuid)
    expect(again.records).toEqual(first.records)
    expect(again.ops.map(o => (o.op === 'set' ? o.set.id : o.op === 'session' ? o.session.id : null)))
      .toEqual(first.ops.map(o => (o.op === 'set' ? o.set.id : o.op === 'session' ? o.session.id : null)))
  })

  it('reconoce las plantillas sembradas que nadie editó', () => {
    const t = instantiateTemplate(ROUTINE_TEMPLATES[0], uuid, 1000)
    expect(isUntouchedTemplate(t)).toBe(true)
    expect(isUntouchedTemplate({ ...t, updatedAt: 2000 })).toBe(false)
  })
})

describe('programa ↔ perfil', () => {
  const base: Profile = {
    displayName: 'Ana', birthYear: 1995, birthMonth: 4, heightCm: null, weightKg: null, experienceLevel: 'beginner',
    goal: 'muscle_gain', trainingLocation: 'gym_full', equipment: [], daysPerWeek: 3, sessionMinutes: 45,
    programType: 'full_body', preferredCamera: 'environment', publicProfile: false, programStartedAt: null,
  }

  it('ida y vuelta; el programa sugerido no se fija', () => {
    const state = {
      questionnaire: { goal: 'strength_gain', level: 'intermediate', location: 'home_limited', equipment: ['dumbbell'], daysPerWeek: 4, sessionMinutes: 60 },
      programStartedAt: '2026-10-01T12:00:00.000Z',
    } as const
    const patch = programToProfile({ ...state, questionnaire: { ...state.questionnaire, equipment: ['dumbbell'] } })
    expect(patch.programType).toBe('upper_lower')
    expect(profileToProgram({ ...base, ...patch })).toEqual(state)
  })

  it('un programa elegido distinto del sugerido se conserva', () => {
    const patch = programToProfile({
      questionnaire: { goal: 'muscle_gain', level: 'beginner', location: 'gym_full', daysPerWeek: 3, sessionMinutes: 45, programType: 'ppl' },
      programStartedAt: '2026-10-01T12:00:00.000Z',
    })
    expect(profileToProgram({ ...base, ...patch })?.questionnaire?.programType).toBe('ppl')
  })

  it('sin cuestionario en la nube no hay programa', () => {
    expect(profileToProgram(base)).toBeNull()
    expect(programToProfile({ questionnaire: null, programStartedAt: null })).toEqual({ programStartedAt: null })
  })
})

describe('fusión', () => {
  it('historial: unión por id, gana lo local, ordenado y con tope', () => {
    const a = rec({ completedAt: '2026-10-01T10:00:00.000Z' })
    const b = rec({ completedAt: '2026-10-03T10:00:00.000Z' })
    const c = rec({ completedAt: '2026-10-02T10:00:00.000Z' })
    const merged = mergeHistory([a, b], [{ ...a, validReps: 99 }, c], 10)
    expect(merged.map(r => r.id)).toEqual([a.id, c.id, b.id])
    expect(merged[0].validReps).toBe(10)
    expect(mergeHistory([a, b], [c], 2).map(r => r.id)).toEqual([c.id, b.id])
  })

  it('rutinas y objetivos: lo pendiente gana y lo borrado en otro dispositivo desaparece', () => {
    const g = (id: string, target: number, createdAt = 1): Goal => ({ id, kind: 'total_reps', target, createdAt })
    const local = [g('a', 1), g('b', 1), g('c', 1), g('d', 1)]
    const cloud = [g('a', 2), g('b', 2), g('e', 2, 5)]
    // a: la nube manda; b: pendiente local; c: borrado en otro lado; d: creado aquí, pendiente;
    // e: nuevo de la nube.
    const merged = mergeById(local, cloud, new Set(['b', 'd']))
    expect(merged.map(x => [x.id, x.target])).toEqual([['a', 2], ['b', 1], ['d', 1], ['e', 2]])
    // Borrado aquí y pendiente: no vuelve aunque la nube todavía lo tenga.
    expect(mergeById([g('a', 1)], [g('a', 1), g('z', 1)], new Set(['z'])).map(x => x.id)).toEqual(['a'])
  })

  it('solo una rutina activa: gana la más reciente', () => {
    const r = (id: string, updatedAt: number, active: boolean): Routine => ({ id, name: id, active, createdAt: 1, updatedAt, days: [] })
    expect(singleActive([r('a', 5, true), r('b', 9, true), r('c', 1, false)]).map(x => x.active)).toEqual([false, true, false])
  })
})
