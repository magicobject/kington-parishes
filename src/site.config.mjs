// Single source of truth for contact details and facts repeated across the
// site — the header's donate button, the footer, and several content
// pages. Edit a value here to update it everywhere at once; scripts/build.mjs
// replaces every {{TOKEN}} (e.g. {{EMAIL}}, {{DONATE_URL}}) with the matching
// value below, in templates and in src/pages/*.html content alike.

export const SITE = {
  orgName: 'Kington Parishes',
  charityNumber: '1185453',

  email: 'vicar@kingtonparishes.org.uk',
  // Sally's (the vicar's) mobile — the old 01544 landline no longer exists.
  phoneDisplay: '07974 439630',
  phoneTel: '+447974439630',

  venue: 'The Vicarage',
  street: 'Church Road',
  town: 'Kington',
  county: 'Herefordshire',
  postcode: 'HR5 3AG',

  // Points at our own church-picker page, not a single church's Parish
  // Giving Scheme link — donating should never default to one church over
  // the other four. See src/pages/donate.html for the actual PGS links.
  donateUrl: 'donate.html',

  bookingName: 'Penny Halcrow',
  bookingEmail: 'p.s.halcrow@gmail.com',

  mediawrightHref: 'https://mediawright.uk',
  mediawrightLabel: 'mediawright.uk',
};
