import { test, expect } from './support/fixtures';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The Vacancies page lists two long-running (no expiry) volunteer vacancies.
// Nav reachability, title/heading, footer, noindex and accessibility are all
// covered generically via test/support/pages.ts's NAV_PAGES entry — these
// specs cover the vacancy-specific content: each card's links and contact
// details, and the obfuscation pattern every other page's emails already get
// (see blog.spec.ts and contact-details.spec.ts for the same pattern).

test('the Treasurer vacancy links through to the job description and blog post, and contacts Greg Wright at the same address used elsewhere', async ({ page }) => {
  await page.goto('/vacancies.html');

  const card = page.locator('.card', { has: page.getByRole('heading', { name: 'Treasurer', exact: true }) });
  await expect(card.getByRole('link', { name: 'Treasurer job description →' })).toHaveAttribute(
    'href',
    'treasurer-job-description.html',
  );
  await expect(card.getByRole('link', { name: 'Blog', exact: true })).toHaveAttribute('href', 'blog.html');
  await expect(card.getByRole('link', { name: 'Greg Wright' })).toHaveAttribute(
    'href',
    'mailto:st.marys.kington.treasurer@gmail.com',
  );
});

test('the Kington Foodbank vacancy links to the foodbank\'s own website and contacts Phillippa Wright', async ({ page }) => {
  await page.goto('/vacancies.html');

  const card = page.locator('.card', { has: page.getByRole('heading', { name: 'Kington Foodbank volunteers', exact: true }) });
  const websiteLink = card.getByRole('link', { name: 'Visit the Kington Foodbank website →' });
  await expect(websiteLink).toHaveAttribute('href', 'https://kingtonfoodbank.org.uk');
  await expect(websiteLink).toHaveAttribute('target', '_blank');
  await expect(websiteLink).toHaveAttribute('rel', 'noopener');

  await expect(card.getByRole('link', { name: 'Phillippa Wright' })).toHaveAttribute(
    'href',
    'mailto:curate@kingtonparishes.org.uk',
  );
  await expect(card).toContainText(/DBS/);
});

test('neither vacancy contact email ever appears in plain text in the page source', async () => {
  const html = readFileSync(join(__dirname, '..', 'public', 'vacancies.html'), 'utf8');
  expect(html).not.toContain('st.marys.kington.treasurer@gmail.com');
  expect(html).not.toContain('curate@kingtonparishes.org.uk');
});
