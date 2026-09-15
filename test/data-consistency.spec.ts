import { test, expect } from './support/fixtures';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// CLAUDE.md's "Data kept in sync by hand" flags each church's lat/lng as
// duplicated in four separate places, none generated from the others:
//   1. src/pages.config.mjs's our-churches JSON-LD `geo` (the notional
//      source of truth, per that same note)
//   2. public/js/churches-map.js — the homepage's five-pin Leaflet map
//   3. each church-<slug>.html portal page's #church-map data-lat/data-lng
// Nothing currently catches one of these silently drifting from the others
// when a pin moves — these specs read all three from the actual built/public
// files and cross-check them, per church.

const CHURCHES = [
  { name: "St Mary the Virgin, Kington", locality: 'Kington', portal: 'church-kington.html' },
  { name: "St Peter's, Titley", locality: 'Titley', portal: 'church-titley.html' },
  { name: "St Stephen's, Old Radnor", locality: 'Old Radnor', portal: 'church-old-radnor.html' },
  { name: "St Mary's, Kinnerton", locality: 'Kinnerton', portal: 'church-kinnerton.html' },
  { name: 'St Thomas à Becket, Huntington', locality: 'Huntington', portal: 'church-huntington.html' },
];

function readFile(relPath: string): string {
  return readFileSync(join(__dirname, '..', relPath), 'utf8');
}

// Pulls { name -> {lat, lng} } out of public/js/churches-map.js's `churches`
// array literal — parsed as data (a small regex over known-shape JS), not
// executed, since this file is a plain classic script with no module exports.
function parseChurchesMapJs(): Record<string, { lat: number; lng: number }> {
  const js = readFile('public/js/churches-map.js');
  const out: Record<string, { lat: number; lng: number }> = {};
  // churches-map.js quotes a name with an apostrophe ("St Mary's, Kinnerton")
  // in double quotes and a name with no apostrophe ('St Thomas à Becket, ...')
  // in single quotes — match either, rather than excluding both quote
  // characters from the name (which would stop at the internal apostrophe).
  const entryRe = /name:\s*(?:"([^"]+)"|'([^']+)'),\s*lat:\s*(-?[\d.]+),\s*lng:\s*(-?[\d.]+)/g;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(js))) {
    out[m[1] ?? m[2]] = { lat: Number(m[3]), lng: Number(m[4]) };
  }
  return out;
}

// Pulls { addressLocality -> {lat, lng} } out of the our-churches JSON-LD
// `@graph` embedded in the built public/our-churches.html.
function parseOurChurchesGeo(): Record<string, { lat: number; lng: number }> {
  const html = readFile('public/our-churches.html');
  const match = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
  if (!match) throw new Error('no structured data script found on public/our-churches.html');
  const data = JSON.parse(match[1]);
  const graph = Array.isArray(data) ? data : data['@graph'] ?? [data];
  const out: Record<string, { lat: number; lng: number }> = {};
  for (const node of graph) {
    if (node['@type'] === 'Church' && node.geo) {
      out[node.address.addressLocality] = { lat: node.geo.latitude, lng: node.geo.longitude };
    }
  }
  return out;
}

test.describe('each church\'s coordinates agree across every place they\'re duplicated', () => {
  const mapJs = parseChurchesMapJs();
  const jsonLdGeo = parseOurChurchesGeo();

  for (const church of CHURCHES) {
    test(`${church.name}: churches-map.js, the our-churches JSON-LD, and the ${church.portal} portal map all agree`, async ({ page }) => {
      const fromMapJs = mapJs[church.name];
      expect(fromMapJs, `${church.name} missing from public/js/churches-map.js`).toBeTruthy();

      const fromJsonLd = jsonLdGeo[church.locality];
      expect(fromJsonLd, `${church.locality} missing from our-churches.html JSON-LD`).toBeTruthy();

      await page.goto(`/${church.portal}`);
      const mapDiv = page.locator('#church-map');
      const portalLat = Number(await mapDiv.getAttribute('data-lat'));
      const portalLng = Number(await mapDiv.getAttribute('data-lng'));

      expect(portalLat).toBeCloseTo(fromMapJs.lat, 5);
      expect(portalLng).toBeCloseTo(fromMapJs.lng, 5);
      expect(portalLat).toBeCloseTo(fromJsonLd.lat, 5);
      expect(portalLng).toBeCloseTo(fromJsonLd.lng, 5);
    });
  }
});
