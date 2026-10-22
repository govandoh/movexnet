import { describe, expect, it } from 'vitest'
import { SupabaseWorkoutRepository } from './supabaseWorkoutRepository.ts'
import { fakeDb, step } from './fakePostgrest.ts'
import type { MetricValue, SetLog } from '../domain/ports.ts'

const SET: SetLog = {
  id: 's1', sessionId: 'w1', source: 'camera', durationMs: 30_000, exerciseId: 'sentadilla', method: 'normal',
  methodParams: {}, loadKg: null, rpe: null, reps: 10, startedAt: '2026-10-05T16:00:00.000Z',
}

const METRIC: MetricValue = {
  id: 'm1', sessionId: 'w1', setId: 's1', scope: 'set', name: 'clean_reps', value: 8, unit: 'reps',
  schemaVersion: 1, computedAt: '2026-10-05T16:00:30.000Z',
}

describe('SupabaseWorkoutRepository', () => {
  it('inserta series sin duplicar y sin user_id ni marcas anti-trampa', async () => {
    const { db, calls } = fakeDb()
    await new SupabaseWorkoutRepository(db).logSets([SET])
    expect(calls[0].table).toBe('set_logs')
    const [rows, opts] = step(calls[0], 'upsert') as [Record<string, unknown>[], unknown]
    expect(opts).toEqual({ onConflict: 'id,started_at', ignoreDuplicates: true })
    expect(rows[0]).toEqual({
      id: 's1', session_id: 'w1', exercise_id: 'sentadilla', method: 'normal', method_params: {}, load_kg: null,
      rpe: null, reps: 10, started_at: SET.startedAt, source: 'camera', duration_ms: 30_000,
    })
    for (const forbidden of ['user_id', 'flagged', 'flag_reasons']) expect(rows[0]).not.toHaveProperty(forbidden)
  })

  it('no llama a la red con un lote vacío', async () => {
    const { db, calls } = fakeDb()
    const repo = new SupabaseWorkoutRepository(db)
    await repo.logSets([])
    await repo.logMetrics([])
    expect(calls).toHaveLength(0)
  })

  it('crea la sesión con su id, idempotente, y la cierra con un update', async () => {
    const { db, calls } = fakeDb()
    const repo = new SupabaseWorkoutRepository(db)
    await repo.startSession({ id: 'w1', startedAt: 'a', endedAt: null, device: null, modelVersions: {} })
    await repo.endSession('w1', 'b')
    expect(step(calls[0], 'upsert')).toEqual([
      { id: 'w1', started_at: 'a', ended_at: null, device: null, model_versions: {} }, { onConflict: 'id', ignoreDuplicates: true },
    ])
    expect(step(calls[1], 'update')).toEqual([{ ended_at: 'b' }])
    expect(step(calls[1], 'eq')).toEqual(['id', 'w1'])
  })

  it('inserta métricas con su id, sin duplicar', async () => {
    const { db, calls } = fakeDb()
    await new SupabaseWorkoutRepository(db).logMetrics([METRIC])
    const [rows, opts] = step(calls[0], 'upsert') as [Record<string, unknown>[], unknown]
    expect(opts).toEqual({ onConflict: 'id', ignoreDuplicates: true })
    expect(rows[0]).toMatchObject({ id: 'm1', set_id: 's1', scope: 'set', name: 'clean_reps', computed_at: METRIC.computedAt })
    expect(rows[0]).not.toHaveProperty('user_id')
  })

  it('lee las últimas series del rango y las devuelve en orden', async () => {
    const row = (id: string, started_at: string) => ({
      id, session_id: 'w1', exercise_id: 'sentadilla', method: 'normal', method_params: {}, load_kg: null, rpe: null,
      reps: 10, started_at, source: 'manual', duration_ms: null,
    })
    const { db, calls } = fakeDb(() => ({ data: [row('b', '2026-10-02'), row('a', '2026-10-01')], error: null, status: 200 }))
    const sets = await new SupabaseWorkoutRepository(db).listSets({ from: 'f', to: 't' })
    expect(sets.map(s => s.id)).toEqual(['a', 'b'])
    expect(sets[0]).toMatchObject({ sessionId: 'w1', source: 'manual', durationMs: null })
    expect(step(calls[0], 'gte')).toEqual(['started_at', 'f'])
    expect(step(calls[0], 'lt')).toEqual(['started_at', 't'])
    expect(step(calls[0], 'order')).toEqual(['started_at', { ascending: false }])
  })

  it('lee solo métricas por serie', async () => {
    const { db, calls } = fakeDb(() => ({
      data: [{ id: 'm1', session_id: 'w1', set_id: 's1', scope: 'set', name: 'clean_reps', value: 8, unit: 'reps', schema_version: 1, computed_at: 'c' }],
      error: null, status: 200,
    }))
    const metrics = await new SupabaseWorkoutRepository(db).listSetMetrics({ from: 'f', to: 't' })
    expect(metrics).toEqual([{ ...METRIC, computedAt: 'c' }])
    expect(step(calls[0], 'eq')).toEqual(['scope', 'set'])
    expect(step(calls[0], 'range')).toEqual([0, 999])
  })

  it('traduce los errores: red reintentable, restricción no', async () => {
    const network = fakeDb(() => ({ data: null, error: { code: '' }, status: 0 }))
    await expect(new SupabaseWorkoutRepository(network.db).logSets([SET])).rejects.toMatchObject({ transient: true })
    const invalid = fakeDb(() => ({ data: null, error: { code: '23503' }, status: 409 }))
    await expect(new SupabaseWorkoutRepository(invalid.db).logSets([SET])).rejects.toMatchObject({ transient: false })
  })
})
