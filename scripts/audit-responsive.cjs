/**
 * Auditoría de responsive y áreas seguras (DEC-060). Recorre la app en siete tamaños de
 * celular Android e iOS, con notch y Dynamic Island simulados, y comprueba en cada pantalla:
 * - que nada se salga del ancho (salvo dentro de filas con scroll horizontal);
 * - que cada control se pueda alcanzar con el dedo (sin depender de contenedores con
 *   overflow hidden) y quede fuera de las áreas seguras;
 * - que ningún texto desborde su control y que los objetivos táctiles midan 40 px o más.
 *
 * Uso: `pnpm build && pnpm preview` en otra terminal y luego
 *   node scripts/audit-responsive.cjs            (todos los dispositivos)
 *   ONLY=iPhone-SE SHOTS=1 node scripts/audit-responsive.cjs   (uno, con capturas en ./audit-shots)
 * Requiere Playwright con Chromium (`npx playwright install chromium`); no es dependencia del
 * repo hasta que exista su DEC (propuesta en DEC-060). Sin red a los CDN de MediaPipe, pasa
 * MODEL_PATH con el archivo pose_landmarker_lite.task descargado.
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const WASM = path.join(__dirname, '..', 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const BASE = process.env.BASE ?? 'https://localhost:4173/';
const S = process.env.S ?? path.join(process.cwd(), 'audit-shots');
if (process.env.SHOTS) fs.mkdirSync(S, { recursive: true });
// safe = [top, right, bottom, left] en px, como en el dispositivo real con viewport-fit=cover.
const DEVICES = [
  { name: 'Android-320x568', w: 320, h: 568, safe: [0, 0, 0, 0] },
  { name: 'Galaxy-S9-360x740', w: 360, h: 740, safe: [24, 0, 0, 0] },
  { name: 'iPhone-SE-375x667', w: 375, h: 667, safe: [20, 0, 0, 0] },
  { name: 'iPhone-15-Pro-DI-393x852', w: 393, h: 852, safe: [59, 0, 34, 0] },
  { name: 'Pixel-7-412x915', w: 412, h: 915, safe: [32, 0, 0, 0] },
  { name: 'iPhone-15-ProMax-DI-430x932', w: 430, h: 932, safe: [59, 0, 34, 0] },
  { name: 'iPhone-15-Pro-horizontal-852x393', w: 852, h: 393, safe: [0, 59, 21, 59] },
];
const ONLY = process.env.ONLY;

async function audit(page, dev, label) {
  const [t, r, b, l] = dev.safe;
  const issues = await page.evaluate(({ t, r, b, l }) => {
    const out = [];
    const W = innerWidth, H = innerHeight;
    if (document.documentElement.scrollWidth > W + 1) out.push(`desborde horizontal del documento (${document.documentElement.scrollWidth}px)`);
    const scrollsX = el => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; };
    const clipped = el => { for (let p = el.parentElement; p; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.overflow === 'hidden' || cs.overflowX === 'hidden') { const pr = p.getBoundingClientRect(); if (pr.right <= W + 1 && pr.left >= -1) return true; } } return false; };
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
      const rc = el.getBoundingClientRect();
      if (rc.width === 0 || rc.height === 0) continue;
      if ((rc.right > W + 1 || rc.left < -1) && !scrollsX(el) && !clipped(el) && !['VIDEO', 'CANVAS'].includes(el.tagName)) {
        out.push(`sale del ancho: <${el.tagName.toLowerCase()} class="${el.className?.baseVal ?? el.className}"> ${Math.round(rc.left)}..${Math.round(rc.right)}`);
      }
    }
    // Texto que no cabe en su control (se parte y desborda, o se corta).
    for (const el of document.querySelectorAll('button, a[href], .pill, .chip, .badge-assist, .metric-row__head, .list-row__title, .card-title, .screen-title, .flow__title, .island, .workout__title, .ob-h1, .ob-app-name, .display-number')) {
      const rc = el.getBoundingClientRect();
      if (rc.width === 0 || rc.height === 0 || el.closest('[data-visible="false"]')) continue;
      const cs = getComputedStyle(el);
      if (cs.textOverflow === 'ellipsis') continue;
      if (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2) {
        out.push(`texto desborda: <${el.tagName.toLowerCase()} class="${el.className?.baseVal ?? el.className}"> "${el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40)}" (${el.scrollWidth}x${el.scrollHeight} en ${el.clientWidth}x${el.clientHeight})`);
      }
    }
    // Etiqueta y valor pegados en una misma fila.
    for (const row of document.querySelectorAll('.metric-row__head')) {
      const [a, b] = row.children;
      if (a && b && b.getBoundingClientRect().left - a.getBoundingClientRect().right < 6) out.push(`etiqueta pegada al valor: "${row.textContent.trim()}"`);
    }
    const dialog = document.querySelector('[role=dialog]');
    const root = dialog ?? document;
    const controls = [...root.querySelectorAll('button, a[href], input, [role=radio], [role=tab]')].filter(e => {
      const rc = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      return rc.width > 0 && rc.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.closest('[data-visible="false"]');
    });
    const resetScroll = () => { for (const el of [document.scrollingElement, ...document.querySelectorAll('*')]) { if (el && (el.scrollTop || el.scrollLeft)) { el.scrollTop = 0; el.scrollLeft = 0; } } };
    // Un dedo solo puede desplazar contenedores con overflow auto/scroll; scrollIntoView mueve también los hidden.
    const blockedScroll = () => {
      for (const el of [document.scrollingElement, ...document.querySelectorAll('*')]) {
        if (!el || (!el.scrollTop && !el.scrollLeft)) continue;
        const cs = getComputedStyle(el === document.scrollingElement ? document.body : el);
        const oy = cs.overflowY, ox = cs.overflowX;
        if ((el.scrollTop && !(oy === 'auto' || oy === 'scroll')) || (el.scrollLeft && !(ox === 'auto' || ox === 'scroll'))) return el === document.scrollingElement ? 'documento' : (el.className?.baseVal ?? el.className);
      }
      return null;
    };
    for (const e of controls) {
      resetScroll();
      e.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      const blocked = blockedScroll();
      if (blocked) { out.push(`inalcanzable con el dedo (contenedor sin scroll: ${blocked}): "${(e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)}"`); continue; }
      const rc = e.getBoundingClientRect();
      const name = (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
      const inX = rc.left >= l - 1 && rc.right <= W - r + 1;
      if (rc.top < t - 1 || rc.bottom > H - b + 1 || !inX) {
        out.push(`fuera del área segura o inalcanzable: "${name}" (${Math.round(rc.left)},${Math.round(rc.top)})-(${Math.round(rc.right)},${Math.round(rc.bottom)})`);
        continue;
      }
      const hit = document.elementFromPoint(rc.left + rc.width / 2, rc.top + rc.height / 2);
      if (hit && hit !== e && !e.contains(hit) && !hit.contains(e)) out.push(`tapado: "${name}" por <${hit.tagName.toLowerCase()} class="${hit.className?.baseVal ?? hit.className}">`);
      if (rc.height < 40 && e.tagName !== 'INPUT') out.push(`objetivo táctil bajo (${Math.round(rc.height)}px): "${name}"`);
    }
    // Volver arriba para la captura.
    document.querySelectorAll('*').forEach(el => { if (el.scrollTop) el.scrollTop = 0; });
    return [...new Set(out)];
  }, { t, r, b, l });
  if (process.env.SHOTS) await page.screenshot({ path: `${S}/aud-${dev.name}-${label}.png` });
  return issues.map(i => `[${dev.name}] ${label}: ${i}`);
}

async function withSafe(ctx, dev) {
  const [t, r, b, l] = dev.safe;
  await ctx.addInitScript(({ t, r, b, l }) => {
    const apply = () => { document.documentElement.style.cssText += `;--safe-top:${t}px;--safe-right:${r}px;--safe-bottom:${b}px;--safe-left:${l}px`; };
    if (document.documentElement) apply(); else document.addEventListener('DOMContentLoaded', apply);
  }, { t, r, b, l });
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--enable-unsafe-swiftshader'] });
  const all = [];
  for (const dev of DEVICES.filter(d => !ONLY || d.name.includes(ONLY))) {
    const ctx = await browser.newContext({ viewport: { width: dev.w, height: dev.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ['camera'], ignoreHTTPSErrors: true });
    await ctx.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ path: path.join(WASM, path.basename(new URL(r.request().url()).pathname)) }));
    if (process.env.MODEL_PATH) await ctx.route('https://storage.googleapis.com/**', r => r.fulfill({ path: process.env.MODEL_PATH }));
    await withSafe(ctx, dev);
    const page = await ctx.newPage();
    // El service worker no se registra con el certificado autofirmado del preview: no es un fallo de la app.
    page.on('pageerror', e => { if (!/ServiceWorker/.test(e.message)) all.push(`[${dev.name}] error JS: ${e.message}`); });

    // Bienvenida (sin datos).
    await page.goto(BASE);
    await page.waitForTimeout(3300);
    for (const label of ['bienvenida-como', 'bienvenida-permisos', 'bienvenida-empezar']) {
      await page.waitForTimeout(700);
      all.push(...await audit(page, dev, label));
      const btn = page.locator('.ob-btn').last();
      if (await btn.count()) await btn.click({ timeout: 3000 }).catch(() => {});
    }
    // Datos de ejemplo y pantallas de gestión.
    await page.evaluate(() => {
      localStorage.setItem('ob_complete_v1', '1');
      const now = new Date();
      const d = (off, h) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + off, h).toISOString();
      const r = (id, off, v, g, f) => ({ id, completedAt: d(off, 9), exerciseId: 'sentadilla', validReps: v, rejectedReps: 1, goodReps: g, timed: false, fatigue: f });
      localStorage.setItem('fitnet_history_v1', JSON.stringify([r('a', -2, 10, 9, 'baja'), r('b', -1, 12, 10, 'moderada'), r('c', 0, 10, 9, 'baja')]));
      localStorage.setItem('fitnet_profile_v1', JSON.stringify({ questionnaire: { goal: 'muscle_gain', level: 'intermediate', location: 'home_limited', equipment: ['dumbbell', 'band'], daysPerWeek: 4, sessionMinutes: 60 }, programStartedAt: d(-3, 8), voiceEnabled: true }));
    });
    // Pantallas de cuenta (#60). Con un build con VITE_ENABLE_ACCOUNTS=true la app entera
    // pide cuenta, así que se auditan solo estas: ACCOUNTS=1 node scripts/audit-responsive.cjs
    if (process.env.ACCOUNTS) {
      for (const [label, hash] of [['cuenta-bienvenida', '#/cuenta'], ['cuenta-registro', '#/cuenta/registro'], ['cuenta-entrar', '#/cuenta/entrar'], ['cuenta-recuperar', '#/cuenta/recuperar'], ['privacidad', '#/privacidad']]) {
        await page.goto(BASE + hash); await page.waitForTimeout(700);
        all.push(...await audit(page, dev, label));
      }
      await ctx.close();
      continue;
    }
    for (const [label, hash] of [['hoy', '#/'], ['rutinas', '#/rutinas'], ['ejercicios', '#/ejercicios'], ['perfil', '#/perfil']]) {
      await page.goto(BASE + hash); await page.reload(); await page.waitForTimeout(700);
      if (label === 'ejercicios') await page.locator('.exercise-row').first().click();
      all.push(...await audit(page, dev, label));
    }
    await page.goto(BASE + '#/rutinas'); await page.waitForTimeout(500);
    await page.getByRole('tab', { name: /Semana 2/ }).click(); await page.waitForTimeout(600);
    all.push(...await audit(page, dev, 'premium'));
    // Ficha de técnica con el modelo 3D.
    await page.goto(BASE + '#/ejercicios'); await page.reload(); await page.waitForTimeout(600);
    await page.locator('.exercise-row').first().click();
    await page.getByRole('button', { name: 'Ver técnica en 3D' }).click(); await page.waitForTimeout(1500);
    all.push(...await audit(page, dev, 'tecnica'));

    // Cuestionario completo, con el paso 3 en "casa con equipo".
    await page.goto(BASE + '#/cuestionario'); await page.waitForTimeout(500);
    for (let step = 1; step <= 4; step++) {
      if (step === 3) { await page.getByRole('radio', { name: /Casa con algo de equipo/ }).click(); await page.waitForTimeout(300); }
      all.push(...await audit(page, dev, `cuestionario-${step}`));
      if (step < 4) await page.getByRole('button', { name: 'Continuar' }).click({ timeout: 3000 }).catch(e => all.push(`[${dev.name}] cuestionario-${step}: no se pudo tocar Continuar (${e.message.split('\n')[0]})`));
      await page.waitForTimeout(300);
    }

    // Entrenamiento: preparación, serie y resumen. Con MediaPipe y WebGL por software el hilo
    // principal va cargado y el clic de Playwright no confirma a tiempo: se toca con un clic de DOM.
    const tap = async (name, label) => {
      const b = page.getByRole('button', { name, exact: true });
      if (!(await b.count())) { all.push(`[${dev.name}] ${label}: no aparece el botón ${name}`); return; }
      await b.first().evaluate(el => el.click());
    };
    await page.goto(BASE + '#/entrenar?ex=squat'); await page.waitForTimeout(9000);
    // La primera vez con el ejercicio la ficha de técnica se abre sola (DEC-061).
    all.push(...await audit(page, dev, 'entrenar-ficha-primera-vez'));
    await tap('Entendido, empezar', 'entrenar-ficha-primera-vez');
    await page.waitForTimeout(800);
    all.push(...await audit(page, dev, 'entrenar-preparacion'));
    await tap('Empezar serie', 'entrenar-preparacion');
    await page.waitForTimeout(800);
    all.push(...await audit(page, dev, 'entrenar-serie'));
    await tap('Técnica del ejercicio', 'entrenar-serie');
    // La hoja entra en 380 ms, pero con el hilo cargado tarda más: se espera a que termine.
    await page.waitForTimeout(2500);
    all.push(...await audit(page, dev, 'entrenar-serie-ficha'));
    await tap('Seguir con la serie', 'entrenar-serie-ficha');
    await page.waitForTimeout(800);
    await tap('Mostrar consejos', 'entrenar-serie');
    await page.waitForTimeout(500);
    all.push(...await audit(page, dev, 'entrenar-serie-consejos'));
    await tap('Terminar serie', 'entrenar-serie-consejos');
    await page.waitForTimeout(800);
    all.push(...await audit(page, dev, 'entrenar-resumen'));
    await ctx.close();
  }
  await browser.close();
  console.log(all.length ? all.join('\n') : 'SIN PROBLEMAS');
  console.log(`\nTotal: ${all.length}`);
})();
