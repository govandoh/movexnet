import { describe, expect, it } from 'vitest'
import { OWNER_KEY, SyncEngine, queueKey, type KeyValueStore, type LocalData, type SyncRepositories } from './syncEngine.ts'
import { SyncError } from '../domain/sync.ts'
import type { MetricValue, Profile, SetLog, WorkoutSession } from '../domain/ports.ts'
import type { SetRecord } from '../domain/sessionHistory.ts'
import { ROUTINE_TEMPLATES, instantiateTemplate, type Routine } from '../domain/routines.ts'
import type { Goal } from '../domain/progress.ts'

let n = 0
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`
const USER = 'aaaaaaaa-0000-4000-8000-000000000001'

const PROFILE: Profile = {
  displayName: 'Ana', birthYear: 1995, birthMonth: 4, heightCm: null, weightKg: null, experienceLevel: 'beginner',
  goal: 'muscle_gain', trainingLocation: 'gym_full', equipment: [], daysPerWeek: 3, sessionMinutes: 45,
  programType: 'full_body', preferredCamera: 'environment', publicProfile: false, programStartedAt: null,
}

/** Nube en memoria con las mismas reglas que la base: inserciones idempotentes y última escritura gana. */
function fakeCloud() {
  const sessions = new Map<string, WorkoutSession>()
  const sets = new Map<string, SetLog>()
  const metrics = new Map<string, MetricValue>()
  const routines = new Map<string, Routine>()
  const goals = new Map<string, Goal>()
  const calls: string[] = []
  let profile: Profile | null = { ...PROFILE }
  /** Error a lanzar en la próxima llamada a ese método (se consume). */
  const failures: { method: string; error: SyncError; match?: (arg: unknown) => boolean }[] = []
  const hit = (method: string, arg?: unknown) => {
    calls.push(method)
    const i = failures.findIndex(f => f.method === method && (!f.match || f.match(arg)))
    if (i >= 0) throw failures.splice(i, 1)[0].error
  }
  const repos: SyncRepositories = {
    workout: {
      async startSession(s) { hit('startSession'); if (!sessions.has(s.id)) sessions.set(s.id, { ...s }) },
      async endSession(id, endedAt) { hit('endSession'); const s = sessions.get(id); if (s) s.endedAt = endedAt },
      async logSets(list) {
        hit('logSets', list)
        for (const s of list) {
          if (!sessions.has(s.sessionId)) throw new SyncError(false, '42501')
          if (!sets.has(s.id)) sets.set(s.id, s)
        }
      },
      async logMetrics(list) { hit('logMetrics'); for (const m of list) if (!metrics.has(m.id)) metrics.set(m.id, m) },
      async listSets() { hit('listSets'); return [...sets.values()] },
      async listSetMetrics() { hit('listSetMetrics'); return [...metrics.values()] },
    },
    profile: {
      async get() { hit('profile.get'); return profile },
      async update(patch) { hit('profile.update'); profile = { ...profile!, ...patch } },
    },
    routines: {
      async list() { hit('routines.list'); return [...routines.values()] },
      async upsert(list) {
        hit('routines.upsert')
        for (const r of list) { const old = routines.get(r.id); if (!old || r.updatedAt >= old.updatedAt) routines.set(r.id, r) }
      },
      async remove(ids) { hit('routines.remove'); for (const id of ids) routines.delete(id) },
    },
    goals: {
      async list() { hit('goals.list'); return [...goals.values()] },
      async upsert(list) { hit('goals.upsert'); for (const g of list) goals.set(g.id, g) },
      async remove(ids) { hit('goals.remove'); for (const id of ids) goals.delete(id) },
    },
  }
  return {
    repos, sessions, sets, metrics, routines, goals, calls, failures,
    get profile() { return profile },
    set profile(p: Profile | null) { profile = p },
  }
}

function memoryStore(init: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...init }
  return {
    data,
    get: k => (k in data ? data[k] : null),
    set: (k, v) => { data[k] = v },
    remove: k => { delete data[k] },
  }
}

function fakeLocal(init: Partial<LocalData> = {}) {
  const empty = (): LocalData => ({ history: [], routines: [], goals: [], program: { questionnaire: null, programStartedAt: null } })
  let data: LocalData = { ...empty(), ...init }
  return {
    get data() { return data },
    read: () => data,
    write: (patch: Partial<LocalData>) => { data = { ...data, ...patch } },
    clear: () => { data = empty() },
  }
}

interface Timer { fn: () => void; ms: number }

function setup(opts: { local?: ReturnType<typeof fakeLocal>; store?: ReturnType<typeof memoryStore>; cloud?: ReturnType<typeof fakeCloud>; online?: () => boolean; now?: () => number } = {}) {
  const cloud = opts.cloud ?? fakeCloud()
  const local = opts.local ?? fakeLocal()
  const store = opts.store ?? memoryStore()
  const timers: Timer[] = []
  const engine = new SyncEngine({
    userId: USER, repos: cloud.repos, local, store, makeId: uuid, random: () => 1, isOnline: opts.online ?? (() => true),
    now: opts.now ?? (() => Date.UTC(2026, 9, 21, 12)),
    setTimer: (fn, ms) => { const t = { fn, ms }; timers.push(t); return t },
    clearTimer: h => { const i = timers.indexOf(h as Timer); if (i >= 0) timers.splice(i, 1) },
  })
  return { engine, cloud, local, store, timers }
}

/** Espera a que termine lo que la cola esté enviando. */
const settle = async (engine: SyncEngine) => { await engine.sync(); await engine.sync() }

function camSet(sessionId: string, completedAt: string, extra: Partial<SetRecord> = {}): SetRecord {
  return {
    id: uuid(), completedAt, exerciseId: 'sentadilla', validReps: 10, rejectedReps: 1, goodReps: 9, timed: false,
    fatigue: null, sessionId, source: 'camera', durationMs: 30_000, ...extra,
  }
}

describe('cola offline', () => {
  it('sin red guarda la cola; al volver la red envía sesión, series y métricas en orden', async () => {
    let online = false
    const { engine, cloud, store } = setup({ online: () => online })
    await engine.start()
    const w = uuid()
    engine.recordSets([camSet(w, '2026-10-21T10:00:30.000Z'), camSet(w, '2026-10-21T10:03:30.000Z')], false)
    await settle(engine)
    expect(cloud.sets.size).toBe(0)
    expect(engine.status()).toMatchObject({ state: 'offline', pendingSets: 2 })
    expect(JSON.parse(store.data[queueKey(USER)]).ops).toHaveLength(3)

    online = true
    await engine.sync()
    expect(cloud.sessions.get(w)).toMatchObject({ startedAt: '2026-10-21T10:00:00.000Z', endedAt: null })
    expect(cloud.sets.size).toBe(2)
    expect(cloud.metrics.size).toBe(4)
    expect(cloud.calls.filter(c => c === 'startSession')).toHaveLength(1)
    expect(engine.status()).toMatchObject({ state: 'synced', pendingSets: 0 })
  })

  it('un error transitorio reintenta con backoff exponencial y no duplica', async () => {
    const { engine, cloud, timers } = setup()
    await engine.start()
    cloud.failures.push({ method: 'logMetrics', error: new SyncError(true, 'network') })
    cloud.failures.push({ method: 'logSets', error: new SyncError(true, 'http_503') })
    const w = uuid()
    engine.recordSets([camSet(w, '2026-10-21T10:00:30.000Z')], false)
    // `sync()` durante un envío devuelve ese mismo envío: no dispara un reintento inmediato.
    await engine.sync()
    expect(cloud.sets.size).toBe(0)
    expect(timers.map(t => t.ms)).toEqual([2_000])
    expect(engine.status().state).toBe('retrying')

    timers.shift()!.fn()
    await engine.sync()
    expect(cloud.sets.size).toBe(1)
    expect(timers.map(t => t.ms)).toEqual([4_000])
    expect(engine.status().state).toBe('offline')
    timers.shift()!.fn()
    await engine.sync()
    expect(cloud.sets.size).toBe(1)
    expect(cloud.metrics.size).toBe(2)
    expect(engine.status()).toMatchObject({ state: 'synced', pendingOps: 0 })
  })

  it('un error permanente descarta solo la operación culpable y sigue', async () => {
    const { engine, cloud } = setup()
    await engine.start()
    const w = uuid()
    const bad = camSet(w, '2026-10-21T10:03:30.000Z')
    cloud.failures.push({ method: 'logSets', error: new SyncError(false, '23514'), match: a => (a as SetLog[]).length === 2 })
    cloud.failures.push({ method: 'logSets', error: new SyncError(false, '23514'), match: a => (a as SetLog[])[0]?.id === bad.id })
    engine.recordSets([camSet(w, '2026-10-21T10:00:30.000Z'), bad], false)
    await settle(engine)
    expect(cloud.sets.size).toBe(1)
    expect(cloud.sets.has(bad.id)).toBe(false)
    expect(engine.status()).toMatchObject({ pendingOps: 0, failed: 1 })
  })

  it('la cola sobrevive a cerrar la app', async () => {
    const store = memoryStore()
    const cloud = fakeCloud()
    const first = setup({ store, cloud, online: () => false })
    await first.engine.start()
    first.engine.recordSets([camSet(uuid(), '2026-10-21T10:00:30.000Z')], false)
    expect(cloud.sets.size).toBe(0)

    const second = setup({ store, cloud })
    await second.engine.start()
    expect(cloud.sets.size).toBe(1)
  })

  it('la sesión de cámara se cierra con el fin de la última serie; si la app se cerró, al volver', async () => {
    const store = memoryStore()
    const cloud = fakeCloud()
    const { engine } = setup({ store, cloud })
    await engine.start()
    const w = uuid()
    engine.recordSets([camSet(w, '2026-10-21T10:00:30.000Z')], false)
    engine.recordSets([camSet(w, '2026-10-21T10:05:00.000Z')], false)
    engine.endSession(w, '2026-10-21T10:30:00.000Z')
    await settle(engine)
    expect(cloud.sessions.get(w)?.endedAt).toBe('2026-10-21T10:05:00.000Z')

    // Otra visita que nunca llega a endSession (la app se cerró).
    const w2 = uuid()
    engine.recordSets([camSet(w2, '2026-10-21T11:00:30.000Z')], false)
    await settle(engine)
    expect(cloud.sessions.get(w2)?.endedAt).toBeNull()
    await setup({ store, cloud }).engine.start()
    expect(cloud.sessions.get(w2)?.endedAt).toBe('2026-10-21T11:00:30.000Z')
  })

  it('el modo manual crea la sesión ya cerrada', async () => {
    const { engine, cloud } = setup()
    await engine.start()
    const w = uuid()
    const manual = (at: string) => camSet(w, at, { source: 'manual', durationMs: null })
    engine.recordSets([manual('2026-10-21T10:00:00.000Z'), manual('2026-10-21T10:04:00.000Z')], true)
    await settle(engine)
    expect(cloud.sessions.get(w)).toMatchObject({ startedAt: '2026-10-21T10:00:00.000Z', endedAt: '2026-10-21T10:04:00.000Z' })
    expect([...cloud.sets.values()].every(s => s.source === 'manual')).toBe(true)
  })
})

describe('primera sincronización', () => {
  it('sube el historial previo una sola vez, agrupado por día y como imported', async () => {
    const legacy: SetRecord[] = [
      { id: 'viejo-1', completedAt: '2026-10-01T15:00:00.000Z', exerciseId: 'sentadilla', validReps: 8, rejectedReps: 0, goodReps: 8, timed: false, fatigue: null },
      { id: uuid(), completedAt: '2026-10-01T15:10:00.000Z', exerciseId: 'sentadilla', validReps: 8, rejectedReps: 0, goodReps: 8, timed: false, fatigue: null },
    ]
    const store = memoryStore()
    const cloud = fakeCloud()
    const local = fakeLocal({ history: legacy })
    await setup({ store, cloud, local }).engine.start()
    expect(cloud.sets.size).toBe(2)
    expect(cloud.sessions.size).toBe(1)
    expect([...cloud.sets.values()].every(s => s.source === 'imported' && s.durationMs === null)).toBe(true)
    expect(local.data.history.every(r => r.sessionId && r.source === 'imported')).toBe(true)
    expect(local.data.history[0].id).not.toBe('viejo-1')
    expect(store.data[OWNER_KEY]).toBe(USER)

    const before = cloud.calls.filter(c => c === 'logSets').length
    await setup({ store, cloud, local }).engine.start()
    expect(cloud.calls.filter(c => c === 'logSets').length).toBe(before)
    expect(cloud.sets.size).toBe(2)
  })

  it('no sube plantillas sin editar si la cuenta ya tiene rutinas; sí las propias', async () => {
    const cloud = fakeCloud()
    const mine: Routine = { id: uuid(), name: 'De otro celular', active: true, createdAt: 1, updatedAt: 5, days: [] }
    cloud.routines.set(mine.id, mine)
    const template = instantiateTemplate(ROUTINE_TEMPLATES[0], uuid, 100)
    const custom: Routine = { id: uuid(), name: 'Mía', active: false, createdAt: 100, updatedAt: 200, days: [] }
    const local = fakeLocal({ routines: [template, custom] })
    await setup({ cloud, local }).engine.start()
    expect([...cloud.routines.keys()].sort()).toEqual([mine.id, custom.id].sort())
    // Tras leer: la plantilla local que no subió desaparece y llega la de la nube.
    expect(local.data.routines.map(r => r.id).sort()).toEqual([mine.id, custom.id].sort())
  })

  it('el programa de la nube gana; si la nube no tiene, sube el local', async () => {
    const q = { goal: 'weight_loss', level: 'beginner', location: 'home_none', daysPerWeek: 3, sessionMinutes: 30 } as const
    const program = { questionnaire: q, programStartedAt: '2026-10-10T12:00:00.000Z' }

    const empty = fakeCloud()
    await setup({ cloud: empty, local: fakeLocal({ program }) }).engine.start()
    expect(empty.profile).toMatchObject({ goal: 'weight_loss', programStartedAt: program.programStartedAt })

    const withProgram = fakeCloud()
    withProgram.profile = { ...PROFILE, goal: 'strength_gain', programStartedAt: '2026-09-01T12:00:00.000Z' }
    const local = fakeLocal({ program })
    await setup({ cloud: withProgram, local }).engine.start()
    expect(withProgram.calls).not.toContain('profile.update')
    expect(local.data.program).toMatchObject({ programStartedAt: '2026-09-01T12:00:00.000Z', questionnaire: { goal: 'strength_gain' } })
  })

  it('si entra otra cuenta, los datos de la anterior se borran del dispositivo', async () => {
    const store = memoryStore({ [OWNER_KEY]: 'otra', [queueKey('otra')]: '{"ops":[]}' })
    const local = fakeLocal({ history: [camSet(uuid(), '2026-10-01T10:00:00.000Z')] })
    const { cloud } = setup()
    await setup({ store, cloud, local }).engine.start()
    expect(cloud.sets.size).toBe(0)
    expect(local.data.history).toEqual([])
    expect(store.data[queueKey('otra')]).toBeUndefined()
    expect(store.data[OWNER_KEY]).toBe(USER)
  })
})

describe('lectura y fusión', () => {
  it('baja las series de otro dispositivo y respeta lo pendiente', async () => {
    const cloud = fakeCloud()
    const w = uuid()
    cloud.sessions.set(w, { id: w, startedAt: '2026-10-20T10:00:00.000Z', endedAt: null, device: null, modelVersions: {} })
    const remote = camSet(w, '2026-10-20T10:00:30.000Z', { timed: true, validReps: 45, goodReps: 45, rejectedReps: 0, durationMs: 46_000 })
    cloud.sets.set(remote.id, { id: remote.id, sessionId: w, source: 'camera', durationMs: 46_000, exerciseId: 'sentadilla', method: 'normal', methodParams: {}, loadKg: null, rpe: null, reps: null, startedAt: '2026-10-20T09:59:44.000Z' })
    cloud.metrics.set('m', { id: 'm', sessionId: w, setId: remote.id, scope: 'set', name: 'hold_seconds', value: 45, unit: 's', schemaVersion: 1, computedAt: remote.completedAt })
    const gone: Goal = { id: uuid(), kind: 'total_reps', target: 100, createdAt: 1 }
    const local = fakeLocal({ goals: [gone] })
    const store = memoryStore({ [OWNER_KEY]: USER, [queueKey(USER)]: JSON.stringify({ firstSyncDone: true }) })
    await setup({ cloud, local, store }).engine.start()
    expect(local.data.history).toEqual([expect.objectContaining({ id: remote.id, timed: true, validReps: 45, completedAt: '2026-10-20T10:00:30.000Z' })])
    // Borrado en otro dispositivo y sin cambios pendientes aquí: desaparece.
    expect(local.data.goals).toEqual([])
  })

  it('no vuelve a leer antes de 5 min salvo al iniciar sesión', async () => {
    let now = Date.UTC(2026, 9, 21, 12)
    const { engine, cloud } = setup({ now: () => now })
    await engine.start()
    const reads = () => cloud.calls.filter(c => c === 'listSets').length
    expect(reads()).toBe(1)
    await engine.sync({ pull: true })
    expect(reads()).toBe(1)
    now += 5 * 60_000
    await engine.sync({ pull: true })
    expect(reads()).toBe(2)
  })
})

describe('cerrar sesión', () => {
  it('borra la cola, la marca de dueño y los datos locales', async () => {
    const store = memoryStore()
    const local = fakeLocal()
    const { engine } = setup({ store, local, online: () => false })
    await engine.start()
    engine.recordSets([camSet(uuid(), '2026-10-21T10:00:30.000Z')], false)
    local.write({ history: [camSet(uuid(), '2026-10-21T10:00:30.000Z')] })
    engine.discard()
    expect(store.data).toEqual({})
    expect(local.data.history).toEqual([])
    expect(engine.status().pendingOps).toBe(0)
  })
})
