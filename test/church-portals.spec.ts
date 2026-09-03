import { test, expect } from './support/fixtures';

// Each church on Our Churches links through to its own portal page, and
// St Mary's, Kington's portal shares the exact same person data as Our
// People — both are rendered from src/people.config.mjs via the
// {{PEOPLE:clergy}} / {{PEOPLE:kington}} tokens (see scripts/build.mjs), so
// these specs are really checking that the single source of truth actually
// reached both pages, not that someone kept two hand-written lists in sync.

const CHURCHES = [
  { anchor: 'kington', label: "Visit the St Mary's, Kington page →", portal: '/church-kington.html', heading: /st mary the virgin, kington/i },
  { anchor: 'titley', label: "Visit the St Peter's, Titley page →", portal: '/church-titley.html', heading: /st peter's, titley/i },
  { anchor: 'old-radnor', label: "Visit the St Stephen's, Old Radnor page →", portal: '/church-old-radnor.html', heading: /st stephen's, old radnor/i },
  { anchor: 'kinnerton', label: "Visit the St Mary's, Kinnerton page →", portal: '/church-kinnerton.html', heading: /st mary's, kinnerton/i },
  { anchor: 'huntington', label: 'Visit the St Thomas à Becket, Huntington page →', portal: '/church-huntington.html', heading: /st thomas à becket, huntington/i },
];

for (const church of CHURCHES) {
  test(`Our Churches links to the ${church.portal} portal page for #${church.anchor}`, async ({ page }) => {
    await page.goto('/our-churches.html');
    const link = page.locator(`#${church.anchor}`).getByRole('link', { name: church.label });
    await expect(link).toHaveAttribute('href', church.portal.slice(1));

    await link.click();
    await expect(page).toHaveURL(new RegExp(`${church.portal}$`));
    await expect(page.locator('h1')).toHaveText(church.heading);
  });
}

test('the Kington portal page lists the same clergy and officers as Our People, with matching roles', async ({ page }) => {
  const people = [
    ['Revd Sally Welch', 'Vicar'],
    ['Revd Phillippa Wright', 'Curate'],
    ['Greg Wright', 'Churchwarden · Interim Treasurer'],
    ['Margaret Cooke', 'Churchwarden'],
    ['Christine Robinson', 'Parish Safeguarding Officer · Church Secretary'],
    ['Julia Reed', 'Health & Safety Officer'],
    ['Philip Sell', 'Director of Music'],
  ];

  for (const path of ['/our-people.html', '/church-kington.html']) {
    await page.goto(path);
    for (const [name, role] of people) {
      const card = page.locator('.card', { has: page.getByRole('heading', { name, exact: true }) });
      await expect(card.locator('.tags')).toHaveText(role);
    }
  }
});

test("Christine Robinson's card links to the Safeguarding page identically on both pages", async ({ page }) => {
  for (const path of ['/our-people.html', '/church-kington.html']) {
    await page.goto(path);
    const card = page.locator('.card', { has: page.getByRole('heading', { name: 'Christine Robinson', exact: true }) });
    await expect(card.getByRole('link', { name: 'Safeguarding page' })).toHaveAttribute('href', 'safeguarding.html');
  }
});

test("the other four churches' portal pages don't yet show a People section", async ({ page }) => {
  for (const path of ['/church-titley.html', '/church-old-radnor.html', '/church-kinnerton.html', '/church-huntington.html']) {
    await page.goto(path);
    await expect(page.getByText('More to come')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Greg Wright' })).toHaveCount(0);
  }
});
