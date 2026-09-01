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

// The homepage isn't in NAV_PAGES below: the brand link in the header
// already goes here, so it has no link of its own in the primary nav (same
// reasoning as Safeguarding/Parish News Archive, just for the opposite
// reason — this one has no nav link at all, not a different one).
export const HOME_PAGE: SitePage = {
  path: '/index.html',
  navLabel: 'Home',
  titleContains: 'Kington Parishes',
  heading: /vibrant church communities/i,
};

// The ten pages in the primary header nav.
export const NAV_PAGES: SitePage[] = [
  { path: '/our-churches.html', navLabel: 'Our Churches', titleContains: 'Our Churches', heading: /five churches, one benefice/i },
  { path: '/our-people.html', navLabel: 'Our People', titleContains: 'Our People', heading: /the people who lead and serve us/i },
  { path: '/walkers.html', navLabel: 'Walkers', titleContains: 'Walkers Welcome', heading: /walkers welcome/i },
  { path: '/services.html', navLabel: 'Services & Events', titleContains: 'Services', heading: /worship, week by week/i },
  { path: '/parish-news.html', navLabel: 'Parish News', titleContains: 'Parish News', heading: /family magazine/i },
  { path: '/life-events.html', navLabel: 'Life Events', titleContains: 'Life Events', heading: /baptisms, weddings/i },
  { path: '/get-involved.html', navLabel: 'Get Involved', titleContains: 'Get Involved', heading: /support, hire, and take part/i },
  { path: '/parish-hall.html', navLabel: 'Parish Hall', titleContains: 'Parish Hall', heading: /a hall for the whole community/i },
  { path: '/calendar.html', navLabel: 'Calendar', titleContains: 'Calendar', heading: /what's on/i },
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

// Same pattern as Safeguarding: reachable from the footer's "Explore" list
// (labelled "Parish News", same text as the NAV_PAGES entry above but
// pointing at the archive instead) and from the Parish News page — not the
// primary nav.
export const PARISH_NEWS_ARCHIVE_PAGE: SitePage = {
  path: '/parish-news-archive.html',
  navLabel: 'Parish News',
  titleContains: 'Parish News Archive',
  heading: /the parish news archive/i,
};

// Not in the primary nav either — reachable from the header's Donate Now
// button (every page) and Get Involved's Give card, so it doesn't need its
// own nav entry.
export const DONATE_PAGE: SitePage = {
  path: '/donate.html',
  navLabel: 'Donate',
  titleContains: 'Donate',
  heading: /choose which church to support/i,
};

// Not in the primary nav, the footer, or anywhere else — a build changelog
// for whoever knows the URL, not user-facing content. See CLAUDE.md's
// "Build numbers" section.
export const UPDATES_PAGE: SitePage = {
  path: '/updates.html',
  navLabel: 'Updates',
  titleContains: 'Site Updates',
  heading: /site updates/i,
};

// Every generated page, including the ones without primary nav — used by
// specs that should run against literally everything (footer, tokens).
export const ALL_PAGES: SitePage[] = [HOME_PAGE, ...NAV_PAGES, SAFEGUARDING_PAGE, PARISH_NEWS_ARCHIVE_PAGE, DONATE_PAGE, UPDATES_PAGE];
