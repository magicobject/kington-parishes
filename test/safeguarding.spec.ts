import { test, expect } from './support/fixtures';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Regression guard: the safeguarding page's contact cards hold some long,
// unbroken strings (email addresses in particular) that once overflowed
// their card — nothing told them to wrap. Checks every link in every card
// stays within its card's box, not just that the text is present.
test('no contact link on the safeguarding page overflows its card', async ({ page }) => {
  await page.goto('/safeguarding.html');

  const cards = page.locator('.card');
  const cardCount = await cards.count();
  expect(cardCount).toBeGreaterThan(0);

  for (let i = 0; i < cardCount; i++) {
    const card = cards.nth(i);
    const cardBox = await card.boundingBox();
    expect(cardBox).not.toBeNull();

    const links = card.locator('a');
    const linkCount = await links.count();
    for (let j = 0; j < linkCount; j++) {
      const linkBox = await links.nth(j).boundingBox();
      expect(linkBox).not.toBeNull();
      expect(linkBox!.x + linkBox!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width + 1);
    }
  }
});

test('the officer contacts show the name as a mailto link, not a bare email address', async ({ page }) => {
  await page.goto('/safeguarding.html');

  const christine = page.getByRole('link', { name: 'Christine Robinson' });
  await expect(christine).toHaveAttribute('href', 'mailto:st.marys.kington.secretary54@gmail.com');
  await expect(page.getByText('st.marys.kington.secretary54@gmail.com')).toHaveCount(0);

  const lisa = page.getByRole('link', { name: 'Lisa Anderson' });
  await expect(lisa).toHaveAttribute('href', 'mailto:lisa.anderson@hereford.anglican.org');
  await expect(page.getByText('lisa.anderson@hereford.anglican.org')).toHaveCount(0);
});

test('the Diocesan Safeguarding Officer entry is up to date', async ({ page }) => {
  await page.goto('/safeguarding.html');

  await expect(page.getByRole('heading', { name: 'Diocesan Safeguarding Officer' })).toBeVisible();
  await expect(page.getByText('Lisa Anderson')).toBeVisible();
  await expect(page.locator('a[href="tel:+447999028076"]')).toHaveText('07999 028076');

  // The previous officer shouldn't be findable anywhere on the page.
  await expect(page.getByText('Steventon')).toHaveCount(0);
  await expect(page.getByText('Diocesan Safeguarding Adviser')).toHaveCount(0);
});

test('the officer email addresses never appear in plain text in the page source', async () => {
  const html = readFileSync(join(__dirname, '..', 'public', 'safeguarding.html'), 'utf8');

  expect(html).not.toContain('st.marys.kington.secretary54@gmail.com');
  expect(html).not.toContain('lisa.anderson@hereford.anglican.org');

  // The obfuscated form (numeric HTML entities) should be present instead —
  // this is what actually makes the raw source hard for a simple scraper
  // to read, as opposed to just hiding the text visually.
  expect(html).toMatch(/href="(&#\d+;)+"/);
});

test('every national helpline name links to that organisation\'s own website, alongside its phone number', async ({
  page,
}) => {
  await page.goto('/safeguarding.html');

  const expected: Record<string, string> = {
    NSPCC: 'https://www.nspcc.org.uk',
    Childline: 'https://www.childline.org.uk',
    'Stop It Now': 'https://www.stopitnow.org.uk',
    NAPAC: 'https://napac.org.uk',
    Samaritans: 'https://www.samaritans.org',
    'Family Lives': 'https://www.familylives.org.uk',
    'National Domestic Violence Helpline': 'https://www.nationaldahelpline.org.uk',
    'Action on Elder Abuse': 'https://wearehourglass.org',
  };

  for (const [name, url] of Object.entries(expected)) {
    const item = page.locator('.helpline-list li', { hasText: name });
    const nameLink = item.getByRole('link', { name, exact: true });
    await expect(nameLink).toHaveAttribute('href', url);
    await expect(nameLink).toHaveAttribute('target', '_blank');
    await expect(nameLink).toHaveAttribute('rel', 'noopener');
  }
});
