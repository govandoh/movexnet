/**
 * Cliente de Supabase en el navegador (issue #60, DEC-069). Único lugar que crea el cliente;
 * se carga con `import()` desde `index.ts` solo si las cuentas están activas, para que el SDK
 * no pese en el bundle cuando no se usan. Cuentas y datos comparten el mismo cliente: los
 * repositorios de datos viajan con el JWT de la sesión que renueva Auth (issue #87).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../domain/database.types.ts';
import type { AccountsConfig } from './config.ts';
import { SupabaseAuthRepository } from './supabaseAuthRepository.ts';
import { SupabaseWorkoutRepository } from './supabaseWorkoutRepository.ts';
import { SupabaseProfileRepository } from './supabaseProfileRepository.ts';
import { SupabaseGoalRepository, SupabaseRoutineRepository } from './supabaseRoutineRepository.ts';
import { SupabasePushRepository } from './supabasePushRepository.ts';
import type { SyncRepositories } from './syncEngine.ts';

/** Clave propia en vez de `sb-<ref>-auth-token` para poder borrarla sin conocer el proyecto. */
const STORAGE_KEY = 'movexnet-auth';

function clearLocalSession(): void {
  try {
    // La sesión y los verificadores de PKCE de cada flujo (`-code-verifier`, `-flow-<id>-…`).
    const keys = Object.keys(localStorage).filter(k => k === STORAGE_KEY || k.startsWith(`${STORAGE_KEY}-`));
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    // Almacenamiento bloqueado (modo privado): no hay nada guardado que borrar (DEC-024).
  }
}

export interface BrowserServices {
  auth: SupabaseAuthRepository;
  /** Repositorios de datos de la cuenta con sesión; `userId` solo filtra, autoriza la RLS. */
  data(userId: string): SyncRepositories;
  /** Suscripción y avisos de Web Push de la cuenta con sesión (DEC-080). */
  push: SupabasePushRepository;
}

export function createBrowserServices(config: AccountsConfig): BrowserServices {
  const client: SupabaseClient<Database> = createClient<Database>(config.url, config.publishableKey, {
    auth: {
      // PKCE: el enlace del correo trae un código de un solo uso que solo canjea el navegador
      // que lo pidió, no un token en la URL (DEC-069).
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: STORAGE_KEY,
    },
  });
  const auth = new SupabaseAuthRepository({
    auth: client.auth,
    // Raíz exacta del sitio: es la URL que debe estar en la allow-list del panel. HashRouter
    // no sirve aquí porque Auth agrega `?code=` a la URL.
    redirectTo: `${window.location.origin}/`,
    clearLocalSession,
  });
  return {
    auth,
    data: userId => ({
      workout: new SupabaseWorkoutRepository(client),
      profile: new SupabaseProfileRepository(client, userId),
      routines: new SupabaseRoutineRepository(client),
      goals: new SupabaseGoalRepository(client),
    }),
    push: new SupabasePushRepository(client),
  };
}
