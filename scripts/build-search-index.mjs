// Pure, unit-tested functions behind the site search index. No DOM, no
// build-specific globals — everything here takes plain strings/data in and
// returns plain strings/data out, so it's testable with plain `node --test`
// (see test-unit/build-search-index.test.mjs) as well as exercised for real
// by scripts/build.mjs on every build.
import { parse } from 'node-html-parser';

// Turns heading text into a URL-safe id: "Hire the Parish Hall" -> "hire-the-parish-hall".
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/&amp;/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

// Walks up from a node looking for the nearest ancestor carrying an id
// attribute (e.g. the <article id="kington"> wrapping a plain <h2>Kington</h2>
// several levels down). Returns the id, or null if none of the ancestors has
// one. Deliberately ignores <main id="main"> — every page's own content
// fragment is wrapped in that one landmark id (it's the site's skip-link
// target, see templates/header.html), so treating it as "the nearest id"
// would collapse every heading on every page onto the same #main anchor.
function nearestAncestorId(node) {
  let current = node.parentNode;
  while (current && current.tagName) {
    const id = current.getAttribute && current.getAttribute('id');
    if (id && current.tagName !== 'MAIN') return id;
    current = current.parentNode;
  }
  return null;
}

// Ensures every h1/h2/h3 in `html` is reachable by a URL anchor — either
// because it (or a wrapping <section>/<article>) already has an id, or
// because this function injects one, slugified from the heading's own text.
//
// Deliberately does NOT reparse-and-reserialize the whole document (that
// would risk rewriting self-closing SVG <path/> tags into <path></path>,
// among other subtle diffs against hand-authored source) — it only splices
// `id="..."` into the exact character range node-html-parser reports for
// each heading that actually needs one, leaving everything else untouched.
export function ensureSectionIds(html) {
  const root = parse(html);
  const headings = root.querySelectorAll('h1, h2, h3');

  const usedIds = new Set(
    root.querySelectorAll('[id]')
      .map((el) => el.getAttribute('id'))
      .filter(Boolean),
  );

  const injections = [];
  for (const heading of headings) {
    if (heading.getAttribute('id')) continue;
    if (nearestAncestorId(heading)) continue;

    const base = slugify(heading.text);
    let candidate = base;
    let n = 2;
    while (usedIds.has(candidate)) candidate = `${base}-${n++}`;
    usedIds.add(candidate);

    injections.push({ start: heading.range[0], id: candidate });
  }

  // Apply from the end of the string backwards so earlier offsets are
  // never invalidated by an edit made later in the loop.
  injections.sort((a, b) => b.start - a.start);
  let result = html;
  for (const { start, id } of injections) {
    const closeAngle = result.indexOf('>', start);
    result = `${result.slice(0, closeAngle)} id="${id}"${result.slice(closeAngle)}`;
  }
  return result;
}

// One entry per *anchor* — call this AFTER ensureSectionIds, on the
// id-complete HTML, so every entry's anchor is guaranteed to exist on the
// real page. `page` is { slug, title }.
//
// Deliberately not "one entry per heading": several h3s can legitimately
// share one id'd ancestor (e.g. index.html's Pilgrim Paths section has a
// separate h3 per parish, none with their own id, so they all resolve to
// the same #pilgrim-paths anchor) — indexing each of those separately would
// produce a handful of near-duplicate results that all link to the same
// place. They're grouped by anchor instead, using whichever heading in the
// group is highest-level (h1 before h2 before h3) as the entry's own
// heading, and the shared boundary element's text once, not once per h3.
export function extractSearchEntries(html, page) {
  const root = parse(html);
  const headings = root.querySelectorAll('h1, h2, h3');

  const groups = new Map(); // anchor -> { headings: [], boundary }
  for (const heading of headings) {
    const anchor = heading.getAttribute('id') || nearestAncestorId(heading);
    if (!anchor) continue; // shouldn't happen post-ensureSectionIds, but stay defensive

    // The "section" is whichever element the anchor actually belongs to —
    // the nearest id'd ancestor if there is one (which may wrap photos,
    // facts, links etc. as well as the heading), otherwise just the
    // heading's own immediate parent (e.g. one .card in a card-grid).
    let boundary = heading;
    let node = heading.parentNode;
    while (node && node.tagName) {
      if (node.getAttribute && node.getAttribute('id') === anchor) {
        boundary = node;
        break;
      }
      node = node.parentNode;
    }
    if (boundary === heading) boundary = heading.parentNode;

    if (!groups.has(anchor)) groups.set(anchor, { headings: [], boundary });
    groups.get(anchor).headings.push(heading);
  }

  const rank = { H1: 0, H2: 1, H3: 2 };
  const entries = [];
  for (const [anchor, group] of groups) {
    const primary = group.headings.slice().sort((a, b) => rank[a.tagName] - rank[b.tagName])[0];
    const boundary = group.boundary;
    const text = (boundary && boundary.text ? boundary.text : primary.text)
      .replace(/\s+/g, ' ')
      .trim();

    entries.push({
      page: `${page.slug}.html`,
      // page.title is authored pre-escaped for direct HTML interpolation
      // (see pages.config.mjs, e.g. "Services &amp; Events — ...") — decode
      // it here so the search dropdown shows "&" as text, not "&amp;".
      pageTitle: parse(page.title).text,
      anchor,
      heading: primary.text.replace(/\s+/g, ' ').trim(),
      text: text.slice(0, 500),
    });
  }
  return entries;
}

// Pages that should never appear in search: the internal build changelog
// (deliberately unlisted and noindex) and the 404 page (no real content).
export function isSearchablePage(page) {
  return page.slug !== 'updates' && page.slug !== '404';
}
