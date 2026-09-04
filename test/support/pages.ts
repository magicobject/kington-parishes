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

// The twelve pages in the primary header nav.
export const NAV_PAGES: SitePage[] = [
  { path: '/our-churches.html', navLabel: 'Our Churches', titleContains: 'Our Churches', heading: /five churches, one benefice/i },
  { path: '/our-people.html', navLabel: 'Our People', titleContains: 'Our People', heading: /the people who lead and serve us/i },
  { path: '/services.html', navLabel: 'Services & Events', titleContains: 'Services', heading: /worship, week by week/i },
  { path: '/parish-news.html', navLabel: 'Parish Magazine', titleContains: 'Parish News', heading: /family magazine/i },
  { path: '/newsletter.html', navLabel: 'InSpire', titleContains: 'InSpire Newsletter', heading: /inspire newsletter/i },
  { path: '/blog.html', navLabel: 'Blog', titleContains: 'Blog', heading: /news from across the parishes/i },
  { path: '/life-events.html', navLabel: 'Life Events', titleContains: 'Life Events', heading: /baptisms, weddings/i },
  { path: '/get-involved.html', navLabel: 'Get Involved', titleContains: 'Get Involved', heading: /support, hire, and take part/i },
  { path: '/parish-hall.html', navLabel: 'Parish Hall', titleContains: 'Parish Hall', heading: /a hall for the whole community/i },
  { path: '/calendar.html', navLabel: 'Calendar', titleContains: 'Calendar', heading: /what's on/i },
  { path: '/walkers.html', navLabel: 'Walkers', titleContains: 'Walkers Welcome', heading: /walkers welcome/i },
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
// (labelled "Parish Magazine", same text as the NAV_PAGES entry above but
// pointing at the archive instead) and from the Parish Magazine page — not
// the primary nav.
export const PARISH_NEWS_ARCHIVE_PAGE: SitePage = {
  path: '/parish-news-archive.html',
  navLabel: 'Parish Magazine',
  titleContains: 'Parish News Archive',
  heading: /the parish news archive/i,
};

// One entry per newsletter issue page — reachable only via the newsletter
// page's "Recent issues" list (and, once six months old, the archive), not
// the primary nav or the footer. Add one line here per new issue.
export const NEWSLETTER_ISSUE_PAGES: SitePage[] = [
  { path: '/newsletter-2026-09.html', navLabel: 'September 2026', titleContains: 'September 2026', heading: /september 2026/i },
];

// Reachable from the newsletter page's "Browse the full archive" link, and
// from the footer's "Explore" list (labelled "InSpire Newsletter") — same
// nav/footer split as Parish Magazine, just the other way round (nav points
// at the hub, footer at the archive).
export const NEWSLETTER_ARCHIVE_PAGE: SitePage = {
  path: '/newsletter-archive.html',
  navLabel: 'InSpire Newsletter Archive',
  titleContains: 'InSpire Newsletter Archive',
  heading: /the inspire newsletter archive/i,
};

// Not in the primary nav or the footer — reachable only via the consent
// text on the newsletter signup form. Same pattern as Treasurer Job
// Description (reachable only via a link in page content).
export const PRIVACY_POLICY_PAGE: SitePage = {
  path: '/privacy-policy.html',
  navLabel: 'Privacy Policy',
  titleContains: 'Privacy Policy',
  heading: /privacy policy/i,
};

export const DONATE_PAGE: SitePage = {
  path: '/donate.html',
  navLabel: 'Donate',
  titleContains: 'Donate',
  heading: /choose which church to support/i,
};

// Not in the primary nav — reachable only via the link in the blog post
// announcing the Treasurer vacancy. Same pattern as Donate.
export const TREASURER_JOB_DESCRIPTION_PAGE: SitePage = {
  path: '/treasurer-job-description.html',
  navLabel: 'Treasurer Job Description',
  titleContains: 'Treasurer Job Description',
  heading: /treasurer role description/i,
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

// One portal page per church, reachable only via the "Visit the ... page →"
// link on each church's section of Our Churches — not the primary nav.
export const CHURCH_PORTAL_PAGES: SitePage[] = [
  { path: '/church-kington.html', navLabel: 'Kington', titleContains: 'St Mary the Virgin, Kington', heading: /st mary the virgin, kington/i },
  { path: '/church-titley.html', navLabel: 'Titley', titleContains: "St Peter's, Titley", heading: /st peter's, titley/i },
  { path: '/church-old-radnor.html', navLabel: 'Old Radnor', titleContains: "St Stephen's, Old Radnor", heading: /st stephen's, old radnor/i },
  { path: '/church-kinnerton.html', navLabel: 'Kinnerton', titleContains: "St Mary's, Kinnerton", heading: /st mary's, kinnerton/i },
  { path: '/church-huntington.html', navLabel: 'Huntington', titleContains: 'St Thomas à Becket, Huntington', heading: /st thomas à becket, huntington/i },
];

// Every generated page, including the ones without primary nav — used by
// specs that should run against literally everything (footer, tokens).
export const ALL_PAGES: SitePage[] = [HOME_PAGE, ...NAV_PAGES, SAFEGUARDING_PAGE, PARISH_NEWS_ARCHIVE_PAGE, ...NEWSLETTER_ISSUE_PAGES, NEWSLETTER_ARCHIVE_PAGE, PRIVACY_POLICY_PAGE, DONATE_PAGE, TREASURER_JOB_DESCRIPTION_PAGE, ...CHURCH_PORTAL_PAGES, UPDATES_PAGE];
