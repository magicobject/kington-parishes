import { test, expect } from './support/fixtures';
import type { Page } from '@playwright/test';
import { HOME_PAGE, NAV_PAGES, SAFEGUARDING_PAGE } from './support/pages';

async function activeNavLabel(page: Page): Promise<string | null> {
  const active = page.locator('nav.links a[aria-current="page"]');
  const count = await active.count();
  if (count === 0) return null;
  await expect(active).toHaveCount(1);
  return (await active.textContent())?.trim() ?? '';
}

test('landing on the site shows the homepage with no primary nav item highlighted', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/Kington Parishes/);
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('nav.links')).toBeVisible();
  // Home has no link of its own in the primary nav — the brand link already
  // goes here — so nothing should be marked aria-current on the homepage.
  expect(await activeNavLabel(page)).toBeNull();

  const links = page.locator('nav.links a');
  await expect(links).toHaveText(NAV_PAGES.map((p) => p.navLabel));
});

for (const target of NAV_PAGES) {
  test(`clicking "${target.navLabel}" in the nav opens ${target.path} and highlights only that item`, async ({
    page,
  }) => {
    await page.goto('/');

    await page.locator('nav.links').getByRole('link', { name: target.navLabel, exact: true }).click();

    await expect(page).toHaveURL(new RegExp(`${target.path}$`));
    await expect(page).toHaveTitle(new RegExp(target.titleContains));
    await expect(page.locator('h1')).toHaveText(target.heading);
    expect(await activeNavLabel(page)).toBe(target.navLabel);
  });
}

test('the brand logo links back to the homepage from every page in the nav', async ({ page }) => {
  for (const sitePage of NAV_PAGES) {
    await page.goto(sitePage.path);
    await page.locator('a.brand').click();
    await expect(page).toHaveURL(/\/index\.html$/);
  }
});

test('the donate button appears on the homepage and every nav page, and points at the church-picker page', async ({ page }) => {
  for (const sitePage of [HOME_PAGE, ...NAV_PAGES]) {
    await page.goto(sitePage.path);
    await expect(page.locator('a.btn-donate')).toHaveAttribute('href', 'donate.html');
  }
});

test('the Live Stream button appears on the homepage and every nav page, and opens the YouTube streams tab in a new tab', async ({
  page,
}) => {
  for (const sitePage of [HOME_PAGE, ...NAV_PAGES]) {
    await page.goto(sitePage.path);
    const liveStream = page.locator('a.btn-livestream');
    await expect(liveStream).toHaveAttribute('href', 'https://www.youtube.com/@KingtonStMaryLive/streams');
    await expect(liveStream).toHaveAttribute('target', '_blank');
    await expect(liveStream).toHaveAttribute('rel', 'noopener');
  }
});

test('safeguarding is reachable from the footer\'s Explore list, but not highlighted in the primary nav', async ({
  page,
}) => {
  await page.goto('/index.html');
  await page.locator('footer.site').getByRole('link', { name: SAFEGUARDING_PAGE.navLabel }).click();

  await expect(page).toHaveURL(new RegExp(`${SAFEGUARDING_PAGE.path}$`));
  await expect(page).toHaveTitle(new RegExp(SAFEGUARDING_PAGE.titleContains));
  expect(await activeNavLabel(page)).toBeNull();
});

// Below 860px the primary nav collapses behind an ellipsis "Menu" toggle
// (see the matching @media block in style.css) rather than wrapping across
// three cramped lines.
test.describe('mobile nav toggle (narrow viewport)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('the nav is collapsed behind the toggle by default, and the toggle opens it', async ({ page }) => {
    await page.goto('/index.html');

    const toggle = page.getByRole('button', { name: 'Menu' });
    const nav = page.locator('nav.links');

    await expect(toggle).toBeVisible();
    await expect(nav).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.click();
    await expect(nav).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(nav.getByRole('link', { name: 'Our Churches', exact: true })).toBeVisible();
  });

  test('clicking a link in the open menu navigates there', async ({ page }) => {
    await page.goto('/index.html');
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.locator('nav.links').getByRole('link', { name: 'Contact', exact: true }).click();
    await expect(page).toHaveURL(/\/contact\.html$/);
  });

  test('Escape closes the menu and returns focus to the toggle', async ({ page }) => {
    await page.goto('/index.html');
    const toggle = page.getByRole('button', { name: 'Menu' });
    const nav = page.locator('nav.links');

    await toggle.click();
    await expect(nav).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(nav).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
  });

  test('clicking outside the open menu closes it', async ({ page }) => {
    await page.goto('/index.html');
    const toggle = page.getByRole('button', { name: 'Menu' });
    const nav = page.locator('nav.links');

    await toggle.click();
    await expect(nav).toBeVisible();

    await page.locator('main#main').click({ position: { x: 10, y: 10 } });
    await expect(nav).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});

test('at desktop width the nav toggle is hidden and the full nav is always visible', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.getByRole('button', { name: 'Menu' })).toBeHidden();
  await expect(page.locator('nav.links')).toBeVisible();
});
