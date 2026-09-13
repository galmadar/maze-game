#!/usr/bin/env node
/**
 * Enforces the one architectural rule from DESIGN.md: `src/sim/` and
 * `src/content/` must never touch the DOM or the renderer/input/audio layers.
 * Rules that are only written down get broken; this one fails the build.
 *
 * Relative imports are RESOLVED rather than pattern-matched, so a regex can't
 * confuse `../input/` at different depths.
 *
 * Test files inside sim/content are allowed to import each other (fixtures)
 * but still can't reach into render/input/audio, and still can't touch DOM.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const PURE_DIRS = ['sim', 'content'];
const FORBIDDEN_UPPER = ['render', 'input', 'audio'];

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

function* specifiers(source) {
  const re = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    if (trimmed.startsWith('*') || trimmed.startsWith('//')) continue;
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(line)) !== null) {
      yield { specifier: match[1], line: i + 1, text: trimmed };
    }
  }
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

    for (const { specifier, line, text } of specifiers(source)) {
      if (!specifier.startsWith('.')) continue; // no external deps forbidden here

      const target = resolve(dirname(file), specifier);
      const rel = relative(SRC, target).split(sep)[0];

      if (PURE_DIRS.includes(rel)) continue; // sim <-> content, fine

      if (FORBIDDEN_UPPER.includes(rel)) {
        violations.push({ where, line, why: `imports from ${rel}/ — outside sim/content`, text });
      }
    }

    if (isTest) continue;
    const lines = source.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trimStart();
      if (trimmed.startsWith('*') || trimmed.startsWith('//')) continue;
      for (const { pattern, why } of DOM_GLOBALS) {
        if (pattern.test(lines[i])) violations.push({ where, line: i + 1, why, text: trimmed });
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
  console.error('  src/sim and src/content must stay pure: no DOM, no render/input/audio.\n');
  process.exit(1);
}

console.log('sim purity OK — no forbidden dependencies in src/sim or src/content');
