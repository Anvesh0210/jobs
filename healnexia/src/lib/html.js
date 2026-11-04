/**
 * Auto-escaping HTML templating.
 *
 * Every interpolated value is escaped unless it is already a SafeHtml instance
 * produced by this module. `mount()` is the single innerHTML sink in the app and
 * refuses anything that is not SafeHtml, so untrusted strings cannot reach the DOM
 * as markup by accident.
 */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;', '=': '&#61;' };

export class SafeHtml {
  #value;
  constructor(value) { this.#value = value; Object.freeze(this); }
  get value() { return this.#value; }
  toString() { return this.#value; }
}

export function escapeHtml(input) {
  return String(input).replace(/[&<>"'`=]/g, (c) => ESCAPES[c]);
}

function serialise(value) {
  if (value === null || value === undefined || value === false) return '';
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(serialise).join('');
  return escapeHtml(value);
}

/** Tagged template: html`<p>${untrusted}</p>` */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i += 1) out += serialise(values[i]) + strings[i + 1];
  return new SafeHtml(out);
}

/** Joins a list of fragments with an optional (trusted, static) separator. */
export function join(items, separator = '') {
  return new SafeHtml(items.map(serialise).join(serialise(separator)));
}

/** Writes trusted markup into an element. The only innerHTML assignment in the app. */
export function mount(element, fragment) {
  if (!(fragment instanceof SafeHtml)) throw new TypeError('mount() requires SafeHtml');
  element.innerHTML = fragment.value; // eslint-disable-line no-unsanitized/property -- guarded above
}
