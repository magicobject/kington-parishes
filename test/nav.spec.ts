import { test, expect, type Page } from '@playwright/test';
import { NAV_PAGES, SAFEGUARDING_PAGE } from './support/pages';

async function activeNavLabel(page: Page): Promise<string | null> {
  const active = page.locator('nav.links a[aria-current="page"]');
  const count = await active.count();
  if (count === 0) return null;
  await expect(active).toHaveCount(1);
  return (await active.textContent())?.trim() ?? '';
}

test('landing on the site shows the homepage with Home highlighted in the nav', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/Kington Parishes/);
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('nav.links')).toBeVisible();
  expect(await activeNavLabel(page)).toBe('Home');

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
  for (const sitePage of NAV_PAGES.filter((p) => p.path !== '/index.html')) {
    await page.goto(sitePage.path);
    await page.locator('a.brand').click();
    await expect(page).toHaveURL(/\/index\.html$/);
  }
});

test('the donate button appears on every nav page and points at the Parish Giving Scheme', async ({ page }) => {
  for (const sitePage of NAV_PAGES) {
    await page.goto(sitePage.path);
    await expect(page.locator('a.btn-donate')).toHaveAttribute(
      'href',
      'https://www.parishgiving.org.uk/donate',
    );
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
