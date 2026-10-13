import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The picture check bounds draw cost (modules/advent/build.mjs, drawCost). This is the real-browser guard: the
// HEAVIEST pictures the check still accepts must load, decode and paint as an <img> in well under a second, at the
// size they are shown (400px) and at twice that (800px, a wide screen):
//   - heaviest-accepted.svg: many opacity shapes, one clipPath and masks (weight just under the cap);
//   - heaviest-mask-accepted.svg: a 50-shape mask referenced 20 times (the most mask work the check allows; a
//     browser redraws the whole mask for every reference). Weights are asserted in test-unit/advent-svg-cost.test.mjs.
// The limit is deliberately generous (typical times are tens of milliseconds) so a slow CI machine does not make it
// flaky; if it fails, the cap or the per-reference charge in drawCost is too generous for real browsers.
const LIMIT_MS = 1000;
const fixtures = ['heaviest-accepted.svg', 'heaviest-mask-accepted.svg'];

for (const name of fixtures) {
  for (const width of [400, 800]) {
    test(`${name} renders as an image ${width}px wide in under a second`, async ({ page }) => {
      const svg = readFileSync(join(__dirname, 'support', name), 'utf8');
      await page.route('**/advent/art/heaviest-fixture.svg', (route) => route.fulfill({ contentType: 'image/svg+xml', body: svg }));
      await page.goto('/404.html');
      const elapsed = await page.evaluate(async (pixels) => {
        const start = performance.now();
        const image = new Image();
        image.width = pixels;
        image.src = '/advent/art/heaviest-fixture.svg';
        document.body.append(image);
        await image.decode();
        // Decoding alone can be lazy: drawing the picture onto a canvas and reading a pixel forces it to be rasterised.
        const canvas = document.createElement('canvas');
        canvas.width = pixels;
        canvas.height = Math.round(pixels * 0.5625);
        const context = canvas.getContext('2d')!;
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        context.getImageData(0, 0, 1, 1);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return performance.now() - start;
      }, width);
      console.log(`${name} at ${width}px rendered in ${Math.round(elapsed)} ms`);
      expect(elapsed, `rendering took ${Math.round(elapsed)} ms (limit ${LIMIT_MS} ms): lower MAX_DRAW_WEIGHT or the mask caps`).toBeLessThan(LIMIT_MS);
    });
  }
}
