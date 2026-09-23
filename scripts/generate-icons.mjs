// Génère les icônes PNG de la PWA à partir de public/logo.svg.
// Utilise Playwright (Chromium) : `npx playwright` ou une installation globale.
// Usage : node scripts/generate-icons.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import path from 'node:path';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  const globalRoot = execSync('npm root -g').toString().trim();
  playwright = require(path.join(globalRoot, 'playwright'));
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const logo = await readFile(path.join(root, 'public/logo.svg'), 'utf8');
const inner = logo.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

/** Icône maskable : fond plein bord à bord, contenu réduit dans la zone de sécurité. */
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#111827"/>
  <g transform="translate(256 256) scale(0.74) translate(-256 -256)">${inner}</g>
</svg>`;

const targets = [
  { file: 'icon-192.png', size: 192, svg: logo, transparent: true },
  { file: 'icon-512.png', size: 512, svg: logo, transparent: true },
  { file: 'maskable-icon-512.png', size: 512, svg: maskable, transparent: false },
  { file: 'apple-touch-icon.png', size: 180, svg: maskable, transparent: false },
  { file: 'favicon-32.png', size: 32, svg: logo, transparent: true },
];

const browser = await playwright.chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  const html = `<html><body style="margin:0;background:transparent">
    <div style="width:${t.size}px;height:${t.size}px">${t.svg.replace('<svg ', `<svg width="${t.size}" height="${t.size}" `)}</div>
  </body></html>`;
  await page.setContent(html);
  const buf = await page.screenshot({ omitBackground: t.transparent, clip: { x: 0, y: 0, width: t.size, height: t.size } });
  await writeFile(path.join(root, 'public', t.file), buf);
  console.log('✓', t.file);
}
await browser.close();
