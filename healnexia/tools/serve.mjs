#!/usr/bin/env node
/**
 * Minimal, dependency-free static server for local development and end-to-end tests.
 * Serves only whitelisted file types from the project root, blocks path traversal and
 * dotfiles, accepts only GET/HEAD, and sends the same security headers as production.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PUBLIC = new Set(['index.html', 'app.html', 'sw.js', 'manifest.webmanifest', 'src', 'site', 'assets']);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json' };

export const WORKER_CSP = "default-src 'none'; connect-src 'self'";

export const SECURITY_HEADERS = Object.freeze({
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; font-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'Cache-Control': 'no-store'
});

/** Maps a URL path to a file under ROOT, or null if it is not allowed. */
export function resolvePublicPath(urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath.split('?')[0]); } catch { return null; }
  if (decoded.includes('\0')) return null;
  const rel = normalize(decoded === '/' ? '/index.html' : decoded).replace(/^[/\\]+/, '');
  const segments = rel.split(/[/\\]/);
  if (segments.some((s) => s === '..' || s.startsWith('.'))) return null;
  if (!PUBLIC.has(segments[0])) return null;
  const full = join(ROOT, rel);
  if (!full.startsWith(ROOT + sep)) return null;
  if (!Object.hasOwn(TYPES, extname(full))) return null;
  return full;
}

export function createAppServer() {
  return createServer(async (req, res) => {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain' }); res.end('Method not allowed'); return;
    }
    const file = resolvePublicPath(new URL(req.url, 'http://localhost').pathname);
    try {
      if (!file || !(await stat(file)).isFile()) throw new Error('not found');
      const body = await readFile(file);
      // The service worker fetches same-origin files to fill its offline cache.
      if (file.endsWith(`${sep}sw.js`)) res.setHeader('Content-Security-Policy', WORKER_CSP);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)], 'Content-Length': body.length });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 8080;
  const host = process.env.HOST || '127.0.0.1';
  createAppServer().listen(port, host, () => console.log(`HEALNEXIA prototype: http://${host}:${port}/`));
}
