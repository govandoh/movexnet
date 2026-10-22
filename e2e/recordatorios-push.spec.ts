/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';

/**
 * Recordatorios con la app cerrada por Web Push (issue #88, DEC-080), contra el stack local.
 * El servicio de push del navegador no existe en Playwright: se simula `PushManager` en la
 * página y se comprueba lo que llega a la base (suscripción y avisos) y la baja al apagar los
 * recordatorios o cerrar sesión. El envío real se prueba aparte (descripción del PR) y en
 * celular.
 */

const API = 'http://127.0.0.1:54321';
const PASSWORD = 'Sentadilla2026'; // ggignore: contraseña de prueba, no es un secreto
const run = Date.now().toString(36);

function serviceKey(): string {
  const out = execSync('pnpm exec supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  return JSON.parse(out.slice(out.indexOf('{'))).SERVICE_ROLE_KEY as string;
}
const KEY = serviceKey();
const admin = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function createUser(tag: string): Promise<{ id: string; email: string }> {
  const email = `e2e-${run}-push-${tag}@test.local`;
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

interface SubscriptionRow {
  id: string;
  endpoint: string;
  push_reminders: { send_at: string; title: string; body: string; url: string }[];
}

async function subscriptions(userId: string): Promise<SubscriptionRow[]> {
  const res = await fetch(
    `${API}/rest/v1/push_subscriptions?user_id=eq.${userId}&select=id,endpoint,push_reminders(send_at,title,body,url)`,
    { headers: admin },
  );
  return (await res.json()) as SubscriptionRow[];
}

/** Programa de 3 días empezado hoy, permiso concedido y un `PushManager` simulado con un endpoint de FCM. */
async function seed(page: Page, endpoint: string) {
  await page.addInitScript(({ endpoint, startedAt }) => {
    localStorage.setItem('ob_complete_v1', '1');
    localStorage.setItem('fitnet_profile_v1', JSON.stringify({
      questionnaire: { goal: 'muscle_gain', level: 'beginner', location: 'home_none', daysPerWeek: 3, sessionMinutes: 45 },
      programStartedAt: startedAt,
      voiceEnabled: true,
    }));
    // Chromium sin interfaz niega las notificaciones aunque se concedan: se simula el permiso.
    class FakeNotification {
      static permission = 'granted';
      static requestPermission = async () => 'granted';
    }
    Object.defineProperty(window, 'Notification', { value: FakeNotification, configurable: true });
    let current: object | null = null;
    const subscription = {
      endpoint,
      options: { applicationServerKey: null },
      toJSON: () => ({ endpoint, keys: { p256dh: `B${'A'.repeat(86)}`, auth: 'A'.repeat(22) } }),
      unsubscribe: async () => { current = null; return true; },
    };
    const registration = {
      pushManager: {
        getSubscription: async () => current,
        subscribe: async () => (current = subscription),
      },
      showNotification: async () => {},
    };
    Object.defineProperty(ServiceWorkerContainer.prototype, 'ready', { get: () => Promise.resolve(registration) });
    ServiceWorkerContainer.prototype.getRegistration = async () => registration as unknown as ServiceWorkerRegistration;
    ServiceWorkerContainer.prototype.register = async () => registration as unknown as ServiceWorkerRegistration;
  }, { endpoint, startedAt: new Date().toISOString() });
}

async function signIn(page: Page, email: string) {
  await page.goto('/#/cuenta/entrar');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/#\/$/);
}

async function openProfile(page: Page) {
  // Cambio de ruta sin recargar; se reintenta por si la app termina otra navegación a Hoy.
  await expect(async () => {
    await page.evaluate(() => { window.location.hash = '#/perfil'; });
    await expect(page.getByRole('heading', { name: 'Perfil' })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

const remindersButton = (page: Page) => page.getByRole('button', { name: /Recordatorios/ });

test('activar los recordatorios suscribe el navegador y sube los avisos de 14 días', async ({ page }) => {
  const user = await createUser('activar');
  const endpoint = `https://fcm.googleapis.com/fcm/send/e2e-${run}-activar`;
  await seed(page, endpoint);
  await signIn(page, user.email);
  await openProfile(page);

  await remindersButton(page).click();
  await expect(remindersButton(page)).toContainText('aunque la app esté cerrada', { timeout: 15_000 });

  await expect.poll(async () => (await subscriptions(user.id))[0]?.push_reminders.length ?? 0, { timeout: 15_000 })
    .toBeGreaterThan(0);
  const [sub] = await subscriptions(user.id);
  expect(sub.endpoint).toBe(endpoint);
  const limit = Date.now() + 14 * 86_400_000;
  for (const r of sub.push_reminders) {
    expect(r.title).toBe('Hoy toca entrenar');
    expect(r.body).toMatch(/^Semana \d+ (·|de tu programa)/);
    expect(r.url).toMatch(/^\/#\/rutinas\?semana=\d+$/);
    expect(Date.parse(r.send_at)).toBeGreaterThan(Date.now());
    expect(Date.parse(r.send_at)).toBeLessThanOrEqual(limit);
    expect(new Date(r.send_at).getHours()).toBe(18);
  }

  // Cambiar la hora reemplaza los avisos.
  await page.getByRole('combobox', { name: 'Hora', exact: true }).selectOption('7');
  await page.getByRole('combobox', { name: 'Minutos' }).selectOption('30');
  await expect.poll(
    async () => (await subscriptions(user.id))[0]?.push_reminders.every(r => new Date(r.send_at).getMinutes() === 30),
    { timeout: 15_000 },
  ).toBe(true);

  // Apagar borra la suscripción y sus avisos.
  await remindersButton(page).click();
  await expect.poll(async () => (await subscriptions(user.id)).length, { timeout: 15_000 }).toBe(0);
});

test('cerrar sesión borra la suscripción de push', async ({ page }) => {
  const user = await createUser('salir');
  await seed(page, `https://fcm.googleapis.com/fcm/send/e2e-${run}-salir`);
  await signIn(page, user.email);
  await openProfile(page);
  await remindersButton(page).click();
  await expect.poll(async () => (await subscriptions(user.id)).length, { timeout: 15_000 }).toBe(1);

  await page.getByRole('button', { name: /Cerrar sesión/ }).click();
  await expect.poll(async () => (await subscriptions(user.id)).length, { timeout: 15_000 }).toBe(0);
});
