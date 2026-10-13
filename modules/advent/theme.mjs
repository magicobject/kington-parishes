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
  slug: 'advent',
  previewEnabled: true,
  adventEnabled: true,
  // false = not in the sitemap or search, and noindex, until Greg switches it on (on or before 1 December).
  publicListing: false,
  translationName: 'World English Bible',
  colours: Object.freeze({
    night: '#14202b',
    sky2: '#2E3C48',
    ridge: '#0d161e',
    cream: '#F2E6C4',
    accent: '#E8C27A',
    accentInk: '#1F1A0B',
    door: '#22323f',
    doorEdge: '#A8813C',
    paper: '#F8F5EE',
    text: '#262521',
    textSoft: '#4A473F',
    link: '#7C5E28',
    focus: '#fff3c8',
  }),
});
