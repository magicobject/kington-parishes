// Single source of truth for what each page in the main nav should look
// like. Used across specs so a new page only needs an entry added here.
export interface SitePage {
  /** Path served by the static test server, e.g. "/about.html". */
  path: string;
  /** Visible text of this page's link in the main nav. */
  navLabel: string;
  /** Substring expected in <title>. */
  titleContains: string;
  /** Text expected in the page's <h1>. */
  heading: RegExp;
  /** Whether this page shows the primary header nav (false only for 404). */
  hasHeader?: boolean;
}

// The seven pages in the primary header nav.
export const NAV_PAGES: SitePage[] = [
  { path: '/index.html', navLabel: 'Home', titleContains: 'Kington Parishes', heading: /vibrant church communities/i },
  { path: '/our-churches.html', navLabel: 'Our Churches', titleContains: 'Our Churches', heading: /five churches, one benefice/i },
  { path: '/services.html', navLabel: 'Services & Events', titleContains: 'Services', heading: /worship, week by week/i },
  { path: '/parish-news.html', navLabel: 'Parish News', titleContains: 'Parish News', heading: /family magazine/i },
  { path: '/life-events.html', navLabel: 'Life Events', titleContains: 'Life Events', heading: /baptisms, weddings/i },
  { path: '/get-involved.html', navLabel: 'Get Involved', titleContains: 'Get Involved', heading: /support, hire, and take part/i },
  { path: '/contact.html', navLabel: 'Contact', titleContains: 'Contact', heading: /we'd love to hear from you/i },
];

// Safeguarding isn't in the primary nav (only the footer's "Explore" list
// and the safeguard-strip banner), so it's listed separately.
export const SAFEGUARDING_PAGE: SitePage = {
  path: '/safeguarding.html',
  navLabel: 'Safeguarding',
  titleContains: 'Safeguarding',
  heading: /safeguarding, care and nurture/i,
};

// Every generated page, including the ones without primary nav — used by
// specs that should run against literally everything (footer, tokens).
export const ALL_PAGES: SitePage[] = [...NAV_PAGES, SAFEGUARDING_PAGE];
