/**
 * Registers the service worker shared by the marketing site and the app, so HEALNEXIA
 * installs as one web app and keeps working offline. Silently does nothing where
 * unsupported (old browsers, file://, private modes that block workers).
 */
export function registerServiceWorker(win = globalThis.window) {
  const nav = win?.navigator;
  if (!nav || !('serviceWorker' in nav) || !/^https?:$/.test(win.location.protocol)) return;
  const register = () => nav.serviceWorker.register('sw.js', { scope: './' }).catch(() => { /* offline support is optional */ });
  if (win.document.readyState === 'complete') register();
  else win.addEventListener('load', register, { once: true });
}
