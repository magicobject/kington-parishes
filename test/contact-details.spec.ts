import { test, expect } from '@playwright/test';
import { ALL_PAGES } from './support/pages';

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
  await expect(page.locator('a[href="tel:+441544230525"]').first()).toBeVisible();

  await page.goto('/parish-news.html');
  // 2 in the body content ("Write for us" / "Get the paper edition") + 1 in the footer.
  const mailtoLinks = page.locator('a[href="mailto:vicar@kingtonparishes.org.uk"]');
  await expect(mailtoLinks).toHaveCount(3);

  await page.goto('/index.html');
  await expect(page.locator('footer.site a[href="mailto:vicar@kingtonparishes.org.uk"]')).toBeVisible();
  await expect(page.locator('footer.site a[href="tel:+441544230525"]')).toBeVisible();
});

test('the booking secretary\'s contact is consistent between get-involved and contact', async ({ page }) => {
  await page.goto('/get-involved.html');
  await expect(page.locator('a[href="mailto:p.s.halcrow@gmail.com"]')).toContainText('Penny Halcrow');

  await page.goto('/contact.html');
  await expect(page.getByText('Penny Halcrow')).toBeVisible();
  await expect(page.locator('a[href="mailto:p.s.halcrow@gmail.com"]')).toBeVisible();
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
