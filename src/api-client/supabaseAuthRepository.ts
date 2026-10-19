/**
 * `AuthRepository` sobre Supabase Auth (issue #60, DEC-069).
 *
 * Recibe el cliente `auth` ya creado (`browserClient.ts`) para poder probarlo con un doble.
 * Reglas de seguridad que se aplican aquí:
 * - Los errores del servidor se traducen a `AuthError` con mensajes fijos; nunca se muestra
 *   ni se registra el mensaje crudo, ni tokens ni contraseñas.
 * - Registro y recuperación responden igual exista o no la cuenta (anti enumeración).
 * - Cerrar sesión borra la sesión local aunque el servidor no responda.
 */

import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js';
import {
  AuthError, PRIVACY_VERSION, normalizeEmail, validateSignUp, type AuthErrorCode, type SignUpInput,
} from '../domain/auth.ts';
import type { AuthEvent, AuthRepository, AuthUser, EmailLinkType } from '../domain/ports.ts';

export type SupabaseAuth = Pick<
  SupabaseClient['auth'],
  'signUp' | 'signInWithPassword' | 'signOut' | 'resetPasswordForEmail' | 'updateUser' | 'getSession'
  | 'onAuthStateChange' | 'verifyOtp'
>;

export interface SupabaseAuthRepositoryDeps {
  auth: SupabaseAuth;
  /** URL exacta a la que vuelven los enlaces de confirmación y recuperación (allow-list del panel). */
  redirectTo: string;
  /** Borra la sesión guardada en el dispositivo; se usa si el cierre en el servidor falla. */
  clearLocalSession: () => void;
  now?: () => Date;
}

interface ErrorLike {
  name?: string;
  code?: string;
  status?: number;
}

type Operation = 'signUp' | 'signIn' | 'reset' | 'update' | 'session' | 'verify';

/** Códigos de https://supabase.com/docs/guides/auth/debugging/error-codes que usamos. */
const CODE_MAP: Record<string, AuthErrorCode> = {
  invalid_credentials: 'invalid_credentials',
  email_not_confirmed: 'email_not_confirmed',
  weak_password: 'weak_password',
  same_password: 'same_password',
  over_request_rate_limit: 'rate_limited',
  over_email_send_rate_limit: 'rate_limited',
  captcha_failed: 'captcha_failed',
  signup_disabled: 'signup_disabled',
  email_provider_disabled: 'signup_disabled',
  reauthentication_needed: 'reauthentication_needed',
  session_not_found: 'session_expired',
  session_expired: 'session_expired',
  refresh_token_not_found: 'session_expired',
  refresh_token_already_used: 'session_expired',
  bad_jwt: 'session_expired',
};

export function mapAuthError(error: unknown, op: Operation): AuthErrorCode {
  const e = (error ?? {}) as ErrorLike;
  if (e.name === 'AuthRetryableFetchError' || e.status === 0) return 'network';
  const mapped = e.code ? CODE_MAP[e.code] : undefined;
  if (mapped) return mapped;
  if (e.status === 429) return 'rate_limited';
  // El trigger de alta rechaza edad o aviso inválidos y Auth responde 500 "Database error
  // saving new user" (`unexpected_failure`). Los datos inválidos del formulario, 400/422.
  if (op === 'signUp' && (e.code === 'unexpected_failure' || e.status === 500 || e.status === 400 || e.status === 422)) {
    return 'signup_rejected';
  }
  // Credenciales con formato inválido: mismo mensaje que credenciales incorrectas.
  if (op === 'signIn' && (e.status === 400 || e.status === 422)) return 'invalid_credentials';
  return 'unknown';
}

/** El correo ya tenía cuenta: no se revela, se responde como un registro normal. */
const EXISTING_ACCOUNT_CODES = new Set(['user_already_exists', 'email_exists']);

const EVENT_MAP: Partial<Record<AuthChangeEvent, AuthEvent>> = {
  INITIAL_SESSION: 'signed_in',
  SIGNED_IN: 'signed_in',
  SIGNED_OUT: 'signed_out',
  PASSWORD_RECOVERY: 'password_recovery',
  USER_UPDATED: 'user_updated',
};

function toUser(session: Session | null): AuthUser | null {
  if (!session) return null;
  return { id: session.user.id, email: session.user.email ?? '' };
}

export class SupabaseAuthRepository implements AuthRepository {
  private readonly deps: SupabaseAuthRepositoryDeps;
  private readonly listeners = new Set<(event: AuthEvent, user: AuthUser | null) => void>();

