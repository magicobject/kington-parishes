#!/usr/bin/env node
// Rewrites JavaScript source files so every non-ASCII character becomes a \uXXXX escape (a character outside the basic plane
// becomes two escapes, a surrogate pair). Why: the file-writing tool turns \uXXXX in what it is given into the literal character,
// so source written through it can silently gain non-ASCII bytes. Usage: node scripts/ascii-escape.mjs <file> [<file> ...]
//
// Only strings, template literals, regular expressions and comments are touched, and no ASCII byte ever changes. A non-ASCII
// character anywhere else (an identifier, say) is refused with its line number and the file is left alone: fix that by hand.
// A backslash directly before a non-ASCII character in a string is dropped (\e-acute means e-acute), so the meaning is kept.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WORD_BEFORE_REGEX = new Set(['return', 'typeof', 'case', 'in', 'of', 'delete', 'void', 'throw', 'new', 'else', 'do', 'yield', 'await']);
const escapeChar = (character) => [...character].flatMap((point) => {
  const code = point.codePointAt(0);
  const units = code > 0xffff ? [0xd800 + ((code - 0x10000) >> 10), 0xdc00 + ((code - 0x10000) & 0x3ff)] : [code];
  return units.map((unit) => `\\u${unit.toString(16).padStart(4, '0')}`);
}).join('');

/** The source with every non-ASCII character in a string, regular expression or comment escaped; throws on one anywhere else. */
export function escapeSource(source) {
  let out = '';
  let i = 0;
  let regexAllowed = true; // whether a "/" here starts a regular expression
  const lineAt = (index) => source.slice(0, index).split('\n').length;

  // Copies characters up to and including `end`, escaping non-ASCII ones; a backslash escapes the next character.
  const copyLiteral = (end, lineEnds = false) => {
    while (i < source.length) {
      const c = source[i];
      if (c === '\\') {
        const next = String.fromCodePoint(source.codePointAt(i + 1));
        if (next.charCodeAt(0) > 127) { out += escapeChar(next); i += 1 + next.length; } else { out += c + next; i += 2; }
      } else if (c === end) { out += c; i += 1; return; } else if (lineEnds && c === '\n') { return; } else {
        const point = String.fromCodePoint(source.codePointAt(i));
        out += point.charCodeAt(0) > 127 ? escapeChar(point) : point;
        i += point.length;
      }
    }
  };

  // Copies a regular expression literal: a "/" inside [...] does not end it.
  const copyRegex = () => {
    out += '/'; i += 1;
    let inClass = false;
    while (i < source.length) {
      const c = source[i];
      if (c === '\\') { copyOne(i); continue; }
      if (c === '\n') return;
      if (c === '[') inClass = true;
      else if (c === ']') inClass = false;
      else if (c === '/' && !inClass) { out += c; i += 1; while (/[a-z]/i.test(source[i] ?? '')) { out += source[i]; i += 1; } return; }
      const point = String.fromCodePoint(source.codePointAt(i));
      out += point.charCodeAt(0) > 127 ? escapeChar(point) : point;
      i += point.length;
    }
  };
  // Copies a backslash pair at `at` (inside a regex).
  function copyOne(at) {
    const next = String.fromCodePoint(source.codePointAt(at + 1));
    if (next.charCodeAt(0) > 127) { out += escapeChar(next); i = at + 1 + next.length; } else { out += source[at] + next; i = at + 2; }
  }

  // A template literal; "${" starts ordinary code that ends at the matching "}".
  const copyTemplate = () => {
    out += '`'; i += 1;
    while (i < source.length) {
      const c = source[i];
      if (c === '`') { out += c; i += 1; return; }
      if (c === '$' && source[i + 1] === '{') { out += '${'; i += 2; scanCode(true); continue; }
      if (c === '\\') { copyOne(i); continue; }
      const point = String.fromCodePoint(source.codePointAt(i));
      out += point.charCodeAt(0) > 127 ? escapeChar(point) : point;
      i += point.length;
    }
  };

  // Ordinary code. With `untilBrace`, stops after the "}" that closes a template's "${".
  function scanCode(untilBrace) {
    let depth = 0;
    let previousWord = '';
    while (i < source.length) {
      const c = source[i];
      if (c === '\'' || c === '"') { out += c; i += 1; copyLiteral(c, true); regexAllowed = false; previousWord = ''; continue; }
      if (c === '`') { copyTemplate(); regexAllowed = false; previousWord = ''; continue; }
      if (c === '/' && source[i + 1] === '/') {
        while (i < source.length && source[i] !== '\n') { const point = String.fromCodePoint(source.codePointAt(i)); out += point.charCodeAt(0) > 127 ? escapeChar(point) : point; i += point.length; }
        continue;
      }
      if (c === '/' && source[i + 1] === '*') {
        const end = source.indexOf('*/', i + 2);
        const stop = end < 0 ? source.length : end + 2;
        for (const point of source.slice(i, stop)) out += point.charCodeAt(0) > 127 ? escapeChar(point) : point;
        i = stop;
        continue;
      }
      if (c === '/' && (regexAllowed || WORD_BEFORE_REGEX.has(previousWord))) { copyRegex(); regexAllowed = false; previousWord = ''; continue; }
      if (c.charCodeAt(0) > 127 || (c >= '\ud800' && c <= '\udbff')) {
        const point = String.fromCodePoint(source.codePointAt(i));
        throw new Error(`non-ASCII character ${JSON.stringify(point)} outside a string, regular expression or comment on line ${lineAt(i)}`);
      }
      if (c === '{') depth += 1;
      if (c === '}') {
        if (untilBrace && depth === 0) { out += c; i += 1; return; }
        depth -= 1;
      }
      out += c; i += 1;
      if (/[A-Za-z0-9_$]/.test(c)) { previousWord = /[A-Za-z0-9_$]/.test(source[i - 2] ?? '') ? previousWord + c : c; regexAllowed = false; continue; }
      if (/\s/.test(c)) continue;
      previousWord = '';
      regexAllowed = !(c === ')' || c === ']' || c === '}');
    }
  }

  scanCode(false);
  return out;
}

function main(files) {
  if (files.length === 0) {
    console.error('Usage: node scripts/ascii-escape.mjs <file> [<file> ...]');
    process.exitCode = 2;
    return;
  }
  for (const file of files) {
    try {
      const before = readFileSync(file, 'utf8');
      const after = escapeSource(before);
      if (after === before) console.log(`${file}: already plain ASCII`);
      else { writeFileSync(file, after); console.log(`${file}: non-ASCII characters rewritten as \\u escapes`); }
    } catch (error) {
      console.error(`${file}: ${error.message}; the file was not changed`);
      process.exitCode = 1;
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
