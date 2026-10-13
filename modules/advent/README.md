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

Site-owned files (each church writes its own):

- `theme.mjs` holds the site name, dates, page address, switches and colours.
- `content.mjs` holds the 25 days of story text, references, picture names and descriptions.

## What it does not do

It stores nothing in the visitor's browser: no cookies and no saved settings.
Progress is simply today's date, so no memory is needed. It uses no outside
services and has no dependencies. The date logic runs in Node, a browser or a Worker.

## Status

Only the tested date and checking logic exists so far (phases 0 and 1 of
`docs/advent/build-plan.md`). The page, the door grid, the build steps, the
pictures and the help guide (phase 2 onwards) are not wired in yet, so nothing
about the calendar is visible on the live site. Run the tests with `npm run test:unit`.
