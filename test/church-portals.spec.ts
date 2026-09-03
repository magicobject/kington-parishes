import { test, expect } from './support/fixtures';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Each church on Our Churches links through to its own portal page, and
// St Mary's, Kington's portal shares the exact same person data as Our
// People — both are rendered from src/people.config.mjs via the
// {{PEOPLE:clergy}} / {{PEOPLE:kington}} tokens (see scripts/build.mjs), so
// these specs are really checking that the single source of truth actually
// reached both pages, not that someone kept two hand-written lists in sync.

const CHURCHES = [
  { anchor: 'kington', label: "Visit the St Mary's, Kington page →", photoLabel: "Visit the St Mary's, Kington page", portal: '/church-kington.html', heading: /st mary the virgin, kington/i },
  { anchor: 'titley', label: "Visit the St Peter's, Titley page →", photoLabel: "Visit the St Peter's, Titley page", portal: '/church-titley.html', heading: /st peter's, titley/i },
  { anchor: 'old-radnor', label: "Visit the St Stephen's, Old Radnor page →", photoLabel: "Visit the St Stephen's, Old Radnor page", portal: '/church-old-radnor.html', heading: /st stephen's, old radnor/i },
  { anchor: 'kinnerton', label: "Visit the St Mary's, Kinnerton page →", photoLabel: "Visit the St Mary's, Kinnerton page", portal: '/church-kinnerton.html', heading: /st mary's, kinnerton/i },
  { anchor: 'huntington', label: 'Visit the St Thomas à Becket, Huntington page →', photoLabel: 'Visit the St Thomas à Becket, Huntington page', portal: '/church-huntington.html', heading: /st thomas à becket, huntington/i },
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

  test(`the church photo for #${church.anchor} also links to ${church.portal}`, async ({ page }) => {
    await page.goto('/our-churches.html');
    const photoLink = page.locator(`#${church.anchor} .parish-photo a`);
    await expect(photoLink).toHaveAttribute('href', church.portal.slice(1));
    await expect(photoLink).toHaveAccessibleName(church.photoLabel);

    await photoLink.click();
    await expect(page).toHaveURL(new RegExp(`${church.portal}$`));
    await expect(page.locator('h1')).toHaveText(church.heading);
  });
}

// Every church now has at least a clergy section on its portal page, plus
// its own officers where we have them — each keyed off src/people.config.mjs
// via {{PEOPLE:clergy}} / {{PEOPLE:<slug>}}, same as Our People.
const CHURCH_OFFICERS = {
  kington: [
    ['Greg Wright', 'Churchwarden · Interim Treasurer'],
    ['Margaret Cooke', 'Churchwarden'],
    ['Christine Robinson', 'Parish Safeguarding Officer · Church Secretary'],
    ['Julia Reed', 'Health & Safety Officer'],
    ['Philip Sell', 'Director of Music · Parish Administrator'],
    ['Revd Paul Roberts', 'Organist'],
    ['David Redmayne', 'Parish News Editor'],
    ['John Clayton', 'Bell Tower Captain'],
  ],
  titley: [
    ['Dick Alford', 'Churchwarden'],
    ['Hannah Vernon', 'Secretary'],
    ['Robert Page', 'Organist'],
    ['Ann James', 'Organist'],
  ],
  'old-radnor': [
    ['Rosemary Watkins', 'Churchwarden'],
    ['Reg Preece', 'Bell Tower Captain'],
  ],
  kinnerton: [
    ['Sue Thompson', 'Churchwarden · Secretary'],
    ['Nicola Cavell', 'Parish News Editor'],
  ],
  huntington: [
    ['Fiona Shone', 'Churchwarden · Organist'],
    ['Peter Kelly', 'Churchwarden'],
    ['Sue Maiden', 'Secretary'],
  ],
};
const CLERGY = [
  ['Revd Sally Welch', 'Vicar'],
  ['Revd Phillippa Wright', 'Curate'],
];
const PORTAL_PATH: Record<string, string> = {
  kington: '/church-kington.html',
  titley: '/church-titley.html',
  'old-radnor': '/church-old-radnor.html',
  kinnerton: '/church-kinnerton.html',
  huntington: '/church-huntington.html',
};

for (const [slug, officers] of Object.entries(CHURCH_OFFICERS)) {
  test(`${PORTAL_PATH[slug]} lists the same clergy and officers as Our People, with matching roles`, async ({ page }) => {
    for (const path of ['/our-people.html', PORTAL_PATH[slug]]) {
      await page.goto(path);
      for (const [name, role] of [...CLERGY, ...officers]) {
        // .first(): our-people.html lists every church on one page, so
        // someone serving more than one church (Ruth Jones, Nicola Cavell)
        // has more than one matching card there — any one of them proves
        // the data reached the page, which is all this check needs.
        const card = page.locator('.card', { has: page.getByRole('heading', { name, exact: true }) }).first();
        await expect(card.locator('.tags')).toHaveText(role);
      }
    }
  });
}

test("Christine Robinson's card links to the Safeguarding page identically on both pages", async ({ page }) => {
  for (const path of ['/our-people.html', '/church-kington.html']) {
    await page.goto(path);
    const card = page.locator('.card', { has: page.getByRole('heading', { name: 'Christine Robinson', exact: true }) });
    await expect(card.getByRole('link', { name: 'Safeguarding page' })).toHaveAttribute('href', 'safeguarding.html');
  }
});

// Ruth Jones serves as an officer at three different churches (Kinnerton,
// Old Radnor, Titley) — one person, one email, three cards. Proves the same
// source of truth reaches every page she's listed on, not just a pair.
test('Ruth Jones contacts to the same address on every church she serves', async ({ page }) => {
  for (const path of ['/church-kinnerton.html', '/church-old-radnor.html', '/church-titley.html', '/our-people.html']) {
    await page.goto(path);
    const card = page.locator('.card', { has: page.getByRole('heading', { name: 'Ruth Jones', exact: true }) }).first();
    await expect(card.getByRole('link', { name: 'Get in touch →' })).toHaveAttribute(
      'href',
      'mailto:lewisjonesruth@yahoo.co.uk',
    );
  }
});

test('none of the new officers\' email addresses appear in plain text in any page source', async () => {
  const emails = [
    'fiona@huntingtoncourt.co.uk',
    'peterbkelly642@hotmail.com',
    'lewisjonesruth@yahoo.co.uk',
    'suesuethompson@outlook.com',
    'dick.alford@gmail.com',
    'susan.el.maiden@gmail.com',
    'nicola.cavell@gmail.com',
    'office@kingtonparishes.org.uk',
    'rev.paul.c.roberts@gmail.com',
  ];
  const pages = ['our-people.html', 'church-kington.html', 'church-titley.html', 'church-old-radnor.html', 'church-kinnerton.html', 'church-huntington.html'];
  for (const path of pages) {
    const html = readFileSync(join(__dirname, '..', 'public', path), 'utf8');
    for (const email of emails) {
      expect(html).not.toContain(email);
    }
  }
});
