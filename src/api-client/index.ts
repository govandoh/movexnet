/**
 * Punto de entrada de `api-client` (carpeta interina; pasa a `packages/api-client` en el PR 6).
 * Es lo único que la UI importa para las cuentas y la sincronización; el SDK de Supabase no
 * sale de esta carpeta (regla de ESLint en `eslint.config.js`, DEC-028 y DEC-069).
 */

import type { AuthRepository, PushRepository } from '../domain/ports.ts';
import type { BrowserServices } from './browserClient.ts';
import type { LocalPort, SyncEngine } from './syncEngine.ts';
import { readAccountsConfig, type AccountsConfig } from './config.ts';

export type { LocalData, LocalPort, SyncEngine, SyncStatus } from './syncEngine.ts';

let config: AccountsConfig | null | undefined;
let services: Promise<BrowserServices | null> | null = null;

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

function loadServices(): Promise<BrowserServices | null> {
  services ??= (async () => {
    const cfg = getAccountsConfig();
    if (!cfg) return null;
    const { createBrowserServices } = await import('./browserClient.ts');
    return createBrowserServices(cfg);
  })();
  return services;
}

/** Repositorio de cuentas, cargado bajo demanda; null si las cuentas están apagadas. */
export async function loadAuthRepository(): Promise<AuthRepository | null> {
  return (await loadServices())?.auth ?? null;
}

/**
 * Clave pública VAPID; null si las cuentas están apagadas o no hay clave. Sin ella no hay
 * Web Push y los recordatorios se quedan en el aviso local (DEC-080).
 */
export function vapidPublicKey(): string | null {
  return getAccountsConfig()?.vapidPublicKey ?? null;
}

/** Suscripción y avisos de Web Push (issue #88); null si las cuentas o el push están apagados. */
export async function loadPushRepository(): Promise<PushRepository | null> {
  if (!vapidPublicKey()) return null;
  return (await loadServices())?.push ?? null;
}

/** Cierre de sesión sin motor en marcha: borra igual la cola y la marca de dueño (DEC-079). */
export async function forgetSync(userId: string): Promise<void> {
  const { forgetAccount, browserStore } = await import('./syncEngine.ts');
  forgetAccount(browserStore, userId);
}

export interface SyncSession {
  engine: SyncEngine;
  /** Quita los disparadores del navegador y detiene los reintentos. */
  stop(): void;
}

/**
 * Arranca la sincronización de la cuenta con sesión (issue #87, DEC-079); null si las cuentas
 * están apagadas: sin cuenta nada sale del dispositivo.
 */
export async function startSync(userId: string, local: LocalPort, makeId: () => string): Promise<SyncSession | null> {
  const s = await loadServices();
  if (!s) return null;
  const { SyncEngine, attachBrowserTriggers, browserStore } = await import('./syncEngine.ts');
  const engine = new SyncEngine({
    userId, repos: s.data(userId), local, store: browserStore, makeId, isOnline: () => navigator.onLine,
  });
  const detach = attachBrowserTriggers(engine);
  void engine.start();
  return {
    engine,
    stop: () => {
      detach();
      engine.stop();
    },
  };
}
