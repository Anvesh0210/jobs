import { test } from 'node:test';
import assert from 'node:assert/strict';
import { html, escapeHtml, join, mount, SafeHtml } from '../../src/lib/html.js';
import { sanitizeText } from '../../src/lib/text.js';

test('interpolated values are escaped', () => {
  const out = html`<p title="${'"><img src=x onerror=alert(1)>'}">${'<script>alert(1)</script>'}</p>`.value;
  assert.ok(!out.includes('<script>'));
  assert.ok(!out.includes('<img'));
  assert.ok(out.includes('&lt;script&gt;'));
  assert.ok(out.includes('&quot;&gt;&lt;img src&#61;x'));
});

test('nested SafeHtml and arrays are not double-escaped', () => {
  const inner = html`<b>${'a&b'}</b>`;
  assert.equal(html`<p>${[inner, inner]}</p>`.value, '<p><b>a&amp;b</b><b>a&amp;b</b></p>');
});

test('null, undefined and false render nothing; 0 renders', () => {
  assert.equal(html`${null}${undefined}${false}${0}`.value, '0');
});

test('SafeHtml cannot be forged by a plain object or mutated', () => {
  assert.equal(html`${{ value: '<b>x</b>' }}`.value, '[object Object]');
  const s = html`<i></i>`;
  assert.throws(() => { s.value = '<script>'; });
  assert.ok(Object.isFrozen(s));
});

test('join escapes string separators', () => {
  assert.equal(join(['a', 'b'], '<br>').value, 'a&lt;br&gt;b');
});

test('mount only accepts SafeHtml', () => {
  const el = { innerHTML: '' };
  assert.throws(() => mount(el, '<b>raw</b>'), TypeError);
  mount(el, html`<b>${'ok'}</b>`);
  assert.equal(el.innerHTML, '<b>ok</b>');
  assert.ok(html`` instanceof SafeHtml);
});

test('escapeHtml covers all attribute-breaking characters', () => {
  assert.equal(escapeHtml(`&<>"'\`=`), '&amp;&lt;&gt;&quot;&#39;&#96;&#61;');
});

test('sanitizeText strips control and bidi characters, trims, limits and is idempotent', () => {
  const dirty = '  hi\u0000 there‮ evil \u0007 ';
  const once = sanitizeText(dirty, 100);
  assert.equal(once, 'hi there evil');
  assert.equal(sanitizeText(once, 100), once);
  assert.equal(sanitizeText('abc  def', 4), 'abc');
  assert.equal(sanitizeText(42, 10), '');
  assert.equal(sanitizeText('a\r\nb', 10), 'a\nb');
});
