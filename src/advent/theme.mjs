// Kington Parishes' settings for the Advent calendar: SITE-OWNED, data only.
// Shape and limits are documented in schema.mjs. Colours are the --advent-* tokens
// from the approved mock-up (docs/advent/mockups/advent-mockup.html).
export const theme = Object.freeze({
  siteName: 'Kington Parishes',
  timeZone: 'Europe/London',
  season: Object.freeze({
    start: Object.freeze({ month: 12, day: 1 }),
    end: Object.freeze({ month: 12, day: 25 }),
    archiveUntil: Object.freeze({ month: 1, day: 6 }),
  }),
  // The 6 January bonus door (Epiphany, "Gifts for a King"). It only appears once content.mjs has a `bonus` day
  // (the text is being written separately); until then the calendar shows its 25 doors.
  bonus: Object.freeze({ on: Object.freeze({ month: 1, day: 6 }), label: 'Epiphany' }),
  // This site's own scene picture (the five church silhouettes on the ridge): a hand-made file in public/advent/.
  // Set to null to use the module's plain hills scene instead.
  scene: 'scene.svg',
  slug: 'advent',
  // reservedSlugs is optional and not needed: the build checks the slug against the site's real page list (pageNames).
  previewEnabled: true,
  adventEnabled: true,
  // false = not in the sitemap or search, and noindex, until Greg switches it on (on or before 1 December).
  publicListing: false,
  // false = the build allows missing pictures (they are still checked when present).
  // Flip to true at launch; the build then refuses to continue if any art file is missing.
  artRequired: false,
  // THE LAUNCH SWITCH. false = a real visitor ALWAYS sees the calm message (calendar page and home banner), even in
  // December; ?advent-preview still works. Flip goLive, publicListing and artRequired together (launch-checklist.md);
  // the schema refuses goLive without the other two.
  goLive: false,
  translationName: 'World English Bible',
  // Contrast (WCAG 2, computed by test-unit/advent-contrast.test.mjs):
  //   text on paper 14.09   textSoft on paper 8.52   link on paper 5.53   (need 4.5)
  //   cream on night 13.29  accentInk on accent 10.26  accent on night 9.78 (need 4.5)
  //   doorEdge on door 3.68 (need 3, UI edge)   focus on night 14.87 (need 3, focus ring)
  // AVOID: focus on paper (about 1.0) and link on night (about 2.7). They fail.
  colours: Object.freeze({
    night: '#14202b',
    sky2: '#2E3C48',
    ridge: '#0d161e',
    cream: '#F2E6C4',
    accent: '#E8C27A',
    accentInk: '#1F1A0B',
    door: '#22323f',
    doorLocked: '#18232d',
    doorEdge: '#A8813C',
    paper: '#F8F5EE',
    text: '#262521',
    textSoft: '#4A473F',
    link: '#7C5E28',
    focus: '#fff3c8',
  }),
});
