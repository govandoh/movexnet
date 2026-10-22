import { describe, expect, it } from 'vitest'
import { SupabaseGoalRepository, SupabaseRoutineRepository } from './supabaseRoutineRepository.ts'
import { fakeDb, step } from './fakePostgrest.ts'
import type { Routine } from '../domain/routines.ts'

const ROUTINE: Routine = {
  id: 'r1', name: 'Pierna', active: true, createdAt: Date.UTC(2026, 9, 1), updatedAt: Date.UTC(2026, 9, 2),
  days: [{ id: 'd1', weekday: 1, name: 'Lunes', exercises: [
    { id: 'e1', exerciseId: 'sentadilla', difficulty: 'medio', sets: 3, reps: 10, restSeconds: 90, method: 'normal' },
  ] }],
}

describe('SupabaseRoutineRepository', () => {
  it('sube la rutina con la hora del último cambio (última escritura gana)', async () => {
    const { db, calls } = fakeDb()
    await new SupabaseRoutineRepository(db).upsert([ROUTINE])
    const [rows, opts] = step(calls[0], 'upsert') as [Record<string, unknown>[], unknown]
    expect(opts).toEqual({ onConflict: 'id' })
    expect(rows[0]).toEqual({
      id: 'r1', name: 'Pierna', active: true, days: ROUTINE.days,
      created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-02T00:00:00.000Z',
    })
    expect(rows[0]).not.toHaveProperty('user_id')
  })

  it('valida lo leído y descarta las filas malformadas', async () => {
    const row = { id: 'r1', name: 'Pierna', active: true, days: ROUTINE.days, created_at: '2026-10-01T00:00:00+00:00', updated_at: '2026-10-02T00:00:00+00:00' }
    const { db } = fakeDb(() => ({ data: [row, { ...row, id: 'r2', days: 'no es lista' }, { ...row, id: 3 }], error: null, status: 200 }))
    const list = await new SupabaseRoutineRepository(db).list()
    expect(list.map(r => r.id)).toEqual(['r1', 'r2'])
    expect(list[0]).toEqual(ROUTINE)
    expect(list[1].days).toEqual([])
  })

  it('borra por id', async () => {
    const { db, calls } = fakeDb()
    await new SupabaseRoutineRepository(db).remove(['r1'])
    expect(calls[0].steps.map(([n]) => n)).toEqual(['delete', 'in'])
    expect(step(calls[0], 'in')).toEqual(['id', ['r1']])
  })
})

describe('SupabaseGoalRepository', () => {
  it('guarda el tipo en metric_name y usa createdAt si nunca se editó', async () => {
    const { db, calls } = fakeDb()
    await new SupabaseGoalRepository(db).upsert([{ id: 'g1', kind: 'weekly_days', target: 3, createdAt: Date.UTC(2026, 9, 1) }])
    expect((step(calls[0], 'upsert') as [unknown[]])[0]).toEqual([{
      id: 'g1', metric_name: 'weekly_days', target: 3, created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z',
    }])
  })

  it('descarta objetivos de tipos que la app no conoce', async () => {
    const row = { id: 'g1', metric_name: 'weekly_days', target: 3, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-02T00:00:00Z' }
    const { db } = fakeDb(() => ({ data: [row, { ...row, id: 'g2', metric_name: 'form_score' }], error: null, status: 200 }))
    const goals = await new SupabaseGoalRepository(db).list()
    expect(goals).toEqual([{ id: 'g1', kind: 'weekly_days', target: 3, createdAt: Date.UTC(2026, 9, 1), updatedAt: Date.UTC(2026, 9, 2) }])
  })
})
