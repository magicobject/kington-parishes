// scripts/check-live.mjs: the after-deploy check of the live site. Every test here runs against a local fixture server
// (test-unit/support/fake-site.mjs): no test touches the network.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs, immutablePaths, inlineScriptHashes, visibleText } from '../scripts/check-live.mjs';
import { startFakeSite } from './support/fake-site.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/check-live.mjs', import.meta.url));
const run = (args) => new Promise((resolve) => {
  execFile(process.execPath, [SCRIPT, ...args], (error, stdout, stderr) => resolve({ code: error ? error.code : 0, out: stdout + stderr }));
});
const lines = (out) => out.split('\n');
const failing = (out) => lines(out).filter((line) => line.startsWith('FAIL'));

async function check(options = {}, args = []) {
  const site = await startFakeSite(options);
  try {
    return { site, ...(await run(['--base', site.base, '--build', options.build ?? '2026.10.14.006', '--state', options.state ?? 'hidden', ...args])) };
  } finally {
    await site.close();
  }
}

describe('the pure helpers', () => {
  test('parseArgs reads the documented options and rejects unknown ones', () => {
    assert.deepEqual(parseArgs([]), { base: 'https://www.kingtonparishes.org.uk', build: 'latest', wait: false, timeout: 900, interval: 15, state: 'auto' });
    const given = parseArgs(['--base', 'http://x/', '--build', '1.2.3.004', '--wait', '--timeout', '60', '--state', 'launched']);
    assert.deepEqual(given, { base: 'http://x', build: '1.2.3.004', wait: true, timeout: 60, interval: 15, state: 'launched' });
    assert.throws(() => parseArgs(['--nonsense']), /unknown option/);
    assert.throws(() => parseArgs(['--state', 'half']), /--state/);
  });

  test('immutablePaths lists exactly the paths whose rule has an immutable Cache-Control', () => {
    const text = '/*\n  X-Frame-Options: DENY\n\n# note\n/js/a.js\n  Cache-Control: public, max-age=31536000, immutable\n\n/advent/day-*.json\n  X-Robots-Tag: noindex\n\n/css/b.css\n  Cache-Control: public, max-age=0\n';
    assert.deepEqual(immutablePaths(text), ['/js/a.js']);
    assert.ok(immutablePaths(readFileSync(new URL('../public/_headers', import.meta.url), 'utf8')).length >= 10);
  });

  test('inlineScriptHashes hashes executable inline scripts only: not JSON-LD, not external scripts, not empty ones', () => {
    const html = '<script type="application/ld+json">{"a":1}</script><script src="/x.js"></script><script> </script><script>var a=1;</script><script type="module">import "/y.js";</script>';
    assert.equal(inlineScriptHashes(html).length, 2);
    assert.match(inlineScriptHashes(html)[0], /^sha256-[A-Za-z0-9+/]+=*$/);
  });

  test('visibleText drops tags, scripts, styles and comments', () => {
    assert.equal(visibleText('<style>.a{}</style><!-- advent --><div data-advent="x">Hello <b>there</b></div><script>advent()</script>').replace(/\s+/g, ' ').trim(), 'Hello there');
  });
});

