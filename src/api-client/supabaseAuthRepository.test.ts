import { describe, expect, it, vi } from 'vitest'
import { AuthError, PRIVACY_VERSION, type SignUpInput } from '../domain/auth.ts'
import { SupabaseAuthRepository, mapAuthError, type SupabaseAuth } from './supabaseAuthRepository.ts'

const NOW = new Date(2026, 9, 19, 12)
const SESSION = { user: { id: 'u1', email: 'ana@example.com' } }

const signUpInput: SignUpInput = {
  email: '  Ana@Example.com ',
  password: 'Sentadilla2026', // ggignore: contraseña de prueba, no es un secreto
  displayName: ' Ana ',
  birthYear: 1995,
  birthMonth: 4,
  privacyVersion: PRIVACY_VERSION,
  captchaToken: 'tok',
}

function apiError(code: string, status = 400) {
  return { name: 'AuthApiError', code, status, message: `mensaje crudo ${code}` }
}

/** Doble del cliente `auth` de supabase-js con respuestas configurables. */
function fakeAuth(overrides: Record<string, unknown> = {}) {
  let callback: ((event: string, session: unknown) => void) | null = null
  const auth = {
    signUp: vi.fn(async () => ({ data: { user: SESSION.user, session: null }, error: null })),
    signInWithPassword: vi.fn(async () => ({ data: { user: SESSION.user, session: SESSION }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    resetPasswordForEmail: vi.fn(async () => ({ data: {}, error: null })),
    updateUser: vi.fn(async () => ({ data: { user: SESSION.user }, error: null })),
    getSession: vi.fn(async () => ({ data: { session: SESSION }, error: null })),
    verifyOtp: vi.fn(async () => ({ data: { session: SESSION, user: SESSION.user }, error: null })),
    onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
      callback = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    }),
    ...overrides,
  }
  return { auth, fire: (event: string, session: unknown) => callback?.(event, session) }
}

function repo(auth: unknown, clearLocalSession = vi.fn()) {
  return new SupabaseAuthRepository({
    auth: auth as SupabaseAuth,
    redirectTo: 'https://app.example/',
    clearLocalSession,
    now: () => NOW,
  })
}

describe('signUp', () => {
  it('envía correo normalizado, metadatos para el trigger, captcha y redirect exacto', async () => {
    const { auth } = fakeAuth()
    await expect(repo(auth).signUp(signUpInput)).resolves.toEqual({ needsEmailConfirmation: true })
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'ana@example.com',
      password: signUpInput.password,
      options: {
        emailRedirectTo: 'https://app.example/',
        captchaToken: 'tok',
        data: { display_name: 'Ana', birth_year: '1995', birth_month: '4', privacy_version: PRIVACY_VERSION },
      },
    })
  })

  it('no llama al servidor si el formulario no es válido (menor de edad)', async () => {
    const { auth } = fakeAuth()
    await expect(repo(auth).signUp({ ...signUpInput, birthYear: 2012 })).rejects.toMatchObject({ code: 'signup_rejected' })
    expect(auth.signUp).not.toHaveBeenCalled()
  })

  it('un correo ya registrado responde como un registro normal (anti enumeración)', async () => {
    const { auth } = fakeAuth({
      signUp: vi.fn(async () => ({ data: { user: null, session: null }, error: apiError('user_already_exists', 422) })),
    })
    await expect(repo(auth).signUp(signUpInput)).resolves.toEqual({ needsEmailConfirmation: true })
  })

  it('el rechazo del trigger se traduce a un mensaje genérico', async () => {
    const { auth } = fakeAuth({
      signUp: vi.fn(async () => ({ data: { user: null, session: null }, error: apiError('unexpected_failure', 500) })),
    })
    const err = await repo(auth).signUp(signUpInput).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AuthError)
    expect((err as AuthError).code).toBe('signup_rejected')
    expect((err as AuthError).message).not.toContain('crudo')
  })
})

