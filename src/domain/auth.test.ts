import { describe, expect, it } from 'vitest'
import {
  AuthError, PRIVACY_VERSION, isAdultBirthMonth, isValidEmail, normalizeEmail, passwordIssues,
  validateSignUp, type SignUpInput,
} from './auth.ts'

/** 19 de octubre de 2026. */
const NOW = new Date(2026, 9, 19, 12)

const valid: SignUpInput = {
  email: 'ana@example.com',
  password: 'Sentadilla2026',
  displayName: 'Ana',
  birthYear: 1995,
  birthMonth: 4,
  privacyVersion: PRIVACY_VERSION,
}

describe('isAdultBirthMonth', () => {
  it('exige 18 años y un mes completo más: el mes de nacimiento todavía no cuenta', () => {
    // NOW = 19 de octubre de 2026
    expect(isAdultBirthMonth(2008, 9, NOW)).toBe(true)
    expect(isAdultBirthMonth(2008, 10, NOW)).toBe(false)
    expect(isAdultBirthMonth(2008, 11, NOW)).toBe(false)
    expect(isAdultBirthMonth(1990, 12, NOW)).toBe(true)
  })

  it('con solo el año entraba gente de 17: ya no', () => {
    expect(isAdultBirthMonth(2008, 12, NOW)).toBe(false)
  })

  it('rechaza meses fuera de rango y años absurdos o no enteros', () => {
    expect(isAdultBirthMonth(1990, 0, NOW)).toBe(false)
    expect(isAdultBirthMonth(1990, 13, NOW)).toBe(false)
    expect(isAdultBirthMonth(1850, 5, NOW)).toBe(false)
    expect(isAdultBirthMonth(1990.5, 5, NOW)).toBe(false)
    expect(isAdultBirthMonth(Number.NaN, 5, NOW)).toBe(false)
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
    expect(validateSignUp({ ...valid, birthYear: 2010 }, NOW).birthDate).toMatch(/18 años/)
    expect(validateSignUp({ ...valid, birthYear: 2008, birthMonth: 10 }, NOW).birthDate).toBeDefined()
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
