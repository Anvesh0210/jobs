/**
 * End-to-end tests against the real app served with production security headers.
 * Covers the PRD prototype acceptance criteria plus security behaviour (CSP, XSS, hostile storage).
 */
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
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  page = await context.newPage();
  problems = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
  page.on('dialog', (d) => d.accept());
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
});

async function go(route = 'overview') {
  await page.goto(`${base}#/${route}`);
  await page.waitForSelector('#main h1');
}
const tiles = () => page.$$eval('#main .tiles strong', (els) => els.slice(0, 4).map((e) => Number(e.textContent)));
async function assertClean() {
  assert.deepEqual(problems, []);
  assert.deepEqual(await page.evaluate(() => window.__cspViolations), []);
}

test('overview shows the priority action, progress, team and check-in (AC1, AC11)', async () => {
  await go();
  assert.equal(await page.textContent('.hero h2'), 'Follow-up blood test');
  for (const text of ['Care progress', 'Your care team', 'Wellbeing check-in', 'Recent activity']) assert.ok(await page.isVisible(`text=${text}`), text);
  assert.ok(await page.isVisible('.proto-banner'));
  assert.deepEqual(await tiles(), [5, 1, 2, 2]);
  await assertClean();
});

test('acknowledge and complete update counts, history and persist across reload (AC3)', async () => {
  await go();
  await page.click('.hero [data-command="acknowledge"]');
  assert.match(await page.textContent('.hero .chips'), /Acknowledged.*Patient-reported/);
  await page.click('.hero [data-command="markComplete"]');
  assert.deepEqual(await tiles(), [4, 1, 2, 3]);
  await page.reload(); await page.waitForSelector('#main h1');
  assert.deepEqual(await tiles(), [4, 1, 2, 3]);
  await go('actions'); await page.click('[data-tab="completed"]');
  await page.click('#A-1042 summary');
  assert.match(await page.textContent('#A-1042 .history'), /Marked complete \(patient-reported/);
  assert.ok(await page.isVisible('#A-1042 [data-command="reopen"]'));
  await assertClean();
});

test('timeline filters and episode grouping (AC4)', async () => {
  await go('journey');
  await page.click('[data-timeline="medication"]');
  assert.equal(await page.$$eval('.tl-item', (e) => e.length), 2);
  assert.equal(await page.getAttribute('[data-timeline="medication"]', 'aria-pressed'), 'true');
  await page.click('[data-timeline="all"]');
  await page.check('#tl-group');
  assert.equal(await page.$$eval('.episode-group', (e) => e.length), 3);
  await assertClean();
});

test('records search and type filter (AC5)', async () => {
  await go('records');
  await page.fill('#rec-q', 'northbank');
  assert.equal(await page.textContent('#rec-count'), '3 records shown.');
  await page.selectOption('#rec-t', 'result');
  assert.equal(await page.textContent('#rec-count'), '1 record shown.');
  assert.equal(await page.inputValue('#rec-q'), 'northbank', 'search keeps focus/value while filtering');
  await assertClean();
});

test('medication reminders toggle and persist without implying adherence (AC6)', async () => {
  await go('meds');
  await page.check('[data-med="ramipril"]');
  await page.reload(); await page.waitForSelector('#main h1');
  assert.equal(await page.isChecked('[data-med="ramipril"]'), true);
  assert.ok(await page.isVisible('text=do not record whether you have taken a medicine'));
  assert.ok(await page.isVisible('text=Sources disagree'));
  await assertClean();
});

test('contextual message, urgent backstop and XSS-safe rendering (AC7)', async () => {
  await go('meds');
  await page.click('[data-do="compose"][data-ctx="med:ramipril"]');
  await page.waitForSelector('#m-text:focus');
  assert.equal(await page.inputValue('#m-ctx'), 'med:ramipril');
  const payload = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=2</script>';
  await page.fill('#m-text', payload);
  await page.click('#m-send');
  assert.equal(await page.evaluate(() => window.__pwned), undefined);
  assert.equal(await page.$$eval('.thread img, .thread script', (e) => e.length), 0);
  assert.ok((await page.textContent('.thread')).includes(payload), 'payload shown as literal text');
  await page.fill('#m-text', 'I have chest pain');
  await page.click('#m-send');
  assert.match(await page.textContent('#m-err'), /may be urgent/);
  await page.click('#m-send');
  assert.ok((await page.textContent('#h-conv + ul')).includes('I have chest pain'));
  await assertClean();
});

test('wellbeing check-in validates and completes the check-in action', async () => {
  await go();
  await page.click('#checkin button[type="submit"]');
  assert.equal(await page.textContent('#ci-err'), 'Please choose one option.');
  await page.check('input[value="Mostly well"]');
  await page.fill('#ci-note', 'Sleeping better');
  await page.click('#checkin button[type="submit"]');
  assert.match(await page.textContent('#h-ci + p'), /Mostly well.*Sleeping better/);
  await assertClean();
});

test('provider worklist, summary drawer, simulated reminder and closed loop (AC8)', async () => {
  await go('dashboard');
  assert.equal(await page.$$eval('.work-item', (e) => e.length), 7);
  await page.click('[data-do="openSummary"][data-id="W-1"]');
  await page.waitForSelector('#drawer[open]');
  await page.selectOption('#pv-tpl', '1');
  await page.click('#pvform button[type="submit"]');
  assert.ok(await page.isVisible('#drawer >> text=Sending another may create duplicate reminders'));
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('#drawer', (d) => d.open), false);
  await go('audit');
  assert.match(await page.textContent('#main ol li'), /Please tell us if you have already arranged this elsewhere/);
  // Patient acknowledges → item leaves the worklist.
  await go(); await page.click('.hero [data-command="acknowledge"]');
  await go('dashboard');
  assert.equal(await page.$$eval('.work-item', (e) => e.length), 6);
  await go('messages');
  assert.ok((await page.textContent('#h-conv + ul')).includes('Please tell us if you have already arranged this elsewhere'));
  await assertClean();
});

