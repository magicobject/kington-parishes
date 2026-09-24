import { test, expect } from './support/fixtures';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// calendar.html's Event structured data (see CLAUDE.md's "Calendar & events")
// is computed at build time from src/events.config.mjs, filtered to events
// on or after the build date, with each event's location run through
// placeFor(). These specs check the actual generated public/calendar.html
// against that source of truth — not just placeFor() in isolation (covered
// separately in test-unit/events-config.test.mjs).
//
// build.mjs's cutoff is the real date `npm run build` happened to run on —
// build-number.json's date only matches that when the pre-commit hook did
// the building (it stays put across any plain `npm run build` run by hand
// in between, e.g. while iterating locally), so this derives the cutoff
// actually used from public/calendar.html's own data instead of assuming
// build-number.json reflects it.

function readCalendarStructuredData(): any[] {
  const html = readFileSync(join(__dirname, '..', 'public', 'calendar.html'), 'utf8');
  const match = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
  if (!match) throw new Error('no structured data script found on public/calendar.html');
  return JSON.parse(match[1]);
}

test("calendar.html's Event structured data matches src/events.config.mjs exactly, one Event per occurrence on or after the build's cutoff date", async () => {
  // Untyped: events.config.mjs is a plain ESM source file with no .d.ts,
  // same as scripts/build.mjs's own import of it. A non-literal specifier
  // stops tsc from trying (and failing) to resolve declarations for it.
  const eventsConfigPath = '../src/events.config.mjs';
  const eventsConfig: any = await import(eventsConfigPath);
  const { expandEvents, placeFor } = eventsConfig;
  const actual = readCalendarStructuredData();
  expect(actual.length).toBeGreaterThan(0);

  // The events are emitted in expandEvents()'s own chronological order (see
  // build.mjs), so the first entry's date is the cutoff that was actually
  // applied — read it from the data rather than assuming which real-world
  // date the build ran on.
  const cutoff = actual[0].startDate.slice(0, 10);
  const expected = expandEvents().filter((e: { date: string }) => e.date >= cutoff);

  expect(actual).toHaveLength(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i]['@type']).toBe('Event');
    expect(actual[i].name).toBe(expected[i].title);
    // Whole-day events get a date-only startDate; timed ones a full datetime.
    expect(actual[i].startDate).toBe(
      expected[i].allDay ? expected[i].date : `${expected[i].date}T${expected[i].time}:00`,
    );
    expect(actual[i].location).toEqual(placeFor(expected[i].location));
  }
});

test('the build cutoff is a recent date, not a stale leftover from a much older build', () => {
  const actual = readCalendarStructuredData();
  const cutoff = actual[0].startDate.slice(0, 10);
  const daysSinceCutoff = (Date.now() - new Date(`${cutoff}T00:00:00`).getTime()) / 86_400_000;
  // Generous window — this only needs to catch "public/ hasn't been rebuilt
  // in ages", not flag an ordinary same-day or next-day test run.
  expect(daysSinceCutoff).toBeLessThan(30);
});

test('an event at a recognised church carries a full postal address; an event at an unrecognised venue does not', async () => {
  const actual = readCalendarStructuredData();

  const churchEvent = actual.find((e) => e.location?.name === "St Mary's, Kington");
  expect(churchEvent).toBeTruthy();
  expect(churchEvent.location.address).toEqual({
    '@type': 'PostalAddress',
    addressLocality: 'Kington',
    addressCountry: 'GB',
  });

  // "Carols at the Oxford" has no `location` set in events.config.mjs (the
  // venue is named in the title instead) — placeFor() falls back to the
  // generic org name with no address, rather than guessing one.
  const noVenueEvent = actual.find((e) => e.name === 'Carols at the Oxford');
  expect(noVenueEvent).toBeTruthy();
  expect(noVenueEvent.location).toEqual({ '@type': 'Place', name: 'Kington Parishes' });
});
