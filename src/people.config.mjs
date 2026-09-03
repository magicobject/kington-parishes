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
const PEN_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="#A8813C" stroke-width="1.6"><path d="M4 20h4L18 10l-4-4L4 16v4Z"/><path d="M13 7l4 4"/></svg>';
const NEWSPAPER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="#A8813C" stroke-width="1.6"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>';
const BELL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="#A8813C" stroke-width="1.6"><path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 3h16l-2-3Z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>';

// A person's mailto, obfuscated the same way as any other on-page contact
// link (see scripts/build.mjs's obfuscateMailtoLinks) — added to their bio
// as a plain "Get in touch →" link, only when we actually have their email.
function contactLink(email) {
  return email ? ` <a href="{{OBFUSCATE_MAILTO:${email}}}">Get in touch →</a>` : '';
}

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
// our-churches.html and each church's portal page). A person serving two
// roles at the same church (e.g. warden and organist) gets one card with
// both roles joined by " · ", not two near-duplicate cards.
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
      role: 'Director of Music · Parish Administrator',
      bio: "Director of Music at St Mary's, Kington, and Parish Administrator for Kington Parishes." + contactLink('office@kingtonparishes.org.uk'),
      iconSvg: MUSIC_ICON,
    },
    {
      name: 'Revd Paul Roberts',
      role: 'Organist',
      bio: "Organist at St Mary's, Kington." + contactLink('rev.paul.c.roberts@gmail.com'),
      iconSvg: MUSIC_ICON,
    },
    {
      name: 'David Redmayne',
      role: 'Parish News Editor',
      bio: 'Editor of the Kington Parish News, the family magazine for all five churches.' + contactLink('pn.kingtonparishes@gmail.com'),
      iconSvg: NEWSPAPER_ICON,
    },
    {
      name: 'John Clayton',
      role: 'Bell Tower Captain',
      bio: 'Bell Tower Captain at St Mary the Virgin, Kington.',
      iconSvg: BELL_ICON,
    },
  ],
  titley: [
    {
      name: 'Dick Alford',
      role: 'Churchwarden',
      bio: "Churchwarden at St Peter's, Titley." + contactLink('dick.alford@gmail.com'),
      iconSvg: WARDEN_ICON,
    },
    {
      name: 'Hannah Vernon',
      role: 'Secretary',
      bio: "Secretary at St Peter's, Titley.",
      iconSvg: PEN_ICON,
    },
    {
      name: 'Robert Page',
      role: 'Organist',
      bio: "Organist at St Peter's, Titley.",
      iconSvg: MUSIC_ICON,
    },
    {
      name: 'Ruth Jones',
      role: 'Organist',
      bio: "Organist at St Peter's, Titley." + contactLink('lewisjonesruth@yahoo.co.uk'),
      iconSvg: MUSIC_ICON,
    },
    {
      name: 'Ann James',
      role: 'Organist',
      bio: "Organist at St Peter's, Titley.",
      iconSvg: MUSIC_ICON,
    },
  ],
  'old-radnor': [
    {
      name: 'Rosemary Watkins',
      role: 'Churchwarden',
      bio: "Churchwarden at St Stephen's, Old Radnor.",
      iconSvg: WARDEN_ICON,
    },
    {
      name: 'Ruth Jones',
      role: 'Organist',
      bio: "Organist at St Stephen's, Old Radnor." + contactLink('lewisjonesruth@yahoo.co.uk'),
      iconSvg: MUSIC_ICON,
    },
    {
      name: 'Reg Preece',
      role: 'Bell Tower Captain',
      bio: "Bell Tower Captain at St Stephen's, Old Radnor.",
      iconSvg: BELL_ICON,
    },
    {
      name: 'Nicola Cavell',
      role: 'Parish News Editor',
      bio: "Parish News Editor for St Stephen's, Old Radnor." + contactLink('nicola.cavell@gmail.com'),
      iconSvg: NEWSPAPER_ICON,
    },
  ],
  kinnerton: [
    {
      name: 'Ruth Jones',
      role: 'Churchwarden · Organist',
      bio: "Churchwarden and Organist at St Mary's, Kinnerton." + contactLink('lewisjonesruth@yahoo.co.uk'),
      iconSvg: WARDEN_ICON,
    },
    {
      name: 'Sue Thompson',
      role: 'Churchwarden · Secretary',
      bio: "Churchwarden and Secretary at St Mary's, Kinnerton." + contactLink('suesuethompson@outlook.com'),
      iconSvg: WARDEN_ICON,
    },
    {
      name: 'Nicola Cavell',
      role: 'Parish News Editor',
      bio: "Parish News Editor for St Mary's, Kinnerton." + contactLink('nicola.cavell@gmail.com'),
      iconSvg: NEWSPAPER_ICON,
    },
  ],
  huntington: [
    {
      name: 'Fiona Shone',
      role: 'Churchwarden · Organist',
      bio: 'Churchwarden and Organist at St Thomas à Becket, Huntington.' + contactLink('fiona@huntingtoncourt.co.uk'),
      iconSvg: WARDEN_ICON,
    },
    {
      name: 'Peter Kelly',
      role: 'Churchwarden',
      bio: 'Churchwarden at St Thomas à Becket, Huntington.' + contactLink('peterbkelly642@hotmail.com'),
      iconSvg: WARDEN_ICON,
    },
    {
      name: 'Sue Maiden',
      role: 'Secretary',
      bio: 'Secretary at St Thomas à Becket, Huntington.' + contactLink('susan.el.maiden@gmail.com'),
      iconSvg: PEN_ICON,
    },
  ],
};
