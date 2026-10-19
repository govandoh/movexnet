import { useSyncExternalStore } from 'react';
import { accountsEnabled, loadAuthRepository } from '../../api-client/index.ts';
import type { AuthRepository, AuthUser, EmailLinkType } from '../../domain/ports.ts';

/**
 * Estado de la cuenta para la UI (issue #60, DEC-069). Solo guarda quién inició sesión;
 * la sesión en sí (tokens) la guarda y renueva `api-client`, nunca este estado.
 *
 * - `disabled`: cuentas apagadas (`VITE_ENABLE_ACCOUNTS`) o mal configuradas; la app es la de hoy.
 * - `recovery`: el usuario volvió del enlace de recuperación y hay que pedirle la contraseña nueva.
 * - `linkError`: el enlace del correo venció, ya se usó o se abrió en otro navegador (PKCE).
 */
export interface AccountState {
  status: 'disabled' | 'loading' | 'signed_out' | 'signed_in';
  user: AuthUser | null;
  recovery: boolean;
  linkError: boolean;
}

let state: AccountState = {
  status: accountsEnabled() ? 'loading' : 'disabled',
  user: null,
  recovery: false,
  linkError: false,
};
const listeners = new Set<() => void>();
let started = false;

function set(patch: Partial<AccountState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

/** Parámetros que dejan en la URL los enlaces del correo y las redirecciones de Auth. */
const AUTH_PARAMS = ['code', 'token_hash', 'type', 'error', 'error_code', 'error_description'];
const LINK_TYPES: readonly EmailLinkType[] = ['email', 'recovery'];

/**
 * Quita de la URL lo que dejó Auth. Si el canje funcionó, supabase-js ya borró `code`; si
 * falló, el código quedaría en el historial del navegador. Devuelve si había un error.
 */
function cleanAuthParams(): boolean {
  const url = new URL(window.location.href);
  const failed = url.searchParams.has('error') || url.searchParams.has('code');
  if (!url.searchParams.has('token_hash') && !url.searchParams.has('code') && !url.searchParams.has('error')) return false;
  for (const p of AUTH_PARAMS) url.searchParams.delete(p);
  window.history.replaceState(window.history.state, '', url.toString());
  return failed;
}

/**
 * Arranca la cuenta lo antes posible: el cliente de Supabase canjea al cargar el código del
 * enlace de confirmación o recuperación que viene en la URL.
 */
export function startAccount(): void {
  if (started || state.status === 'disabled') return;
  started = true;
  void loadAuthRepository()
    .then(async repo => {
      if (!repo) return set({ status: 'disabled' });
      repo.onAuthChange((event, user) => {
        if (event === 'signed_out') set({ status: 'signed_out', user: null, recovery: false });
        else if (event === 'password_recovery') set({ status: 'signed_in', user, recovery: true });
        else set({ status: 'signed_in', user });
      });
      const linkFailed = await verifyLinkInUrl(repo);
      const user = await repo.currentUser();
      set({ status: user ? 'signed_in' : 'signed_out', user, linkError: cleanAuthParams() || linkFailed });
    })
    .catch(() => set({ status: 'disabled' }));
}

/**
 * Enlace del correo con `token_hash` (plantillas de `supabase/templates/`, DEC-069): a
 * diferencia del código PKCE, se canjea en cualquier navegador. Devuelve si falló.
 */
async function verifyLinkInUrl(repo: AuthRepository): Promise<boolean> {
  const params = new URL(window.location.href).searchParams;
  const tokenHash = params.get('token_hash');
  const type = params.get('type') as EmailLinkType | null;
  if (!tokenHash) return false;
  if (!type || !LINK_TYPES.includes(type)) return true;
  try {
    await repo.verifyEmailLink({ tokenHash, type });
    return false;
  } catch {
    return true;
  }
}

export function useAccount(): AccountState {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb); },
    () => state,
  );
}

/** Repositorio de cuentas; lanza si las cuentas están apagadas (las pantallas no se muestran). */
export async function authRepository(): Promise<AuthRepository> {
  const repo = await loadAuthRepository();
  if (!repo) throw new Error('cuentas apagadas');
  return repo;
}

export const accountActions = {
  recoveryDone: () => set({ recovery: false }),
  dismissLinkError: () => set({ linkError: false }),
};
