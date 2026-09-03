#!/usr/bin/env node
// Assembles public/*.html from templates/ + src/pages/*.html +
// src/pages.config.mjs + src/site.config.mjs. Run `npm run build` after
// editing anything in templates/ or src/, and commit the regenerated
// public/*.html — Cloudflare serves that directory as-is.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { NAV, FOOTER_NAV, PAGES } from '../src/pages.config.mjs';
import { SITE } from '../src/site.config.mjs';
import { CLERGY, CHURCH_OFFICERS } from '../src/people.config.mjs';
import { ensureSectionIds, extractSearchEntries, isSearchablePage } from './build-search-index.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

// The proof-of-concept build's own deployed URL — used for canonical links
// and, now, Open Graph/Twitter Card URLs and images (absolute URLs are
// required for both). Not the parishes' real domain — see pages.config.mjs's
// own note on why every page is noindex.
const SITE_URL = 'https://kington-parishes.magicobject.workers.dev';
// Falls back for any page that doesn't set its own `image` — the flagship
// aerial shot of St Mary's, Kington, representative of the benefice as a
// whole.
const DEFAULT_OG_IMAGE = '/img/our-churches/kington.webp';

const pageTemplate = read('templates/page.html');
const headerTemplate = read('templates/header.html').trimEnd();
const footerTemplate = read('templates/footer.html').trimEnd();
const safeguardStripTemplate = read('templates/safeguard-strip.html').trimEnd();

function readBuildNumber() {
  const file = join(root, 'build-number.json');
  if (!existsSync(file)) return '0000.00.00.000';
  const { date, build } = JSON.parse(readFileSync(file, 'utf8'));
  return `${date}.${String(build).padStart(3, '0')}`;
}

// camelCase site.config.mjs keys become {{UPPER_SNAKE_CASE}} tokens, e.g.
// phoneDisplay -> {{PHONE_DISPLAY}}. Every token is replaced everywhere it
// appears — in templates and in page content alike — so contact details,
// the donate link and other repeated facts only ever need to be typed once.
function tokensFromSite(site, buildNumber) {
  const tokens = { BUILD_NUMBER: buildNumber };
  for (const [key, value] of Object.entries(site)) {
    const token = key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase();
    tokens[token] = value;
  }
  return tokens;
}

function replaceTokens(html, tokens) {
  let out = html;
  for (const [token, value] of Object.entries(tokens)) {
    out = out.replaceAll(`{{${token}}}`, value);
  }
  return out;
}

// Turns each character into a numeric HTML entity (e.g. "a" -> "&#97;").
// Browsers decode these back to plain text/attribute values automatically,
// so real visitors and the mailto: link both work exactly as normal — but
// the page's raw source never contains the literal email address, which
// stops the simple regex-over-raw-HTML scrapers most bulk email harvesters
// use. It does NOT stop a scraper that actually parses the HTML (anything
// using a real DOM/HTML parser sees the decoded value just like a browser
// does) — there's no way to hide a mailto: link from that class of scraper
// and still have it work as a link.
function encodeEntities(str) {
  return [...str].map((ch) => `&#${ch.codePointAt(0)};`).join('');
}

// Page content can write {{OBFUSCATE_MAILTO:someone@example.com}} instead of
// a plain mailto: href, and the build turns it into an entity-encoded one.
function obfuscateMailtoLinks(html) {
  return html.replace(/\{\{OBFUSCATE_MAILTO:([^}]+)\}\}/g, (_, email) => encodeEntities(`mailto:${email}`));
}

// Renders one clergy/officer card. Used via {{PEOPLE:clergy}} and
// {{PEOPLE:<church-slug>}} tokens (see renderPeopleTokens below) so Our
// People and each church's portal page share the exact same person data —
// add someone to src/people.config.mjs once, and every page that lists them
// picks it up.
function renderPersonCard({ iconSvg, role, name, bio }) {
  return `        <div class="card reveal">
          <div class="icon-badge">${iconSvg}</div>
          <div class="tags">${role}</div>
          <h3>${name}</h3>
          <p>${bio}</p>
        </div>`;
}

function renderPeopleCards(list) {
  return list.map(renderPersonCard).join('\n');
}

