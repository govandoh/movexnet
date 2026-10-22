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
const APP_PORT = 5176; // la misma app con las cuentas apagadas: pantallas que no dependen de la sesión
// iPhone (WebKit): Supabase por el mismo origen https, porque Safari bloquea el http local
// como contenido mixto (ver vite.config.ts). En producción Supabase ya es https.
const IPHONE_PORT = 5177;
const LOCAL_SUPABASE = 'http://127.0.0.1:54321';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    ...devices['Pixel 7'],
    // Certificado autofirmado de @vitejs/plugin-basic-ssl (DEC-020).
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    // El service worker no se registra con el certificado autofirmado y no aporta a estas pruebas.
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'cuentas', testMatch: /cuentas\.spec\.ts/, use: { baseURL: `https://localhost:${PORT}` } },
    // La sincronización se prueba en Android (Pixel 7, Chromium) y en iPhone (WebKit, Safari):
    // la red se corta con context.setOffline, que dispara los eventos online/offline (#87).
    { name: 'sincronizacion', testMatch: /sincronizacion\.spec\.ts/, use: { baseURL: `https://localhost:${PORT}` } },
    {
      name: 'sincronizacion-iphone',
      testMatch: /sincronizacion\.spec\.ts/,
      // WebKit en Windows con el servidor de desarrollo es más lento que Chromium.
      timeout: 60_000,
      use: { ...devices['iPhone 15'], baseURL: `https://localhost:${IPHONE_PORT}` },
    },
    { name: 'app', testMatch: /calendario\.spec\.ts/, use: { baseURL: `https://localhost:${APP_PORT}` } },
  ],
  webServer: [
    {
      command: `pnpm exec vite --port ${PORT} --strictPort`,
      url: `https://localhost:${PORT}`,
      ignoreHTTPSErrors: true,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        VITE_ENABLE_ACCOUNTS: 'true',
        VITE_SUPABASE_URL: LOCAL_SUPABASE,
        VITE_SUPABASE_PUBLISHABLE_KEY: localPublishableKey(),
        VITE_TURNSTILE_SITE_KEY: '',
      },
    },
    {
      command: `pnpm exec vite --port ${APP_PORT} --strictPort`,
      url: `https://localhost:${APP_PORT}`,
      ignoreHTTPSErrors: true,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { VITE_ENABLE_ACCOUNTS: 'false' },
    },
    {
      command: `pnpm exec vite --port ${IPHONE_PORT} --strictPort`,
      url: `https://localhost:${IPHONE_PORT}`,
      ignoreHTTPSErrors: true,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        E2E_SUPABASE_PROXY: LOCAL_SUPABASE,
        VITE_ENABLE_ACCOUNTS: 'true',
        VITE_SUPABASE_URL: `https://localhost:${IPHONE_PORT}`,
        VITE_SUPABASE_PUBLISHABLE_KEY: localPublishableKey(),
        VITE_TURNSTILE_SITE_KEY: '',
      },
    },
  ],
});
