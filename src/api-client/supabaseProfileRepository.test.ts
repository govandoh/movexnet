import { describe, expect, it } from 'vitest'
import { SupabaseProfileRepository } from './supabaseProfileRepository.ts'
import { fakeDb, step } from './fakePostgrest.ts'

const ROW = {
  display_name: 'Ana', birth_year: 1995, birth_month: 4, height_cm: null, weight_kg: 61.5, experience_level: 'intermediate',
  goal: 'strength_gain', training_location: 'home_limited', equipment: ['dumbbell'], days_per_week: 4, session_minutes: 60,
  program_type: 'upper_lower', preferred_camera: 'environment', public_profile: false, program_started_at: '2026-10-01T12:00:00+00:00',
}

describe('SupabaseProfileRepository', () => {
  it('lee el perfil propio', async () => {
    const { db, calls } = fakeDb(() => ({ data: ROW, error: null, status: 200 }))
    const p = await new SupabaseProfileRepository(db, 'u1').get()
    expect(p).toMatchObject({ displayName: 'Ana', experienceLevel: 'intermediate', daysPerWeek: 4, programStartedAt: ROW.program_started_at })
    expect(step(calls[0], 'eq')).toEqual(['user_id', 'u1'])
  })

  it('null si no hay fila', async () => {
    const { db } = fakeDb(() => ({ data: null, error: null, status: 200 }))
    await expect(new SupabaseProfileRepository(db, 'u1').get()).resolves.toBeNull()
  })

  it('actualiza solo los campos dados y editables', async () => {
    const { db, calls } = fakeDb()
    const patch = { daysPerWeek: 5, programStartedAt: null, privacyVersion: 'privacy-2099-01-v9', userId: 'otro' }
    await new SupabaseProfileRepository(db, 'u1').update(patch as never)
    expect(step(calls[0], 'update')).toEqual([{ days_per_week: 5, program_started_at: null }])
    expect(step(calls[0], 'eq')).toEqual(['user_id', 'u1'])
  })

  it('no llama a la red sin cambios', async () => {
    const { db, calls } = fakeDb()
    await new SupabaseProfileRepository(db, 'u1').update({})
    expect(calls).toHaveLength(0)
  })
})
