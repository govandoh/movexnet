/**
 * Reglas de las cuentas (issue #60, DEC-069): validación del registro, política de
 * contraseñas, puerta 18+ y errores de autenticación con mensajes en español. Módulo puro:
 * la fecha llega como parámetro.
 *
 * Todo esto se repite en el servidor (Supabase Auth y `supabase/migrations/*_cuentas.sql`),
 * que es quien manda; aquí solo sirve para avisar antes de enviar el formulario.
 */

/** Versión vigente del aviso de privacidad (DEC-067). Igual que `private.current_privacy_version()`. */
export const PRIVACY_VERSION = 'privacy-2026-10-v1';

/** Edad mínima para crear cuenta, declarada con el año de nacimiento (DEC-067). */
export const MIN_ACCOUNT_AGE_YEARS = 18;
/** Años hacia atrás que se aceptan como año de nacimiento; descarta valores absurdos. */
const MAX_AGE_YEARS = 120;

/** Mismo mínimo que `minimum_password_length` en `supabase/config.toml` y el panel (DEC-069). */
export const MIN_PASSWORD_LENGTH = 10;
/** bcrypt solo usa los primeros 72 bytes y Supabase Auth rechaza contraseñas más largas. */
export const MAX_PASSWORD_BYTES = 72;
const MAX_EMAIL_LENGTH = 254;
const MAX_DISPLAY_NAME_LENGTH = 60;

/**
 * Regla por año de calendario, igual que `private.is_adult_birth_year`: quien cumple 18 en
 * el año en curso puede registrarse. Sin mes de nacimiento no hay más precisión.
 */
export function isAdultBirthYear(birthYear: number, now: Date): boolean {
  const year = now.getFullYear();
  return Number.isInteger(birthYear)
    && birthYear >= year - MAX_AGE_YEARS
    && year - birthYear >= MIN_ACCOUNT_AGE_YEARS;
}

/** Correo normalizado (sin espacios, en minúsculas) para que la misma cuenta no se duplique. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Validación de forma, no de existencia: la confirmación por correo prueba que es suyo. */
export function isValidEmail(email: string): boolean {
  const e = normalizeEmail(email);
  return e.length <= MAX_EMAIL_LENGTH && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(e);
}

export type PasswordIssue = 'too_short' | 'too_long' | 'no_lower' | 'no_upper' | 'no_digit';

/** Política `lower_upper_letters_digits` de Supabase con mínimo de 10 (DEC-069). */
export function passwordIssues(password: string): PasswordIssue[] {
  const issues: PasswordIssue[] = [];
  if (password.length < MIN_PASSWORD_LENGTH) issues.push('too_short');
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) issues.push('too_long');
  if (!/[a-z]/.test(password)) issues.push('no_lower');
  if (!/[A-Z]/.test(password)) issues.push('no_upper');
  if (!/[0-9]/.test(password)) issues.push('no_digit');
  return issues;
}

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
  birthYear: number;
  /** Debe ser `PRIVACY_VERSION`: el usuario marcó la casilla del aviso vigente. */
  privacyVersion: string;
  /** Token de Cloudflare Turnstile; obligatorio cuando el captcha está activo (DEC-069). */
  captchaToken?: string;
}

export type SignUpField = 'email' | 'password' | 'displayName' | 'birthYear' | 'privacy';

/** Errores por campo, en español; vacío si el formulario puede enviarse. */
export function validateSignUp(input: SignUpInput, now: Date): Partial<Record<SignUpField, string>> {
  const errors: Partial<Record<SignUpField, string>> = {};
  if (!isValidEmail(input.email)) errors.email = 'Escribe un correo válido.';
  const pw = passwordIssues(input.password);
  if (pw.length > 0) errors.password = passwordMessage(pw);
  const name = input.displayName.trim();
  if (name.length < 1 || name.length > MAX_DISPLAY_NAME_LENGTH) {
    errors.displayName = `Escribe tu nombre (máximo ${MAX_DISPLAY_NAME_LENGTH} caracteres).`;
  }
  if (!isAdultBirthYear(input.birthYear, now)) {
    errors.birthYear = `Necesitas tener al menos ${MIN_ACCOUNT_AGE_YEARS} años para crear una cuenta.`;
  }
  if (input.privacyVersion !== PRIVACY_VERSION) errors.privacy = 'Debes aceptar el aviso de privacidad.';
  return errors;
}

export function passwordMessage(issues: readonly PasswordIssue[]): string {
  if (issues.includes('too_long')) return `La contraseña no puede pasar de ${MAX_PASSWORD_BYTES} caracteres.`;
  return `Usa al menos ${MIN_PASSWORD_LENGTH} caracteres, con mayúsculas, minúsculas y números.`;
}

/**
 * Errores de autenticación que ve la app. Deliberadamente gruesos: `invalid_credentials`
 * no distingue "no existe" de "contraseña incorrecta", para no revelar qué correos tienen
 * cuenta (enumeración de usuarios).
 */
export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'weak_password'
  | 'same_password'
  | 'rate_limited'
  | 'captcha_failed'
  | 'signup_rejected'
  | 'signup_disabled'
  | 'session_expired'
  | 'reauthentication_needed'
  | 'network'
  | 'unknown';

const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  email_not_confirmed: 'Confirma tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.',
  weak_password: `La contraseña es débil. Usa al menos ${MIN_PASSWORD_LENGTH} caracteres, con mayúsculas, minúsculas y números.`,
  same_password: 'La nueva contraseña debe ser distinta de la anterior.',
  rate_limited: 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
  captcha_failed: 'No pudimos verificar que no eres un robot. Vuelve a intentarlo.',
  signup_rejected: 'No pudimos crear la cuenta con esos datos. Revisa el formulario.',
  signup_disabled: 'El registro de cuentas no está disponible por ahora.',
  session_expired: 'Tu sesión terminó. Inicia sesión de nuevo.',
  reauthentication_needed: 'Por seguridad, inicia sesión de nuevo antes de cambiar la contraseña.',
  network: 'Sin conexión con el servidor. Revisa tu internet y vuelve a intentarlo.',
  unknown: 'Algo salió mal. Vuelve a intentarlo.',
};

export function authErrorMessage(code: AuthErrorCode): string {
  return AUTH_ERROR_MESSAGES[code];
}

/** Error de los adaptadores de `AuthRepository`; nunca lleva el mensaje crudo del servidor. */
export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode) {
    super(AUTH_ERROR_MESSAGES[code]);
    this.name = 'AuthError';
    this.code = code;
  }
}
