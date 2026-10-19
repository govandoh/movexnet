import { describe, expect, it } from 'vitest'
import {
  AuthError, PRIVACY_VERSION, isAdultBirthYear, isValidEmail, normalizeEmail, passwordIssues,
  validateSignUp, type SignUpInput,
} from './auth.ts'

/** 19 de octubre de 2026. */
const NOW = new Date(2026, 9, 19, 12)

const valid: SignUpInput = {
  email: 'ana@example.com',
  password: 'Sentadilla2026',
  displayName: 'Ana',
  birthYear: 1995,
  privacyVersion: PRIVACY_VERSION,
}

describe('isAdultBirthYear', () => {
  it('aplica la regla por año de calendario, igual que el servidor', () => {
    expect(isAdultBirthYear(2008, NOW)).toBe(true)
    expect(isAdultBirthYear(2009, NOW)).toBe(false)
    expect(isAdultBirthYear(1990, NOW)).toBe(true)
  })

  it('rechaza años absurdos o no enteros', () => {
    expect(isAdultBirthYear(1850, NOW)).toBe(false)
    expect(isAdultBirthYear(1990.5, NOW)).toBe(false)
    expect(isAdultBirthYear(Number.NaN, NOW)).toBe(false)
  })
})

describe('correo', () => {
  it('normaliza espacios y mayúsculas', () => {
    expect(normalizeEmail('  Ana@Example.COM ')).toBe('ana@example.com')
  })

  it('valida la forma', () => {
    expect(isValidEmail('ana@example.com')).toBe(true)
    expect(isValidEmail('ana@example')).toBe(false)
    expect(isValidEmail('ana example@x.com')).toBe(false)
    expect(isValidEmail(`${'a'.repeat(250)}@x.com`)).toBe(false)
  })
})

describe('passwordIssues', () => {
  it('acepta una contraseña que cumple la política', () => {
    expect(passwordIssues('Sentadilla2026')).toEqual([]) // ggignore: contraseña de prueba, no es un secreto
  })

  it('pide longitud mínima, minúsculas, mayúsculas y dígitos', () => {
    expect(passwordIssues('Ab1')).toContain('too_short')
    expect(passwordIssues('SENTADILLA2026')).toContain('no_lower') // ggignore: contraseña de prueba, no es un secreto
    expect(passwordIssues('sentadilla2026')).toContain('no_upper') // ggignore: contraseña de prueba, no es un secreto
    expect(passwordIssues('Sentadillaaa')).toContain('no_digit')
  })

  it('cuenta bytes, no caracteres, para el límite de 72 de bcrypt', () => {
    expect(passwordIssues(`Aa1${'x'.repeat(69)}`)).not.toContain('too_long')
    expect(passwordIssues(`Aa1${'ñ'.repeat(35)}`)).toContain('too_long')
  })
})

describe('validateSignUp', () => {
  it('no da errores con datos válidos', () => {
    expect(validateSignUp(valid, NOW)).toEqual({})
  })

  it('bloquea a menores de 18', () => {
    expect(validateSignUp({ ...valid, birthYear: 2010 }, NOW).birthYear).toMatch(/18 años/)
  })

  it('exige el aviso de privacidad vigente', () => {
    expect(validateSignUp({ ...valid, privacyVersion: '' }, NOW).privacy).toBeDefined()
    expect(validateSignUp({ ...valid, privacyVersion: 'privacy-2020-01-v1' }, NOW).privacy).toBeDefined()
  })

  it('exige nombre y correo válidos', () => {
    const errors = validateSignUp({ ...valid, displayName: '   ', email: 'x' }, NOW)
    expect(errors.displayName).toBeDefined()
    expect(errors.email).toBeDefined()
  })
})

describe('AuthError', () => {
  it('lleva un mensaje en español fijo, nunca el del servidor', () => {
    const e = new AuthError('invalid_credentials')
    expect(e.code).toBe('invalid_credentials')
    expect(e.message).toBe('Correo o contraseña incorrectos.')
  })
})
