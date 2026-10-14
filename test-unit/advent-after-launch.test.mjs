// The AFTER-LAUNCH wording (scripts/advent-after-launch-edits.mjs and docs/advent/after-launch/*.part). Launch applies these
// edits to src/pages/help-advent.html and CLAUDE.md. This test proves, BEFORE launch, that applying them leaves none of the
// "hidden" wording behind, and, AFTER launch (the real files already edited, as in `npm run advent:rehearse`'s copy), that the
// real files are free of it.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { theme } from '../modules/advent/theme.mjs';
import { EDITS, HELP_FILE, CLAUDE_FILE, PART_FILES, afterLaunchTexts, applyEdits, matchText, parseParts } from '../scripts/advent-after-launch-edits.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const launched = theme.goLive === true;

// Words that are only true while the calendar is hidden.
const STALE = [/not public yet/i, /hidden from the public/i, /before launch/i, /nobody can find/i, /PRE-LAUNCH/, /\[LAUNCH\]/, /going-live/, /go live/i, /until launch/i, /until we go/i, /the real date shows nothing/i];

const advent = (claude) => claude.slice(claude.indexOf('## Advent calendar module'), claude.indexOf('\n## ', claude.indexOf('## Advent calendar module') + 5));

describe('the after-launch edits', () => {
  test('there is a replacement block for every edit and no block without an edit, in each .part file', () => {
    for (const [file, part] of Object.entries(PART_FILES)) {
      const blocks = parseParts(read(part));
      assert.deepEqual([...blocks.keys()].sort(), EDITS.filter((edit) => edit.file === file).map((edit) => edit.id).sort(), part);
    }
  });

  test('a rule that does not match exactly once refuses to apply (the command stops instead of leaving stale wording)', () => {
    const blocks = new Map([['x', 'new']]);
    assert.throws(() => applyEdits('a\nb', [{ id: 'x', line: 'zzz' }], blocks), /exactly once, found 0/);
    assert.throws(() => applyEdits('a1\na2', [{ id: 'x', line: 'a' }], blocks), /exactly once, found 2/);
    assert.throws(() => applyEdits('same same', [{ id: 'x', text: 'same' }], blocks), /exactly once, found 2/);
    assert.equal(applyEdits('keep\nold line\nkeep', [{ id: 'x', line: 'old' }], blocks), 'keep\nnew\nkeep');
    assert.equal(applyEdits('keep\nold line\nkeep', [{ id: 'x', line: 'old' }], new Map([['x', '']])), 'keep\nkeep', 'an empty block removes the line');
    assert.equal(applyEdits('a\n<s>\nb\n</s>\nc', [{ id: 'x', from: '<s>', to: '</s>' }], blocks), 'a\nnew\nc');
  });

  test('the checklist lists every edit by its id and quotes the start of the text it replaces', () => {
    const checklist = read('docs/advent/launch-checklist.md');
    for (const edit of EDITS) {
      assert.ok(checklist.includes(`\`${edit.id}\``), `the checklist does not list ${edit.id}`);
      assert.ok(checklist.includes(matchText(edit).trim().slice(0, 28)), `the checklist does not quote the start of ${edit.id}'s text`);
    }
  });

  test('the checklist tells the person to run npm run advent:after-launch, and the script is wired in package.json', () => {
    assert.ok(read('docs/advent/launch-checklist.md').includes('npm run advent:after-launch'));
    assert.match(read('package.json'), /"advent:after-launch": "node scripts\/advent-after-launch-edits\.mjs"/);
  });
});

describe('before launch: applying the edits leaves no stale wording', { skip: launched ? 'launched: the files are already edited' : false }, () => {
  const texts = afterLaunchTexts();

  test('the help page no longer says anything that is only true while the calendar is hidden', () => {
    for (const pattern of STALE) assert.ok(!pattern.test(texts[HELP_FILE]), `${pattern} is still in help-advent.html`);
  });

  test('the Advent section of CLAUDE.md no longer says anything that is only true while the calendar is hidden', () => {
    for (const pattern of STALE) assert.ok(!pattern.test(advent(texts[CLAUDE_FILE])), `${pattern} is still in the Advent section of CLAUDE.md`);
  });

  test('the edited help page still hangs together: every jump link has its section, ids are unique, no heading level is skipped', () => {
    const html = texts[HELP_FILE];
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, 'ids are unique');
    for (const [, target] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(target), `#${target} has no section`);
    assert.ok(ids.includes('after-the-season'));
    let level = 0;
    for (const [, digit] of html.matchAll(/<h([1-6])[\s>]/g)) {
      assert.ok(Number(digit) <= level + 1, `h${digit} after h${level}`);
      level = Number(digit);
    }
  });

  test('only the stale pieces change: everything else in each file is untouched', () => {
    const before = read(HELP_FILE).split('\n');
    const after = texts[HELP_FILE].split('\n');
    const kept = before.filter((line) => after.includes(line));
    assert.ok(kept.length > before.length - 60, 'most of the help page is unchanged');
    const claude = read(CLAUDE_FILE).split('\n');
    const claudeAfter = texts[CLAUDE_FILE].split('\n');
    assert.ok(claude.filter((line) => !claudeAfter.includes(line)).every((line) => /LAUNCH\]|PRE-LAUNCH/.test(line)), 'only [LAUNCH] lines and the pre-launch comment change in CLAUDE.md');
  });
});

describe('after launch: the real files carry none of the stale wording', { skip: launched ? false : 'not launched yet' }, () => {
  test('help-advent.html and the Advent section of CLAUDE.md', () => {
    for (const pattern of STALE) {
      assert.ok(!pattern.test(read(HELP_FILE)), `${pattern} in help-advent.html`);
      assert.ok(!pattern.test(advent(read(CLAUDE_FILE))), `${pattern} in CLAUDE.md`);
    }
  });
});
