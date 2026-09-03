import { test, expect } from './support/fixtures';
import { ALL_PAGES } from './support/pages';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Regression guard for the DRY-up of contact details: the parish office
// email/phone, the booking secretary's contact, and the donate link all
// come from a single source (src/site.config.mjs) and are substituted in
// at build time. These specs check the substitution actually happened
// correctly — not just on the pages where the details were originally
// hand-written.
const ALL_PATHS = [...ALL_PAGES.map((p) => p.path), '/404.html'];

for (const path of ALL_PATHS) {
  test(`${path} has no leftover {{TOKEN}} placeholders`, async ({ page }) => {
    await page.goto(path);
    const html = await page.content();
    expect(html).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });
}

test('the parish office email and phone number are correct and consistent everywhere they appear', async ({
  page,
}) => {
  await page.goto('/contact.html');
  await expect(page.locator('a[href="mailto:vicar@kingtonparishes.org.uk"]').first()).toBeVisible();
  await expect(page.locator('a[href="tel:+447974439630"]').first()).toBeVisible();

  await page.goto('/parish-news.html');
  // 1 in the body content ("Get the paper edition" — "Write for us" now
  // contacts the Parish News editor directly, a different address) + 1 in
  // the footer.
  const mailtoLinks = page.locator('a[href="mailto:vicar@kingtonparishes.org.uk"]');
  await expect(mailtoLinks).toHaveCount(2);

  await page.goto('/index.html');
  await expect(page.locator('footer.site a[href="mailto:vicar@kingtonparishes.org.uk"]')).toBeVisible();
  await expect(page.locator('footer.site a[href="tel:+447974439630"]')).toBeVisible();
});

test('the booking secretary\'s contact is consistent between get-involved and contact', async ({ page }) => {
  await page.goto('/get-involved.html');
  await expect(page.locator('a[href="mailto:p.s.halcrow@gmail.com"]')).toContainText('Penny Halcrow');

  await page.goto('/contact.html');
  await expect(page.getByRole('link', { name: 'Penny Halcrow' })).toHaveAttribute(
    'href',
    'mailto:p.s.halcrow@gmail.com',
  );
});

test("the booking secretary's email never appears in plain text in the page source", async () => {
  for (const path of ['contact.html', 'get-involved.html', 'parish-hall.html']) {
    const html = readFileSync(join(__dirname, '..', 'public', path), 'utf8');
    expect(html).not.toContain('p.s.halcrow@gmail.com');
  }
});

test('Parish News articles, information and adverts go to the editor, David Redmayne', async ({ page }) => {
  await page.goto('/parish-news.html');
  await expect(page.getByRole('link', { name: 'David Redmayne' })).toHaveAttribute(
    'href',
    'mailto:pn.kingtonparishes@gmail.com',
  );
});

test("the Parish News editor's email never appears in plain text in the page source", async () => {
  const html = readFileSync(join(__dirname, '..', 'public', 'parish-news.html'), 'utf8');
  expect(html).not.toContain('pn.kingtonparishes@gmail.com');
});

test('the donate link is identical in the header and on Get Involved, and points at the church-picker page', async ({
  page,
}) => {
  await page.goto('/get-involved.html');

  await expect(page.locator('a.btn-donate')).toHaveAttribute('href', 'donate.html');
  await expect(page.getByRole('link', { name: 'Choose a church to support →' })).toHaveAttribute(
    'href',
    'donate.html',
  );
});

test('donate.html links each church (and the combined Old Radnor/Kinnerton entry) to its own Parish Giving Scheme page', async ({
  page,
}) => {
  await page.goto('/donate.html');

  await expect(page.getByRole('link', { name: "Donate to St Mary's, Kington →" })).toHaveAttribute(
    'href',
    'https://www.parishgiving.org.uk/donors/find-your-parish/kington-st-mary-herefordshire',
  );
  await expect(page.getByRole('link', { name: "Donate to St Peter's, Titley →" })).toHaveAttribute(
    'href',
    'https://www.parishgiving.org.uk/donors/find-your-parish/titley-st-peter-hereford',
  );
  await expect(page.getByRole('link', { name: 'Donate to Old Radnor & Kinnerton →' })).toHaveAttribute(
    'href',
    'https://www.parishgiving.org.uk/donors/find-your-parish/old-radnor-st-stephen-hereford',
  );
  await expect(page.getByRole('link', { name: 'Donate to Huntington →' })).toHaveAttribute(
    'href',
    'https://www.parishgiving.org.uk/donors/find-your-parish/huntington-st-thomas-a-becket-hereford',
  );
});
