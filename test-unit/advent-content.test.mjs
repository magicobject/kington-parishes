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
};

const quotedPassages = (day) =>
  day.paragraphs.flatMap((paragraph) => [...paragraph.matchAll(/"([^"]+)"/g)].map((match) => match[1].replace(/[.,?!]+$/, '')));

describe('content honesty', () => {
  test('every day has a translation label, and it is the label the verified table expects', () => {
    for (const day of content.days) assert.equal(day.translation, VERIFIED[day.day][0], `day ${day.day}`);
  });

  test('every quoted passage is on the verified list for that day', () => {
    for (const day of content.days) {
      const allowed = VERIFIED[day.day].slice(1);
      for (const passage of quotedPassages(day)) {
        assert.ok(allowed.includes(passage), `day ${day.day} quotes "${passage}", which is not verified`);
      }
    }
  });

  test('every verified quotation is actually used, so the table cannot drift', () => {
    for (const day of content.days) {
      const used = quotedPassages(day);
      for (const passage of VERIFIED[day.day].slice(1)) {
        assert.ok(used.includes(passage), `day ${day.day} no longer contains "${passage}"`);
      }
    }
  });

  test('days with no quotation are labelled as retold', () => {
    for (const day of content.days) {
      if (VERIFIED[day.day].length === 1) assert.equal(quotedPassages(day).length, 0, `day ${day.day}`);
    }
  });

  test('a day quoting the King James Version says so, and one quoting the World English Bible says so', () => {
    for (const day of content.days) {
      const label = VERIFIED[day.day][0];
      if (label === KJV) assert.match(day.translation, /King James/);
      if (label === WEB) assert.match(day.translation, /World English Bible/);
    }
  });
});
