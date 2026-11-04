import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePublicPath, createAppServer, SECURITY_HEADERS, WORKER_CSP } from '../../tools/serve.mjs';
import { parseRoute } from '../../src/ui/app.js';

test('path resolution blocks traversal, dotfiles, non-public dirs and unknown types', () => {
  assert.ok(resolvePublicPath('/').endsWith('index.html'));
  assert.ok(resolvePublicPath('/src/main.js').endsWith('main.js'));
  for (const bad of ['/../package.json', '/%2e%2e/%2e%2e/etc/passwd', '/src/../../x.js', '/.git/config', '/package.json', '/tests/unit/html.test.js', '/tools/serve.mjs', '/src/main.js%00.html', '/%E0%A4%A']) {
    assert.equal(resolvePublicPath(bad), null, bad);
  }
});

let server; let base;
before(async () => {
  server = createAppServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test('serves pages with security headers', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) assert.equal(res.headers.get(k), v, k);
  assert.match(res.headers.get('content-type'), /text\/html/);
});

test('service worker gets its own narrow CSP so it can fill the offline cache', async () => {
  const res = await fetch(`${base}/sw.js`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-security-policy'), WORKER_CSP);
  assert.match(res.headers.get('content-type'), /javascript/);
  assert.equal((await fetch(`${base}/manifest.webmanifest`)).headers.get('content-type'), 'application/manifest+json');
});

test('rejects non-GET methods and unknown paths', async () => {
  assert.equal((await fetch(`${base}/`, { method: 'POST' })).status, 405);
  assert.equal((await fetch(`${base}/package.json`)).status, 404);
  assert.equal((await fetch(`${base}/src/nope.js`)).status, 404);
});

test('router only accepts known routes', () => {
  assert.equal(parseRoute('#/meds'), 'meds');
  for (const bad of ['', '#/', '#/__proto__', '#/constructor', '#/meds?x=1', '#/<script>', 'javascript:alert(1)']) assert.equal(parseRoute(bad), 'overview', bad);
});
