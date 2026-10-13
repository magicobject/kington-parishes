# Advent calendar module

A small, self-contained module for a church website's Advent calendar: 25 doors,
one opening each day from 1 December, with a short Bible story, a picture and a
prayer. It is built so another church on the same website system can adopt it by
changing its settings and its content, not its code.

## What is in this folder

Generic code (the same for every church, never mentions a particular church):

- `date.mjs` works out the calendar day in the church's time zone and which doors are open.
- `preview.mjs` handles the demo switch that lets staff pretend it is another date.
- `schema.mjs` checks the settings and the 25 days of content and refuses anything unsafe.
- `build.mjs` is the build step: it checks everything, writes the generated files, and supplies the page markup and the page's entry for the host's page list.
- `client/advent.js` and `client/advent.css` are the browser files, written by hand and copied by the build.

Site-owned files (each church writes its own):

- `theme.mjs` holds the site name, dates, page address, switches and colours.
- `content.mjs` holds the 25 days of story text, references, picture names and descriptions.

## What it does not do

It stores nothing in the visitor's browser: no cookies and no saved settings.
Progress is simply today's date, so no memory is needed. It uses no outside
services and has no dependencies. The date logic runs in Node, a browser or a Worker.

## What exists now (phase 2 of docs/advent/build-plan.md)

The page is built into the site but **hidden**. With today's real date it shows only a calm
message ("Advent opens on 1 December", or "Advent comes round again on 1 December" outside the
season). With `?advent-preview=2026-12-07` on the page's address it pretends to be that date, shows a
notice and an "Exit preview" link, and from 1 December to 6 January shows 25 plain placeholder doors
marked today, not yet or available, so the date logic can be checked. The real doors, day panel,
pictures, reading text, sharing, read-aloud and the home-page banner are phase 3 and are not built.

### How it is wired into the site

- `scripts/build.mjs` calls `buildAdvent({theme, content, publicDir, siteUrl, pageNames})` once. It checks the theme and content with the validators and uses the copies they return, checks the pictures, and only then writes:
  - `public/advent/day-01.json` to `day-25.json` (plain text, fixed key order, checked again);
  - `public/css/advent-theme.css` (the colours as `--advent-*` variables);
  - `public/css/advent.css` and `public/js/advent.js` (copies of `client/`);
  - `public/js/advent/date.js` and `preview.js` (copies of `date.mjs` and `preview.mjs`). One source of truth: the browser runs the same files the tests do. The build rewrites the client's import lines to point at the copies and adds a content hash, so a changed copy is never served stale.

  Every generated file carries an AUTO-GENERATED banner (JSON cannot) and is written the same way every time, so a file only changes when its source changes.
- `renderAdventToken` replaces `{{ADVENT}}` in the page source with markup only: a section carrying its settings in `data-*` attributes, a calm message, a hidden region for the doors and a no-JavaScript note. It never contains day text, inline script, inline style or event handlers, and everything it writes is escaped (braces too, so a later token pass cannot expand anything). It runs before heading ids are added.
- `adventPageEntry(theme)` gives `src/pages.config.mjs` the page's entry; `src/pages/advent.html` is the host's own page source (its h1 and the token).
- `public/_headers` has one extra rule, for `/advent/art/*`, that only tightens the policy.

## Going live (for the person in charge)

Two switches in `theme.mjs`, both false now:

1. `artRequired: true`. The build then refuses to continue if any `public/advent/art/day-NN.svg` is missing. Pictures are always checked when they exist (no scripts, no links elsewhere, under 100 KB), whatever this says.
2. `publicListing: true`. The page joins the sitemap and the site search and loses its noindex. Nothing else changes: add a menu, footer or home-page link separately.

Rebuild, run the tests, deploy, and check the live page. The hidden help guide `/help-advent` explains this in plain English.

## Status

Phases 0, 1 and 2 are done. The door grid, day panel, pictures, reading text and the rest of
phase 3 onwards are not built, and nothing about the calendar is visible to the public.
Run the tests with `npm run test:unit` (and `npm test` for the browser tests).
