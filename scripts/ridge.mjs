// Builds the journey line shown at the foot of every page header (the
// {{PAGE_RIDGE}} token). Pure functions — covered by test-unit/ridge.test.mjs.

const EARTH_RADIUS_M = 6371e3;
const rad = (deg) => (deg * Math.PI) / 180;
export const SAMPLES_PER_LEG = 14;

export function haversine(a, b) {
  const h = Math.sin((rad(b.lat) - rad(a.lat)) / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin((rad(b.lng) - rad(a.lng)) / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// Evenly spaced points along the straight line between consecutive stops,
// each with its distance (m) from the start. Stop i is at index i*SAMPLES_PER_LEG.
export function legSamplePoints(stops) {
  const points = [];
  let travelled = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1], len = haversine(a, b);
    for (let k = i ? 1 : 0; k <= SAMPLES_PER_LEG; k++) {
      const t = k / SAMPLES_PER_LEG;
      points.push({ x: travelled + len * t, lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });
    }
    travelled += len;
  }
  return points;
}

const f = (n) => Number(n.toFixed(1));

// Catmull-Rom through the points, written as cubic Béziers.
export function smoothPath(pts) {
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

export const RIDGE_VIEWBOX = { w: 1200, h: 130 };

// churches: CHURCHES; journey: slugs in order; profile: journey-profile.json;
// sketches: { slug: { w, h } }. Throws if the profile is stale.
export function renderRidge({ churches, journey, profile, sketches }) {
  const stops = journey.map((slug) => {
    const c = churches.find((x) => x.slug === slug);
    if (!c) throw new Error(`journey: no church "${slug}" in src/churches.config.mjs`);
    return c;
  });
  const stale = stops.length !== profile.stops.length
    || stops.some((c, i) => c.slug !== profile.stops[i].slug || c.lat !== profile.stops[i].lat || c.lng !== profile.stops[i].lng);
  if (stale) throw new Error('journey: src/journey-profile.json is out of date with churches.config.mjs / journey.config.mjs — run `npm run journey:profile`');

  const { w: W, h: H } = RIDGE_VIEWBOX;
  const padX = 70, top = 62, base = 118;
  const total = profile.points[profile.points.length - 1].x;
  const els = profile.points.map((p) => p.e);
  const lo = Math.min(...els), hi = Math.max(...els);
  const pts = profile.points.map((p) => [padX + (p.x / total) * (W - 2 * padX), base - ((p.e - lo) / (hi - lo)) * (base - top - 14)]);

  const images = stops.map((c, i) => {
    const [x, y] = pts[i * SAMPLES_PER_LEG];
    const s = sketches[c.slug];
    return `<image href="/img/journey/${c.slug}.png" x="${f(x - s.w / 2)}" y="${f(y - s.h + 1 - (s.lift || 0))}" width="${s.w}" height="${s.h}"/>`;
  }).join('');

  return `<svg class="ridge-watermark ridge-journey" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="${smoothPath(pts)}" fill="none" stroke="#B8A98C" stroke-width="2"/><g class="ridge-sketches">${images}</g></svg>`;
}
