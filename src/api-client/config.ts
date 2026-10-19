/**
 * Configuración de las cuentas a partir de las variables `VITE_*` (issue #60, DEC-069).
 *
 * Todo lo que empieza por `VITE_` termina en el bundle y es público. Por eso aquí solo
 * puede haber la URL del proyecto y la clave publicable; la `service_role`/`sb_secret_*`
 * vive en Edge Functions y secretos de CI (regla dura 3). Si alguien la pone por error,
 * las cuentas no arrancan y el script `check-bundle-secrets` falla el build.
 */

export interface AccountsConfig {
  /** Origen del proyecto Supabase, sin ruta. */
  url: string;
  publishableKey: string;
  /** Site key pública de Cloudflare Turnstile; null si el captcha no está configurado. */
  turnstileSiteKey: string | null;
}

export type AccountsEnv = Record<string, string | boolean | undefined>;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

export class AccountsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountsConfigError';
  }
}

/** null si `VITE_ENABLE_ACCOUNTS` no es `true`: la app funciona como hoy, sin cuentas. */
export function readAccountsConfig(env: AccountsEnv): AccountsConfig | null {
  if (env.VITE_ENABLE_ACCOUNTS !== 'true') return null;
  return {
    url: parseProjectUrl(str(env.VITE_SUPABASE_URL)),
    publishableKey: checkPublishableKey(str(env.VITE_SUPABASE_PUBLISHABLE_KEY)),
    turnstileSiteKey: str(env.VITE_TURNSTILE_SITE_KEY) || null,
  };
}

function str(value: string | boolean | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** HTTPS obligatorio salvo en local, sin credenciales ni ruta en la URL. */
function parseProjectUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AccountsConfigError('VITE_SUPABASE_URL no es una URL válida');
  }
  const local = LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new AccountsConfigError('VITE_SUPABASE_URL debe usar https');
  }
  if (url.username || url.password) {
    throw new AccountsConfigError('VITE_SUPABASE_URL no puede llevar credenciales');
  }
  return url.origin;
}

/**
 * Solo claves `sb_publishable_*`. Se rechazan las secretas y cualquier JWT: las claves JWT
 * heredadas (`anon`, `service_role`) no se distinguen a simple vista y una `service_role`
 * en el bundle salta RLS para cualquiera que abra la app.
 */
function checkPublishableKey(key: string): string {
  if (key.startsWith('sb_secret_')) {
    throw new AccountsConfigError('VITE_SUPABASE_PUBLISHABLE_KEY contiene una clave secreta; quítala del entorno y rótala');
  }
  if (key.startsWith('eyJ')) {
    throw new AccountsConfigError('VITE_SUPABASE_PUBLISHABLE_KEY debe ser una clave sb_publishable_, no un JWT');
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    throw new AccountsConfigError('VITE_SUPABASE_PUBLISHABLE_KEY falta o no tiene el formato sb_publishable_');
  }
  return key;
}
