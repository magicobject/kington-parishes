// Pure search-matching logic — no DOM, no fetch, nothing browser-only, so
// it's usable both as a plain classic script in the browser (attaches to
// window.SearchMatch, matching main.js/calendar.js's own convention: no
// bundler, no module system) and via `require()`/`import` from
// test-unit/search-match.test.mjs for fast, no-browser unit tests.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SearchMatch = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  function normalize(text) {
    return String(text)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokenize(query) {
    var normalized = normalize(query);
    return normalized ? normalized.split(' ') : [];
  }

  // Every query token must appear somewhere in the entry's heading or text
  // (plain substring, keyword matching — no fuzzy matching, nothing
  // approximate). A heading match counts for more than a body-text match,
  // so "Titley" ranks the Titley section above a page that only mentions
  // Titley in passing — and an *exact* heading match ("Kington" matching
  // the heading "Kington") outranks a heading that merely contains the
  // word ("Kington Zero Waste Food Project"), so the specific thing you
  // typed wins over a longer, more general heading that happens to include it.
  function searchEntries(query, entries, limit) {
    var queryNorm = normalize(query);
    var tokens = tokenize(query);
    if (!tokens.length) return [];

    var scored = [];
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var headingNorm = normalize(entry.heading);
      var textNorm = normalize(entry.text);
      var score = 0;
      var matchesAll = true;

      for (var t = 0; t < tokens.length; t++) {
        var token = tokens[t];
        var inHeading = headingNorm.indexOf(token) !== -1;
        var inText = !inHeading && textNorm.indexOf(token) !== -1;
        if (!inHeading && !inText) { matchesAll = false; break; }
        score += inHeading ? 10 : 1;
      }

      if (!matchesAll) continue;

      if (headingNorm === queryNorm) {
        score += 1000; // the whole query is exactly this heading
      } else if (headingNorm.indexOf(queryNorm) === 0) {
        score += 200; // the heading starts with the whole query
      }
      // Tie-break toward the more specific (shorter) heading when scores
      // would otherwise be equal, e.g. "Kington" over "More walks around
      // Kington" — both are whole-word heading matches on their own.
      score -= headingNorm.length * 0.01;

      scored.push({ entry: entry, score: score });
    }

    scored.sort(function (a, b) { return b.score - a.score; });
    var capped = typeof limit === 'number' ? scored.slice(0, limit) : scored;
    return capped.map(function (s) { return s.entry; });
  }

  return { normalize: normalize, tokenize: tokenize, searchEntries: searchEntries };
});
