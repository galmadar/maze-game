#!/usr/bin/env node
/**
 * Enforces the one architectural rule from DESIGN.md: `src/sim/` and
 * `src/content/` must never touch the DOM, the renderer/input/audio layers,
 * or anything outside themselves. Rules that are only written down get broken;
 * this one fails the build.
 *
 * Imports are judged by an allowlist, not a blocklist:
 *   - relative imports may only land inside `src/sim/` or `src/content/`, so a
 *     new sibling directory is caught the day it appears;
 *   - package and Node-builtin imports are refused outright, except `vitest`
 *     inside `*.test.ts`.
 *
 * Relative imports are RESOLVED rather than pattern-matched, so a regex can't
 * confuse `../input/` at different depths.
 *
 * Test files inside sim/content are allowed to import each other (fixtures)
 * but still can't reach into render/input/audio, and still can't touch DOM.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const PURE_DIRS = ['sim', 'content'];

/** The only packages sim/content may import, and only from a test file. */
const TEST_ONLY_PACKAGES = ['vitest'];

const BUILTINS = new Set(builtinModules);

const DOM_GLOBALS = [
  { pattern: /(^|[^.\w])document\s*\./, why: 'touches the DOM (document)' },
  { pattern: /(^|[^.\w])window\s*\./, why: 'touches the DOM (window)' },
  { pattern: /(^|[^.\w])navigator\s*\./, why: 'touches the DOM (navigator)' },
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

/**
 * Blanks out comments and string bodies so `import`/`require`/`document.` can
 * only be found where they are really code. Positions and line breaks are
 * preserved, so an offset into the result still points at the same line.
 * Returns the masked source plus the literal text of every string, keyed by
 * the offset of its opening quote.
 */
function mask(source) {
  const chars = source.split('');
  const strings = new Map();
  const blank = (from, to) => {
    for (let k = from; k < to && k < chars.length; k++) if (chars[k] !== '\n') chars[k] = ' ';
  };

  let i = 0;
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];

    if (c === '/' && next === '/') {
      let j = i;
      while (j < source.length && source[j] !== '\n') j++;
      blank(i, j);
      i = j;
    } else if (c === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const j = end === -1 ? source.length : end + 2;
      blank(i, j);
      i = j;
    } else if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      let value = '';
      while (j < source.length) {
        if (source[j] === '\\') {
          value += source[j + 1] ?? '';
          j += 2;
          continue;
        }
        if (source[j] === c) break;
        if (c !== '`' && source[j] === '\n') break; // unterminated: don't run away
        value += source[j];
        j++;
      }
      strings.set(i, value);
      blank(i + 1, j);
      i = Math.min(j + 1, source.length);
    } else {
      i++;
    }
  }

  return { code: chars.join(''), strings };
}

// `import 'x'`, `import x from 'x'`, `export … from 'x'`.
const STATIC_RE = /(?<![.$\w])(?:import|from)\s*(['"`])/g;
// `import('x')`, `require('x')`.
const CALL_RE = /(?<![.$\w])(?:import|require)\s*\(\s*(['"`])/g;
// `import(someVariable)`, `require(join(…))` — an unreadable specifier.
const COMPUTED_RE = /(?<![.$\w])(import|require)\s*\(\s*(?!['"`])(?!\s*\))/g;

function lineOf(source, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (source[i] === '\n') line++;
  return line;
}

/** Every import specifier the file really asks for, plus computed ones. */
function* specifiers(source) {
  const { code, strings } = mask(source);
  const lines = source.split('\n');
  const seen = new Set();

  for (const re of [STATIC_RE, CALL_RE]) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(code)) !== null) {
      const quoteAt = match.index + match[0].length - 1;
      if (seen.has(quoteAt)) continue;
      seen.add(quoteAt);
      const specifier = strings.get(quoteAt);
      if (specifier === undefined) continue;
      const line = lineOf(source, match.index);
      yield { specifier, line, text: (lines[line - 1] ?? '').trim() };
    }
  }

  COMPUTED_RE.lastIndex = 0;
  let computed;
  while ((computed = COMPUTED_RE.exec(code)) !== null) {
    const line = lineOf(source, computed.index);
    yield { computed: computed[1], line, text: (lines[line - 1] ?? '').trim() };
  }
}

/** Why this specifier is forbidden here, or null if it's allowed. */
function reasonToReject(specifier, file, isTest) {
  if (specifier.startsWith('.')) {
    const target = resolve(dirname(file), specifier);
    const rel = relative(SRC, target);
    const upper = rel.split(sep)[0];
    if (rel !== '' && !rel.startsWith('..') && PURE_DIRS.includes(upper)) return null;
    const what = rel === '' || rel.startsWith('..') ? `${specifier}, outside src/` : `src/${rel}`;
    return `imports ${what} — only src/sim and src/content may be imported here`;
  }

  if (isTest && TEST_ONLY_PACKAGES.includes(specifier)) return null;

  const bare = specifier.startsWith('node:') ? specifier.slice(5) : specifier;
  if (specifier.startsWith('node:') || BUILTINS.has(bare)) {
    return `imports the Node builtin '${specifier}' — sim/content must run anywhere, not just in Node`;
  }

  if (TEST_ONLY_PACKAGES.includes(specifier)) {
    return `imports the package '${specifier}' — only allowed inside a *.test.ts file`;
  }

  return `imports the package '${specifier}' — sim/content may not depend on packages`;
}

const violations = [];

for (const dirName of PURE_DIRS) {
  const dir = join(SRC, dirName);
  let files;
  try {
    files = walk(dir);
  } catch {
    console.error(`sim purity: cannot read ${dir}`);
    process.exit(1);
  }

  for (const file of files) {
    const isTest = file.endsWith('.test.ts');
    const source = readFileSync(file, 'utf8');
    const where = relative(ROOT, file);
    const { code } = mask(source);

    for (const { specifier, computed, line, text } of specifiers(source)) {
      if (computed) {
        violations.push({
          where,
          line,
          why: `computed ${computed}() — the specifier must be a plain string so it can be checked`,
          text,
        });
        continue;
      }
      const why = reasonToReject(specifier, file, isTest);
      if (why) violations.push({ where, line, why, text });
    }

    if (isTest) continue;
    const codeLines = code.split('\n');
    const sourceLines = source.split('\n');
    for (let i = 0; i < codeLines.length; i++) {
      for (const { pattern, why } of DOM_GLOBALS) {
        if (pattern.test(codeLines[i])) {
          violations.push({ where, line: i + 1, why, text: (sourceLines[i] ?? '').trim() });
        }
      }
    }
  }
}

if (violations.length > 0) {
  console.error('\n  sim purity check FAILED\n');
  for (const v of violations) {
    console.error(`  ${v.where}:${v.line} — ${v.why}`);
    console.error(`    ${v.text}\n`);
  }
  console.error('  src/sim and src/content must stay pure: no DOM, no packages, no other src/ dirs.\n');
  process.exit(1);
}

console.log('sim purity OK — no forbidden dependencies in src/sim or src/content');
