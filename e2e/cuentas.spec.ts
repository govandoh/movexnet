import { expect, test, type Page } from '@playwright/test';

/**
 * Flujo completo de cuentas contra el stack local (issue #60, DEC-069): puerta 18+ con mes y
 * año, registro, confirmación por correo con token_hash (también desde otro navegador),
 * inicio de sesión, persistencia, recuperación, cierre de sesión y enlaces ya usados.
 * Requiere `pnpm db:start`; los correos se leen de Mailpit.
 */

const MAILPIT = 'http://127.0.0.1:54324/api/v1';
const PASSWORD = 'Sentadilla2026'; // ggignore: contraseña de prueba, no es un secreto
const NEW_PASSWORD = 'PressHombro2026'; // ggignore: contraseña de prueba, no es un secreto

const run = Date.now().toString(36);
const email = (tag: string) => `e2e-${run}-${tag}@test.local`;

interface MailList { messages?: { ID: string; Subject: string }[] }

/** Último enlace del correo con ese asunto que llegó a `to`; espera hasta 15 s. */
async function mailLink(to: string, subject: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const list = (await (await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:${to}`)}`)).json()) as MailList;
    const msg = list.messages?.find(m => m.Subject.includes(subject));
    if (msg) {
      const full = (await (await fetch(`${MAILPIT}/message/${msg.ID}`)).json()) as { HTML: string };
      const href = /href="([^"]+)"/.exec(full.HTML)?.[1];
      if (href) return href.replace(/&amp;/g, '&');
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`no llegó el correo "${subject}" a ${to}`);
}

/** Año y mes de alguien nacido hace `months` meses (1 a 12). */
function bornMonthsAgo(months: number): { year: string; month: string } {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - months);
  return { year: String(d.getFullYear()), month: String(d.getMonth() + 1) };
}

async function skipOnboarding(page: Page) {
  await page.addInitScript(() => localStorage.setItem('ob_complete_v1', '1'));
}

async function fillSignUp(page: Page, to: string, birth: { year: string; month: string }, accept = true) {
  // Pasar por Perfil desmonta el formulario: cada intento empieza vacío.
  await page.goto('/#/perfil');
  await page.goto('/#/cuenta/registro');
  await page.getByLabel('Nombre').fill('Prueba E2E');
  await page.getByLabel('Correo').fill(to);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Mes de nacimiento').selectOption(birth.month);
  await page.getByLabel('Año de nacimiento').fill(birth.year);
  if (accept) await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
}

async function signIn(page: Page, to: string, password: string) {
  await page.goto('/#/cuenta/entrar');
  await page.getByLabel('Correo').fill(to);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test.beforeEach(async ({ page }) => {
  await skipOnboarding(page);
});

test('la puerta 18+ bloquea a quien cumple 18 este mes y exige el aviso', async ({ page }) => {
  await fillSignUp(page, email('menor'), bornMonthsAgo(216));
  await expect(page.getByText('Necesitas tener al menos 18 años')).toBeVisible();

  await fillSignUp(page, email('sinaviso'), bornMonthsAgo(400), false);
  await expect(page.getByText('Debes aceptar el aviso de privacidad.')).toBeVisible();
});

test('registro, confirmación desde otro navegador, sesión persistente y cierre', async ({ page, browser }) => {
  const to = email('registro');
  await fillSignUp(page, to, bornMonthsAgo(217));
  await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible();

  // Sin confirmar no entra.
  await signIn(page, to, PASSWORD);
  await expect(page.getByText('Confirma tu correo antes de iniciar sesión')).toBeVisible();

  // El enlace se abre en otro navegador (como el correo que abre Safari fuera de la PWA).
  const link = await mailLink(to, 'Confirma tu cuenta');
  expect(link).toContain('token_hash=');
  const other = await browser.newContext({ ignoreHTTPSErrors: true });
  const otherPage = await other.newPage();
  await skipOnboarding(otherPage);
  await otherPage.goto(link);
  // La app canjea el enlace y lo borra de la URL; recién entonces se navega.
  await expect(otherPage).not.toHaveURL(/token_hash/);
  await otherPage.getByRole('link', { name: 'Perfil' }).click();
  await expect(otherPage.getByText('Sesión iniciada')).toBeVisible();

  // El mismo enlace no sirve dos veces.
  const third = await browser.newContext({ ignoreHTTPSErrors: true });
  const thirdPage = await third.newPage();
  await skipOnboarding(thirdPage);
  await thirdPage.goto(link);
  await expect(thirdPage.getByText('El enlace venció o ya se usó')).toBeVisible();
  await third.close();
  await other.close();

  // Contraseña incorrecta: mensaje genérico. Correcta: entra y persiste al recargar.
  await signIn(page, to, 'Incorrecta2026');
  await expect(page.getByText('Correo o contraseña incorrectos.')).toBeVisible();
  await signIn(page, to, PASSWORD);
  // Tras iniciar sesión entra a la app (Hoy), no a Perfil.
  await expect(page).toHaveURL(/#\/$/);
  await page.getByRole('link', { name: 'Perfil' }).click();
  await expect(page.getByText('Sesión iniciada')).toBeVisible();
  await page.reload();
  await expect(page.getByText(to)).toBeVisible();

  // Cerrar sesión deja el dispositivo sin datos de la sesión.
  await page.getByRole('button', { name: /Cerrar sesión/ }).click();
  await expect(page.getByRole('heading', { name: 'Entra a tu cuenta' })).toBeVisible();
  const keys = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('movexnet-auth')));
  expect(keys).toEqual([]);
});

