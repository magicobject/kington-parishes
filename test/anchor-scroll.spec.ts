import { test, expect } from './support/fixtures';
import type { Page } from '@playwright/test';

// Regression guard: header.site is position: sticky; top: 0 and overlays
// whatever's scrolled underneath it. Jumping to any #anchor — a search
// result, a church section, a person's card — used to land the target flush
// at the very top of the scrollport, hidden behind the header (the header
// has no fixed height either: the primary nav's 13 links wrap individually
// as the viewport narrows, so it's anywhere from ~97px to ~180px tall). Now
// every :target gets scroll-margin-top: var(--header-offset), set to the
// header's real measured height by the inline script right after {{HEADER}}
// in templates/page.html. These specs check the actual rendered position,
// not just that the CSS variable exists.
//
// Reduced motion is emulated throughout: the site's own
// @media (prefers-reduced-motion: reduce) rule switches scroll-behavior from
// smooth to auto, so the fragment-scroll lands instantly instead of over a
// CSS transition — without that, a boundingBox() read right after
// navigation can catch mid-animation and pass either way, fix or no fix.

async function expectClearOfHeader(page: Page, targetSelector: string) {
  const headerBottom = await page.evaluate(
    () => document.querySelector('header.site')!.getBoundingClientRect().bottom,
  );
  // 1px tolerance: the browser scroll-snaps to a device pixel while
  // --header-offset is a fractional CSS value, so a sub-pixel gap (well
  // under what's visible) is expected here, not a bug to chase.
  await expect
    .poll(async () => (await page.locator(targetSelector).boundingBox())?.y, {
      message: `${targetSelector} should have scrolled clear of the ${headerBottom}px-tall sticky header`,
    })
    .toBeGreaterThanOrEqual(headerBottom - 1);
}

test('following a search result to a person card scrolls it fully clear of the sticky header (the Ruth Jones case)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/index.html');
  await page.getByRole('combobox', { name: 'Search the site' }).fill('Ruth Jones');
  const result = page.locator('#site-search-results a[href^="our-people.html#"]').first();
  await expect(result).toBeVisible();
  await result.click();
  await expect(page).toHaveURL(/our-people\.html#ruth-jones/);

  await expectClearOfHeader(page, ':target');
  await expect(page.locator(':target')).toBeInViewport();
});

test('a direct link to a person card anchor is not hidden behind the header, at desktop width', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/our-people.html#ruth-jones-2');
  await expectClearOfHeader(page, '#ruth-jones-2');
});

test.describe('narrow viewport (taller, wrapped header)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('a direct link to a person card anchor is not hidden behind the header, at mobile width', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/our-people.html#ruth-jones-2');
    await expectClearOfHeader(page, '#ruth-jones-2');
  });
});

test('a direct link to a church section (Our Churches) is not hidden behind the header', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/our-churches.html#titley');
  await expectClearOfHeader(page, '#titley');
});
