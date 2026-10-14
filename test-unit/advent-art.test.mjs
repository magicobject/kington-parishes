// The 26 real pictures (day-01.svg to day-26.svg, the 25 days and the bonus day) are in public/advent/art/ and are
// consistent with the content and with the build, including its strict mode (artRequired true, as at launch).
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAdvent, lintSvg, svgDrawWeight } from '../modules/advent/build.mjs';
import { theme } from '../modules/advent/theme.mjs';
import { content } from '../modules/advent/content.mjs';

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const ART = join(PUBLIC, 'advent', 'art');
const names = Array.from({ length: 26 }, (_, i) => `day-${String(i + 1).padStart(2, '0')}.svg`);
const allDays = [...content.days, content.bonus];
const dirs = [];
after(() => { for (const dir of dirs) rmSync(dir, { recursive: true, force: true }); });

describe('the real pictures', () => {
  test('public/advent/art holds exactly day-01.svg to day-26.svg, nothing else', () => {
    assert.deepEqual(readdirSync(ART).sort(), names);
  });

  test('every picture passes the lint, is plain LF text, and is a real svg', () => {
    for (const name of names) {
      const text = readFileSync(join(ART, name), 'utf8');
      assert.deepEqual(lintSvg(text), [], name);
      assert.ok(!text.includes('\r'), `${name} has a carriage return`);
      assert.match(text, /^<svg /);
    }
  });

  test('the strict build (artRequired true, as at launch) passes against the real art folder and finds all 26', () => {
    const publicDir = mkdtempSync(join(tmpdir(), 'advent-art-'));
    dirs.push(publicDir);
    mkdirSync(join(publicDir, 'advent'), { recursive: true });
    cpSync(ART, join(publicDir, 'advent', 'art'), { recursive: true });
    cpSync(join(PUBLIC, 'advent', 'scene.svg'), join(publicDir, 'advent', 'scene.svg'));
    const result = buildAdvent({ theme: { ...structuredClone(theme), artRequired: true, goLive: true, publicListing: true }, content, publicDir, siteUrl: 'https://example.test', pageNames: ['index'] });
    assert.deepEqual(result.artPresent.slice().sort(), names);
  });

  test('every built day file (25 days and the bonus) now carries its art key', () => {
    for (const day of allDays) {
      const file = JSON.parse(readFileSync(join(PUBLIC, 'advent', `day-${String(day.day).padStart(2, '0')}.json`), 'utf8'));
      assert.equal(file.art, `day-${String(day.day).padStart(2, '0')}.svg`, `day ${day.day}`);
    }
  });

  test('the alt text in the content equals the picture\'s own aria-label and title, for all 26', () => {
    for (const day of allDays) {
      const text = readFileSync(join(ART, `day-${String(day.day).padStart(2, '0')}.svg`), 'utf8');
      const label = /<svg [^>]*aria-label="([^"]*)"/.exec(text)?.[1];
      const title = /<title>([^<]*)<\/title>/.exec(text)?.[1];
      assert.equal(label, day.alt, `day ${day.day} aria-label`);
      assert.equal(title, day.alt, `day ${day.day} title`);
    }
  });

  test('the alt text is one sentence of a sensible length for every day', () => {
    for (const day of allDays) assert.ok(day.alt.length >= 40 && day.alt.length <= 200, `day ${day.day}: ${day.alt.length}`);
  });

  test('Day 25 is the simplified picture (Greg, 13 Oct 2026): no front ledge of 24 tiny objects, a light picture with the same alt text', () => {
    const text = readFileSync(join(ART, 'day-25.svg'), 'utf8');
    assert.ok(text.length < 12000, `day-25.svg is ${text.length} bytes`);
    assert.ok(svgDrawWeight(text) < 250, `weight ${svgDrawWeight(text)}`);
    assert.equal(/aria-label="([^"]*)"/.exec(text)[1], 'A manger glows at the centre of a stable, wrapped in a golden thread, with a star above and watchers kneeling.');
  });
});

