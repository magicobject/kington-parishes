#!/usr/bin/env node
// One-off (re-run only when public/img/favicon.svg changes) generator for
// the PNG favicon files older/non-SVG-aware clients still need: a plain
// PNG <link rel="icon"> fallback, and an apple-touch-icon for iOS/iPadOS
// "Add to Home Screen", which does not support SVG. Renders the existing
// SVG via a headless Chromium page (Playwright's already a devDependency —
// no new dependency needed just for this) rather than hand-drawing a
// second version of the icon that could drift from the SVG original.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(root, 'public/img/favicon.svg'), 'utf8');

const targets = [
  { file: 'public/img/favicon-32.png', size: 32 },
  { file: 'public/img/apple-touch-icon.png', size: 180 },
];

const browser = await chromium.launch();
try {
  for (const { file, size } of targets) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`);
    await page.locator('svg').evaluate((el, s) => {
      el.setAttribute('width', String(s));
      el.setAttribute('height', String(s));
    }, size);
    const png = await page.locator('svg').screenshot({ omitBackground: false });
    writeFileSync(join(root, file), png);
    console.log(`wrote ${file} (${size}x${size})`);
    await page.close();
  }
} finally {
  await browser.close();
}
