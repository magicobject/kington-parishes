import { test, expect } from './support/fixtures';
import { AxeBuilder } from '@axe-core/playwright';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';

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

test.describe('the hidden help guide has its own search scope', () => {
  test('an ordinary page never surfaces help-guide content', async ({ page }) => {
    // "Under the hood" is help-technical-details.html's own h1, and appears
    // nowhere in the site's real, public-facing content.
    await page.goto('/index.html');
    await page.getByRole('combobox', { name: 'Search the site' }).fill('under the hood');
    const results = page.locator('#site-search-results');
    await expect(results).toBeVisible();
    await expect(results).toContainText('No results');
  });

  test('a help page never surfaces ordinary site content', async ({ page }) => {
    await page.goto('/help.html');
    await page.getByRole('combobox', { name: 'Search the help guide' }).fill('Titley');
    const results = page.locator('#site-search-results');
    await expect(results).toBeVisible();
    await expect(results).toContainText('No results');
  });

  test('a help page searches across the whole guide, not just its own page', async ({ page }) => {
    // Searched from help.html (the hub), but the match lives on a different
    // help page (help-technical-details.html) — proves the scope covers the
    // whole guide, not just whatever page the box happens to be on.
    await page.goto('/help.html');
    await page.getByRole('combobox', { name: 'Search the help guide' }).fill('under the hood');
    const results = page.locator('#site-search-results');
    await expect(results).toBeVisible();
    await expect(results.getByRole('option').first()).toHaveAttribute('href', 'help-technical-details.html#under-the-hood');
  });

  test('the search box relabels itself while on a help page', async ({ page }) => {
    await page.goto('/help-making-a-change.html');
    await expect(page.getByRole('combobox', { name: 'Search the help guide' })).toBeVisible();
    await expect(page.getByPlaceholder('Search the help guide')).toBeVisible();
  });

  test('axe: search results open, on a help page', async ({ page }) => {
    await page.goto('/help.html');
    await page.evaluate(() => {
      document.querySelectorAll('.reveal').forEach((el) => {
        el.classList.add('in');
        (el as HTMLElement).style.transition = 'none';
        (el as HTMLElement).style.opacity = '1';
        (el as HTMLElement).style.transform = 'none';
      });
    });
    await page.getByRole('combobox', { name: 'Search the help guide' }).fill('newsletter');
    await expect(page.locator('#site-search-results')).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
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

// The LAUNCHED site (tester finding S3): once the calendar is in the sitemap and the site search, searching "advent" must give ONE
// result, not two (the page's h1 and the calendar section's h2). The real build is not launched yet, so this builds a temporary COPY
// of the repository with the three launch flags flipped (scripts/advent-launched-copy.mjs, the same steps as `npm run advent:rehearse`),
// serves its public folder, and searches there. Slow (a copy and a build), so it is a single test.
test('on the launched site, searching "advent" gives exactly one result, and its target is visible', async ({ page }) => {
  test.setTimeout(240_000);
  const made = JSON.parse(execFileSync(process.execPath, [join(__dirname, '..', 'scripts', 'advent-launched-copy.mjs'), 'make'], { maxBuffer: 64 * 1024 * 1024 }).toString()) as { temp: string; publicDir: string };
  const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.xml': 'application/xml', '.txt': 'text/plain' };
  const server = createServer((request, response) => {
    const path = resolve(join(made.publicDir, decodeURIComponent((request.url ?? '/').split('?')[0].split('#')[0]).replace(/^\/$/, '/index.html')));
    if (!path.startsWith(resolve(made.publicDir) + sep) || !existsSync(path) || statSync(path).isDirectory()) { response.writeHead(404); response.end('not found'); return; }
    response.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' });
    response.end(readFileSync(path));
  });
  await new Promise<void>((done) => server.listen(0, 'localhost', done));
  try {
    const base = `http://localhost:${(server.address() as { port: number }).port}`;
    const index = JSON.parse(readFileSync(join(made.publicDir, 'search-index.json'), 'utf8')) as { page: string; heading: string }[];
    expect(index.filter((entry) => entry.page === 'advent.html').map((entry) => entry.heading), 'the launched index lists the calendar page once').toEqual(['Advent']);
    await page.goto(`${base}/index.html`);
    await page.getByRole('combobox', { name: 'Search the site' }).fill('advent');
    const results = page.locator('#site-search-results');
    await expect(results).toBeVisible();
    await expect(results.getByRole('option')).toHaveCount(1);
    const result = results.getByRole('option').first();
    await expect(result).toHaveAttribute('href', 'advent.html#advent');
    await result.click();
    await expect(page).toHaveURL(/advent\.html#advent$/);
    await expect(page.locator('#advent')).toBeVisible();
    await expect(page.locator('h1#advent')).toHaveText('Advent');
  } finally {
    server.close();
    execFileSync(process.execPath, [join(__dirname, '..', 'scripts', 'advent-launched-copy.mjs'), 'remove', made.temp]);
  }
});
