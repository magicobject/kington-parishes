#!/usr/bin/env node
// The after-deploy check of the LIVE site, read-only, no dependencies (Node's own http client).
//   node scripts/check-live.mjs [--base https://www.kingtonparishes.org.uk] [--build 2026.10.14.006|latest]
//        [--wait [--timeout 900]] [--state auto|hidden|launched]
// --wait polls /updates every 15 seconds (--interval, in seconds, changes that) until the build number appears: that is how we
// know Cloudflare has deployed. --state auto reads the Advent flags in src/advent/theme.mjs.
// Every check prints one PASS or FAIL line with the URL and the HTTP status. A check on a page that is not HTTP 200 FAILS, because
// a page that does not load proves nothing about what it contains. Exit code 0 only if every check passes. Console errors need a
// browser and are out of scope: the last line reminds the person to look.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_BASE = 'https://www.kingtonparishes.org.uk';
export const SAMPLE_PAGES = ['/', '/church-kington', '/advent', '/calendar', '/contact', '/our-churches', '/our-people', '/services'];
const SANDBOX = /default-src 'none'[^,]*sandbox|sandbox/;
const SITE_POLICY = /default-src 'self'/;

/** Reads the command line. Times are in seconds. */
export function parseArgs(argv) {
  const options = { base: DEFAULT_BASE, build: 'latest', wait: false, timeout: 900, interval: 15, state: 'auto' };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = () => {
      index += 1;
      if (argv[index] === undefined) throw new Error(`${flag} needs a value`);
      return argv[index];
    };
    if (flag === '--base') options.base = value().replace(/\/+$/, '');
    else if (flag === '--build') options.build = value();
    else if (flag === '--wait') options.wait = true;
    else if (flag === '--timeout') options.timeout = Number(value());
    else if (flag === '--interval') options.interval = Number(value());
    else if (flag === '--state') {
      options.state = value();
      if (!['auto', 'hidden', 'launched'].includes(options.state)) throw new Error('--state must be auto, hidden or launched');
    } else throw new Error(`unknown option ${flag}`);
  }
  return options;
}

/** The paths that public/_headers gives an immutable Cache-Control. */
export function immutablePaths(headersText) {
  const paths = [];
  let current = null;
  for (const line of headersText.split('\n')) {
    if (/^\s*#/.test(line) || line.trim() === '') continue;
    if (!/^\s/.test(line)) current = line.trim();
    else if (current && /^\s*cache-control:.*immutable/i.test(line) && !current.includes('*')) paths.push(current);
  }
  return paths;
}

/** The sha256 source expression of every executable inline script (JSON-LD data blocks, external and empty scripts excluded). */
export function inlineScriptHashes(html) {
  const tag = /<script((?![^>]*\bsrc=)[^>]*)>([\s\S]*?)<\/script>/g;
  return [...html.matchAll(tag)]
    .filter((match) => !/application\/ld\+json/.test(match[1]) && match[2].trim() !== '')
    .map((match) => `sha256-${createHash('sha256').update(match[2]).digest('base64')}`);
}

/** The text a visitor could read: no comments, scripts, styles or tags. */
export function visibleText(html) {
  return html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ');
}

const decode = (text) => text.replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const withoutKnownMentions = (text) => text.replace(/Advent Sunday/gi, ''); // the calendar's one real event with the word in it

/** One GET with the raw headers kept (so a header sent twice shows as two). */
export function get(url) {
  return new Promise((done, fail) => {
    const client = url.startsWith('https:') ? https : http;
    const request = client.get(url, { headers: { 'accept-encoding': 'identity', 'user-agent': 'check-live' } }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const headers = {};
        for (let index = 0; index < response.rawHeaders.length; index += 2) (headers[response.rawHeaders[index].toLowerCase()] ??= []).push(response.rawHeaders[index + 1]);
        done({ status: response.statusCode, headers, body: Buffer.concat(chunks).toString('utf8') });
      });
    });
    request.on('error', fail);
    request.setTimeout(30000, () => request.destroy(new Error('no answer in 30 seconds')));
  });
}

const sleep = (seconds) => new Promise((done) => setTimeout(done, seconds * 1000));
const pass = (text) => ({ ok: true, text });
const fail = (text) => ({ ok: false, text });
const verdict = (ok, text) => (ok ? pass(text) : fail(text));
const nameOf = (path) => (path === '' ? '/' : path);

