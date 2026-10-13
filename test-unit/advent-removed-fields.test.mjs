// Greg's decisions of 13 Oct 2026: "Try this together" (the `activity` field) and the hidden-detail hint (the
// `hidden` field) are removed everywhere, Day 3 names Hergest Ridge, and Days 24 and 25 read correctly on any date.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { content } from '../modules/advent/content.mjs';
import { validateDay, validateContent } from '../modules/advent/schema.mjs';
import { validateDayPayload } from '../modules/advent/day.mjs';
import { readDayFile } from '../modules/advent/logic.mjs';

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const allDays = [...content.days, content.bonus];
const dayFile = (day) => {
  const { art, ...rest } = day;
  return rest;
};

describe('the activity and hidden fields are gone', () => {
  test('no day in content.mjs (25 days and the bonus) has an activity or hidden key', () => {
    for (const day of allDays) {
      assert.ok(!('activity' in day), `day ${day.day} has activity`);
      assert.ok(!('hidden' in day), `day ${day.day} has hidden`);
    }
  });

  test('no built day file has either key', () => {
    for (let n = 1; n <= 26; n += 1) {
      const file = JSON.parse(readFileSync(join(PUBLIC, 'advent', `day-${String(n).padStart(2, '0')}.json`), 'utf8'));
      assert.ok(!('activity' in file) && !('hidden' in file), `day ${n}`);
      assert.deepEqual(Object.keys(file), ['day', 'title', 'ref', 'paragraphs', 'wonder', 'prayer', 'alt', 'translation', 'credit', 'art']);
    }
  });

  test('the validators refuse a day (or a day file) that still carries either key (unknown-key rule)', () => {
    const day = content.days[0];
    assert.doesNotThrow(() => validateDay(day, 0));
    assert.throws(() => validateDay({ ...day, activity: 'Do something.' }, 0), /unknown key "activity"/);
    assert.throws(() => validateDay({ ...day, hidden: 'A tiny star.' }, 0), /unknown key "hidden"/);
    assert.throws(() => validateDayPayload({ ...dayFile(day), activity: 'Do something.' }, 1), /unknown key "activity"/);
    assert.throws(() => validateDayPayload({ ...dayFile(day), hidden: 'A tiny star.' }, 1), /unknown key "hidden"/);
    assert.throws(() => readDayFile(JSON.stringify({ ...dayFile(day), hidden: 'x' }), 1), /unknown key/);
    const copy = structuredClone(content);
    copy.days[2].activity = 'Colour a rainbow.';
    assert.throws(() => validateContent(copy), /activity/);
  });

  test('the built page, scripts and styles mention neither block', () => {
    const files = ['advent.html', 'js/advent.js', 'css/advent.css', 'js/advent-teaser.js', 'css/advent-teaser.css', 'js/advent/logic.js', 'js/advent/day.js']
      .concat(readdirSync(PUBLIC).filter((n) => n.endsWith('.html') && !/^(?:updates|help)/.test(n)));
    for (const path of files) {
      const text = readFileSync(join(PUBLIC, path), 'utf8');
      assert.ok(!/Try this together|find something hidden|advent-activity|advent-hint/i.test(text), path);
    }
  });
});

describe('Day 3, Day 24 and Day 25 wording', () => {
  const day = (n) => content.days.find((d) => d.day === n);

  test('Day 3 names Hergest Ridge, and Radnor hills is gone everywhere in the content', () => {
    assert.match(day(3).paragraphs[0], /whether over Hergest Ridge or a puddle in the road/);
    assert.ok(!/Radnor hills/.test(JSON.stringify(content)));
  });

  test('Day 24 ends date-neutrally, with the quotation untouched', () => {
    const text = day(24).paragraphs[0];
    assert.ok(text.endsWith("That night's hurry is the hurry of Christmas Eve. Perhaps it is in us too."));
    assert.ok(!/It's Christmas Eve\. Tonight/.test(text));
    assert.ok(text.includes('"Glory to God in the highest, on earth peace, good will toward men" (WEB)'));
  });

  test('Day 25 prayer no longer says "today"', () => {
    assert.ok(day(25).prayer.includes('be born in our hearts and make us bearers of your light'));
    assert.ok(!/\btoday\b/i.test(day(25).prayer));
  });
});
