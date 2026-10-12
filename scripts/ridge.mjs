// Builds the journey line on the home page (the {{JOURNEY_NAV}} token). Pure functions — covered by test-unit/ridge.test.mjs.

const EARTH_RADIUS_M = 6371e3;
const rad = (deg) => (deg * Math.PI) / 180;
export const SAMPLE_SPACING_M = 150;

export function haversine(a, b) {
  const h = Math.sin((rad(b.lat) - rad(a.lat)) / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin((rad(b.lng) - rad(a.lng)) / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// Points about SAMPLE_SPACING_M apart along the straight line between
// consecutive stops, each with its distance (m) from the start, plus the
// index each stop lands on.
export function legSamplePoints(stops) {
  const points = [];
  const stopIndexes = [0];
  let travelled = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1], len = haversine(a, b);
    const n = Math.max(2, Math.round(len / SAMPLE_SPACING_M));
    for (let k = i ? 1 : 0; k <= n; k++) {
      const t = k / n;
      points.push({ x: travelled + len * t, lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });
    }
    stopIndexes.push(points.length - 1);
    travelled += len;
  }
  return { points, stopIndexes };
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

export const RIDGE_VIEWBOX = { w: 1200, h: 240 };

// Ground higher than the tallest church is squashed to a quarter of its
// excess, so a ridge the journey happens to cross never dwarfs the churches
// themselves (Old Radnor and Kinnerton each stand on their own hill).
export const RIDGE_COMPRESSION = 0.25;

export function compressHeights(heights, ceiling, factor = RIDGE_COMPRESSION) {
  return heights.map((h) => (h > ceiling ? ceiling + (h - ceiling) * factor : h));
}

// Light 3-point smoothing so the 25 m DEM's noise doesn't make the line
// jittery; the stops themselves keep their exact heights.
export function smoothHeights(heights, fixed) {
  return heights.map((h, i) => (fixed.has(i) || i === 0 || i === heights.length - 1 ? h : (heights[i - 1] + 2 * h + heights[i + 1]) / 4));
}

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The home page's journey nav: the elevation line with each church's sketch
// and name on it, every one a link to that church's section on Our Churches.
// churches: CHURCHES; journey: slugs in order; profile: journey-profile.json;
// sketches: { slug: { w, h, lift? } }. Throws if the profile is stale.
export function renderJourneyNav({ churches, journey, profile, sketches, scale = 1.25 }) {
  const stops = journey.map((slug) => {
    const c = churches.find((x) => x.slug === slug);
    if (!c) throw new Error(`journey: no church "${slug}" in src/churches.config.mjs`);
    return c;
  });
  const stale = stops.length !== profile.stops.length
    || stops.some((c, i) => c.slug !== profile.stops[i].slug || c.lat !== profile.stops[i].lat || c.lng !== profile.stops[i].lng);
  if (stale) throw new Error('journey: src/journey-profile.json is out of date with churches.config.mjs / journey.config.mjs — run `npm run journey:profile`');

  const { w: W, h: H } = RIDGE_VIEWBOX;
  const padX = 80, base = H - 14, range = 82;
  const total = profile.points[profile.points.length - 1][0];
  const stopIdx = new Set(profile.stops.map((s) => s.index));
  const ceiling = Math.max(...profile.stops.map((s) => profile.points[s.index][1]));
  const heights = smoothHeights(compressHeights(profile.points.map((p) => p[1]), ceiling), stopIdx);
  const lo = Math.min(...heights), hi = Math.max(...heights);
  const pts = profile.points.map((p, i) => [padX + (p[0] / total) * (W - 2 * padX), base - ((heights[i] - lo) / (hi - lo)) * range]);

  // Every name sits on one row, level with the highest church's (Kington's);
  // a dashed leader joins each name down to its sketch where they've parted.
  const placed = stops.map((c, i) => {
    const [x, y] = pts[profile.stops[i].index];
    const s = sketches[c.slug];
    const w = s.w * scale, h = s.h * scale;
    return { c, x, y, w, h, top: y - h + 1 - (s.lift || 0) * scale };
  });
  const labelY = Math.min(...placed.map((p) => p.top)) - 8;
  const minY = labelY - 16;
  const links = placed.map(({ c, x, y, w, h, top }) => {
    const leader = top - labelY > 14 ? `<line class="ridge-leader" x1="${f(x)}" y1="${f(labelY + 6)}" x2="${f(x)}" y2="${f(top - 3)}"/>` : '';
    return `<a href="our-churches.html#${c.slug}"><rect class="ridge-hit" x="${f(x - Math.max(w, 90) / 2)}" y="${f(labelY - 16)}" width="${f(Math.max(w, 90))}" height="${f(y - labelY + 20)}" rx="6"/>${leader}<image href="/img/journey/${c.slug}.png" x="${f(x - w / 2)}" y="${f(top)}" width="${f(w)}" height="${f(h)}"/><text x="${f(x)}" y="${f(labelY)}" text-anchor="middle" class="ridge-label">${esc(c.locality)}</text></a>`;
  }).join('');

  // Crop the empty headroom above the highest label so the hero doesn't waste screen space.
  const vy = Math.max(0, Math.floor(minY) - 4);
  return `<svg viewBox="0 ${vy} ${W} ${H - vy}" xmlns="http://www.w3.org/2000/svg"><path d="${smoothPath(pts)}" fill="none" stroke="#B8A98C" stroke-width="2" stroke-linecap="round" aria-hidden="true"/>${links}</svg>`;
}