// {{PEOPLE:clergy}} -> everyone in CLERGY; {{PEOPLE:<slug>}} -> that church's
// entry in CHURCH_OFFICERS (empty/absent slugs just render nothing — a
// church with no officers listed yet simply gets no cards, not an error).
// Must run before ensureSectionIds/extractSearchEntries so each rendered
// person's <h3> is a real heading by the time anchors get injected and the
// search index gets built — not a token search can't see.
function renderPeopleTokens(html) {
  return html.replace(/\{\{PEOPLE:([a-z-]+)\}\}/g, (_, key) => {
    const list = key === 'clergy' ? CLERGY : CHURCH_OFFICERS[key] || [];
    return renderPeopleCards(list);
  });
}

function renderNavItems(links, activeHref) {
  return links
    .map(({ href, label }) => {
      const current = href === activeHref ? ' aria-current="page"' : '';
      return `      <a href="${href}"${current}>${label}</a>`;
    })
    .join('\n');
}

const footerNavItems = FOOTER_NAV.map(({ href, label }) => {
  const external = /^https?:\/\//.test(href);
  const attrs = external ? ' target="_blank" rel="noopener"' : '';
  return `<a href="${href}"${attrs}>${label}</a>`;
}).join('<br>\n        ');

const buildNumber = readBuildNumber();
const tokens = tokensFromSite(SITE, buildNumber);

const footer = replaceTokens(
  footerTemplate.replace('{{FOOTER_NAV_ITEMS}}', footerNavItems),
  tokens,
);

const searchEntries = [];

for (const page of PAGES) {
  // {{PEOPLE:...}} tokens expand to real headings first, so the anchor
  // injection and search indexing below see actual person cards, not
  // unexpanded tokens. Every heading then gets a real, working anchor
  // before anything else touches this page's content — search results and
  // the page itself can never disagree about where a section actually is.
  const content = ensureSectionIds(renderPeopleTokens(read(`src/pages/${page.slug}.html`).trimEnd()));

  if (isSearchablePage(page)) {
    const resolvedForSearch = replaceTokens(content, tokens);
    searchEntries.push(...extractSearchEntries(resolvedForSearch, page));
  }

  const pageUrl = `${SITE_URL}/${page.slug}.html`;
  const pageImage = `${SITE_URL}${page.image || DEFAULT_OG_IMAGE}`;

  let extraHead = '';
  if (page.robots) extraHead += `<meta name="robots" content="${page.robots}">\n`;
  if (page.canonical !== false) {
    extraHead += `<link rel="canonical" href="${pageUrl}">\n`;
  }
  // Open Graph / Twitter Card metadata — inert while the site stays
  // noindex, but correct and ready for the day it goes live on the
  // parishes' real domain (only SITE_URL needs to change).
  extraHead += `<meta property="og:type" content="website">\n`;
  extraHead += `<meta property="og:site_name" content="${SITE.orgName}">\n`;
  extraHead += `<meta property="og:title" content="${page.title}">\n`;
  extraHead += `<meta property="og:description" content="${page.description}">\n`;
  extraHead += `<meta property="og:url" content="${pageUrl}">\n`;
  extraHead += `<meta property="og:image" content="${pageImage}">\n`;
  extraHead += `<meta name="twitter:card" content="summary_large_image">\n`;
  extraHead += `<meta name="twitter:title" content="${page.title}">\n`;
  extraHead += `<meta name="twitter:description" content="${page.description}">\n`;
  extraHead += `<meta name="twitter:image" content="${pageImage}">\n`;
  if (page.structuredData) extraHead += `<script type="application/ld+json">${JSON.stringify(page.structuredData)}</script>\n`;

  const header = page.header
    ? replaceTokens(headerTemplate.replace('{{NAV_ITEMS}}', renderNavItems(NAV, page.active)), tokens)
    : '';
  const safeguardStrip = page.safeguardStrip === false ? '' : safeguardStripTemplate;
  const pageFooter = page.footer === false ? '' : footer;

  let html = pageTemplate
    .replace('{{TITLE}}', page.title)
    .replace('{{DESCRIPTION}}', page.description)
    .replace('{{EXTRA_HEAD}}', extraHead)
    .replace('{{HEADER}}', header)
    .replace('{{CONTENT}}', content)
    .replace('{{SAFEGUARD_STRIP}}', safeguardStrip)
    .replace('{{FOOTER}}', pageFooter);

  html = replaceTokens(html, tokens);
  html = obfuscateMailtoLinks(html);

  writeFileSync(join(root, 'public', `${page.slug}.html`), html);
  console.log(`built public/${page.slug}.html`);
}

writeFileSync(join(root, 'public', 'search-index.json'), JSON.stringify(searchEntries));
console.log(`built public/search-index.json (${searchEntries.length} entries)`);
