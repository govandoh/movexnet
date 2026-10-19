/**
 * Punto de entrada de `api-client` (carpeta interina; pasa a `packages/api-client` en el PR 6).
 * Es lo único que la UI importa para las cuentas; el SDK de Supabase no sale de esta carpeta
 * (regla de ESLint en `eslint.config.js`, DEC-028 y DEC-069).
 */

import type { AuthRepository } from '../domain/ports.ts';
import { readAccountsConfig, type AccountsConfig } from './config.ts';

let config: AccountsConfig | null | undefined;
let repository: Promise<AuthRepository | null> | null = null;

/**
 * Configuración de las cuentas; null si están apagadas o mal configuradas. Una configuración
 * inválida deja las cuentas apagadas (falla cerrado) en vez de romper la app.
 */
export function getAccountsConfig(): AccountsConfig | null {
  if (config === undefined) {
    try {
      config = readAccountsConfig(import.meta.env);
    } catch (e) {
      // Solo el motivo de configuración; nunca el valor de la clave.
      console.error(e instanceof Error ? e.message : 'configuración de cuentas inválida');
      config = null;
    }
  }
  return config;
}

export function accountsEnabled(): boolean {
  return getAccountsConfig() !== null;
}

/** Repositorio de cuentas, cargado bajo demanda; null si las cuentas están apagadas. */
export function loadAuthRepository(): Promise<AuthRepository | null> {
  repository ??= (async () => {
    const cfg = getAccountsConfig();
    if (!cfg) return null;
    const { createBrowserAuthRepository } = await import('./browserClient.ts');
    return createBrowserAuthRepository(cfg);
  })();
  return repository;
}
