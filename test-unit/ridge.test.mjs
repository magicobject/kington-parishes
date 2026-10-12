import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHURCHES } from '../src/churches.config.mjs';
import { JOURNEY, SKETCHES } from '../src/journey.config.mjs';
import { renderRidge, legSamplePoints, haversine, SAMPLES_PER_LEG } from '../scripts/ridge.mjs';

const profile = JSON.parse(readFileSync(new URL('../src/journey-profile.json', import.meta.url), 'utf8'));
const args = { churches: CHURCHES, journey: JOURNEY, profile, sketches: SKETCHES };

test('haversine: Kington to Titley is a plausible few miles', () => {
  const k = CHURCHES.find((c) => c.slug === 'kington'), t = CHURCHES.find((c) => c.slug === 'titley');
  const m = haversine(k, t);
  assert.ok(m > 5000 && m < 9000, `got ${m}`);
});

test('legSamplePoints: stop i lands exactly on index i * SAMPLES_PER_LEG', () => {
  const stops = JOURNEY.map((s) => CHURCHES.find((c) => c.slug === s));
  const pts = legSamplePoints(stops);
  assert.equal(pts.length, (stops.length - 1) * SAMPLES_PER_LEG + 1);
  stops.forEach((c, i) => {
    assert.ok(Math.abs(pts[i * SAMPLES_PER_LEG].lat - c.lat) < 1e-9);
    assert.ok(Math.abs(pts[i * SAMPLES_PER_LEG].lng - c.lng) < 1e-9);
  });
});

test('the committed profile is in step with churches.config.mjs', () => {
  assert.doesNotThrow(() => renderRidge(args));
  assert.equal(profile.points.length, (JOURNEY.length - 1) * SAMPLES_PER_LEG + 1);
});

test('renderRidge: decorative svg with one sketch per church, in journey order', () => {
  const svg = renderRidge(args);
  assert.match(svg, /aria-hidden="true"/);
  assert.match(svg, /class="ridge-watermark ridge-journey"/);
  const files = [...svg.matchAll(/href="\/img\/journey\/([a-z-]+)\.png"/g)].map((m) => m[1]);
  assert.deepEqual(files, JOURNEY);
  const xs = [...svg.matchAll(/<image [^>]*x="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.deepEqual(xs, [...xs].sort((a, b) => a - b));
});

test('renderRidge: refuses a stale profile when a church moves', () => {
  const moved = CHURCHES.map((c) => (c.slug === 'titley' ? { ...c, lat: c.lat + 0.01 } : c));
  assert.throws(() => renderRidge({ ...args, churches: moved }), /npm run journey:profile/);
});