  constructor(deps: SupabaseAuthRepositoryDeps) {
    this.deps = deps;
  }

  async signUp(input: SignUpInput): Promise<{ needsEmailConfirmation: boolean }> {
    const now = this.deps.now?.() ?? new Date();
    // Defensa en profundidad: la UI ya valida y el servidor vuelve a hacerlo.
    if (Object.keys(validateSignUp(input, now)).length > 0) throw new AuthError('signup_rejected');
    const { data, error } = await this.deps.auth.signUp({
      email: normalizeEmail(input.email),
      password: input.password,
      options: {
        emailRedirectTo: this.deps.redirectTo,
        captchaToken: input.captchaToken,
        // Lo lee solo el trigger de alta (`private.handle_new_user`). Año y mes viajan como
        // texto porque el trigger valida el formato con una expresión regular.
        data: {
          display_name: input.displayName.trim(),
          birth_year: String(input.birthYear),
          birth_month: String(input.birthMonth),
          privacy_version: PRIVACY_VERSION,
        },
      },
    });
    if (error) {
      if (error.code && EXISTING_ACCOUNT_CODES.has(error.code)) return { needsEmailConfirmation: true };
      throw new AuthError(mapAuthError(error, 'signUp'));
    }
    return { needsEmailConfirmation: data.session === null };
  }

  async signIn(input: { email: string; password: string; captchaToken?: string }): Promise<AuthUser> {
    const { data, error } = await this.deps.auth.signInWithPassword({
      email: normalizeEmail(input.email),
      password: input.password,
      options: { captchaToken: input.captchaToken },
    });
    if (error) throw new AuthError(mapAuthError(error, 'signIn'));
    const user = toUser(data.session);
    if (!user) throw new AuthError('unknown');
    return user;
  }

  async signOut(): Promise<void> {
    // `local`: revoca solo la sesión de este dispositivo. Si el servidor no responde, la
    // sesión guardada se borra igual para que un celular compartido no quede abierto.
    let failed: boolean;
    try {
      const { error } = await this.deps.auth.signOut({ scope: 'local' });
      failed = error !== null;
    } catch {
      failed = true;
    }
    if (failed) {
      this.deps.clearLocalSession();
      this.emit('signed_out', null);
    }
  }

  async requestPasswordReset(input: { email: string; captchaToken?: string }): Promise<void> {
    const { error } = await this.deps.auth.resetPasswordForEmail(normalizeEmail(input.email), {
      redirectTo: this.deps.redirectTo,
      captchaToken: input.captchaToken,
    });
    if (!error) return;
    const code = mapAuthError(error, 'reset');
    // Solo se informan los errores que no dicen nada de la cuenta.
    if (code === 'rate_limited' || code === 'captcha_failed' || code === 'network') throw new AuthError(code);
  }

  async verifyEmailLink(input: { tokenHash: string; type: EmailLinkType }): Promise<void> {
    const { error } = await this.deps.auth.verifyOtp({ token_hash: input.tokenHash, type: input.type });
    if (error) throw new AuthError(mapAuthError(error, 'verify'));
  }

  async updatePassword(newPassword: string): Promise<void> {
    const { error } = await this.deps.auth.updateUser({ password: newPassword });
    if (error) throw new AuthError(mapAuthError(error, 'update'));
  }

  /**
   * Lee la sesión guardada sin ir a la red, para que la PWA abra sin conexión. No sirve para
   * autorizar: eso lo hace RLS en la base con el JWT de cada petición.
   */
  async currentUser(): Promise<AuthUser | null> {
    const { data, error } = await this.deps.auth.getSession();
    if (error) return null;
    return toUser(data.session);
  }

  onAuthChange(listener: (event: AuthEvent, user: AuthUser | null) => void): () => void {
    this.listeners.add(listener);
    // El callback de Supabase no debe esperar otras llamadas de Auth (bloquea su candado
    // interno), así que solo se reenvía el evento.
    const { data } = this.deps.auth.onAuthStateChange((event, session) => {
      const mapped = EVENT_MAP[event];
      if (!mapped) return;
      if (event === 'INITIAL_SESSION' && !session) return;
      listener(mapped, toUser(session));
    });
    return () => {
      this.listeners.delete(listener);
      data.subscription.unsubscribe();
    };
  }

  private emit(event: AuthEvent, user: AuthUser | null): void {
    for (const l of this.listeners) l(event, user);
  }
}
