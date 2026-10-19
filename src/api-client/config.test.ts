import { describe, expect, it } from 'vitest'
import { AccountsConfigError, readAccountsConfig } from './config.ts'

const base = {
  VITE_ENABLE_ACCOUNTS: 'true',
  VITE_SUPABASE_URL: 'https://abcdefgh.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_AbC123_x-y',
}

describe('readAccountsConfig', () => {
  it('apagado por defecto: sin la variable, sin cuentas', () => {
    expect(readAccountsConfig({})).toBeNull()
    expect(readAccountsConfig({ ...base, VITE_ENABLE_ACCOUNTS: 'false' })).toBeNull()
    expect(readAccountsConfig({ ...base, VITE_ENABLE_ACCOUNTS: '1' })).toBeNull()
  })

  it('lee la URL y la clave publicable', () => {
    expect(readAccountsConfig({ ...base, VITE_TURNSTILE_SITE_KEY: '0x4AAA' })).toEqual({
      url: 'https://abcdefgh.supabase.co',
      publishableKey: 'sb_publishable_AbC123_x-y',
      turnstileSiteKey: '0x4AAA',
    })
  })

  it('rechaza una clave secreta', () => {
    expect(() => readAccountsConfig({ ...base, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_xyz' }))
      .toThrow(AccountsConfigError)
  })

  it('rechaza cualquier JWT, incluida la service_role heredada', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.firma'
    expect(() => readAccountsConfig({ ...base, VITE_SUPABASE_PUBLISHABLE_KEY: jwt })).toThrow(/JWT/)
  })

  it('el mensaje de error nunca incluye la clave', () => {
    try {
      readAccountsConfig({ ...base, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_NO_FILTRAR' })
    } catch (e) {
      expect((e as Error).message).not.toContain('NO_FILTRAR')
    }
  })

  it('exige https salvo en local', () => {
    expect(() => readAccountsConfig({ ...base, VITE_SUPABASE_URL: 'http://abcdefgh.supabase.co' })).toThrow(/https/)
    expect(readAccountsConfig({ ...base, VITE_SUPABASE_URL: 'http://127.0.0.1:54321' })?.url).toBe('http://127.0.0.1:54321')
  })

  it('rechaza URLs con credenciales o inválidas y descarta la ruta', () => {
    expect(() => readAccountsConfig({ ...base, VITE_SUPABASE_URL: 'https://u:p@x.supabase.co' })).toThrow()
    expect(() => readAccountsConfig({ ...base, VITE_SUPABASE_URL: 'no es url' })).toThrow()
    expect(readAccountsConfig({ ...base, VITE_SUPABASE_URL: 'https://x.supabase.co/rest/v1' })?.url).toBe('https://x.supabase.co')
  })
})
