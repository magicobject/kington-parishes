import { test, expect } from '@playwright/test';

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
