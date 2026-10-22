import { expect, test, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';

/**
 * Sincronización con la nube y cola offline (issue #87, DEC-079) contra el stack local
 * (`pnpm db:start`). Las cuentas se crean ya confirmadas con la API de administración local y
 * las filas se leen con la clave de servicio local (la de demostración de la CLI, sin acceso a
 * ningún proyecto real). El modo manual reemplaza a la cámara, que no se puede simular aquí.
 */

const API = 'http://127.0.0.1:54321';
const NO_ACCOUNTS_URL = 'https://localhost:5176'; // misma app con las cuentas apagadas (playwright.config.ts)
const PASSWORD = 'Sentadilla2026'; // ggignore: contraseña de prueba, no es un secreto
const run = Date.now().toString(36);

function serviceKey(): string {
  const out = execSync('pnpm exec supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  return JSON.parse(out.slice(out.indexOf('{'))).SERVICE_ROLE_KEY as string;
}
const KEY = serviceKey();
const admin = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

/** Cuenta confirmada; el trigger de alta exige nombre, año, mes y aviso vigente (DEC-069). */
async function createUser(tag: string): Promise<{ id: string; email: string }> {
  const email = `e2e-${run}-${tag}@test.local`;
  const res = await fetch(`${API}/auth/v1/admin/users`, {
    method: 'POST',
    headers: admin,
    body: JSON.stringify({
      email, password: PASSWORD, email_confirm: true,
      user_metadata: { display_name: 'Prueba E2E', birth_year: '1995', birth_month: '4', privacy_version: 'privacy-2026-10-v1' },
    }),
  });
  if (!res.ok) throw new Error(`no se pudo crear la cuenta: ${res.status}`);
  return { id: ((await res.json()) as { id: string }).id, email };
}

async function rows<T = Record<string, unknown>>(table: string, userId: string): Promise<T[]> {
  const res = await fetch(`${API}/rest/v1/${table}?user_id=eq.${userId}&select=*`, { headers: admin });
  return (await res.json()) as T[];
}

async function signIn(page: Page, email: string) {
  await page.goto('/#/cuenta/entrar');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/#\/$/);
}

async function syncState(page: Page) {
  await page.getByRole('link', { name: 'Perfil' }).click();
  return page.getByRole('status').filter({ hasText: 'Sincronización' });
}

/** Una serie de 8 repeticiones en el modo manual; cerrar el ejercicio la guarda. */
async function manualSet(page: Page) {
  await page.getByRole('button', { name: /Empezar serie 1/ }).click();
  for (let i = 0; i < 8; i++) await page.getByRole('button', { name: 'Sumar una repetición' }).click();
  await page.getByRole('button', { name: 'Terminar serie' }).click();
  await page.getByRole('button', { name: 'Terminar ejercicio' }).click();
  await expect(page.getByRole('heading', { name: 'Ejercicio terminado' })).toBeVisible();
  await page.getByRole('button', { name: 'Listo' }).click();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ob_complete_v1', '1'));
});

test('con cuenta, una serie hecha sin red llega a Supabase al volver la red', async ({ page, context }) => {
  const user = await createUser('offline');
  await signIn(page, user.email);
  await expect(await syncState(page)).toContainText('Sincronizado');

  // La pantalla manual se carga con red (es un trozo aparte) y la serie se hace sin red.
  await page.goto('/#/manual?ex=press-banca');
  await expect(page.getByRole('button', { name: /Empezar serie 1/ })).toBeVisible();
  await context.setOffline(true);
  await manualSet(page);

  const status = await syncState(page);
  await expect(status).toContainText('Sin conexión');
  await expect(status).toContainText('Pendiente: 1 serie');
  expect(await rows('set_logs', user.id)).toHaveLength(0);

  await context.setOffline(false);
  await expect(status).toContainText('Sincronizado');
  const sets = await rows<{ source: string; reps: number; duration_ms: number | null; flagged: boolean }>('set_logs', user.id);
  expect(sets).toHaveLength(1);
  expect(sets[0]).toMatchObject({ source: 'manual', duration_ms: null, flagged: false });
  const sessions = await rows<{ ended_at: string | null }>('workout_sessions', user.id);
  expect(sessions).toHaveLength(1);
  expect(sessions[0].ended_at).not.toBeNull();
  const metrics = await rows<{ name: string }>('metrics', user.id);
  expect(metrics.map(m => m.name).sort()).toEqual(['clean_reps', 'rejected_reps']);
});

test('la primera sincronización sube el historial previo una sola vez', async ({ page }) => {
  const user = await createUser('historial');
  // Historial anterior a la cuenta, sin sesión ni origen; se siembra una sola vez.
  await page.addInitScript(() => {
    if (localStorage.getItem('e2e_sembrado')) return;
    localStorage.setItem('e2e_sembrado', '1');
    const set = (id: string, hour: number) => ({
      id, completedAt: new Date(2026, 9, 1, hour).toISOString(), exerciseId: 'sentadilla',
      validReps: 10, rejectedReps: 1, goodReps: 9, timed: false, fatigue: 'baja',
    });
    localStorage.setItem('fitnet_history_v1', JSON.stringify([set('viejo-1', 9), set('viejo-2', 10)]));
  });
  await signIn(page, user.email);
  await expect(await syncState(page)).toContainText('Sincronizado');
  const sets = await rows<{ source: string }>('set_logs', user.id);
  expect(sets).toHaveLength(2);
  expect(sets.every(s => s.source === 'imported')).toBe(true);
  expect(await rows('workout_sessions', user.id)).toHaveLength(1);

  // Al volver a abrir la app no se sube otra vez.
  await page.reload();
  await expect(await syncState(page)).toContainText('Sincronizado');
  expect(await rows('set_logs', user.id)).toHaveLength(2);
  expect(await rows('workout_sessions', user.id)).toHaveLength(1);
});

test('cerrar sesión borra del celular los datos de la cuenta y al volver bajan de la nube', async ({ page }) => {
  const user = await createUser('cierre');
  await signIn(page, user.email);
  await page.goto('/#/manual?ex=press-banca');
  await manualSet(page);
  await expect(await syncState(page)).toContainText('Sincronizado');

  await page.getByRole('button', { name: /Cerrar sesión/ }).click();
  await expect(page.getByRole('heading', { name: 'Entra a tu cuenta' })).toBeVisible();
  const left = await page.evaluate(() => ({
    history: JSON.parse(localStorage.getItem('fitnet_history_v1') ?? '[]').length,
    sync: Object.keys(localStorage).filter(k => k.startsWith('movexnet_sync') || k === 'movexnet_data_owner_v1'),
  }));
  expect(left).toEqual({ history: 0, sync: [] });

  await signIn(page, user.email);
  await expect(await syncState(page)).toContainText('Sincronizado');
  const history = await page.evaluate(() => JSON.parse(localStorage.getItem('fitnet_history_v1') ?? '[]').length);
  expect(history).toBe(1);
});

test('sin cuenta, nada sale del dispositivo', async ({ page }) => {
  const calls: string[] = [];
  page.on('request', r => { if (r.url().startsWith(API)) calls.push(r.url()); });
  await page.goto(`${NO_ACCOUNTS_URL}/#/manual?ex=press-banca`);
  await manualSet(page);
  await page.goto(`${NO_ACCOUNTS_URL}/#/perfil`);
  await expect(page.getByText('Sincronización')).toHaveCount(0);
  expect(calls).toEqual([]);
});
