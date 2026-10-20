import { test, expect } from './support/fixtures';

// The inline script in templates/page.html reads location.hash on every page.
// A malformed percent escape in the fragment must not raise an error.
// (The fixtures block outside requests, whose aborted loads log 'Failed to load resource'; those are not ours.)
const PAGES = ['/', '/church-kington.html', '/calendar.html'];
const BAD_FRAGMENTS = ['#%', '#%E0%A4%A', '#day-%'];

for (const path of PAGES) {
  for (const hash of BAD_FRAGMENTS) {
    test(`${path}${hash} (malformed fragment) raises no page or console error`, async ({ page }) => {
      const problems: string[] = [];
      page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
      page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) problems.push(`console: ${m.text()}`); });
      await page.goto(`${path}${hash}`);
      await page.waitForLoadState('load');
      expect(problems).toEqual([]);
    });
  }
}

test('a normal fragment still scrolls to its target', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(e.message));
  await page.goto('/#noticeboard');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  expect(problems).toEqual([]);
});

test('a percent-encoded fragment is still decoded, and its .reveal target is settled', async ({ page }) => {
  // Serve the home page with a space/non-ASCII id on its last .reveal card, and switch off
  // IntersectionObserver so main.js cannot add .in: only the inline script can.
  await page.addInitScript(() => { (window as any).IntersectionObserver = undefined; });
  await page.route('**/', async (route) => {
    const response = await route.fetch();
    const html = (await response.text()).replace(/(.*)class="pilgrim-card reveal"/s, '$1id="café x" class="pilgrim-card reveal"');
    await route.fulfill({ response, body: html });
  });
  await page.goto('/#caf%C3%A9%20x');
  await expect.poll(() => page.evaluate(() => document.getElementById('café x')?.classList.contains('in'))).toBe(true);
});
