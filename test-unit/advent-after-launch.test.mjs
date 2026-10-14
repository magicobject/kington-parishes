// The AFTER-LAUNCH wording (scripts/advent-after-launch-edits.mjs and docs/advent/after-launch/*.part). Launch applies these
// edits to src/pages/help-advent.html and CLAUDE.md. This test proves, BEFORE launch, that applying them leaves none of the
// "hidden" wording behind, and, AFTER launch (the real files already edited, as in `npm run advent:rehearse`'s copy), that the
// real files are free of it.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { theme } from '../modules/advent/theme.mjs';
import { EDITS, HELP_FILE, CLAUDE_FILE, PART_FILES, afterLaunchTexts, applyAfterLaunch, applyEdits, applyOrSkip, matchText, parseParts } from '../scripts/advent-after-launch-edits.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const launched = theme.goLive === true;

// Words that are only true while the calendar is hidden.
const STALE = [/not public yet/i, /hidden from the public/i, /before launch/i, /nobody can find/i, /PRE-LAUNCH/, /\[LAUNCH\]/, /going-live/, /go live/i, /until launch/i, /until we go/i, /the real date shows nothing/i, /not linked from anywhere/i, /once it exists/i];

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

describe('running the after-launch command twice (N1)', () => {
  const blocks = new Map([['a', 'NEW A'], ['b', '']]);
  const edits = [{ id: 'a', line: 'old a' }, { id: 'b', line: 'old b' }];

  test('applyOrSkip applies a fresh file, and a file that is already applied is left as it is', () => {
    const fresh = applyOrSkip(['keep', 'old a', 'old b', 'keep'].join('\n'), edits, blocks);
    assert.deepEqual(fresh, { text: ['keep', 'NEW A', 'keep'].join('\n'), already: false });
    assert.deepEqual(applyOrSkip(fresh.text, edits, blocks), { text: fresh.text, already: true });
  });

  test('a block with the ____ launch-date placeholder still counts as applied after the maintainer has written the real date over it', () => {
    const dated = new Map([['a', '- **Launched** (date of the launch commit: ____). More.']]);
    const one = [{ id: 'a', line: '- [LAUNCH] **Launch:**' }];
    assert.equal(applyOrSkip('keep\n- **Launched** (date of the launch commit: 2026-12-01). More.', one, dated).already, true);
    assert.equal(applyOrSkip('keep\n- **Launched** (date of the launch commit: ____). More.', one, dated).already, true);
    assert.equal(applyOrSkip('keep\n- [LAUNCH] **Launch:** old', one, dated).already, false);
  });

  test('a partly applied file stops with a clear message that names what is missing', () => {
    assert.throws(() => applyOrSkip(['keep', 'NEW A', 'old b'].join('\n'), edits, blocks), /partly applied.*"b"/);
    assert.throws(() => applyOrSkip('keep', edits, blocks), /"a".*not found/s);
  });

  test('the real command, run twice on a copy of the files: the second run says nothing to do and changes no byte', { skip: launched ? 'launched: the real files are already edited' : false }, () => {
    const root = mkdtempSync(join(tmpdir(), 'advent-after-twice-'));
    try {
      for (const file of [...Object.keys(PART_FILES), ...Object.values(PART_FILES)]) {
        mkdirSync(dirname(join(root, file)), { recursive: true });
        cpSync(new URL(`../${file}`, import.meta.url), join(root, file));
      }
      const first = applyAfterLaunch(root);
      assert.deepEqual(first, { changed: [HELP_FILE, CLAUDE_FILE], already: [] });
      const bytes = Object.keys(PART_FILES).map((file) => readFileSync(join(root, file)));
      const second = applyAfterLaunch(root);
      assert.deepEqual(second, { changed: [], already: [HELP_FILE, CLAUDE_FILE] });
      Object.keys(PART_FILES).forEach((file, index) => assert.ok(readFileSync(join(root, file)).equals(bytes[index]), `${file} changed`));
      // partial: put one stale line back
      writeFileSync(join(root, HELP_FILE), readFileSync(join(root, HELP_FILE), 'utf8').replace('        <a href="#after-the-season">After the season</a>', '        <a href="#going-live">Going live</a>'));
      assert.throws(() => applyAfterLaunch(root), /partly applied/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
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

describe('the launch date (N2): the maintainer fills it in by hand, and the tests refuse to pass until they have', { skip: launched ? false : 'not launched yet' }, () => {
  test('no literal ____ is left in the Advent section of CLAUDE.md once the calendar has gone live', () => {
    assert.ok(!advent(read(CLAUDE_FILE)).includes('____'), 'CLAUDE.md still says "date of the launch commit: ____": write the real date of the launch commit there (checklist step 9)');
  });
});

describe('the checklist has an explicit step for the launch date (N2)', () => {
  test('a numbered step names the Launched line and the ____ to replace, and comes after the wording step and before the final run', () => {
    const checklist = read('docs/advent/launch-checklist.md');
    const start = checklist.search(/^\d+\. \*\*Fill in the launch date/m);
    assert.ok(start >= 0, 'no numbered step "Fill in the launch date"');
    const step = checklist.slice(start, checklist.indexOf('\n\n', start) > 0 ? checklist.indexOf('\n\n', start) : undefined);
    assert.ok(step.includes('____') && step.includes('date of the launch commit'));
    assert.ok(start > checklist.indexOf('Apply the after-launch wording'));
    assert.ok(start < checklist.indexOf('Run everything with the flags flipped'));
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