test('recuperación de contraseña desde otro navegador', async ({ page, browser }) => {
  const to = email('recupera');
  await fillSignUp(page, to, bornMonthsAgo(300));
  await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible();
  await page.goto(await mailLink(to, 'Confirma tu cuenta'));
  await expect(page).not.toHaveURL(/token_hash/);

  await page.goto('/#/cuenta/recuperar');
  await page.getByLabel('Correo').fill(to);
  await page.getByRole('button', { name: 'Enviar enlace' }).click();
  await expect(page.getByText('Si hay una cuenta con ese correo')).toBeVisible();

  const other = await browser.newContext({ ignoreHTTPSErrors: true });
  const otherPage = await other.newPage();
  await skipOnboarding(otherPage);
  await otherPage.goto(await mailLink(to, 'Recupera tu contraseña'));
  await expect(otherPage.getByRole('heading', { name: 'Contraseña nueva' })).toBeVisible();
  await otherPage.getByLabel('Contraseña nueva').fill(NEW_PASSWORD);
  await otherPage.getByLabel('Repite la contraseña').fill(NEW_PASSWORD);
  await otherPage.getByRole('button', { name: 'Guardar contraseña' }).click();
  await expect(otherPage.getByRole('heading', { name: 'Contraseña cambiada' })).toBeVisible();
  await other.close();

  // La contraseña vieja ya no sirve y la nueva sí.
  await page.goto('/#/perfil');
  await page.getByRole('button', { name: /Cerrar sesión/ }).click();
  await expect(page.getByRole('heading', { name: 'Entra a tu cuenta' })).toBeVisible();
  await signIn(page, to, PASSWORD);
  await expect(page.getByText('Correo o contraseña incorrectos.')).toBeVisible();
  await signIn(page, to, NEW_PASSWORD);
  await expect(page).toHaveURL(/#\/$/);
});

test('la recuperación no revela si el correo tiene cuenta', async ({ page }) => {
  await page.goto('/#/cuenta/recuperar');
  await page.getByLabel('Correo').fill(email('nadie'));
  await page.getByRole('button', { name: 'Enviar enlace' }).click();
  await expect(page.getByText('Si hay una cuenta con ese correo')).toBeVisible();
});

test('sin sesión la app pide cuenta antes de entrenar', async ({ page }) => {
  for (const route of ['/#/', '/#/entrenar', '/#/rutinas', '/#/perfil', '/#/manual']) {
    await page.goto(route);
    await expect(page).toHaveURL(/#\/cuenta$/);
  }
  await expect(page.getByRole('heading', { name: 'Entra a tu cuenta' })).toBeVisible();
  await page.getByRole('link', { name: 'Ya tengo cuenta' }).click();
  await expect(page).toHaveURL(/#\/cuenta\/entrar$/);
  await page.getByRole('button', { name: 'Volver' }).click();
  await expect(page).toHaveURL(/#\/cuenta$/);
});

test('el aviso de privacidad se lee sin sesión y volver lleva a la bienvenida', async ({ page }) => {
  await page.goto('/#/privacidad');
  await expect(page.getByRole('heading', { name: 'Aviso de privacidad' })).toBeVisible();
  await page.getByRole('button', { name: 'Volver' }).click();
  await expect(page).toHaveURL(/#\/cuenta$/);
});
