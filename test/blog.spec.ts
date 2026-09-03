import { test, expect } from './support/fixtures';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The Treasurer-vacancy blog post links through to the full job description
// page, and both pages contact Greg Wright via the site's usual obfuscated
// mailto pattern — these specs guard the link and the obfuscation, the same
// way contact-details.spec.ts and safeguarding.spec.ts do for other people.

test('the blog post links to the Treasurer job description page', async ({ page }) => {
  await page.goto('/blog.html');
  await expect(page.getByRole('link', { name: 'Treasurer job description →' })).toHaveAttribute(
    'href',
    'treasurer-job-description.html',
  );
});

test('both the blog post and the job description page contact Greg Wright at the same address', async ({ page }) => {
  await page.goto('/blog.html');
  await expect(page.getByRole('link', { name: 'Greg Wright' })).toHaveAttribute(
    'href',
    'mailto:st.marys.kington.treasurer@gmail.com',
  );

  await page.goto('/treasurer-job-description.html');
  await expect(page.getByRole('link', { name: 'Greg Wright' })).toHaveAttribute(
    'href',
    'mailto:st.marys.kington.treasurer@gmail.com',
  );
});

test("Greg Wright's treasurer-recruitment email never appears in plain text in the page source", async () => {
  for (const path of ['blog.html', 'treasurer-job-description.html']) {
    const html = readFileSync(join(__dirname, '..', 'public', path), 'utf8');
    expect(html).not.toContain('st.marys.kington.treasurer@gmail.com');
  }
});
