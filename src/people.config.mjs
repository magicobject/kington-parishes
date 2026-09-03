// Single source of truth for clergy and church officer cards. Rendered into
// {{PEOPLE:clergy}} / {{PEOPLE:<church-slug>}} tokens by scripts/build.mjs
// (see renderPeopleTokens) — used on Our People and on each church's portal
// page, so adding, removing, or editing someone here updates every page
// that shows them, in one place.

const PERSON_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="#A8813C" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.5 3.5-7 8-7s8 2.5 8 7"/></svg>';
const WARDEN_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="#46596A" stroke-width="1.5"><path d="M5 21V11c0-3.87 3.13-7 7-7s7 3.13 7 7v10"/><path d="M5 21h14"/></svg>';
const SHIELD_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="#A8813C" stroke-width="1.6"><path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4Z"/></svg>';
const CHECK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="#A8813C" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9"/></svg>';
const MUSIC_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="#A8813C" stroke-width="1.6"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

// Serve all five churches across the benefice — shown on Our People and
// (eventually) every church portal page, not just Kington's.
export const CLERGY = [
  {
    name: 'Revd Sally Welch',
    role: 'Vicar',
    bio: 'Leads worship and ministry across all five churches of the benefice.',
    iconSvg: PERSON_ICON,
  },
  {
    name: 'Revd Phillippa Wright',
    role: 'Curate',
    bio: 'Training and serving alongside Sally across the parishes.',
    iconSvg: PERSON_ICON,
  },
];

// Wardens and officers, keyed by church slug (matching the anchors on
// our-churches.html and each church's portal page). Only Kington is
// populated so far — the other four churches' people will be added here
// once we have them, and their portal pages will pick them up automatically.
export const CHURCH_OFFICERS = {
  kington: [
    {
      name: 'Greg Wright',
      role: 'Churchwarden · Interim Treasurer',
      bio: "Churchwarden at St Mary's, Kington, and currently also serving as Interim Treasurer.",
      iconSvg: WARDEN_ICON,
    },
    {
      name: 'Margaret Cooke',
      role: 'Churchwarden',
      bio: "Churchwarden at St Mary's, Kington.",
      iconSvg: WARDEN_ICON,
    },
    {
      name: 'Christine Robinson',
      role: 'Parish Safeguarding Officer · Church Secretary',
      bio: 'Our named contact for any safeguarding concern — see the <a href="safeguarding.html">Safeguarding page</a> for how to get in touch.',
      iconSvg: SHIELD_ICON,
    },
    {
      name: 'Julia Reed',
      role: 'Health &amp; Safety Officer',
      bio: "Keeps St Mary's, Kington safe for worshippers, volunteers and visitors alike.",
      iconSvg: CHECK_ICON,
    },
    {
      name: 'Philip Sell',
      role: 'Director of Music',
      bio: "Director of Music at St Mary's, Kington.",
      iconSvg: MUSIC_ICON,
    },
  ],
};
