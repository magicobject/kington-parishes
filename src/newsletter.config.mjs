// Single source of truth for InSpire Newsletter issues. Add one entry here
// per issue — src/pages/newsletter.html and src/pages/newsletter-archive.html
// both pick it up automatically via the {{NEWSLETTERS:recent}} /
// {{NEWSLETTERS:archive}} tokens (see scripts/build.mjs and
// scripts/newsletter-issues.mjs), split by whether the issue is more or
// less than six months old as of the build.
//
// An issue's own page (src/pages/newsletter-<slug>.html) still needs
// registering in src/pages.config.mjs like any other page — this config
// only drives the two listing pages, not the issue's own content.
export const NEWSLETTER_ISSUES = [
  {
    slug: 'newsletter-2026-09',
    title: 'September 2026',
    date: '2026-09-03',
    summary: "25 years of ministry for Sally, Phillippa's ordination as priest, a Treasurer vacancy, and September's Wild Church cancelled.",
  },
  // { slug: 'newsletter-2026-10', title: 'October 2026', date: '2026-10-01', summary: 'One-line summary of what is in this issue.' },
];
