// Single source of truth for each church's location — name, locality,
// coordinates and what3words address. scripts/build.mjs generates every map
// and every piece of structured data that needs them from this list:
//   - the our-churches JSON-LD `@graph` (src/pages.config.mjs)
//   - the homepage's five-pin map ({{CHURCHES_MAP}} on index.html, read by
//     public/js/churches-map.js)
//   - each portal page's single-pin map ({{CHURCH_MAP:<slug>}} on
//     church-<slug>.html, read by public/js/church-map.js)
//   - calendar Event locations (placeFor in src/events.config.mjs)
// Moving a pin means editing `lat`/`lng` here, once.
//
// `lat`/`lng` were read off each church's what3words location by a human —
// see CLAUDE.md on why Claude can't resolve what3words to coordinates itself.

export const CHURCHES = [
  {
    slug: 'kington',
    name: 'St Mary the Virgin, Kington',
    locality: 'Kington',
    lat: 52.2045407,
    lng: -3.0384017,
    what3words: 'gripes.remark.dimension',
    sameAs: [
      'https://en.wikipedia.org/wiki/Church_of_St_Mary,_Kington',
      'https://historicengland.org.uk/listing/the-list/list-entry/1208031',
    ],
  },
  {
    slug: 'titley',
    name: "St Peter's, Titley",
    locality: 'Titley',
    lat: 52.2357368,
    lng: -2.9806390,
    what3words: 'wooden.hence.thankful',
    sameAs: [
      'https://en.wikipedia.org/wiki/Titley_Priory',
      'https://historicengland.org.uk/listing/the-list/list-entry/1081465',
    ],
  },
  {
    slug: 'old-radnor',
    name: "St Stephen's, Old Radnor",
    locality: 'Old Radnor',
    lat: 52.2249297,
    lng: -3.0996140,
    what3words: 'tolerable.shifting.roosters',
    sameAs: [
      'https://en.wikipedia.org/wiki/St_Stephen%27s_Church,_Old_Radnor',
      'https://coflein.gov.uk/en/site/306985',
    ],
  },
  {
    slug: 'kinnerton',
    name: "St Mary's, Kinnerton",
    locality: 'Kinnerton',
    lat: 52.2612662,
    lng: -3.1088144,
    what3words: 'active.seducing.revolting',
  },
  {
    slug: 'huntington',
    name: 'St Thomas à Becket, Huntington',
    locality: 'Huntington',
    lat: 52.1735393,
    lng: -3.0989438,
    what3words: 'handicaps.messy.ranted',
    sameAs: ['https://historicengland.org.uk/listing/the-list/list-entry/1349556'],
  },
];
