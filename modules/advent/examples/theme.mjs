// TEMPLATE, NOT CONTENT TO PUBLISH. Copy this file to src/advent/theme.mjs on your own site and change the values.
// The build refuses to run while src/advent/theme.mjs is still equal to this file. Shape and limits are documented in
// modules/advent/schema.mjs. All the launch switches start false: the calendar stays hidden until you launch it
// (see modules/advent/INTEGRATION.md and docs/advent/launch-checklist.md).
export const theme = Object.freeze({
  siteName: 'Example Parish',
  timeZone: 'Europe/London',
  season: Object.freeze({
    start: Object.freeze({ month: 12, day: 1 }),
    end: Object.freeze({ month: 12, day: 25 }),
    archiveUntil: Object.freeze({ month: 1, day: 6 }),
  }),
  // A 26th door (for example Epiphany on 6 January) needs a `bonus` day in content.mjs as well. null = 25 doors.
  bonus: null,
  // null = the module's plain hills scene. A file name such as 'scene.svg' means your own hand-made picture in public/advent/.
  scene: null,
  slug: 'advent',
  // Optional extra page names the calendar page may not take. The build already refuses any name your page list uses.
  reservedSlugs: Object.freeze([]),
  previewEnabled: true,
  adventEnabled: true,
  publicListing: false,
  artRequired: false,
  goLive: false,
  translationName: 'Example Bible translation',
  // Every pairing is checked for WCAG AA contrast by test-unit/advent-contrast.test.mjs: keep that test passing if you change a colour.
  colours: Object.freeze({
    night: '#10233a',
    sky2: '#243b55',
    ridge: '#0a1626',
    cream: '#EEF2E6',
    accent: '#9AD0B5',
    accentInk: '#0B1E16',
    door: '#1d3552',
    doorLocked: '#14263a',
    doorEdge: '#5C957E',
    paper: '#F6F8F4',
    text: '#1c2420',
    textSoft: '#3d4a43',
    link: '#2F6B54',
    focus: '#E6F4EA',
  }),
});