/** The build number the /updates page calls current ("Current build: 2026.10.14.006"); older changelog entries do not count. */
export function currentBuild(html) {
  return (/Current build:\s*(?:<[^>]*>\s*)*([0-9]{4}\.[0-9]{2}\.[0-9]{2}\.[0-9]{3})/.exec(html) ?? [])[1];
}

/** The current build number from build-number.json, written as 2026.10.14.006. */
export function latestBuild(root = ROOT) {
  const { date, build } = JSON.parse(readFileSync(join(root, 'build-number.json'), 'utf8'));
  return `${date}.${String(build).padStart(3, '0')}`;
}

async function stateFromFlags() {
  const { theme } = await import(pathToFileURL(join(ROOT, 'src/advent/theme.mjs')).href);
  if (theme.goLive && theme.publicListing) return 'launched';
  if (!theme.goLive && !theme.publicListing) return 'hidden';
  throw new Error('the Advent flags in theme.mjs are mixed (goLive and publicListing differ), so the expected state is unclear: pass --state hidden or --state launched');
}

/** Runs every check against `base`; returns the list of { ok, text }. */
export async function runChecks({ base, build, state }) {
  const { content } = await import(pathToFileURL(join(ROOT, 'src/advent/content.mjs')).href);
  const dayCount = content.days.length + (content.bonus ? 1 : 0);
  const launched = state === 'launched';
  const results = [];
  const cache = new Map();
  const fetchPage = (path) => {
    if (!cache.has(path)) cache.set(path, get(base + path));
    return cache.get(path);
  };
  const line = (path, response, text, ok) => results.push(verdict(ok, `${base}${nameOf(path)} (HTTP ${response.status}): ${text}`));
  // A page that is not HTTP 200 proves nothing: it fails here and its content checks are skipped.
  let notRun = 0;
  const needOk = (path, response, skipped = 1) => {
    if (response.status === 200) return true;
    notRun += skipped;
    results.push(fail(`${base}${nameOf(path)} (HTTP ${response.status}): the page did not load, so this check proves nothing`));
    return false;
  };

  // (a) the build
  const updates = await fetchPage('/updates');
  if (needOk('/updates', updates)) {
    const current = currentBuild(updates.body);
    line('/updates', updates, current === build ? `says the current build is ${build}` : `says the current build is ${current ?? 'not found'}, not ${build}`, current === build);
  }

  // (b) every executable inline script's hash is in that response's Content-Security-Policy
  for (const path of SAMPLE_PAGES) {
    const page = await fetchPage(path);
    if (!needOk(path, page)) continue;
    const policy = (page.headers['content-security-policy'] ?? []).join(', ');
    const scriptSrc = (policy.match(/script-src[^;]*/) ?? [''])[0];
    const hashes = inlineScriptHashes(page.body);
    const missing = hashes.filter((hash) => !scriptSrc.includes(hash));
    line(path, page, missing.length === 0 ? `${hashes.length} inline script(s), every sha256 is in the Content-Security-Policy script-src` : `inline script hash not in the Content-Security-Policy script-src: ${missing.join(', ')}`, missing.length === 0);
  }

  // (c) the Advent state
  const sitemap = await fetchPage('/sitemap.xml');
  const searchIndex = await fetchPage('/search-index.json');
  const robots = await fetchPage('/robots.txt');
  const advent = await fetchPage('/advent');
  const home = await fetchPage('/');
  if (needOk('/sitemap.xml', sitemap, 2)) {
    const listed = /<loc>[^<]*\/advent(\.html)?<\/loc>/i.test(sitemap.body);
    const mentions = /advent/i.test(withoutKnownMentions(sitemap.body));
    if (launched) line('/sitemap.xml', sitemap, listed ? 'lists the Advent calendar page' : 'does NOT list the Advent calendar page', listed);
    else line('/sitemap.xml', sitemap, listed || mentions ? 'mentions the Advent calendar, which should be hidden' : 'has no page entry for the Advent calendar', !listed && !mentions);
  }
  if (needOk('/search-index.json', searchIndex, 2)) {
    let entries = [];
    try { entries = JSON.parse(searchIndex.body); } catch { /* reported below */ }
    if (!Array.isArray(entries) || entries.length === 0) line('/search-index.json', searchIndex, 'is not a list of search entries', false);
    else if (launched) {
      const publicEntries = entries.filter((entry) => /^advent(\.html)?$/.test(entry.page) && entry.scope !== 'help');
      line('/search-index.json', searchIndex, `has ${publicEntries.length} public Advent entries (exactly one expected)`, publicEntries.length === 1);
    } else {
      const found = entries.filter((entry) => /advent/i.test(withoutKnownMentions(JSON.stringify(entry))));
      line('/search-index.json', searchIndex, found.length === 0 ? 'has no Advent entry' : `has ${found.length} entry/entries that mention Advent, which should be hidden`, found.length === 0);
    }
  }
  if (needOk('/robots.txt', robots)) line('/robots.txt', robots, /advent/i.test(robots.body) ? 'mentions Advent' : 'does not mention Advent', !/advent/i.test(robots.body));
  if (needOk('/advent', advent, 3)) {
    const noindex = /<meta[^>]*name="robots"[^>]*noindex/i.test(advent.body);
    const goLive = (advent.body.match(/data-go-live="(true|false)"/) ?? [])[1];
    const neutral = advent.body.includes('It runs from 1 to 25 December.');
    const wanted = launched ? 'true' : 'false';
    const ok = goLive === wanted && noindex === !launched && neutral;
    const missingHeaders = ['strict-transport-security', 'x-frame-options', 'referrer-policy'].filter((name) => !advent.headers[name]);
    if (!(advent.headers['x-content-type-options'] ?? []).some((value) => /nosniff/i.test(value))) missingHeaders.push('x-content-type-options: nosniff');
    line('/advent', advent, missingHeaders.length === 0 ? 'has the standard security headers (strict-transport-security, x-frame-options, x-content-type-options, referrer-policy)' : `is missing security headers: ${missingHeaders.join(', ')}`, missingHeaders.length === 0);
    line('/advent', advent, `data-go-live="${goLive}" (expected "${wanted}"), robots ${noindex ? 'noindex' : 'indexable'} (expected ${launched ? 'indexable' : 'noindex'}), ${neutral ? 'has' : 'LACKS'} the date-neutral sentence`, ok);
  }
  if (needOk('/', home, launched ? 1 : 2) && !launched) {
    const text = withoutKnownMentions(visibleText(home.body));
    line('/', home, /advent/i.test(text) ? 'the home page shows Advent text: the banner is visible' : 'the home page shows no Advent banner text', !/advent/i.test(text));
  }

  // (d) no day title or opening paragraph where it must not be
  const days = [...content.days, ...(content.bonus ? [content.bonus] : [])];
  const needles = [...new Set(days.flatMap((day) => [day.title, ...day.paragraphs.map((paragraph) => paragraph.trim().slice(0, 40))]))].filter((needle) => needle.length >= 12);
  for (const path of ['/sitemap.xml', '/search-index.json', '/advent', '/']) {
    const page = await fetchPage(path);
    if (page.status !== 200) continue; // already reported as a failure above
    const text = decode(page.body);
    const leaks = needles.filter((needle) => text.includes(needle));
    line(path, page, leaks.length === 0 ? 'no Advent day title or text' : `LEAK of Advent day text: ${leaks.slice(0, 3).join(' | ')}`, leaks.length === 0);
  }

  // (e) headers
  for (const path of immutablePaths(readFileSync(join(ROOT, 'public/_headers'), 'utf8'))) {
    const response = await fetchPage(path);
    if (needOk(path, response)) {
      const values = response.headers['cache-control'] ?? [];
      line(path, response, values.length === 1 && /immutable/.test(values[0]) ? 'exactly one Cache-Control, immutable' : `expected exactly one immutable Cache-Control, found ${values.length}: ${values.join(' | ')}`, values.length === 1 && /immutable/.test(values[0]));
    }
    const neighbour = path.replace(/(\.\w+)$/, '-nothing$1');
    const other = await fetchPage(neighbour);
    const cached = (other.headers['cache-control'] ?? []).some((value) => /immutable/.test(value));
    line(neighbour, other, other.status === 404 && !cached ? 'a made-up neighbour path is 404 and not cached' : `a made-up neighbour path should be 404 without an immutable cache (status ${other.status}, immutable ${cached})`, other.status === 404 && !cached);
  }
  const day3 = await fetchPage('/advent/day-03.json');
  if (needOk('/advent/day-03.json', day3)) {
    const robotsHeader = (day3.headers['x-robots-tag'] ?? []).join(', ');
    const cacheHeader = (day3.headers['cache-control'] ?? []).join(', ');
    line('/advent/day-03.json', day3, /must-revalidate/.test(cacheHeader) ? 'Cache-Control must-revalidate' : `Cache-Control should say must-revalidate, it says "${cacheHeader}"`, /must-revalidate/.test(cacheHeader));
    line('/advent/day-03.json', day3, /noindex/.test(robotsHeader) ? 'x-robots-tag noindex' : `x-robots-tag should say noindex, it says "${robotsHeader}"`, /noindex/.test(robotsHeader));
  }
  for (const path of ['/advent/art/day-01.svg', '/advent/scene.svg']) {
    const picture = await fetchPage(path);
    if (!needOk(path, picture)) continue;
    const policies = picture.headers['content-security-policy'] ?? [];
    const joined = policies.join(', ');
    const both = SITE_POLICY.test(joined) && SANDBOX.test(joined);
    const how = policies.length >= 2 ? 'two separate Content-Security-Policy headers' : 'one joined Content-Security-Policy header';
    line(path, picture, both ? `${how}: the site policy and the sandbox policy` : 'the sandbox Content-Security-Policy is missing (picture policy must include sandbox)', both);
  }

  // An ordinary unknown page must be a real 404 that still carries the site's Content-Security-Policy.
  const unknown = await fetchPage('/this-page-does-not-exist-check-live');
  const unknownPolicy = (unknown.headers['content-security-policy'] ?? []).join(', ');
  const unknownOk = unknown.status === 404 && SITE_POLICY.test(unknownPolicy);
  line('/this-page-does-not-exist-check-live', unknown, unknownOk ? 'an unknown page is a 404 with the site Content-Security-Policy' : `an unknown page should be a 404 with the site Content-Security-Policy (status ${unknown.status}, policy ${unknownPolicy ? 'present' : 'missing'}: Content-Security-Policy)`, unknownOk);

  // (f) the day files and the pictures all exist
  const range = Array.from({ length: dayCount }, (_, index) => String(index + 1).padStart(2, '0'));
  for (const [label, makePath] of [['day files', (n) => `/advent/day-${n}.json`], ['art files', (n) => `/advent/art/day-${n}.svg`]]) {
    const statuses = await Promise.all(range.map(async (n) => [n, (await fetchPage(makePath(n))).status]));
    const bad = statuses.filter(([, status]) => status !== 200);
    results.push(verdict(bad.length === 0, `${base}${makePath('NN')} (HTTP 200 expected): ${statuses.length - bad.length} of ${dayCount} ${label} return 200${bad.length ? `; missing: ${bad.map(([n, status]) => `day-${n} (HTTP ${status})`).join(', ')}` : ''}`));
  }

  results.notRun = notRun;
  return results;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const build = options.build === 'latest' ? latestBuild() : options.build;
  const state = options.state === 'auto' ? await stateFromFlags() : options.state;
  console.log(`Checking ${options.base} for build ${build}, expecting the Advent calendar to be ${state}.`);
  if (options.wait) {
    const deadline = Date.now() + options.timeout * 1000;
    for (;;) {
      let seen = false;
      try { seen = currentBuild((await get(`${options.base}/updates`)).body) === build; } catch { /* keep trying */ }
      if (seen) break;
      if (Date.now() >= deadline) {
        console.log(`FAIL ${options.base}/updates: timed out after ${options.timeout} s waiting for build ${build} to appear`);
        process.exitCode = 1;
        return;
      }
      console.log(`waiting for build ${build} to appear on ${options.base}/updates ...`);
      await sleep(options.interval);
    }
  }
  const results = await runChecks({ base: options.base, build, state });
  for (const result of results) console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.text}`);
  const failed = results.filter((result) => !result.ok).length;
  console.log(`${results.length} checks, ${failed} failed${results.notRun ? `; ${results.notRun} more check${results.notRun === 1 ? '' : 's'} did not run because their page did not load` : ''}.`);
  console.log('NOT CHECKED HERE (needs a browser): open /, /advent and /advent?advent-preview=2026-12-07 and confirm the console shows no errors and no Content-Security-Policy violations (Cloudflare can inject its own scripts).');
  process.exitCode = failed ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`check-live stopped: ${error.message}`);
    process.exitCode = 1;
  });
}