describe('check-live against the fixture site', () => {
  test('a healthy hidden site passes every check, one plain line each, with the URL and status, and exits 0', async () => {
    const { code, out } = await check({ state: 'hidden' });
    assert.equal(code, 0, out);
    assert.deepEqual(failing(out), []);
    assert.match(out, /PASS .*\/updates \(HTTP 200\).*2026\.10\.14\.006/);
    assert.match(out, /PASS .*\/services \(HTTP 200\).*inline script/);
    assert.match(out, /PASS .*\/advent \(HTTP 200\).*go-live.*false/i);
    assert.match(out, /PASS .*\/advent\/art\/day-01\.svg.*two separate/);
    assert.match(out, /26 of 26 .*art/);
    assert.match(out, /browser/i, 'it reminds the person of the manual browser check');
    assert.match(out, /0 failed/);
  });

  test('a healthy launched site passes, including the sitemap entry and the single search result', async () => {
    const { code, out } = await check({ state: 'launched' });
    assert.equal(code, 0, out);
    assert.match(out, /PASS .*sitemap\.xml.*lists the Advent calendar page/);
    assert.match(out, /PASS .*search-index\.json.*exactly one/);
  });

  test('the hidden checks catch a calendar listing that should not be there; the launched checks catch a missing one', async () => {
    const hidden = await check({ state: 'hidden', fault: 'advertListing' });
    assert.equal(hidden.code, 1);
    assert.match(hidden.out, /FAIL .*sitemap\.xml/);
    const launchedButHidden = await check({ state: 'hidden' }, ['--state', 'launched']);
    assert.equal(launchedButHidden.code, 1);
    assert.match(launchedButHidden.out, /FAIL .*sitemap\.xml/);
    assert.match(launchedButHidden.out, /FAIL .*\/advent \(HTTP 200\)/);
  });

  test('a visible banner on the hidden home page fails', async () => {
    const { code, out } = await check({ state: 'hidden', fault: 'bannerText' });
    assert.equal(code, 1);
    assert.match(out, /FAIL .*home page/i);
  });

  test('a page that is not HTTP 200 fails and says it proves nothing', async () => {
    const { code, out } = await check({ fault: 'missingPage' });
    assert.equal(code, 1);
    assert.match(out, /FAIL .*\/contact \(HTTP 404\).*proves nothing/);
  });

  test('an inline script whose hash is not in the Content-Security-Policy fails and names the page', async () => {
    const { code, out } = await check({ fault: 'badHash' });
    assert.equal(code, 1);
    assert.match(out, /FAIL .*\/services \(HTTP 200\).*sha256-/);
    assert.equal(failing(out).length, 1, out);
  });

  test('a day title anywhere it must not be is reported as a leak, naming the place', async () => {
    const { code, out } = await check({ fault: 'leak' });
    assert.equal(code, 1);
    assert.ok(failing(out).some((line) => line.includes('/advent') && /LEAK/.test(line)), out);
    assert.ok(failing(out).some((line) => line.includes('search-index.json') && /LEAK/.test(line)), out);
  });

  test('a wrong build on /updates fails', async () => {
    const { code, out } = await check({ fault: 'staleBuild' });
    assert.equal(code, 1);
    assert.match(out, /FAIL .*\/updates.*2026\.10\.14\.006/);
  });

  test('cache headers: a doubled Cache-Control fails, and so does a cached made-up neighbour', async () => {
    const doubled = await check({ fault: 'doubleCache' });
    assert.equal(doubled.code, 1);
    assert.match(doubled.out, /FAIL .*Cache-Control.*(2|two)/i);
    const neighbour = await check({ fault: 'neighbourCached' });
    assert.equal(neighbour.code, 1);
    assert.match(neighbour.out, /FAIL .*made-up/i);
  });

  test('picture headers: a joined policy is accepted and says so; a missing sandbox policy fails', async () => {
    const joined = await check({ fault: 'joinedCsp' });
    assert.equal(joined.code, 0, joined.out);
    assert.match(joined.out, /PASS .*scene\.svg.*one joined/);
    const bare = await check({ fault: 'noSandbox' });
    assert.equal(bare.code, 1);
    assert.match(bare.out, /FAIL .*art\/day-01\.svg.*sandbox/);
  });

  test('a missing picture is counted and named', async () => {
    const { code, out } = await check({ fault: 'missingArt' });
    assert.equal(code, 1);
    assert.match(out, /FAIL .*25 of 26 .*art.*day-05/s);
  });

  test('the day files must carry x-robots-tag noindex', async () => {
    const { code, out } = await check({ fault: 'noRobotsHeader' });
    assert.equal(code, 1);
    assert.match(out, /FAIL .*day-03\.json.*noindex/);
  });

  test('the build must be the Current build line: an older changelog entry does not count', async () => {
    const { code, out } = await check({}, ['--build', '2026.10.13.001']);
    assert.equal(code, 1, out);
    assert.match(out, /FAIL .*\/updates.*2026\.10\.13\.001/);
  });

  test('--wait with an old build number does not return at once (it waits, then times out)', async () => {
    const site = await startFakeSite({});
    try {
      const outcome = await run(['--base', site.base, '--build', '2026.10.13.001', '--state', 'hidden', '--wait', '--timeout', '1', '--interval', '0.2']);
      assert.equal(outcome.code, 1, outcome.out);
      assert.match(outcome.out, /timed out/i);
    } finally {
      await site.close();
    }
  });

  test('/advent must carry the security headers, and an unknown page must be a 404 with the site policy', async () => {
    const noHsts = await check({ fault: 'noHsts' });
    assert.equal(noHsts.code, 1);
    assert.match(noHsts.out, /FAIL .*\/advent .*strict-transport-security/i);
    const open = await check({ fault: 'unknown200' });
    assert.equal(open.code, 1);
    assert.match(open.out, /FAIL .*this-page-does-not-exist\S* \(HTTP 200\)/);
    const bare = await check({ fault: 'plain404' });
    assert.equal(bare.code, 1);
    assert.match(bare.out, /FAIL .*this-page-does-not-exist\S* \(HTTP 404\).*Content-Security-Policy/);
    const cached = await check({ fault: 'dayCached' });
    assert.equal(cached.code, 1);
    assert.match(cached.out, /FAIL .*day-03\.json.*must-revalidate/);
  });

  test('when a page does not load the summary says how many checks did not run', async () => {
    const { out } = await check({ fault: 'missingPage' });
    assert.match(out, /\d+ more checks? did not run/);
  });

  test('--build latest uses the local build-number.json', async () => {
    const number = JSON.parse(readFileSync(new URL('../build-number.json', import.meta.url), 'utf8'));
    const latest = `${number.date}.${String(number.build).padStart(3, '0')}`;
    const site = await startFakeSite({ build: latest });
    try {
      const { code, out } = await run(['--base', site.base, '--build', 'latest', '--state', 'hidden']);
      assert.equal(code, 0, out);
      assert.ok(out.includes(latest));
    } finally {
      await site.close();
    }
  });

  test('--wait polls /updates until the build appears (and gives up at the timeout)', async () => {
    const site = await startFakeSite({ fault: 'staleBuild' });
    try {
      const outcome = await run(['--base', site.base, '--build', '2026.10.14.006', '--state', 'hidden', '--wait', '--timeout', '1', '--interval', '0.2']);
      assert.equal(outcome.code, 1, 'the build never appears: gives up at the timeout');
      assert.match(outcome.out, /waiting for build 2026\.10\.14\.006/i);
      assert.match(outcome.out, /timed out/i);
      assert.ok(site.hits.filter((path) => path === '/updates').length >= 3, 'it polled more than twice');
    } finally {
      await site.close();
    }
    const ready = await startFakeSite({});
    try {
      const outcome = await run(['--base', ready.base, '--build', '2026.10.14.006', '--state', 'hidden', '--wait', '--timeout', '5', '--interval', '0.2']);
      assert.equal(outcome.code, 0, outcome.out);
    } finally {
      await ready.close();
    }
  });
});
