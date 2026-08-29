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

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

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

function renderNavItems(links, activeHref) {
  return links
    .map(({ href, label }) => {
      const current = href === activeHref ? ' aria-current="page"' : '';
      return `      <a href="${href}"${current}>${label}</a>`;
    })
    .join('\n');
}

const footerNavItems = FOOTER_NAV.map(({ href, label }) => `<a href="${href}">${label}</a>`).join(
  '<br>\n        ',
);

const buildNumber = readBuildNumber();
const tokens = tokensFromSite(SITE, buildNumber);

const footer = replaceTokens(
  footerTemplate.replace('{{FOOTER_NAV_ITEMS}}', footerNavItems),
  tokens,
);

for (const page of PAGES) {
  const content = read(`src/pages/${page.slug}.html`).trimEnd();

  let extraHead = '';
  if (page.robots) extraHead += `<meta name="robots" content="${page.robots}">\n`;
  if (page.canonical !== false) {
    extraHead += `<link rel="canonical" href="https://kington-parishes.magicobject.workers.dev/${page.slug}.html">\n`;
  }

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

  writeFileSync(join(root, 'public', `${page.slug}.html`), html);
  console.log(`built public/${page.slug}.html`);
}
