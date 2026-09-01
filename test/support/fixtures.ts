// Every spec should import `test`/`expect` from here instead of directly
// from '@playwright/test'. The only difference: this blocks every request
// that isn't to our own static-server (Google Fonts, the homepage's Google
// Maps iframe) before it leaves the page. None of the specs assert on
// webfont rendering or live map tiles — they check DOM structure, text,
// links and computed CSS from our own stylesheet — so this doesn't drop
// any coverage. It does remove the suite's only source of real network
// I/O, which is what caused occasional multi-second (sometimes ~19s)
// stalls on an otherwise-arbitrary test whenever that request was slow to
// resolve from wherever CI happens to run.
import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
    await use(page);
  },
});

export { expect };
