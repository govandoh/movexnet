import { defineConfig, devices } from '@playwright/test';
import { execSync } from 'node:child_process';

/**
 * Pruebas de extremo a extremo (issue #60, DEC-060 propuso Playwright). Corren contra el stack
 * local: `pnpm db:start` (Supabase en Docker, correos en Mailpit) y Vite con las cuentas
 * activas. Nada aquí toca la nube.
 *
 * La clave publicable local la da `supabase status`; es la de demostración de la CLI, sin
 * acceso a ningún proyecto real.
 */
function localPublishableKey(): string {
  const out = execSync('pnpm exec supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const json = JSON.parse(out.slice(out.indexOf('{')));
  return json.PUBLISHABLE_KEY as string;
}

const PORT = 5173; // la URL de redirección local (supabase/config.toml) apunta a este puerto

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    ...devices['Pixel 7'],
    baseURL: `https://localhost:${PORT}`,
    // Certificado autofirmado de @vitejs/plugin-basic-ssl (DEC-020).
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    // El service worker no se registra con el certificado autofirmado y no aporta a estas pruebas.
    serviceWorkers: 'block',
  },
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    url: `https://localhost:${PORT}`,
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_ENABLE_ACCOUNTS: 'true',
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: localPublishableKey(),
      VITE_TURNSTILE_SITE_KEY: '',
    },
  },
});
