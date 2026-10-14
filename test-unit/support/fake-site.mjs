// A fixture "live site" for the unit tests of scripts/check-live.mjs: a local node http server that answers like the
// production site does (clean URLs, per-path headers) so no test ever touches the network. `options` switch on the
// good state, the hidden or launched Advent state and one deliberate fault at a time.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { content } from '../../src/advent/content.mjs';

export const PAGES = ['/', '/church-kington', '/advent', '/calendar', '/contact', '/our-churches', '/our-people', '/services'];
const SCRIPT = 'window.fixture = 1;';
const HASH = `sha256-${createHash('sha256').update(SCRIPT).digest('base64')}`;
const SITE_CSP = (hash) => `default-src 'self'; script-src 'self' '${hash}'; style-src 'self'`;
const SANDBOX_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

/** The paths public/_headers gives an immutable Cache-Control (read with a plain regular expression, apart from the script under test). */
export function immutablePathsInHeadersFile() {
  const text = readFileSync(new URL('../../public/_headers', import.meta.url), 'utf8');
  return [...text.matchAll(/^(\/\S+)\n\s+Cache-Control:[^\n]*immutable/gm)].map((match) => match[1]);
}

const days = content.days.length + (content.bonus ? 1 : 0);
const two = (n) => String(n).padStart(2, '0');
const firstTitle = content.days[0].title;

/**
 * Starts the fixture. options: build, state ('hidden'|'launched'), fault (one of: missingPage, badHash, leak, doubleCache,
 * neighbourCached, missingArt, noSandbox, joinedCsp, noRobotsHeader, bannerText, advertListing, staleBuild, noHsts, unknown200, plain404, dayCached).
 * Returns { base, close, hits }.
 */
export async function startFakeSite({ build = '2026.10.14.006', state = 'hidden', fault = null } = {}) {
  const immutable = new Set(immutablePathsInHeadersFile());
  const launched = state === 'launched';
  const hits = [];
  const server = createServer((req, res) => {
    const path = req.url.split('?')[0];
    hits.push(path);
    const send = (status, type, body, headers = {}) => {
      res.statusCode = status;
      res.setHeader('content-type', type);
      for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
      res.end(body);
    };
    if (immutable.has(path)) {
      const cache = fault === 'doubleCache' ? ['public, max-age=31536000, immutable', 'public, max-age=0'] : 'public, max-age=31536000, immutable';
      return send(200, 'text/plain', '// built file', { 'cache-control': cache });
    }
    if (path === '/updates') return send(200, 'text/html', `<p>Current build: ${fault === 'staleBuild' ? '2026.10.14.005' : build}</p><ul><li>2026.10.13.001</li><li>2026.10.14.005</li></ul>`);
    if (path === '/sitemap.xml') {
      const advert = launched || fault === 'advertListing' ? '<url><loc>https://x/advent.html</loc></url>' : '';
      return send(200, 'application/xml', `<urlset><url><loc>https://x/index.html</loc></url><url><loc>https://x/calendar.html</loc></url>${advert}</urlset>`);
    }
    if (path === '/search-index.json') {
      const entries = [{ page: 'index.html', heading: 'Home', text: 'Welcome' }, { page: 'calendar.html', heading: 'Calendar', text: 'Advent Sunday: combined benefice service' }];
      if (launched) entries.push({ page: 'advent.html', heading: 'Advent calendar', text: 'Open a door' }, { page: 'help-advent.html', scope: 'help', heading: 'Advent help', text: 'help' });
      if (fault === 'leak') entries.push({ page: 'index.html', heading: 'Leak', text: `see ${firstTitle}` });
      return send(200, 'application/json', JSON.stringify(entries));
    }
    if (path === '/robots.txt') return send(200, 'text/plain', 'User-agent: *\nAllow: /\n');
    const dayMatch = /^\/advent\/day-(\d\d)\.json$/.exec(path);
    if (dayMatch && Number(dayMatch[1]) >= 1 && Number(dayMatch[1]) <= days) {
      return send(200, 'application/json', '{}', { 'x-robots-tag': fault === 'noRobotsHeader' ? 'all' : 'noindex', 'cache-control': fault === 'dayCached' ? 'public, max-age=3600' : 'public, max-age=0, must-revalidate' });
    }
    const artMatch = /^\/advent\/art\/day-(\d\d)\.svg$/.exec(path);
    if ((artMatch && Number(artMatch[1]) >= 1 && Number(artMatch[1]) <= days && !(fault === 'missingArt' && artMatch[1] === '05')) || path === '/advent/scene.svg') {
      let csp = [SITE_CSP(HASH), SANDBOX_CSP];
      if (fault === 'joinedCsp') csp = `${SITE_CSP(HASH)}, ${SANDBOX_CSP}`;
      if (fault === 'noSandbox') csp = SITE_CSP(HASH);
      return send(200, 'image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg"/>', { 'content-security-policy': csp });
    }
    if (PAGES.includes(path) && !(fault === 'missingPage' && path === '/contact')) {
      const hash = fault === 'badHash' && path === '/services' ? 'sha256-AAAA' : HASH;
      let body = `<title>${path}</title><script type="application/ld+json">{"a":"var x=1"}</script><script>${SCRIPT}</script><script src="/js/a.js"></script><p>Welcome</p>`;
      if (path === '/advent') {
        body += `<meta name="robots" content="${launched ? 'index, follow' : 'noindex, nofollow'}"><section data-go-live="${launched}"><p>The Advent calendar needs JavaScript to open its doors. It runs from 1 to 25 December.</p></section>`;
        if (fault === 'leak') body += `<p>${firstTitle}</p>`;
      }
      if (path === '/') body += '<div data-advent-teaser hidden></div>' + (fault === 'bannerText' ? '<h2>Advent calendar</h2>' : '') + '<p>Join us for Advent Sunday</p>';
      const secure = { 'content-security-policy': SITE_CSP(hash), 'strict-transport-security': 'max-age=31536000', 'x-frame-options': 'DENY', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' };
      if (fault === 'noHsts' && path === '/advent') delete secure['strict-transport-security'];
      return send(200, 'text/html', body, secure);
    }
    if (fault === 'neighbourCached' && /-nothing\.\w+$/.test(path)) return send(404, 'text/html', 'not found', { 'cache-control': 'public, max-age=31536000, immutable' });
    if (fault === 'unknown200' && path.startsWith('/this-page-does-not-exist')) return send(200, 'text/html', 'empty');
    return send(404, 'text/html', 'not found', fault === 'plain404' ? {} : { 'content-security-policy': SITE_CSP(HASH) });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { base: `http://127.0.0.1:${server.address().port}`, hits, close: () => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }) };
}
