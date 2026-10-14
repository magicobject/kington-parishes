// The AFTER-LAUNCH wording of the two files that talk about the calendar being hidden: src/pages/help-advent.html and the
// Advent section of CLAUDE.md. Launch is a COMMAND, not a copy-and-paste: `npm run advent:after-launch` applies every edit below.
//
// Each edit says how to FIND the stale piece (a line that starts with some text, a range of lines, or an exact piece of text) and
// its replacement is the block with the same id in docs/advent/after-launch/*.part (an empty block removes the piece). An edit
// refuses to apply unless its match is found EXACTLY ONCE, so if someone rewords a stale sentence without updating this file the
// command stops and names the edit (and test-unit/advent-after-launch.test.mjs fails first). The checklist lists every edit by id.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const HELP_FILE = 'src/pages/help-advent.html';
export const CLAUDE_FILE = 'CLAUDE.md';
export const PART_FILES = { [HELP_FILE]: 'docs/advent/after-launch/help-advent.html.part', [CLAUDE_FILE]: 'docs/advent/after-launch/CLAUDE-advent.md.part' };

/** How each stale piece is found: `line` (a line starting with it), `from` and `to` (a range of lines), or `text` (exact text). */
export const EDITS = [
  { id: 'h-comment', file: HELP_FILE, line: '<!-- PRE-LAUNCH TEXT' },
  { id: 'h-lede', file: HELP_FILE, line: '      <p class="lede">A calendar of 25 doors' },
  { id: 'h-jump', file: HELP_FILE, line: '        <a href="#going-live">' },
  { id: 'h-good', file: HELP_FILE, text: " (before launch this is the only way to see the calendar at all, whatever today's date)" },
  { id: 'h-linked', file: HELP_FILE, text: 'The page is not linked from anywhere, so type it in or bookmark it.' },
  { id: 'h-exists', file: HELP_FILE, text: 'the picture (once it exists), the Bible reference' },
  { id: 'h-banner', file: HELP_FILE, text: 'Before launch it only appears when you add <strong>?advent-preview=2026-12-07</strong> to the <em>home page</em> address; the real date shows nothing (and a preview on the home page shows a "Preview mode" notice too).' },
  { id: 'h-pictures', file: HELP_FILE, text: 'Before launch every picture is also timed in a real browser. The pictures for all 26 days are in.' },
  { id: 'h-pictures-missing', file: HELP_FILE, text: 'A day whose picture file is missing simply has none, until launch, when the website refuses to build without all of them.' },
  { id: 'h-section', file: HELP_FILE, from: '  <section class="alt" id="going-live">', to: '  </section>' },
  { id: 'c-comment', file: CLAUDE_FILE, line: '<!-- PRE-LAUNCH STATE' },
  { id: 'c-intro', file: CLAUDE_FILE, line: '[LAUNCH] `modules/advent/` is a self-contained' },
  { id: 'c-launch', file: CLAUDE_FILE, line: '- [LAUNCH] **Launch:**' },
  { id: 'c-flags', file: CLAUDE_FILE, line: '- [LAUNCH] **Three launch flags' },
  { id: 'c-home', file: CLAUDE_FILE, line: '- [LAUNCH] **Home page:**' },
  { id: 'c-help', file: CLAUDE_FILE, line: '- [LAUNCH] The hidden help guide' },
];

/** The match text of an edit, for the checklist and its test. */
export const matchText = (edit) => edit.line ?? edit.text ?? edit.from;

/** The replacement blocks of a .part file: "@@ id" starts a block; the block's text is up to the next "@@" line. */
export function parseParts(text) {
  const blocks = new Map();
  let current = null;
  for (const line of text.split('\n')) {
    const marker = /^@@ ([a-z-]+)$/.exec(line);
    if (marker) { current = marker[1]; blocks.set(current, []); } else if (current) blocks.get(current).push(line);
  }
  return new Map([...blocks].map(([id, lines]) => [id, lines.join('\n').replace(/\n+$/, '')]));
}

const once = (id, count) => { if (count !== 1) throw new Error(`after-launch edit "${id}": expected its text to occur exactly once, found ${count}`); };

