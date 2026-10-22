import { describe, expect, it } from 'vitest'
import { PAGE_SIZE, readAll, run, toSyncError } from './postgrest.ts'

describe('toSyncError', () => {
  it('reintenta red, sesión vencida, límites de tasa y errores del servidor', () => {
    expect(toSyncError({ message: 'TypeError: Failed to fetch', code: '' }, 0)).toMatchObject({ transient: true, code: 'network' })
    expect(toSyncError({ code: 'PGRST301' }, 401)).toMatchObject({ transient: true, code: 'auth' })
    expect(toSyncError({ code: '' }, 429).transient).toBe(true)
    expect(toSyncError({ code: '' }, 503).transient).toBe(true)
  })

  it('no reintenta datos inválidos ni permisos', () => {
    expect(toSyncError({ code: '23514' }, 400)).toMatchObject({ transient: false, code: '23514' })
    expect(toSyncError({ code: '42501' }, 403)).toMatchObject({ transient: false, code: '42501' })
    expect(toSyncError({ code: 'PGRST204' }, 400).transient).toBe(false)
  })

  it('no copia el mensaje del servidor', () => {
    expect(toSyncError({ code: '23505', message: 'Key (id)=(secreto) already exists' }, 409).message).not.toContain('secreto')
  })
})

describe('run y readAll', () => {
  it('lanza SyncError si la consulta falla y devuelve los datos si no', async () => {
    await expect(run(Promise.resolve({ data: [1], error: null, status: 200 }))).resolves.toEqual([1])
    await expect(run(Promise.resolve({ data: null, error: { code: '' }, status: 0 }))).rejects.toMatchObject({ code: 'network' })
    await expect(run(Promise.reject(new Error('x')))).rejects.toMatchObject({ transient: true })
  })

  it('lee páginas hasta que una viene incompleta', async () => {
    const pages: [number, number][] = []
    const rows = await readAll((from, to) => {
      pages.push([from, to])
      const n = from === 0 ? PAGE_SIZE : 3
      return Promise.resolve({ data: Array.from({ length: n }, (_, i) => from + i), error: null, status: 200 })
    })
    expect(pages).toEqual([[0, PAGE_SIZE - 1], [PAGE_SIZE, 2 * PAGE_SIZE - 1]])
    expect(rows).toHaveLength(PAGE_SIZE + 3)
  })
})
