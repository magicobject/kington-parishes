// The "journey" line along the bottom of every page header: a schematic
// elevation profile of the ride between the five churches, with each
// church's own sketch standing on it. Locations come from churches.config.mjs;
// this file only holds the order of the journey and the sketches.
//
//   - JOURNEY: the order the line visits the churches.
//   - SKETCHES: one cream-on-transparent PNG per church in public/img/journey/,
//     cut out of public/img/five-churches.gif (the hand-drawn sketch on the
//     Our Churches page). w/h are the size the sketch is drawn at, in the
//     SVG's own units; the PNGs are stored at 2x that for sharp screens.
//     Sizes are deliberately relative (Kington's spire towers over the rest,
//     as it does in the drawing). `lift` (optional) raises a sketch above its
//     point so the line doesn't cut through the building where it rises
//     alongside it.
//   - The ground heights live in journey-profile.json, sampled from real
//     elevation data by `npm run journey:profile` (needs the network, so it
//     isn't part of the build). Re-run it if a church's lat/lng changes —
//     the build refuses to run on a stale profile.

export const JOURNEY = ['kington', 'huntington', 'old-radnor', 'kinnerton', 'titley'];

export const SKETCHES = {
  kington: { w: 133, h: 89.5, lift: 5 },
  huntington: { w: 70, h: 49.5 },
  'old-radnor': { w: 84.5, h: 44, lift: 6 },
  kinnerton: { w: 72, h: 45.5 },
  titley: { w: 106, h: 43, lift: 16 },
};