/** Applies the edits for one file to its text; `replacements` maps an edit id to its block. */
export function applyEdits(text, edits, replacements) {
  let out = text;
  for (const edit of edits) {
    if (!replacements.has(edit.id)) throw new Error(`after-launch edit "${edit.id}": no block in the .part file`);
    const replacement = replacements.get(edit.id);
    if (edit.text !== undefined) {
      once(edit.id, out.split(edit.text).length - 1);
      out = out.replace(edit.text, () => replacement);
      continue;
    }
    const lines = out.split('\n');
    const starts = lines.flatMap((line, index) => (line.startsWith(edit.line ?? edit.from) ? [index] : []));
    once(edit.id, starts.length);
    let last = starts[0];
    if (edit.to !== undefined) {
      last = lines.findIndex((line, index) => index >= starts[0] && line === edit.to);
      if (last < 0) throw new Error(`after-launch edit "${edit.id}": the end line was not found`);
    }
    lines.splice(starts[0], last - starts[0] + 1, ...(replacement === '' ? [] : replacement.split('\n')));
    out = lines.join('\n');
  }
  return out;
}

// How many places in `text` an edit's rule matches.
function matchCount(text, edit) {
  if (edit.text !== undefined) return text.split(edit.text).length - 1;
  return text.split('\n').filter((line) => line.startsWith(edit.line ?? edit.from)).length;
}

// Whether a block's wording is in the text. A block may hold the ____ placeholder (the launch date) that the maintainer later fills in
// by hand (checklist step 9), so ____ matches any text up to the next closing bracket on that line.
function hasBlock(text, block) {
  if (!block.includes('____')) return text.includes(block);
  const escape = (part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(block.split('____').map(escape).join('[^)\\n]*')).test(text);
}

/**
 * Applies the edits to one file's text, unless they are ALREADY applied (the command can be run twice). An edit is "already applied"
 * when its stale text is gone and its after-launch wording is there (an empty block has no wording to look for, so gone is enough).
 * Returns { text, already }. If only some edits are applied, or an edit's text is neither the stale text nor the new wording,
 * it stops with a plain message instead of guessing.
 */
export function applyOrSkip(text, edits, replacements) {
  const pending = [];
  const done = [];
  for (const edit of edits) {
    const count = matchCount(text, edit);
    const block = replacements.get(edit.id);
    if (block !== undefined && block !== '' && hasBlock(text, block)) done.push(edit.id); // (its new wording is there, even if it starts like the old)
    else if (count >= 1) pending.push(edit.id);
    else if (block === '') done.push(edit.id);
    else throw new Error(`after-launch edit "${edit.id}": its text was not found, and the after-launch wording is not in the file either (is this the right file?)`);
  }
  if (pending.length === 0) return { text, already: true };
  if (done.length > 0) throw new Error(`after-launch wording is partly applied: ${done.map((id) => `"${id}"`).join(', ')} done, but ${pending.map((id) => `"${id}"`).join(', ')} not: put the file back to its state before the command, or finish the missing edits by hand`);
  return { text: applyEdits(text, edits, replacements), already: false };
}

/** The text of the two files with every edit applied, and which were already applied (nothing is written). */
export function afterLaunchTexts(root = ROOT) {
  const result = {};
  const already = [];
  for (const [file, partFile] of Object.entries(PART_FILES)) {
    const replacements = parseParts(readFileSync(join(root, partFile), 'utf8'));
    const outcome = applyOrSkip(readFileSync(join(root, file), 'utf8'), EDITS.filter((edit) => edit.file === file), replacements);
    result[file] = outcome.text;
    if (outcome.already) already.push(file);
  }
  result.already = already;
  return result;
}

/** Writes both files with every edit applied; files that were already applied are left untouched. */
export function applyAfterLaunch(root = ROOT) {
  const { already, ...texts } = afterLaunchTexts(root);
  const changed = Object.keys(texts).filter((file) => !already.includes(file));
  for (const file of changed) writeFileSync(join(root, file), texts[file]);
  return { changed, already };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { changed, already } = applyAfterLaunch();
    if (changed.length === 0) console.log('already applied: nothing to do');
    else console.log(`applied the ${EDITS.length} after-launch edits to ${changed.join(' and ')}${already.length ? ` (${already.join(' and ')} was already done)` : ''}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
