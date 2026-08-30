// Single source of truth for contact details and facts repeated across the
// site — the header's donate button, the footer, and several content
// pages. Edit a value here to update it everywhere at once; scripts/build.mjs
// replaces every {{TOKEN}} (e.g. {{EMAIL}}, {{DONATE_URL}}) with the matching
// value below, in templates and in src/pages/*.html content alike.

export const SITE = {
  orgName: 'Kington Parishes',
  charityNumber: '1185453',

  email: 'vicar@kingtonparishes.org.uk',
  phoneDisplay: '01544 230525',
  phoneTel: '+441544230525',

  venue: 'The Vicarage',
  street: 'Church Road',
  town: 'Kington',
  county: 'Herefordshire',
  postcode: 'HR5 3AG',

  donateUrl: 'https://www.parishgiving.org.uk/donate',

  bookingName: 'Penny Halcrow',
  bookingEmail: 'p.s.halcrow@gmail.com',

  mediawrightHref: 'https://mediawright.uk',
  mediawrightLabel: 'mediawright.uk',
};
