import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The picture check bounds draw cost (modules/advent/build.mjs, drawCost). This is the real-browser guard: the
// HEAVIEST picture the check still accepts (test/support/heaviest-accepted.svg, weight just under the cap,
// asserted in test-unit/advent-svg-cost.test.mjs) must load, decode and paint as an <img> in well under a second.
// The limit is deliberately generous (typical time is a few tens of milliseconds) so a slow CI machine does not
// make it flaky; if it fails, the cap in drawCost is too high for real browsers and must be lowered.
const LIMIT_MS = 1000;
const heaviest = readFileSync(join(__dirname, 'support', 'heaviest-accepted.svg'), 'utf8');

test('the heaviest accepted picture renders as an image in under a second', async ({ page }) => {
  await page.route('**/advent/art/heaviest-fixture.svg', (route) => route.fulfill({ contentType: 'image/svg+xml', body: heaviest }));
  await page.goto('/404.html');
  const elapsed = await page.evaluate(async () => {
    const start = performance.now();
    const image = new Image();
    image.src = '/advent/art/heaviest-fixture.svg';
    document.body.append(image);
    await image.decode();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return performance.now() - start;
  });
  console.log(`heaviest accepted picture rendered in ${Math.round(elapsed)} ms`);
  expect(elapsed, `rendering took ${Math.round(elapsed)} ms (limit ${LIMIT_MS} ms): lower MAX_DRAW_WEIGHT`).toBeLessThan(LIMIT_MS);
});
