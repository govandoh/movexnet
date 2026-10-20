/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test';

/**
 * Calendario del programa y recordatorios (#35), con las cuentas apagadas (proyecto `app`
 * de playwright.config.ts) y el reloj del navegador fijo: miércoles 21 de octubre de 2026.
 *
 * Programa de 3 días (lunes, miércoles y viernes) empezado el lunes 12, Premium simulado.
 * Historial: series el lunes 12 y el viernes 16. Así el calendario tiene de todo: hechas
 * (12 y 16), perdidas (14 y 19), hoy (21) y próximas (23 en adelante).
 */

const NOW = new Date(2026, 9, 21, 17, 58);

function at(day: number, hour: number): string {
  return new Date(2026, 9, day, hour).toISOString();
}

function set(id: string, day: number) {
  return { id, completedAt: at(day, 10), exerciseId: 'sentadilla', validReps: 10, rejectedReps: 0, goodReps: 9, timed: false, fatigue: 'baja' };
}

async function seed(page: Page, reminders?: { enabled: boolean; hour: number; minute: number }) {
  await page.clock.install({ time: NOW });
  await page.addInitScript(({ history, startedAt, since, reminders }) => {
    localStorage.setItem('ob_complete_v1', '1');
    localStorage.setItem('fitnet_profile_v1', JSON.stringify({
      questionnaire: { goal: 'muscle_gain', level: 'beginner', location: 'home_none', daysPerWeek: 3, sessionMinutes: 45 },
      programStartedAt: startedAt,
      voiceEnabled: true,
    }));
    localStorage.setItem('fitnet_entitlement_v1', JSON.stringify({ premium: true, since, simulated: true }));
    localStorage.setItem('fitnet_history_v1', JSON.stringify(history));
    if (reminders) localStorage.setItem('fitnet_reminders_v1', JSON.stringify(reminders));
  }, { history: [set('a', 12), set('b', 16)], startedAt: at(12, 9), since: at(12, 9), reminders });
}

test('el calendario muestra cada sesión con su estado y lleva a su semana', async ({ page }) => {
  await seed(page);
  await page.goto('/#/rutinas');
  const cal = page.getByRole('region', { name: 'Calendario del programa' });
  await expect(cal.getByRole('heading', { name: 'Octubre 2026' })).toBeVisible();
  await expect(cal.getByText('2 de 4 sesiones hechas hasta hoy')).toBeVisible();

  await expect(cal.getByRole('gridcell', { name: 'lunes 12 de octubre, sesión hecha' })).toBeVisible();
  await expect(cal.getByRole('gridcell', { name: 'miércoles 14 de octubre, sesión perdida' })).toBeVisible();
  await expect(cal.getByRole('gridcell', { name: 'viernes 16 de octubre, sesión hecha' })).toBeVisible();
  await expect(cal.getByRole('gridcell', { name: 'lunes 19 de octubre, sesión perdida' })).toBeVisible();
  await expect(cal.getByRole('gridcell', { name: 'miércoles 21 de octubre, sesión hoy' })).toBeVisible();
  await expect(cal.getByRole('gridcell', { name: 'viernes 23 de octubre, sesión próxima' })).toBeVisible();
  await expect(cal.getByRole('gridcell', { name: 'martes 20 de octubre' })).toBeVisible();

  // Un día de descanso lo dice; un día con sesión lleva a su semana del programa.
  await cal.getByRole('gridcell', { name: /martes 20 de octubre/ }).click();
  await expect(cal.getByText('Día de descanso.')).toBeVisible();
  await cal.getByRole('gridcell', { name: /viernes 23 de octubre/ }).click();
  await expect(cal.getByText('Semana 2 · Próxima')).toBeVisible();
  await cal.getByRole('button', { name: 'Ver semana' }).click();
  await expect(page.getByRole('tab', { name: 'Semana 2' })).toHaveAttribute('aria-selected', 'true');

  // El programa dura 8 semanas: se puede ir hasta diciembre y no antes de octubre.
  await expect(cal.getByRole('button', { name: 'Mes anterior' })).toBeDisabled();
  await cal.getByRole('button', { name: 'Mes siguiente' }).click();
  await expect(cal.getByRole('heading', { name: 'Noviembre 2026' })).toBeVisible();
});

test('Hoy muestra las próximas sesiones', async ({ page }) => {
  await seed(page);
  await page.goto('/#/');
  const next = page.getByRole('region', { name: 'Próximas sesiones' });
  await expect(next.getByText('Viernes 23 de octubre · Semana 2')).toBeVisible();
  await expect(next.getByText('Lunes 26 de octubre · Semana 3')).toBeVisible();
});

test('el recordatorio avisa a la hora elegida el día de la sesión, una sola vez', async ({ page, context }) => {
  await context.grantPermissions(['notifications']);
  // Notificaciones falsas: se registran en lugar de mostrarse.
  await page.addInitScript(() => {
    const sent: { title: string; body?: string }[] = [];
    (window as unknown as { __sent: typeof sent }).__sent = sent;
    class FakeNotification {
      static permission = 'granted';
      static requestPermission = async () => 'granted';
      constructor(title: string, options?: { body?: string }) { sent.push({ title, body: options?.body }); }
    }
    Object.defineProperty(window, 'Notification', { value: FakeNotification, configurable: true });
  });
  await seed(page);
  await page.goto('/#/perfil');

  await page.getByRole('button', { name: /Recordatorios/ }).click();
  await expect(page.getByText('El día que toca entrenar, a las 18:00')).toBeVisible();

  const sent = () => page.evaluate(() => (window as unknown as { __sent: unknown[] }).__sent.length);
  expect(await sent()).toBe(0);
  await page.clock.fastForward('03:00'); // 17:58 → 18:01
  await expect.poll(sent).toBe(1);
  const first = await page.evaluate(() => (window as unknown as { __sent: { title: string }[] }).__sent[0].title);
  expect(first).toBe('Hoy toca entrenar');

  // Al recargar el mismo día no se repite.
  await page.reload();
  await page.clock.fastForward('05:00');
  expect(await sent()).toBe(0);
});
