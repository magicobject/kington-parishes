// Unit tests for public/js/search-match.js — the pure matching/ranking
// logic behind the header search box. Run with `npm run test:unit`.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import SearchMatch from '../public/js/search-match.js';

const { normalize, tokenize, searchEntries } = SearchMatch;

describe('normalize', () => {
  test('lowercases and strips punctuation', () => {
    assert.equal(normalize("St Mary's, Kington!"), 'st mary s kington');
  });

  test('collapses repeated whitespace', () => {
    assert.equal(normalize('Stay   &  Play'), 'stay play');
  });
});

describe('tokenize', () => {
  test('splits a query into normalized words', () => {
    assert.deepEqual(tokenize('Stay & Play'), ['stay', 'play']);
  });

  test('returns an empty array for an empty or whitespace-only query', () => {
    assert.deepEqual(tokenize(''), []);
    assert.deepEqual(tokenize('   '), []);
  });
});

describe('searchEntries', () => {
  const entries = [
    { heading: 'Kington', text: 'St Mary the Virgin, Kington — Sunday service at 10am.' },
    { heading: 'Titley', text: "St Peter's, Titley — early morning Communion." },
    { heading: 'Stay & Play', text: 'Refreshments, stories, songs and toys for parents and carers.' },
    { heading: 'The Church Fete', text: 'Held annually in July at Kington.' },
  ];

  test('returns nothing for an empty query', () => {
    assert.deepEqual(searchEntries('', entries), []);
  });

  test('finds an entry by a heading-only match', () => {
    const results = searchEntries('titley', entries);
    assert.equal(results.length, 1);
    assert.equal(results[0].heading, 'Titley');
  });

  test('finds an entry by a body-text-only match', () => {
    const results = searchEntries('refreshments', entries);
    assert.equal(results.length, 1);
    assert.equal(results[0].heading, 'Stay & Play');
  });

  test('requires every query word to match (AND, not OR)', () => {
    // "kington fete" should only match the entry containing both words —
    // not every entry that merely mentions Kington.
    const results = searchEntries('kington fete', entries);
    assert.equal(results.length, 1);
    assert.equal(results[0].heading, 'The Church Fete');
  });

  test('ranks an exact heading match above a heading that merely contains the word', () => {
    // Regression: "Kington" used to tie-break on array order between the
    // exact "Kington" heading and "Kington Zero Waste Food Project", since
    // both scored the same flat "heading contains the token" bonus.
    const withLongerHeading = [
      { heading: 'Kington Zero Waste Food Project', text: 'Free food.' },
      { heading: 'Kington', text: 'Sunday service at 10am.' },
    ];
    const results = searchEntries('kington', withLongerHeading);
    assert.equal(results[0].heading, 'Kington');
  });

  test('ranks a heading match above a body-text-only match', () => {
    // "kington" matches the Kington heading directly, and also appears in
    // The Church Fete's body text — the heading match should come first.
    const results = searchEntries('kington', entries);
    assert.equal(results[0].heading, 'Kington');
  });

  test('matching is case-insensitive and ignores punctuation', () => {
    const results = searchEntries("STAY & PLAY!!", entries);
    assert.equal(results.length, 1);
    assert.equal(results[0].heading, 'Stay & Play');
  });

  test('respects the limit argument', () => {
    const manyEntries = entries.concat(entries).concat(entries); // all mention nothing shared, but reuse "kington"-bearing ones
    const results = searchEntries('kington', manyEntries, 2);
    assert.equal(results.length, 2);
  });

  test('returns nothing when no entry matches all query words', () => {
    assert.deepEqual(searchEntries('kington zebra', entries), []);
  });
});
