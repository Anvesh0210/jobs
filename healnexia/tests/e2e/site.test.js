/** End-to-end tests for the marketing site (index.html), served with production security headers. */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createAppServer } from '../../tools/serve.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');

let server; let browser; let base; let page; let problems;

before(async () => {
  server = createAppServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); });

beforeEach(async () => {
  page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  problems = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
  page.on('requestfailed', (r) => problems.push(`requestfailed: ${r.url()}`));
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await page.goto(base);
  await page.waitForLoadState('networkidle');
});

async function assertClean() {
  assert.deepEqual(problems, []);
  assert.deepEqual(await page.evaluate(() => window.__csp), []);
}

test('loads with self-hosted font, all assets, no errors and no CSP violations', async () => {
  assert.match(await page.title(), /HEALNEXIA/);
  assert.equal(await page.evaluate(() => document.fonts.check('16px Figtree')), true);
  assert.equal(await page.locator('h1').count(), 1);
  await assertClean();
});

test('every in-page link has a target and every page link resolves', async () => {
  const hrefs = await page.$$eval('a[href]', (as) => [...new Set(as.map((a) => a.getAttribute('href')))]);
  for (const href of hrefs) {
    if (href.startsWith('#')) assert.ok(await page.$(href), `missing target ${href}`);
    else {
      const res = await page.request.get(new URL(href, base).toString());
      assert.equal(res.status(), 200, href);
    }
  }
});

test('sections follow the reference flow', async () => {
  const ids = await page.$$eval('main > section', (s) => s.map((x) => x.id));
  assert.deepEqual(ids, ['top', 'problem', 'story', 'solution', 'how-it-works', 'security', 'timeline', 'evidence', 'personas', 'impact', 'get-started', 'faq', 'access']);
});

test('timeline tabs: click, arrow keys, Home/End, single visible panel', async () => {
  await page.click('#tl-t3');
  assert.equal(await page.isVisible('#tl-p3'), true);
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'tl-t4');
  assert.equal(await page.getAttribute('#tl-t4', 'aria-selected'), 'true');
  await page.keyboard.press('End');
  assert.equal(await page.isVisible('#tl-p6'), true);
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.isVisible('#tl-p1'), true, 'wraps around');
  assert.equal(await page.$$eval('#timeline [role=tabpanel]:not([hidden])', (p) => p.length), 1);
  assert.deepEqual(await page.$$eval('#timeline [role=tab]', (t) => t.filter((x) => x.tabIndex === 0).length), 1, 'roving tabindex');
  await assertClean();
});

test('persona tabs switch panels', async () => {
  await page.click('#pe-t4');
  assert.equal(await page.isVisible('#pe-p4'), true);
  assert.equal(await page.isVisible('#pe-p1'), false);
});

test('join dialog: validation, accessible errors, success without network', async () => {
  let requests = 0;
  page.on('request', (r) => { if (!r.url().startsWith(base)) requests += 1; });
  await page.click('#top [data-open-dialog="join-dialog"]');
  await page.waitForSelector('#join-dialog[open]');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'join-name');
  await page.click('#join-dialog button[type=submit]');
  assert.equal(await page.getAttribute('#join-name', 'aria-invalid'), 'true');
  assert.equal(await page.getAttribute('#join-name', 'aria-describedby'), 'join-name-error');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'join-name', 'focus moves to first invalid field');
  await page.fill('#join-name', '<img src=x onerror=alert(1)>');
  await page.fill('#join-email', 'not-an-email');
  await page.selectOption('#join-role', 'Clinician');
  await page.check('#join-dialog input[name=consent]');
  await page.click('#join-dialog button[type=submit]');
  assert.match(await page.textContent('#join-email-error'), /name@example\.com/);
  await page.fill('#join-email', 'alex@example.org');
  await page.click('#join-dialog button[type=submit]');
  assert.equal(await page.isVisible('#join-dialog [data-form-success]'), true);
  assert.equal(await page.$$eval('#join-dialog img', (i) => i.length), 0);
  assert.equal(requests, 0, 'form data never leaves the page');
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('#join-dialog', (d) => d.open), false);
  // Re-opening starts with a fresh form.
  await page.click('#top [data-open-dialog="join-dialog"]');
  assert.equal(await page.isVisible('#join-dialog [data-form-body]'), true);
  assert.equal(await page.inputValue('#join-email'), '');
  await assertClean();
});

test('skip link and keyboard focus are visible', async () => {
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Skip to main content');
  assert.equal(await page.isVisible('a[href="#main"]'), true);
});

test('mobile menu opens, navigates and closes; no overflow at 320/390/768/1280', async () => {
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.equal(overflow, 0, `overflow at ${width}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('[popovertarget="mobile-menu"]');
  assert.equal(await page.evaluate(() => document.getElementById('mobile-menu').matches(':popover-open')), true);
  await page.click('#mobile-menu a[href="#faq"]');
  assert.equal(await page.evaluate(() => document.getElementById('mobile-menu').matches(':popover-open')), false);
  await assertClean();
});

test('reduced motion: marquees stop and duplicates are hidden', async () => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(base);
  assert.equal(await p.$eval('.marquee-track', (el) => getComputedStyle(el).animationName), 'none');
  assert.equal(await p.$eval('.marquee-dup', (el) => getComputedStyle(el).display), 'none');
  await ctx.close();
});

test('one web app: manifest, service worker, shared navigation, works offline', async () => {
  const manifest = await page.$eval('link[rel=manifest]', (l) => l.href);
  assert.equal((await page.request.get(manifest)).status(), 200);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.goto(`${base}app.html#/overview`);
  await page.waitForSelector('#main h1');
  assert.ok(await page.isVisible('.app-links a[href="./#story"]'), 'app links back to the site');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.context().setOffline(true);
  await page.reload();
  await page.waitForSelector('#main h1');
  assert.match(await page.textContent('#main h1'), /Good morning/);
  await page.goto(base);
  assert.match(await page.textContent('h1'), /HEALNEXIA/);
  await page.context().setOffline(false);
});

test('story and evidence sections credit the founder and claim no outcomes', async () => {
  const story = await page.textContent('#story');
  assert.match(story, /Ayesha Afreen/);
  assert.match(story, /INNOVOTHON 2024/);
  assert.match(story, /202 people/);
  assert.match(await page.textContent('#evidence'), /No outcomes are claimed yet/);
});