describe('signIn', () => {
  it('devuelve el usuario de la sesión', async () => {
    const { auth } = fakeAuth()
    await expect(repo(auth).signIn({ email: 'ANA@example.com', password: 'x', captchaToken: 't' }))
      .resolves.toEqual({ id: 'u1', email: 'ana@example.com' })
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'ana@example.com', password: 'x', options: { captchaToken: 't' },
    })
  })

  it('credenciales incorrectas: mismo error exista o no la cuenta', async () => {
    const { auth } = fakeAuth({
      signInWithPassword: vi.fn(async () => ({ data: { user: null, session: null }, error: apiError('invalid_credentials') })),
    })
    await expect(repo(auth).signIn({ email: 'a@b.co', password: 'x' })).rejects.toMatchObject({ code: 'invalid_credentials' })
  })
})

describe('signOut', () => {
  it('cierra solo la sesión de este dispositivo', async () => {
    const { auth } = fakeAuth()
    const clear = vi.fn()
    await repo(auth, clear).signOut()
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(clear).not.toHaveBeenCalled()
  })

  it('sin red, borra igual la sesión local y avisa a los suscriptores', async () => {
    const { auth } = fakeAuth({ signOut: vi.fn(async () => { throw new Error('offline') }) })
    const clear = vi.fn()
    const r = repo(auth, clear)
    const listener = vi.fn()
    r.onAuthChange(listener)
    await r.signOut()
    expect(clear).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledWith('signed_out', null)
  })
})

describe('requestPasswordReset', () => {
  it('no revela si la cuenta existe', async () => {
    const { auth } = fakeAuth({
      resetPasswordForEmail: vi.fn(async () => ({ data: null, error: apiError('user_not_found', 404) })),
    })
    await expect(repo(auth).requestPasswordReset({ email: 'nadie@example.com' })).resolves.toBeUndefined()
  })

  it('sí informa el límite de intentos', async () => {
    const { auth } = fakeAuth({
      resetPasswordForEmail: vi.fn(async () => ({ data: null, error: apiError('over_email_send_rate_limit', 429) })),
    })
    await expect(repo(auth).requestPasswordReset({ email: 'a@b.co' })).rejects.toMatchObject({ code: 'rate_limited' })
  })
})

describe('sesión y eventos', () => {
  it('currentUser lee la sesión guardada', async () => {
    const { auth } = fakeAuth()
    await expect(repo(auth).currentUser()).resolves.toEqual({ id: 'u1', email: 'ana@example.com' })
  })

  it('traduce los eventos e ignora la renovación del token', () => {
    const { auth, fire } = fakeAuth()
    const listener = vi.fn()
    const off = repo(auth).onAuthChange(listener)
    fire('PASSWORD_RECOVERY', SESSION)
    fire('TOKEN_REFRESHED', SESSION)
    fire('INITIAL_SESSION', null)
    fire('SIGNED_OUT', null)
    expect(listener.mock.calls).toEqual([
      ['password_recovery', { id: 'u1', email: 'ana@example.com' }],
      ['signed_out', null],
    ])
    off()
  })

  it('updatePassword exige sesión reciente', async () => {
    const { auth } = fakeAuth({
      updateUser: vi.fn(async () => ({ data: { user: null }, error: apiError('reauthentication_needed') })),
    })
    await expect(repo(auth).updatePassword('Nueva12345A')).rejects.toMatchObject({ code: 'reauthentication_needed' })
  })
})

describe('verifyEmailLink', () => {
  it('canjea el token_hash del correo con su tipo', async () => {
    const { auth } = fakeAuth()
    await repo(auth).verifyEmailLink({ tokenHash: 'abc', type: 'recovery' })
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc', type: 'recovery' })
  })

  it('un enlace vencido o usado falla con un error genérico', async () => {
    const { auth } = fakeAuth({
      verifyOtp: vi.fn(async () => ({ data: { session: null, user: null }, error: apiError('otp_expired', 403) })),
    })
    await expect(repo(auth).verifyEmailLink({ tokenHash: 'abc', type: 'email' })).rejects.toBeInstanceOf(AuthError)
  })
})

describe('mapAuthError', () => {
  it('errores de red', () => {
    expect(mapAuthError({ name: 'AuthRetryableFetchError', status: 0 }, 'signIn')).toBe('network')
  })

  it('429 sin código es límite de intentos', () => {
    expect(mapAuthError({ status: 429 }, 'reset')).toBe('rate_limited')
  })

  it('lo desconocido no se filtra', () => {
    expect(mapAuthError(new Error('boom'), 'update')).toBe('unknown')
  })
})
