#!/usr/bin/env node
// Increments build-number.json's per-day counter. Run once per commit (from
// the pre-commit hook) — NOT from `npm run build`, which only reads the
// current value. Format: yyyy.mm.dd.xxx, xxx = build count for that day.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'build-number.json');

const today = new Date();
const date = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, '0'),
  String(today.getDate()).padStart(2, '0'),
].join('.');

let state = { date, build: 0 };
if (existsSync(file)) {
  const saved = JSON.parse(readFileSync(file, 'utf8'));
  if (saved.date === date) state = saved;
}

state.build += 1;

writeFileSync(file, JSON.stringify(state, null, 2) + '\n');
console.log(`Build number: ${date}.${String(state.build).padStart(3, '0')}`);
