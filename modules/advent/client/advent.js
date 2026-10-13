// Advent calendar page script: the door grid, the opened-day dialog, the gentle "not yet" message, sharing
// and printing. Loaded as a module from /js/advent.js. The build copies it, and the files it imports, to
// public/js/ and points the three imports below at those copies, so this runs the very same date, day-rule and
// helper code the unit tests run.
//
// Rules this file keeps (spec S1-S14): nothing is stored in the browser (no cookies, no saved settings, no
// history); text from the day files is only ever set as plain text, never as markup; a day file is fetched from
// an address built only from a checked whole number, size-capped, parsed in try/catch and checked with the shared
// day rules; the preview date is never put into any link, share address or canonical; no outside requests.
import { seasonState, doorState, BONUS_DAY } from '../date.mjs';
import { effectiveDate, formatPreviewNotice } from '../preview.mjs';
import { FRIENDLY_ERROR, artUrl, calendarUrl, dateLabel, doorName, doorNumberText, doorSub, fetchDayFile, neighbours, parseDayHash, readConfig, shareUrl, statusText, todayDoor } from '../logic.mjs';

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function actionButton(className, text, onClick) {
  const node = make('button', className, text);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

const part = (root, name) => root.querySelector(`[data-advent-${name}]`);

// ---------------------------------------------------------------------------
// Small page states

function showCalm(root, text) {
  if (text) part(root, 'calm-text').textContent = text;
  part(root, 'live').hidden = true;
  part(root, 'calm').hidden = false;
}

// Previews must never be indexed, so the page says so whatever its normal setting is.
function markNoindex() {
  let meta = document.querySelector('meta[name="robots"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'robots';
    document.head.append(meta);
  }
  if (!/noindex/i.test(meta.content)) meta.content = 'noindex';
}

function showPreviewNotice(root, parts) {
  part(root, 'notice-text').textContent = formatPreviewNotice(parts);
  // The exit address is built from the origin and path only, so the preview date never travels on.
  const exit = make('a', '', 'Exit preview');
  exit.href = calendarUrl(location.origin, location.pathname);
  const paragraph = make('p');
  paragraph.append(exit);
  part(root, 'notice').append(paragraph);
  part(root, 'notice').hidden = false;
  markNoindex();
}

// ---------------------------------------------------------------------------
// The calendar

class Calendar {
  constructor(root, config, parts, season) {
    this.root = root;
    this.config = config;
    this.parts = parts;
    this.season = season;
    this.hasBonus = Boolean(config.bonus);
    this.days = Array.from({ length: config.dayCount + (this.hasBonus ? 1 : 0) }, (_, index) => index + 1);
    this.states = new Map(this.days.map((day) => [day, doorState(day, parts, config.season, config.bonus)]));
    this.doors = new Map();
    this.files = new Map(); // in memory only: day number -> a promise for the checked day file
    this.titles = new Map(); // in memory only: day number -> title, once its file has loaded
    this.shown = 0; // the day on show in the dialog, or 0
    this.ticket = 0; // lets a slow fetch notice that the visitor has moved on
    this.origin = null; // the door (or button) that opened the dialog, so focus can go back to it
    this.returnTo = 0; // when a "not yet" message was opened from a day, the day to go back to
  }

  isUnlocked(day) {
    return this.states.get(day) !== 'future';
  }

  // ---- fetching (memory only) ----

  load(day) {
    if (!this.files.has(day)) {
      const request = fetchDayFile(day, (url, init) => fetch(url, init));
      this.files.set(day, request);
      request.then((file) => this.titles.set(day, file.title), () => this.files.delete(day)); // a failure is not remembered, so a later try can work
    }
    return this.files.get(day);
  }

  // ---- the page ----

  build() {
    const { root, config } = this;
    const live = part(root, 'live');
    const archive = this.season === 'archive';

    if (archive) part(root, 'heading').textContent = 'The Christmas Story';
    this.status = part(root, 'status');
    this.status.textContent = statusText({ season: this.season, today: this.todayNumber(), bonusToday: this.bonusToday() }, config);

    const list = part(root, 'doors');
    list.replaceChildren(...this.days.map((day) => this.doorItem(day)));

    this.primary = part(root, 'primary');
    const today = this.days.find((day) => this.states.get(day) === 'today');
    if (today) {
      this.primary.hidden = false;
      this.primary.addEventListener('click', () => this.openDay(today, this.primary));
    }

    this.buildScene(part(root, 'scene'), archive || this.todayNumber() === config.dayCount);
    this.dialog = this.buildDialog();
    root.append(this.dialog);
    part(root, 'calm').hidden = true;
    live.hidden = false;

    this.loadTitles();
    this.openFromAddress();
    window.addEventListener('hashchange', () => this.openFromAddress());
    window.addEventListener('beforeprint', () => this.openForPrint());
    window.addEventListener('afterprint', () => this.restoreAfterPrint());
  }

  // A closed <details> does not print, so the reflection and the family activity are opened for the printer.
  openForPrint() {
    this.printed = [this.wonder.element, this.activity.element].map((element) => [element, element.open]);
    for (const [element] of this.printed) element.open = true;
  }

  restoreAfterPrint() {
    for (const [element, wasOpen] of this.printed ?? []) element.open = wasOpen;
    this.printed = null;
  }

  todayNumber() {
    return this.season === 'live' ? todayDoor(this.parts, this.config.season) : 0;
  }

  bonusToday() {
    return this.hasBonus && this.states.get(BONUS_DAY) === 'today';
  }

  doorItem(day) {
    const state = this.states.get(day);
    const item = make('li');
    const door = make('button', `advent-door advent-door-${state}${day === this.config.dayCount ? ' advent-door-star' : ''}${day === BONUS_DAY ? ' advent-door-bonus' : ''}`);
    door.type = 'button';
    door.append(make('span', 'advent-door-number', doorNumberText(day, this.config)), make('span', 'advent-door-sub', doorSub({ day, state }, this.config)));
    door.setAttribute('aria-label', doorName({ day, state }, this.config));
    door.addEventListener('click', () => this.openDay(day, door));
    this.doors.set(day, door);
    item.append(door);
    return item;
  }

  buildScene(scene, showStar) {
    if (this.config.scene) {
      const picture = make('img', 'advent-scene-image');
      picture.alt = '';
      picture.src = this.config.scene;
      scene.append(picture);
    }
    if (showStar) scene.append(make('span', 'advent-scene-star'));
  }

  // Only doors that are open to read are asked for their titles, so a future title is never fetched here.
  loadTitles() {
    const today = this.todayNumber();
    for (const day of this.days) {
      const state = this.states.get(day);
      if (state === 'future') continue;
      this.load(day).then((file) => {
        this.doors.get(day).setAttribute('aria-label', doorName({ day, state, title: file.title }, this.config));
        if (day === today) this.status.textContent = statusText({ season: this.season, today, title: file.title }, this.config);
        if (this.shown) this.renderNav(this.shown); // a neighbour's title may have just arrived
      }, () => {});
    }
  }

  openFromAddress() {
    const day = parseDayHash(location.hash, this.hasBonus);
    if (day) this.openDay(day, this.doors.get(day));
  }

  // ---- the dialog ----

  buildDialog() {
    const dialog = make('dialog', 'advent-dialog');
    dialog.setAttribute('aria-labelledby', 'advent-dialog-title');
    const panel = make('div', 'advent-panel');

    const top = make('div', 'advent-panel-top');
    this.count = make('p', 'advent-count');
    this.closeButton = actionButton('advent-close', 'Close', () => dialog.close());
    top.append(this.count, this.closeButton);

    this.art = make('figure', 'advent-art');
    this.artImage = make('img', 'advent-art-image');
    this.artImage.width = 400;
    this.artImage.height = 225;
    this.artCredit = make('figcaption', 'advent-art-credit');
    this.art.append(this.artImage, this.artCredit);

    this.eyebrow = make('p', 'advent-eyebrow');
    this.title = make('h2', 'advent-title');
    this.title.id = 'advent-dialog-title';
    this.title.tabIndex = -1;

    this.message = make('div', 'advent-message');
    this.messageText = make('p', 'advent-message-text');
    this.messageActions = make('div', 'advent-message-actions');
    this.message.append(this.messageText, this.messageActions);

    this.body = this.buildBody();
    this.announcer = make('p', 'advent-sr');
    this.announcer.setAttribute('role', 'status');

    // Only shown when printing (the print stylesheet): the site name above the day.
    const printSite = make('p', 'advent-print-site', `${this.config.siteName} Advent calendar`);

    panel.append(printSite, top, this.art, this.eyebrow, this.title, this.message, this.body, this.announcer);
    dialog.append(panel);

    // A click on the backdrop (the dialog itself, outside the panel) closes it; Escape is built in.
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => this.afterClose());
    return dialog;
  }

  buildBody() {
    const body = make('div', 'advent-day');
    this.reference = make('p', 'advent-reference');
    this.credit = make('p', 'advent-translation');
    this.story = make('div', 'advent-story');
    this.wonder = this.detailsBlock('Think about it', 'advent-wonder');
    this.activity = this.detailsBlock('Try this together', 'advent-activity');
    this.prayer = make('section', 'advent-prayer');
    this.prayerText = make('p');
    this.prayer.append(make('h3', '', 'A prayer'), this.prayerText);
    this.hint = this.detailsBlock('Can you find something hidden in the picture?', 'advent-hint');
    this.nav = make('div', 'advent-nav');
    this.previous = actionButton('advent-nav-button advent-previous', '', () => this.step('prev'));
    this.next = actionButton('advent-nav-button advent-next', '', () => this.step('next'));
    this.nav.append(this.previous, this.next);
    this.actions = make('div', 'advent-actions');
    this.shareButton = actionButton('advent-action advent-share', '', () => this.share());
    this.printButton = actionButton('advent-action advent-print', 'Print this day', () => window.print());
    this.shareStatus = make('p', 'advent-share-status');
    this.actions.append(this.shareButton, this.printButton);
    body.append(this.reference, this.credit, this.story, this.wonder.element, this.activity.element, this.prayer, this.hint.element, this.nav, this.actions, this.shareStatus);
    return body;
  }

  detailsBlock(summary, className) {
    const element = make('details', `advent-details ${className}`);
    const text = make('p');
    element.append(make('summary', '', summary), text);
    return { element, text };
  }

  // Opens the dialog (if it is not open yet) and shows one of three things: a day, the gentle message, or the error.
  ensureOpen(origin) {
    if (this.dialog.open) return;
    this.origin = origin ?? this.origin;
    if (typeof this.dialog.showModal === 'function') this.dialog.showModal();
    else this.dialog.setAttribute('open', '');
  }

  afterClose() {
    this.ticket += 1; // forget any fetch still on its way
    this.shown = 0;
    this.returnTo = 0;
    this.announcer.textContent = ''; // so the same announcement is made again if the same day is reopened
    const origin = this.origin;
    this.origin = null;
    if (origin && origin.isConnected) origin.focus();
  }

  openDay(day, origin) {
    if (!this.days.includes(day)) return;
    this.ensureOpen(origin);
    this.returnTo = 0;
    if (this.isUnlocked(day)) this.showDay(day);
    else this.showGentle(day, 0);
  }

  step(direction) {
    const target = neighbours(this.shown, this.hasBonus)[direction];
    if (!target) return;
    if (this.isUnlocked(target)) this.showDay(target);
    else this.showGentle(target, this.shown);
  }

  setView(view) {
    this.message.hidden = view === 'day';
    this.body.hidden = view !== 'day';
    this.nav.hidden = view !== 'day';
  }

  eyebrowText(day) {
    return day === BONUS_DAY ? `${this.config.bonus.label} \u00B7 ${dateLabel(day, this.config)}` : `Day ${day} \u00B7 ${dateLabel(day, this.config)}`;
  }

  // The gentle message for a door that is not open yet. Never says "can't".
  showGentle(day, returnTo) {
    this.ticket += 1;
    this.shown = 0;
    this.returnTo = returnTo;
    this.setView('message');
    this.art.hidden = true;
    this.count.textContent = '';
    this.eyebrow.textContent = this.eyebrowText(day);
    this.title.textContent = 'Not yet';
    this.messageText.textContent = `This door opens on ${dateLabel(day, this.config)}.`;
    const anyway = actionButton('advent-pill', 'Open it anyway', () => this.showDay(day));
    const notYet = actionButton('advent-pill advent-pill-quiet', 'Not yet', () => (returnTo ? this.showDay(returnTo) : this.dialog.close()));
    this.messageActions.replaceChildren(anyway, notYet);
    this.title.focus();
    this.say(`Not yet. This door opens on ${dateLabel(day, this.config)}.`);
  }

  showError(day) {
    this.setView('message');
    this.art.hidden = true;
    this.count.textContent = '';
    this.eyebrow.textContent = this.eyebrowText(day);
    this.title.textContent = day === BONUS_DAY ? this.config.bonus.label : `Day ${day}`;
    this.messageText.textContent = FRIENDLY_ERROR;
    this.messageActions.replaceChildren();
    this.title.focus();
  }

  async showDay(day) {
    this.ticket += 1;
    const ticket = this.ticket;
    this.shown = 0;
    this.returnTo = 0;
    this.setView('message');
    this.art.hidden = true;
    this.count.textContent = '';
    this.eyebrow.textContent = this.eyebrowText(day);
    this.title.textContent = day === BONUS_DAY ? this.config.bonus.label : `Day ${day}`;
    this.messageText.textContent = 'Opening the door...';
    this.messageActions.replaceChildren();
    let file;
    try {
      file = await this.load(day);
    } catch {
      if (ticket === this.ticket) this.showError(day);
      return;
    }
    if (ticket !== this.ticket) return; // the visitor moved on while it loaded
    this.shown = day;
    this.renderDay(day, file);
  }

  renderDay(day, file) {
    const { config } = this;
    this.setView('day');
    this.count.textContent = day === BONUS_DAY ? 'Bonus door' : `${day} of ${config.dayCount}`;
    this.eyebrow.textContent = this.eyebrowText(day);
    this.title.textContent = file.title;
    if (file.art) {
      this.artImage.src = artUrl(file.art);
      this.artImage.alt = file.alt;
      this.artCredit.textContent = file.credit;
      this.art.hidden = false;
    } else {
      this.artImage.removeAttribute('src');
      this.art.hidden = true;
    }
    this.reference.textContent = file.ref;
    this.credit.textContent = file.translation;
    this.story.replaceChildren(...file.paragraphs.map((paragraph) => make('p', '', paragraph)));
    this.wonder.text.textContent = file.wonder;
    this.wonder.element.open = window.matchMedia('(min-width: 900px)').matches;
    this.activity.text.textContent = file.activity;
    this.activity.element.open = false;
    this.prayerText.textContent = file.prayer;
    this.hint.element.hidden = !file.hidden;
    this.hint.text.textContent = file.hidden ?? '';
    this.hint.element.open = false;
    this.renderNav(day);
    this.shareButton.textContent = typeof navigator.share === 'function' ? 'Share this day' : 'Copy link';
    this.shareStatus.replaceChildren();
    this.title.focus();
    this.say(day === BONUS_DAY ? `${config.bonus.label} door opened` : `Day ${day} opened`);
  }

  navLabel(target, word) {
    const text = target === BONUS_DAY ? this.config.bonus.label : `Day ${target}`;
    const title = this.isUnlocked(target) ? this.titles.get(target) ?? '' : '';
    return { visible: `${word === 'prev' ? '\u2190 ' : ''}${text}${word === 'next' ? ' \u2192' : ''}`, name: `${word === 'prev' ? 'Previous' : 'Next'}: ${text}${title ? `, ${title}` : this.isUnlocked(target) ? '' : ', not yet'}` };
  }

  renderNav(day) {
    const around = neighbours(day, this.hasBonus);
    for (const [button, key] of [[this.previous, 'prev'], [this.next, 'next']]) {
      const target = around[key];
      button.hidden = !target;
      if (!target) continue;
      const label = this.navLabel(target, key);
      button.textContent = label.visible;
      button.setAttribute('aria-label', label.name);
    }
  }

  say(text) {
    this.announcer.textContent = text;
  }

  // ---- sharing ----

  async share() {
    if (!this.shown) return;
    const address = shareUrl(location.origin, location.pathname, this.shown);
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: this.title.textContent, url: address });
      } catch {
        // Cancelling the share sheet is normal; nothing to report.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(address);
      this.shareStatus.replaceChildren(make('span', '', 'Link copied.'));
    } catch {
      this.showLinkField(address);
    }
  }

  // Where the clipboard is not available: show the link in a read-only box, selected, ready to copy.
  showLinkField(address) {
    const field = make('input', 'advent-link-field');
    field.type = 'text';
    field.readOnly = true;
    field.value = address;
    field.setAttribute('aria-label', 'Link to this day');
    this.shareStatus.replaceChildren(make('span', '', 'Copy this link: '), field);
    field.focus();
    field.select();
  }
}

// ---------------------------------------------------------------------------

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
  // If the date could not be worked out, parts is null and the season state is 'after'.
  const season = seasonState(parts, config.season);

  if (preview) showPreviewNotice(root, parts);
  if (season === 'live' || season === 'archive') {
    new Calendar(root, config, parts, season).build();
  } else {
    showCalm(root, config.opensText);
  }
}

const root = document.querySelector('[data-advent]');
if (root) {
  try {
    start(root);
  } catch {
    // Anything unexpected leaves the calm message the page already shows.
  }
}
