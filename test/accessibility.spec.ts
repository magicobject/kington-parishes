import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { ALL_PAGES } from './support/pages';

const ALL_PATHS = [...ALL_PAGES.map((p) => p.path), '/404.html'];

function formatViolations(violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']): string {
  return violations
    .map((v) => {
      const nodes = v.nodes.map((n) => `    - ${n.target.join(' ')}\n      ${n.failureSummary?.replace(/\n/g, ' ')}`).join('\n');
      return `[${v.impact}] ${v.id}: ${v.description}\n${nodes}`;
    })
    .join('\n\n');
}

for (const path of ALL_PATHS) {
  test(`axe: ${path} has no accessibility violations`, async ({ page }) => {
    await page.goto(path);
    // Force-settle the reveal-on-scroll animation so this tests the real
    // final state, not a mid-transition frame — an element still fading in
    // from opacity:0 reads as low-contrast to axe, which isn't a real bug.
    // Adding the .in class alone isn't enough (it starts a fresh 0.6s
    // transition rather than jumping to the end state), so the transition
    // itself is killed too.
    await page.evaluate(() => {
      document.querySelectorAll('.reveal').forEach((el) => {
        el.classList.add('in');
        (el as HTMLElement).style.transition = 'none';
        (el as HTMLElement).style.opacity = '1';
        (el as HTMLElement).style.transform = 'none';
      });
    });

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });
}

// The primary nav collapses behind an ellipsis "Menu" toggle below 860px —
// scan both its closed and open states, since axe only sees what's actually
// in the accessibility tree at scan time.
test.describe('mobile nav toggle', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('axe: homepage, mobile nav closed', async ({ page }) => {
    await page.goto('/index.html');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });

  test('axe: homepage, mobile nav open', async ({ page }) => {
    await page.goto('/index.html');
    await page.getByRole('button', { name: 'Menu' }).click();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });
});
