import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = (p) => readFile(join(ROOT, p), 'utf8');

async function walk(dir) {
  const out = [];
  for (const e of await readdir(join(ROOT, dir), { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...await walk(p)); else out.push(p);
  }
  return out;
}

async function precacheList() {
  const sw = await read('sw.js');
  const block = sw.slice(sw.indexOf('const PRECACHE = ['), sw.indexOf('];', sw.indexOf('const PRECACHE')));
  return [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

test('service worker precaches every public runtime file, and only files that exist', async () => {
  const list = await precacheList();
  const runtime = [
    ...(await walk('src')), ...(await walk('assets')),
    'site/main.js', 'index.html', 'app.html', 'styles.css', 'manifest.webmanifest'
  ].filter((f) => !f.endsWith('.txt'));
  for (const f of runtime) assert.ok(list.includes(f), `missing from PRECACHE: ${f}`);
  for (const f of list.filter((x) => x !== './')) assert.ok((await stat(join(ROOT, f))).isFile(), `PRECACHE lists missing file ${f}`);
  assert.equal(new Set(list).size, list.length, 'no duplicates');
});

test('manifest is valid and its icons exist', async () => {
  const m = JSON.parse(await read('manifest.webmanifest'));
  assert.equal(m.short_name, 'HEALNEXIA');
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, './');
  assert.ok(m.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'));
  for (const i of [...m.icons, ...m.shortcuts.flatMap((s) => s.icons)]) assert.ok((await stat(join(ROOT, i.src))).isFile(), i.src);
  for (const s of m.shortcuts) assert.match(s.url, /^app\.html#\/[a-z]+$/);
});

test('both pages link the manifest and allow the worker in their CSP', async () => {
  for (const page of ['index.html', 'app.html']) {
    const html = await read(page);
    assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/, page);
    assert.match(html, /worker-src 'self'/, page);
    assert.match(html, /connect-src 'none'/, `${page} pages themselves still cannot make network requests`);
  }
});

test('deploy workflow publishes the PWA files', async () => {
  const wf = await read('../.github/workflows/healnexia-pages.yml');
  for (const f of ['sw.js', 'manifest.webmanifest', 'index.html', 'app.html', 'assets', 'src', 'site']) assert.ok(wf.includes(f), f);
  assert.ok(relative(ROOT, ROOT) === '');
});
