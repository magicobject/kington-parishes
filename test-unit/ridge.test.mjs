import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHURCHES } from '../src/churches.config.mjs';
import { JOURNEY, SKETCHES } from '../src/journey.config.mjs';
import { renderJourneyNav, legSamplePoints, haversine, compressHeights, smoothHeights } from '../scripts/ridge.mjs';

const profile = JSON.parse(readFileSync(new URL('../src/journey-profile.json', import.meta.url), 'utf8'));
const args = { churches: CHURCHES, journey: JOURNEY, profile, sketches: SKETCHES };

test('haversine: Kington to Titley is a plausible few miles', () => {
  const k = CHURCHES.find((c) => c.slug === 'kington'), t = CHURCHES.find((c) => c.slug === 'titley');
  const m = haversine(k, t);
  assert.ok(m > 5000 && m < 9000, `got ${m}`);
});

test('legSamplePoints: ~150 m spacing, and each stop lands on its recorded index', () => {
  const stops = JOURNEY.map((s) => CHURCHES.find((c) => c.slug === s));
  const { points, stopIndexes } = legSamplePoints(stops);
  stops.forEach((c, i) => {
    assert.ok(Math.abs(points[stopIndexes[i]].lat - c.lat) < 1e-9);
    assert.ok(Math.abs(points[stopIndexes[i]].lng - c.lng) < 1e-9);
  });
  for (let i = 1; i < points.length; i++) {
    const gap = points[i].x - points[i - 1].x;
    assert.ok(gap > 80 && gap < 250, `gap ${gap}`);
  }
});

test('compressHeights squashes only what is above the ceiling', () => {
  assert.deepEqual(compressHeights([100, 250, 400], 250, 0.25), [100, 250, 287.5]);
});

test('smoothHeights leaves the ends and fixed points alone', () => {
  assert.deepEqual(smoothHeights([0, 40, 0, 40, 0], new Set([1])), [0, 40, 20, 20, 0]);
});

test('the committed profile is in step with churches.config.mjs', () => {
  assert.doesNotThrow(() => renderJourneyNav(args));
  assert.equal(profile.stops.length, JOURNEY.length);
  profile.stops.forEach((s, i) => assert.ok(s.index > (i ? profile.stops[i - 1].index : -1)));
});

test('renderJourneyNav: one labelled link per church, in journey order, each to its Our Churches section', () => {
  const svg = renderJourneyNav(args);
  const hrefs = [...svg.matchAll(/<a href="\/our-churches#([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(hrefs, JOURNEY);
  const labels = [...svg.matchAll(/class="ridge-label">([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(labels, JOURNEY.map((s) => CHURCHES.find((c) => c.slug === s).locality));
  const files = [...svg.matchAll(/href="\/img\/journey\/([a-z-]+)\.png"/g)].map((m) => m[1]);
  assert.deepEqual(files, JOURNEY);
  const xs = [...svg.matchAll(/<image [^>]*x="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.deepEqual(xs, [...xs].sort((a, b) => a - b));
});

test('renderJourneyNav: refuses a stale profile when a church moves', () => {
  const moved = CHURCHES.map((c) => (c.slug === 'titley' ? { ...c, lat: c.lat + 0.01 } : c));
  assert.throws(() => renderJourneyNav({ ...args, churches: moved }), /npm run journey:profile/);
});
