#!/usr/bin/env node
// Increments build-number.json's per-day counter. Run once per commit (from
// the pre-commit hook) -- NOT from `npm run build`, which only reads the
// current value. Format: yyyy.mm.dd.xxx, xxx = build count for that day.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { nextBuildNumber, formatBuildNumber } from './hook-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'build-number.json');

const saved = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
const state = nextBuildNumber(saved);

writeFileSync(file, JSON.stringify(state, null, 2) + '\n');
console.log(`Build number: ${formatBuildNumber(state)}`);
