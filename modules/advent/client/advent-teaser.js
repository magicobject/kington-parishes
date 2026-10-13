// Home-page Advent banner script: tiny, and separate from the calendar script on purpose (the home page never
// loads the calendar itself). Loaded as a module from /js/advent-teaser.js on any page that has the
// {{ADVENT_TEASER}} token. The page carries one empty, hidden container; this script reveals a banner in it ONLY
// when the effective date is inside the season (live, or the archive after Christmas): the real date, or a
// preview date on this page. Outside the season it does nothing at all, so the page is exactly as it was.
//
// Same rules as the calendar script: nothing stored, text only ever set as plain text, one same-origin request
// (today's day file, for its title), and the link to the calendar page never carries the preview date.
import { seasonState } from '../date.mjs';
import { effectiveDate } from '../preview.mjs';
import { calendarUrl, fetchDayFile, readConfig, stylesheetUrl, teaserText, todayDoor, visibleSeason } from '../logic.mjs';

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Adds a stylesheet and resolves when it has loaded (or failed: the banner then still shows, just unstyled).
function addStylesheet(address) {
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = address;
    link.addEventListener('load', resolve);
    link.addEventListener('error', resolve);
    document.head.append(link);
  });
}

async function show(root, config, season, parts) {
  const sheets = [stylesheetUrl(root.dataset.themeCss), stylesheetUrl(root.dataset.teaserCss)].filter(Boolean);
  const today = season === 'live' ? todayDoor(parts, config.season) : 0;
  const words = teaserText({ season, today }, config);

  const inner = make('div', 'wrap advent-teaser-inner');
  if (config.scene) {
    const picture = make('img', 'advent-teaser-scene');
    picture.alt = '';
    picture.src = config.scene;
    inner.append(picture);
  }
  const text = make('div', 'advent-teaser-text');
  const heading = make('h2', 'advent-teaser-heading', words.heading);
  const line = make('p', 'advent-teaser-line', words.line);
  // The calendar page, with no query: the preview date is never passed on.
  const open = make('a', 'advent-pill', words.button);
  open.href = calendarUrl(location.origin, `/${config.slug}.html`);
  text.append(heading, line, open);
  inner.append(text);
  root.replaceChildren(inner);

  await Promise.all(sheets.map(addStylesheet));
  root.hidden = false;

  if (season === 'live') {
    try {
      const file = await fetchDayFile(today, (url, init) => fetch(url, init));
      line.textContent = teaserText({ season, today, title: file.title }, config).line;
    } catch {
      // Without the title the banner simply says "Day N".
    }
  }
}

function start(root) {
  const config = readConfig(root.dataset);
  if (!config || !config.enabled) return;
  const { parts, preview } = effectiveDate({
    realNow: Date.now(),
    search: location.search,
    pathname: location.pathname,
    previewEnabled: config.previewEnabled,
    timeZone: config.timeZone,
    slug: config.slug,
  });
  const season = visibleSeason(seasonState(parts, config.season), preview, config);
  if (season === 'live' || season === 'archive') show(root, config, season, parts).catch(() => {});
}

const root = document.querySelector('[data-advent-teaser]');
if (root) {
  try {
    start(root);
  } catch {
    // Anything unexpected leaves the page exactly as it was.
  }
}
