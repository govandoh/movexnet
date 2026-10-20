// Genera los íconos PNG de la PWA a partir de la geometría del logo (DEC-058, DEC-068).
// Uso: node scripts/generate-icons.mjs   (requiere @playwright/test y Chromium:
// `pnpm exec playwright install chromium`). Si cambia el logo, cambiar también
// `public/favicon.svg` y `MovexMark` en src/ui/components/icons.tsx, y subir CACHE en
// public/sw.js para que la PWA instalada tome los íconos nuevos (DEC-025).
import { chromium } from '@playwright/test';
import { join } from 'node:path';

const INK = '#0b0e14';
const VOLT = '#d7ff3a';
const INDIGO = '#7b6cff';
const NODES = [[8, 32], [8, 8], [20, 21], [32, 8], [32, 32]];

/** SVG del logo en un lienzo de `size` px. `glyph` es la fracción del lienzo que ocupa la M. */
function logoSvg(size, { rounded, glyph }) {
  const scale = (size * glyph) / 40;
  const offset = (size - 40 * scale) / 2;
  const radius = rounded ? size * 0.22 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${INK}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <path d="M8 32L8 8L20 21L32 8L32 32" fill="none" stroke="${INDIGO}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${NODES.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="${VOLT}"/>`).join('')}
  </g>
</svg>`;
}

// any: esquinas redondeadas (Android las muestra tal cual). maskable: a sangre y con la M
// dentro de la zona segura del 80 % central. apple-touch: a sangre, iOS redondea solo.
const ICONS = [
  { file: 'icon-192.png', size: 192, rounded: true, glyph: 0.625 },
  { file: 'icon-512.png', size: 512, rounded: true, glyph: 0.625 },
  { file: 'icon-maskable-512.png', size: 512, rounded: false, glyph: 0.5 },
  { file: 'apple-touch-icon.png', size: 180, rounded: false, glyph: 0.6 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const icon of ICONS) {
  await page.setViewportSize({ width: icon.size, height: icon.size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${logoSvg(icon.size, icon)}</body></html>`);
  await page.locator('svg').screenshot({ path: join('public', 'icons', icon.file), omitBackground: true });
  console.log(`public/icons/${icon.file}`);
}
await browser.close();
