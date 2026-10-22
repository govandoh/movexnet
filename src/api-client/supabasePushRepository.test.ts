import { describe, expect, it } from 'vitest'
import { fakeDb, step } from './fakePostgrest.ts'
import { SupabasePushRepository } from './supabasePushRepository.ts'
import { SyncError } from '../domain/sync.ts'

const sub = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  p256dh: 'B' + 'A'.repeat(86),
  auth: 'A'.repeat(22),
  userAgent: 'Mozilla/5.0 (Linux; Android 15)',
}

describe('SupabasePushRepository', () => {
  it('registra la suscripción por la función de la base, sin user_id', async () => {
    const { db, calls } = fakeDb()
    await new SupabasePushRepository(db).register(sub)
    expect(calls[0].table).toBe('rpc:register_push_subscription')
    expect(step(calls[0], 'args')).toEqual([{
      p_endpoint: sub.endpoint, p_p256dh: sub.p256dh, p_auth: sub.auth, p_user_agent: sub.userAgent,
    }])
  })

  it('sin user agent no lo envía', async () => {
    const { db, calls } = fakeDb()
    await new SupabasePushRepository(db).register({ ...sub, userAgent: null })
    expect(step(calls[0], 'args')?.[0]).not.toHaveProperty('p_user_agent')
  })

  it('reemplaza los avisos con los nombres de columna de la base', async () => {
    const { db, calls } = fakeDb()
    await new SupabasePushRepository(db).replaceReminders(sub.endpoint, [
      { sendAt: '2026-10-23T00:00:00.000Z', title: 'Hoy toca entrenar', body: 'Semana 2 · Pierna', url: '/#/rutinas?semana=2' },
    ])
    expect(calls[0].table).toBe('rpc:replace_push_reminders')
    expect(step(calls[0], 'args')).toEqual([{
      p_endpoint: sub.endpoint,
      p_items: [{ send_at: '2026-10-23T00:00:00.000Z', title: 'Hoy toca entrenar', body: 'Semana 2 · Pierna', url: '/#/rutinas?semana=2' }],
    }])
  })

  it('una lista vacía deja la suscripción sin avisos', async () => {
    const { db, calls } = fakeDb()
    await new SupabasePushRepository(db).replaceReminders(sub.endpoint, [])
    expect(step(calls[0], 'args')).toEqual([{ p_endpoint: sub.endpoint, p_items: [] }])
  })

  it('da de baja borrando la fila de ese endpoint', async () => {
    const { db, calls } = fakeDb()
    await new SupabasePushRepository(db).unregister(sub.endpoint)
    expect(calls[0].table).toBe('push_subscriptions')
    expect(step(calls[0], 'delete')).toEqual([])
    expect(step(calls[0], 'eq')).toEqual(['endpoint', sub.endpoint])
  })

  it('un rechazo de la base es un error permanente', async () => {
    const { db } = fakeDb(() => ({ data: null, error: { code: '22023' }, status: 400 }))
    const err = await new SupabasePushRepository(db).replaceReminders(sub.endpoint, []).catch(e => e)
    expect(err).toBeInstanceOf(SyncError)
    expect((err as SyncError).transient).toBe(false)
  })
})
