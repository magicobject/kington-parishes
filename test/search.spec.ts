import { test, expect } from './support/fixtures';
import { AxeBuilder } from '@axe-core/playwright';

// The header search box: fetches /search-index.json (regenerated on every
// build — see scripts/build-search-index.mjs and its own unit tests) and
// filters it live as you type. These specs cover the actual UI behaviour;
// the indexing/matching logic itself is covered by test-unit/.

test('typing a query shows the matching section, ranked first', async ({ page }) => {
  await page.goto('/index.html');
  await page.getByRole('combobox', { name: 'Search the site' }).fill('Titley');
  const results = page.locator('#site-search-results');
  await expect(results).toBeVisible();
  // "Titley" genuinely appears in two sections (the church itself, and its
  // Parish Giving Scheme entry on the Donate page) — both are legitimate
  // results, but the church's own section should rank first.
  await expect(results.getByRole('option').first()).toHaveAttribute('href', 'our-churches.html#titley');
});

test('selecting a result navigates to the right page and the right element is present', async ({ page }) => {
  await page.goto('/index.html');
  await page.getByRole('combobox', { name: 'Search the site' }).fill('Titley');
  const topResult = page.locator('#site-search-results a[href="our-churches.html#titley"]');
  await expect(topResult).toBeVisible();
  await topResult.click();
  await expect(page).toHaveURL(/our-churches\.html#titley$/);
  await expect(page.locator('#titley')).toBeVisible();
  await expect(page.locator('#titley').getByRole('heading', { name: 'Titley' })).toBeVisible();
});

test('pressing Enter goes straight to the top result', async ({ page }) => {
  await page.goto('/index.html');
  const input = page.getByRole('combobox', { name: 'Search the site' });
  await input.fill('Kington');
  await expect(page.locator('#site-search-results')).toBeVisible();
  await input.press('Enter');
  await expect(page).toHaveURL(/our-churches\.html#kington$/);
});

test('a query matching nothing shows a "no results" message, not an empty or stale dropdown', async ({ page }) => {
  await page.goto('/index.html');
  await page.getByRole('combobox', { name: 'Search the site' }).fill('xyzzyfrobnicate');
  const results = page.locator('#site-search-results');
  await expect(results).toBeVisible();
  await expect(results).toContainText('No results');
  await expect(results.getByRole('option')).toHaveCount(0);
});

test('clearing the query closes the dropdown', async ({ page }) => {
  await page.goto('/index.html');
  const input = page.getByRole('combobox', { name: 'Search the site' });
  await input.fill('Kington');
  await expect(page.locator('#site-search-results')).toBeVisible();
  await input.fill('');
  await expect(page.locator('#site-search-results')).toBeHidden();
});

test('the internal changelog is never indexed', async ({ page }) => {
  // "recurrence" appears in the /updates.html changelog and nowhere else
  // in the site's real content — if search ever turns it up, that means
  // isSearchablePage's updates.html exclusion has broken.
  await page.goto('/index.html');
  await page.getByRole('combobox', { name: 'Search the site' }).fill('recurrence');
  const results = page.locator('#site-search-results');
  await expect(results).toBeVisible();
  await expect(results).toContainText('No results');
});

test.describe('keyboard interaction', () => {
  test('ArrowDown moves focus from the input into the first result', async ({ page }) => {
    await page.goto('/index.html');
    const input = page.getByRole('combobox', { name: 'Search the site' });
    await input.fill('Kington');
    await expect(page.locator('#site-search-results')).toBeVisible();
    await input.press('ArrowDown');
    await expect(page.getByRole('option').first()).toBeFocused();
  });

  test('ArrowDown/ArrowUp move between results, and ArrowUp off the top returns to the input', async ({ page }) => {
    await page.goto('/index.html');
    const input = page.getByRole('combobox', { name: 'Search the site' });
    await input.fill('a'); // broad enough to match several sections
    const options = page.getByRole('option');
    await expect(options.first()).toBeVisible();
    await input.press('ArrowDown');
    await expect(options.first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(options.nth(1)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(options.first()).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(input).toBeFocused();
  });

  test('Escape closes the dropdown from the input', async ({ page }) => {
    await page.goto('/index.html');
    const input = page.getByRole('combobox', { name: 'Search the site' });
    await input.fill('Kington');
    await expect(page.locator('#site-search-results')).toBeVisible();
    await input.press('Escape');
    await expect(page.locator('#site-search-results')).toBeHidden();
  });

  test('Escape from within the results closes the dropdown and returns focus to the input', async ({ page }) => {
    await page.goto('/index.html');
    const input = page.getByRole('combobox', { name: 'Search the site' });
    await input.fill('Kington');
    await expect(page.locator('#site-search-results')).toBeVisible();
    await input.press('ArrowDown');
    await expect(page.getByRole('option').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#site-search-results')).toBeHidden();
    await expect(input).toBeFocused();
  });
});

test('clicking outside the results closes them', async ({ page }) => {
  await page.goto('/index.html');
  await page.getByRole('combobox', { name: 'Search the site' }).fill('Kington');
  await expect(page.locator('#site-search-results')).toBeVisible();
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await expect(page.locator('#site-search-results')).toBeHidden();
});

test('axe: search results open, on the homepage', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => {
    document.querySelectorAll('.reveal').forEach((el) => {
      el.classList.add('in');
      (el as HTMLElement).style.transition = 'none';
      (el as HTMLElement).style.opacity = '1';
      (el as HTMLElement).style.transform = 'none';
    });
  });
  await page.getByRole('combobox', { name: 'Search the site' }).fill('Kington');
  await expect(page.locator('#site-search-results')).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
