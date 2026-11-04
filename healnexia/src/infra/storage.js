/**
 * Storage adapters (dependency inversion: the store depends on this tiny interface,
 * not on window.localStorage).
 *
 * interface KeyValueStorage { read(key): string|null; write(key, value): boolean; remove(key): void; readonly persistent: boolean }
 */

export class MemoryStorage {
  #map = new Map();
  get persistent() { return false; }
  read(key) { return this.#map.has(key) ? this.#map.get(key) : null; }
  write(key, value) { this.#map.set(key, String(value)); return true; }
  remove(key) { this.#map.delete(key); }
}

/** Wraps Web Storage. Any access failure (private mode, quota, blocked) degrades to memory. */
export class WebStorage {
  #backend; #fallback = new MemoryStorage(); #ok;
  constructor(backend) {
    this.#backend = backend;
    try {
      const probe = '__healnexia_probe__';
      backend.setItem(probe, '1'); backend.removeItem(probe);
      this.#ok = true;
    } catch { this.#ok = false; }
  }
  get persistent() { return this.#ok; }
  read(key) {
    if (!this.#ok) return this.#fallback.read(key);
    try { return this.#backend.getItem(key); } catch { return this.#fallback.read(key); }
  }
  write(key, value) {
    this.#fallback.write(key, value);
    if (!this.#ok) return false;
    try { this.#backend.setItem(key, value); return true; } catch { return false; }
  }
  remove(key) {
    this.#fallback.remove(key);
    if (this.#ok) { try { this.#backend.removeItem(key); } catch { /* ignore */ } }
  }
}

export function createBrowserStorage() {
  try { return new WebStorage(globalThis.localStorage); } catch { return new MemoryStorage(); }
}
