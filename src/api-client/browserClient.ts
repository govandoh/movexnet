/**
 * Cliente de Supabase en el navegador (issue #60, DEC-069). Único lugar que crea el cliente;
 * se carga con `import()` desde `index.ts` solo si las cuentas están activas, para que el SDK
 * no pese en el bundle cuando no se usan.
 */

import { createClient } from '@supabase/supabase-js';
import type { AccountsConfig } from './config.ts';
import { SupabaseAuthRepository } from './supabaseAuthRepository.ts';

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

export function createBrowserAuthRepository(config: AccountsConfig): SupabaseAuthRepository {
  const client = createClient(config.url, config.publishableKey, {
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
  return new SupabaseAuthRepository({
    auth: client.auth,
    // Raíz exacta del sitio: es la URL que debe estar en la allow-list del panel. HashRouter
    // no sirve aquí porque Auth agrega `?code=` a la URL.
    redirectTo: `${window.location.origin}/`,
    clearLocalSession,
  });
}
