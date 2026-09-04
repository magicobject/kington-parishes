import { test, expect } from './support/fixtures';

// The signup form is a single shared partial (templates/newsletter-signup-form.html)
// rendered on both newsletter.html and the homepage — these interaction
// tests run against newsletter.html; a lighter check below confirms the
// homepage got the same, working copy.

test('submitting without ticking consent shows an inline error and leaves the form visible', async ({ page }) => {
  await page.goto('/newsletter.html');

  await page.locator('#newsletter-email').fill('person@example.com');
  await page.getByRole('button', { name: 'Sign up' }).click();

  await expect(page.locator('#newsletter-signup-message')).toBeVisible();
  await expect(page.locator('#newsletter-signup-message')).toHaveText(/tick the box/i);
  await expect(page.locator('#newsletter-signup-form')).toBeVisible();
});

test('a successful signup replaces the form with a focused confirmation', async ({ page }) => {
  await page.route('**/api/subscribe', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, message: "You're all set!" }),
    }),
  );

  await page.goto('/newsletter.html');
  await page.locator('#newsletter-email').fill('person@example.com');
  await page.locator('#newsletter-consent').check();
  await page.getByRole('button', { name: 'Sign up' }).click();

  const success = page.locator('#newsletter-signup-success');
  await expect(success).toBeVisible();
  // Text comes straight from the server's response, not a hardcoded string
  // in the page — proves that pass-through actually works.
  await expect(success).toHaveText("You're all set!");
  await expect(page.locator('#newsletter-signup-form')).toBeHidden();
  await expect(success).toBeFocused();
});

test('a failed signup shows the server\'s error message, and the form stays usable', async ({ page }) => {
  await page.route('**/api/subscribe', (route) =>
    route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, message: 'Something went wrong on our end — please try again shortly.' }),
    }),
  );

  await page.goto('/newsletter.html');
  await page.locator('#newsletter-email').fill('person@example.com');
  await page.locator('#newsletter-consent').check();
  await page.getByRole('button', { name: 'Sign up' }).click();

  await expect(page.locator('#newsletter-signup-message')).toHaveText('Something went wrong on our end — please try again shortly.');
  await expect(page.locator('#newsletter-signup-form')).toBeVisible();
});

test('a second consecutive failure adds a fallback contact link, not just the same message again', async ({ page }) => {
  await page.route('**/api/subscribe', (route) =>
    route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, message: 'Something went wrong on our end — please try again shortly.' }),
    }),
  );

  await page.goto('/newsletter.html');
  await page.locator('#newsletter-email').fill('person@example.com');
  await page.locator('#newsletter-consent').check();

  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page.locator('#newsletter-signup-message')).not.toContainText('Email');

  await page.getByRole('button', { name: 'Sign up' }).click();
  const message = page.locator('#newsletter-signup-message');
  await expect(message).toContainText('Still not working?');
  await expect(message.getByRole('link', { name: 'vicar@kingtonparishes.org.uk' })).toHaveAttribute('href', 'mailto:vicar@kingtonparishes.org.uk');
});

test('a success after failures resets the failure count (no lingering fallback text)', async ({ page }) => {
  let attempt = 0;
  await page.route('**/api/subscribe', (route) => {
    attempt++;
    if (attempt < 3) {
      return route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, message: 'Something went wrong on our end — please try again shortly.' }),
      });
    }
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, message: "You're all set!" }),
    });
  });

  await page.goto('/newsletter.html');
  await page.locator('#newsletter-email').fill('person@example.com');
  await page.locator('#newsletter-consent').check();

  await page.getByRole('button', { name: 'Sign up' }).click();
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page.locator('#newsletter-signup-message')).toContainText('Still not working?');

  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page.locator('#newsletter-signup-success')).toBeVisible();
});

test('the homepage has its own working copy of the same signup form', async ({ page }) => {
  await page.route('**/api/subscribe', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, message: "You're all set!" }),
    }),
  );

  await page.goto('/index.html');
  await expect(page.locator('#newsletter-signup')).toBeVisible();

  await page.locator('#newsletter-email').fill('person@example.com');
  await page.locator('#newsletter-consent').check();
  await page.getByRole('button', { name: 'Sign up' }).click();

  await expect(page.locator('#newsletter-signup-success')).toBeVisible();
});
