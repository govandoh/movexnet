import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// Solo para Playwright en WebKit (playwright.config.ts): Safari bloquea como contenido mixto
// las llamadas de la página https al Supabase local por http. Con la variable, Vite las
// reenvía desde el mismo origen https. Nunca se usa en desarrollo normal ni en producción.
const SUPABASE_PROXY = process.env.E2E_SUPABASE_PROXY;

export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: true,
    port: 5173,
    proxy: SUPABASE_PROXY
      ? Object.fromEntries(['/auth/v1', '/rest/v1'].map(p => [p, { target: SUPABASE_PROXY, changeOrigin: true }]))
      : undefined,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
})