test('keyboard: skip link, visible focus, operable controls (AC9)', async () => {
  await go();
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Skip to main content');
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  assert.notEqual(outline, 'none');
  await page.focus('.hero [data-command="acknowledge"]');
  await page.keyboard.press('Enter');
  assert.match(await page.textContent('.hero .chips'), /Acknowledged/);
  await assertClean();
});

test('no horizontal overflow at 320, 768 and 1280 px on every route (AC10)', async () => {
  const routes = ['overview', 'journey', 'actions', 'records', 'meds', 'messages', 'team', 'dashboard', 'integrations', 'audit'];
  for (const width of [320, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const r of routes) {
      await go(r);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.equal(overflow, 0, `${r} @ ${width}px`);
    }
  }
  await assertClean();
});

test('hostile or corrupted local storage cannot inject markup or crash the app', async () => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('healnexia-prototype', JSON.stringify({
      v: 2,
      actions: { 'A-1042': { status: '<img src=x onerror=window.__pwned=1>', hist: [{ t: 'now', who: '<b>x</b>', what: '<img src=x onerror=window.__pwned=2>' }] } },
      conversations: [{ id: 'c1', ctx: 'general', subject: '<script>window.__pwned=3</script>', withWho: 'x', msgs: [{ me: true, who: 'x', t: 't', text: '<svg onload=window.__pwned=4>', status: 's' }] }],
      audit: 'not-an-array'
    }));
  });
  await go('actions');
  await page.click('#A-1042 summary');
  await go('messages');
  assert.equal(await page.evaluate(() => window.__pwned), undefined);
  assert.equal(await page.$$eval('#main img, #main svg, #main script', (e) => e.length), 0);
  assert.ok(await page.isVisible('text=invalid and has been reset'));
  await assertClean();
});

test('unknown routes fall back to overview; reset restores seed state', async () => {
  await page.goto(`${base}#/<script>`);
  await page.waitForSelector('#main h1');
  assert.match(await page.textContent('#main h1'), /Good morning/);
  await page.click('.hero [data-command="acknowledge"]');
  await page.click('[data-do="reset"]');
  await page.waitForSelector('.hero [data-command="acknowledge"]');
  await assertClean();
});