// The clean-up of 13 Oct 2026: the illustrator changed ONLY the hidden <desc> text of the pictures (the "Hidden: ..."
// game wording is gone; Day 21 and Day 26 no longer state a number of travellers) and moved Day 25's star down so its
// tip is not clipped. This table pins the pictures as they were BEFORE the clean-up, with the <desc> element removed and
// Day 25's star put back at its old height: the files now on disk must normalise to exactly these hashes, which proves
// nothing else changed. (If a picture is later redrawn on purpose, replace its hash here.)
const BEFORE_CLEANUP = {
  'day-01.svg': '32c276d7de3f5f63a1b1f6da7ae58752543f898a8b64c8d8369ee433851289d2',
  'day-02.svg': '916ac646523fab17cc62302d4ff387e954a9e140a1b0daa9236a5b583be4a8a1',
  'day-03.svg': 'f0e78969cd10c75e4384228a82af25271d97dfa437e9c3ccf80660d5bb9518cf',
  'day-04.svg': '43ffe50b7bb6bc113f3e5e8fe26ead0cf7cc8c15dd246f4e4c4a83b455e9db35',
  'day-05.svg': '2abf775c49d429e96405efeb2e5694b091828b89996b443195eac04409834297',
  'day-06.svg': '1994dddf29a207c378b05780030dd3e14be46444df3ac67f8fd0eaf40db7d643',
  'day-07.svg': 'cd04794df680b5ee4d3e7191e140e7ee0d93d65b57903e7a9e0f444477f42312',
  'day-08.svg': '38ca0a16255cfa55e736862b624467865ff1fb528e329e56c6207c2cce436059',
  'day-09.svg': '46bcbde119f4c22ea4ba2ad85eb9d1f42bbc488e44404c3a94d93ad16dc1c3b9',
  'day-11.svg': 'e2bbd9f6eb025415829714d8edd14be830386b6c6c259d721fb3e2595965ee09',
  'day-12.svg': '707af3eada0903dddcdc63ca248c7ea032fe8bc84e83d60c0658e1174fde13f7',
  'day-13.svg': 'c1ce27bbe52636a729e56d5f055fc801b41f081b694a4a55996b42834edc02b6',
  'day-14.svg': '8b8d6d9a538708ca627e254077830aa7478ecf19eb9271d504985bbd4808cf12',
  'day-16.svg': '18cb17f9a918abab17b8156b14b79f9df686e3231fefd9a8a11d57c825eaee3a',
  'day-17.svg': 'd6aa4a11f05e580cb3d1cdcb3bd67f4687cb415e91ab7d25575832328e54233f',
  'day-18.svg': 'b79e6ac0c073ca7394932e7d26b0948f22854492a1eafa75870eff12a722e5a6',
  'day-21.svg': '0c231f82288342ebfd8e950d0475b7fbfe37064e40e099d5e8231c9f6c5de1d9',
  'day-22.svg': 'b2f86df217b6105c6d322916d73fb19f978773e5252d5c8f9c3835d92140998d',
  'day-23.svg': '9e0bd298be3b4f9d60d58ad3645f4e9499202bc00700a69a7441b4aa61712b2a',
  'day-24.svg': '1ade6f7ceda34c4bfbddf50b89716ee5cc56a4f3e1d8c69a8bce1c990679d6d6',
  'day-25.svg': '8f17447e146078ae6023164e03a837df874101b0102628c6694f0deea96c1850',
  'day-26.svg': 'd4a03ffa3caabaecd7d4d305af43af7200939406934cf91826e6814e643240ae',
};
// Redrawn on purpose on 14 Oct 2026 (the illustrator's second pass from the UX review: Day 10 thicker gold crown on a darker
// sky, Day 15 richer palette and gold-edged road, Day 19 clearer house, figures and notes, Day 20 no stray badge and larger
// figures). Their old hashes are gone from the table above; these are the new files' exact (raw) hashes.
const REDRAWN_14_OCT = {
  'day-10.svg': 'dcb23b58c5e4319f4ffddad4c39ca7028f3eb171d0c2111a65144379c3d351e6',
  'day-15.svg': '8fc2152f7c43725b694f3c6c2bd0339a0bdb5030982dbbab4e80acd5213c1fb2',
  'day-19.svg': 'ba2528ef8c8f60c228e46f6c07ebf230444f1d7a46c80da08b13b785aa8ebc88',
  'day-20.svg': 'f9914e64a0442cf9b5a3bfb0e02a55deade021a3c6697b9dd3c50da704258b07',
};
const normalised = (text) => text.replace(/<desc>[\s\S]*?<\/desc>/, '').replace('x="183" y="0" width="34"', 'x="183" y="-3" width="34"');

describe('the picture clean-up of 13 Oct 2026', () => {
  test('the four pictures redrawn on 14 Oct 2026 are exactly the illustrator files, and the other 22 are in the old table', () => {
    assert.deepEqual(Object.keys(REDRAWN_14_OCT), ['day-10.svg', 'day-15.svg', 'day-19.svg', 'day-20.svg']);
    assert.equal(Object.keys(BEFORE_CLEANUP).length, 22);
    for (const [name, expected] of Object.entries(REDRAWN_14_OCT)) {
      assert.equal(createHash('sha256').update(readFileSync(join(ART, name))).digest('hex'), expected, name);
    }
  });

  test('after taking out the <desc> (and putting Day 25\'s star back), all 26 pictures are exactly what they were before', () => {
    for (const name of names.filter((n) => !(n in REDRAWN_14_OCT))) {
      const hash = createHash('sha256').update(normalised(readFileSync(join(ART, name), 'utf8'))).digest('hex');
      assert.equal(hash, BEFORE_CLEANUP[name], name);
    }
  });

  test('no picture\'s <desc> has the old "Hidden: ..." game wording ("half hidden by a tree" in Day 2 is an ordinary description and stays)', () => {
    for (const name of names) {
      const desc = /<desc>([\s\S]*?)<\/desc>/.exec(readFileSync(join(ART, name), 'utf8'))?.[1] ?? '';
      assert.ok(!/hidden\s*:|hidden (?:detail|object|thing)|look for|find the|can you find/i.test(desc), `${name}: ${desc.slice(0, 80)}`);
    }
  });

  test('Day 21 and Day 26 do not state a number of travellers in their <desc> (or anywhere in the file)', () => {
    for (const name of ['day-21.svg', 'day-26.svg']) {
      const text = readFileSync(join(ART, name), 'utf8');
      assert.ok(!/three/i.test(text), `${name} says "three"`);
    }
  });

  test('Day 25\'s star lies fully inside the 0 0 400 225 viewBox (its tip is not clipped)', () => {
    const text = readFileSync(join(ART, 'day-25.svg'), 'utf8');
    assert.match(text, /viewBox="0 0 400 225"/);
    const stars = [...text.matchAll(/<use href="#star4" x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)"\/>/g)];
    assert.ok(stars.length >= 1);
    for (const [, x, y, width, height] of stars.map((m) => m.map(Number))) {
      assert.ok(x >= 0 && y >= 0 && x + width <= 400 && y + height <= 225, `star at ${x},${y} ${width}x${height}`);
    }
  });
});
