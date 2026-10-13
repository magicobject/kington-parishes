import { test, expect, type Page } from '@playwright/test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// GROUND TRUTH for the picture check (modules/advent/build.mjs, drawCost and the caps). The lint estimates how
// costly a picture is to draw; this test measures it in a real browser, with the method that forces the picture to be
// rasterised (drawImage onto a canvas, then reading a pixel: merely decoding an <img> can be lazy and hides slow
// pictures). Each time is the median of three runs.
//   (a) every real picture that exists (public/advent/art/*.svg and the scene*.svg) must render in under 300 ms at
//       400px wide. Real art takes a few milliseconds; a slow CI machine gets generous headroom;
//   (b) the HEAVIEST pictures the check still accepts (test/support/heaviest-*.svg: opacity shapes under a clip path,
//       a 32-shape mask used 20 times, and 49 uses of a 160-arc stroked path) must render in under 1 s at 400px and at
//       800px. Their weights sit at the cap, asserted in test-unit/advent-svg-cost.test.mjs.
// If (b) fails, MAX_DRAW_WEIGHT or the per-reference charges are too generous for real browsers: lower them.
const REAL_LIMIT_MS = 300;
const HEAVIEST_LIMIT_MS = 1000;
const advent = join(__dirname, '..', 'public', 'advent');

const realFiles: { url: string }[] = [
  ...(existsSync(join(advent, 'art')) ? readdirSync(join(advent, 'art')).filter((n) => n.endsWith('.svg')).map((n) => ({ url: `/advent/art/${n}` })) : []),
  ...readdirSync(advent).filter((n) => /^scene.*[.]svg$/.test(n)).map((n) => ({ url: `/advent/${n}` })),
];

/** Median of three render times in milliseconds, at the given width, forcing rasterisation. */
async function renderMedian(page: Page, url: string, width: number): Promise<number> {
  const times: number[] = [];
  for (let run = 0; run < 3; run += 1) {
    times.push(await page.evaluate(async ({ address, pixels }) => {
      const start = performance.now();
      const image = new Image();
      image.width = pixels;
      image.src = address;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = pixels;
      canvas.height = Math.round(pixels * 0.5625);
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      context.getImageData(0, 0, 1, 1);
      return performance.now() - start;
    }, { address: `${url}${url.includes('?') ? '&' : '?'}run=${run}-${Math.random()}`, pixels: width }));
  }
  return times.sort((a, b) => a - b)[1];
}

test('there is at least one real picture to time (the site scene)', () => {
  expect(realFiles.length).toBeGreaterThanOrEqual(1);
});

for (const { url } of realFiles) {
  for (const width of [400, 800]) {
    test(`real picture ${url} renders at ${width}px in under ${REAL_LIMIT_MS} ms`, async ({ page }) => {
      await page.goto('/404.html');
      const elapsed = await renderMedian(page, url, width);
      console.log(`${url} at ${width}px: ${Math.round(elapsed)} ms`);
      expect(elapsed, `${url} took ${Math.round(elapsed)} ms at ${width}px (limit ${REAL_LIMIT_MS} ms). If the machine is just slow, re-run; otherwise this picture is too costly to draw: simplify it.`).toBeLessThan(REAL_LIMIT_MS);
    });
  }
}

for (const name of ['heaviest-accepted.svg', 'heaviest-mask-accepted.svg', 'heaviest-path-accepted.svg']) {
  for (const width of [400, 800, 1200]) {
    test(`${name} (the heaviest the check accepts) renders at ${width}px in under a second`, async ({ page }) => {
      const svg = readFileSync(join(__dirname, 'support', name), 'utf8');
      await page.route('**/advent/art/heaviest-fixture.svg*', (route) => route.fulfill({ contentType: 'image/svg+xml', body: svg }));
      await page.goto('/404.html');
      const elapsed = await renderMedian(page, '/advent/art/heaviest-fixture.svg', width);
      console.log(`${name} at ${width}px: ${Math.round(elapsed)} ms`);
      expect(elapsed, `${name} took ${Math.round(elapsed)} ms at ${width}px (limit ${HEAVIEST_LIMIT_MS} ms): lower MAX_DRAW_WEIGHT or the caps`).toBeLessThan(HEAVIEST_LIMIT_MS);
    });
  }
}
