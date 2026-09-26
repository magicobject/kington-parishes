import { test, expect } from './support/fixtures';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Each church's lat/lng lives once, in src/churches.config.mjs, and
// scripts/build.mjs generates it into three places:
//   1. the our-churches JSON-LD `geo`
//   2. the homepage's five-pin map (#churches-map's data-churches attribute,
//      read by public/js/churches-map.js)
//   3. each church-<slug>.html portal page's #church-map data-lat/data-lng
// These specs read all three back out of the built pages and cross-check
// them, per church — a regression net in case one of them ever stops being
// generated from that shared source.

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

// Pulls { name -> {lat, lng} } out of the homepage map's data-churches
// attribute, as generated into the built public/index.html.
function parseHomepageMapPins(): Record<string, { lat: number; lng: number }> {
  const html = readFile('public/index.html');
  const match = html.match(/<div id="churches-map"[^>]*data-churches="([^"]*)"/);
  if (!match) throw new Error('no data-churches attribute on #churches-map in public/index.html');
  const json = match[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const out: Record<string, { lat: number; lng: number }> = {};
  for (const pin of JSON.parse(json)) out[pin.name] = { lat: pin.lat, lng: pin.lng };
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
  const mapJs = parseHomepageMapPins();
  const jsonLdGeo = parseOurChurchesGeo();

  for (const church of CHURCHES) {
    test(`${church.name}: the homepage map, the our-churches JSON-LD, and the ${church.portal} portal map all agree`, async ({ page }) => {
      const fromMapJs = mapJs[church.name];
      expect(fromMapJs, `${church.name} missing from the homepage map's data-churches`).toBeTruthy();

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

test.describe('the maps actually render their generated pins', () => {
  test('the homepage map shows one marker per church', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#churches-map .leaflet-marker-icon')).toHaveCount(CHURCHES.length);
  });

  for (const church of CHURCHES) {
    test(`${church.portal} shows a single marker for ${church.name}`, async ({ page }) => {
      await page.goto(`/${church.portal}`);
      await expect(page.locator('#church-map .leaflet-marker-icon')).toHaveCount(1);
      await expect(page.locator('#church-map .leaflet-popup-content')).toHaveText(church.name);
    });
  }
});
