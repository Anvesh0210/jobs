#!/usr/bin/env node
/**
 * Dependency-free static checks run in CI:
 *  1. every JS module parses;
 *  2. no dangerous DOM sinks or dynamic code execution outside the one audited sink (src/lib/html.js);
 *  3. no inline event handlers, inline styles or javascript: URLs (they would also be blocked by the CSP).
 */
import { readdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ALLOWED_SINK = 'src/lib/html.js';

const RULES = [
  { re: /\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|document\.write/, msg: 'raw HTML sink (use html`` + mount())', skip: (f) => f === ALLOWED_SINK },
  { re: /\beval\s*\(|new\s+Function\s*\(|setTimeout\s*\(\s*['"`]|setInterval\s*\(\s*['"`]/, msg: 'dynamic code execution' },
  { re: /\son[a-z]+\s*=\s*["'{]/i, msg: 'inline event handler', ext: ['.html', '.js'] },
  { re: /\sstyle\s*=\s*["']/i, msg: 'inline style attribute (blocked by CSP)', ext: ['.html', '.js'] },
  { re: /javascript:/i, msg: 'javascript: URL' },
  { re: /localStorage\.(get|set|remove)Item/, msg: 'direct localStorage access (use infra/storage.js)', skip: (f) => f === 'src/infra/storage.js' }
];

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full)); else out.push(full);
  }
  return out;
}

const files = (await walk(ROOT)).map((f) => relative(ROOT, f).split('\\').join('/'))
  .filter((f) => /\.(m?js|html)$/.test(f) && !f.startsWith('tests/') && !f.startsWith('tools/'));
const problems = [];

for (const file of files) {
  if (/\.m?js$/.test(file)) {
    try { execFileSync(process.execPath, ['--check', join(ROOT, file)], { stdio: 'pipe' }); } catch (e) { problems.push(`${file}: syntax error\n${e.stderr}`); }
  }
  const lines = (await readFile(join(ROOT, file), 'utf8')).split('\n');
  for (const rule of RULES) {
    if (rule.skip?.(file)) continue;
    if (rule.ext && !rule.ext.some((x) => file.endsWith(x))) continue;
    lines.forEach((line, i) => { if (rule.re.test(line)) problems.push(`${file}:${i + 1}: ${rule.msg}\n    ${line.trim()}`); });
  }
}

if (problems.length) {
  console.error(`✗ ${problems.length} problem(s):\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`✓ ${files.length} files checked: syntax OK, no unsafe sinks, no inline handlers/styles.`);
