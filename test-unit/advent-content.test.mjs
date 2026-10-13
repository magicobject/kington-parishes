// Content honesty tests: every quotation mark in a day must be a verbatim quotation
// from the translation the day's label names. The verified list below was checked
// against bible-api.com (World English Bible and King James Version) on 13 Oct 2026.
// Straight apostrophes stand in for the source's curly ones; a trailing comma, full
// stop, question mark or exclamation mark inside the closing quote mark is ignored.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { content } from '../modules/advent/content.mjs';

const KJV = 'Retold in our own words, with a short quotation from the King James Version.';
const WEB = 'Retold in our own words, with short quotations from the World English Bible.';
const RETOLD = 'Retold in our own words, following the World English Bible.';

const VERIFIED = {
  1: [KJV, 'Let there be light'],
  2: [WEB, 'Where are you'],
  3: [KJV, 'I do set my bow in the cloud'],
  4: [WEB, 'Look now toward the sky, and count the stars, if you are able to count them', 'So will your offspring be'],
  5: [WEB, "Surely Yahweh is in this place, and I didn't know it"],
  6: [WEB, 'Take off your sandals, for the place you are standing on is holy ground', 'Certainly I will be with you'],
  7: [RETOLD],
  8: [RETOLD],
  9: [WEB, 'where you go, I will go; and where you stay, I will stay. Your people will be my people, and your God my God'],
  10: [WEB, 'Are all your children here', 'There remains yet the youngest. Behold, he is keeping the sheep', 'Arise! Anoint him, for this is he'],
  11: [KJV, 'The people that walked in darkness have seen a great light'],
  12: [RETOLD],
  13: [KJV, 'But thou, Bethlehem Ephratah, though thou be little among the thousands of Judah, yet out of thee shall he come forth'],
  14: [WEB, "How can we sing Yahweh's song in a foreign land"],
  15: [WEB, 'Comfort, comfort my people', 'Prepare the way of Yahweh in the wilderness', 'with healing in its wings'],
  16: [WEB, 'How can I be sure of this', 'I am Gabriel, who stands in the presence of God', 'His name is John'],
  17: [KJV, 'Behold the handmaid of the Lord; be it unto me according to thy word'],
  18: [WEB, 'God with us'],
  19: [KJV, 'My soul doth magnify the Lord, and my spirit hath rejoiced in God my Saviour'],
  20: [RETOLD],
  21: [WEB, 'Nations will come to your light'],
  22: [RETOLD],
  23: [KJV, 'Fear not'],
  24: [WEB, 'Glory to God in the highest, on earth peace, good will toward men'],
  25: [KJV, 'And the Word was made flesh, and dwelt among us'],
  // The 6 January bonus door (Matthew 2, World English Bible, checked against bible-api.com): verses 2, 8, 10, 11 and a
  // fragment of 12 (the full verse is "Being warned in a dream that they shouldn't return to Herod, they went back to
  // their own country another way.").
  26: [WEB,
    'Where is he who is born King of the Jews? For we saw his star in the east, and have come to worship him',
    'Go and search diligently for the young child. When you have found him, bring me word, so that I also may come and worship him',
    'When they saw the star, they rejoiced with exceedingly great joy',
    'Opening their treasures, they offered to him gifts: gold, frankincense, and myrrh',
    'went back to their own country another way'],
};

// The 25 days and the bonus day, when there is one.
const allDays = [...content.days, ...(content.bonus ? [content.bonus] : [])];

const quotedPassages = (day) =>
  day.paragraphs.flatMap((paragraph) => [...paragraph.matchAll(/"([^"]+)"/g)].map((match) => match[1].replace(/[.,?!]+$/, '')));

describe('content honesty', () => {
  test('every day has a translation label, and it is the label the verified table expects', () => {
    for (const day of allDays) assert.equal(day.translation, VERIFIED[day.day][0], `day ${day.day}`);
  });

  test('every quoted passage is on the verified list for that day', () => {
    for (const day of allDays) {
      const allowed = VERIFIED[day.day].slice(1);
      for (const passage of quotedPassages(day)) {
        assert.ok(allowed.includes(passage), `day ${day.day} quotes "${passage}", which is not verified`);
      }
    }
  });

  test('every verified quotation is actually used, so the table cannot drift', () => {
    for (const day of allDays) {
      const used = quotedPassages(day);
      for (const passage of VERIFIED[day.day].slice(1)) {
        assert.ok(used.includes(passage), `day ${day.day} no longer contains "${passage}"`);
      }
    }
  });

  test('days with no quotation are labelled as retold', () => {
    for (const day of allDays) {
      if (VERIFIED[day.day].length === 1) assert.equal(quotedPassages(day).length, 0, `day ${day.day}`);
    }
  });

  test('a day quoting the King James Version says so, and one quoting the World English Bible says so', () => {
    for (const day of allDays) {
      const label = VERIFIED[day.day][0];
      if (label === KJV) assert.match(day.translation, /King James/);
      if (label === WEB) assert.match(day.translation, /World English Bible/);
    }
  });
});

describe('the 6 January bonus door ("Gifts for a King")', () => {
  const bonus = content.bonus;

  test('exists as day 26 with the approved title and reference, and a picture file name (the picture itself is added later)', () => {
    assert.ok(bonus, 'content.mjs has a bonus day');
    assert.equal(bonus.day, 26);
    assert.equal(bonus.title, 'Gifts for a King');
    assert.equal(bonus.ref, 'Matthew 2:1-12');
    assert.equal(bonus.art, 'day-26.svg');
    assert.equal(bonus.paragraphs.length, 5);
  });

  test('says "the wise travellers" and never claims a number of travellers or that they were kings', () => {
    const text = JSON.stringify(bonus);
    assert.match(text, /wise travellers/);
    assert.ok(!/three (?:wise|travellers|kings|men|magi)/i.test(text));
    assert.ok(!/we three/i.test(text));
    assert.match(bonus.paragraphs[3], /does not say how many travellers/);
  });

  test('the theme names the bonus door, so the door appears', async () => {
    const { theme } = await import('../modules/advent/theme.mjs');
    assert.deepEqual(theme.bonus, { on: { month: 1, day: 6 }, label: 'Epiphany' });
  });
});

describe('Day 21 closing wording (Greg, 13 Oct 2026) and the bonus door it leads to', () => {
  const day21 = content.days.find((d) => d.day === 21).paragraphs[0];

  test('Day 21 promises the bonus door by name and date: "at Epiphany, on 6 January"', () => {
    assert.ok(day21.includes('We will meet them properly at Epiphany, on 6 January. But their journey starts here,'));
    assert.ok(!day21.includes('when they arrive'));
    assert.match(day21, /Epiphany/);
    assert.match(day21, /6 January/);
  });

  test('the bonus day still opens sensibly after Day 21 ("On Day 21 some wise people set out from far away")', () => {
    assert.ok(content.bonus.paragraphs[0].startsWith('On Day 21 some wise people set out from far away, following a star. Now their long road is nearly over.'));
  });
});
