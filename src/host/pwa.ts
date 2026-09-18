import type { IncomingMessage, ServerResponse } from 'node:http'
import { readFileSync } from 'node:fs'

// @xgone/dsh-remote intentionally leaves /auth/* ungated. PWA metadata must be
// fetchable by Android's installer, which may not share the browser cookie jar.
// These files are static, contain no user data, and grant no DSH access.
export const BASE = '/auth/mobile-workbench-pwa'
export const WORKER_PATH = `${BASE}/sw.js`
export const MANIFEST_PATH = `${BASE}/manifest.webmanifest`

/** No hostnames, user data, tokens, or environment values enter the manifest. */
export const manifest = {
  id: '/',
  name: 'DSH Mobile Workbench',
  short_name: 'DSH',
  description: 'Mobile access to your existing DeepSeek Harness workspace',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: '#101827',
  theme_color: '#101827',
  icons: [
    { src: `${BASE}/icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: `${BASE}/icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: `${BASE}/icons/maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
} as const

/** Intentionally NO fetch handler, CacheStorage, offline page, or auth interception.
 * The browser's network stack remains authoritative for every request.
 */
export const workerScript = `// DSH Mobile Workbench v0.1.0 — network-only worker.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
`

const HEAD = [
  // Anonymous mode is intentional: Android installation services may fetch the
  // manifest/icons outside the signed-in tab's cookie jar.
  `<link data-mobile-workbench-head rel="manifest" href="${MANIFEST_PATH}" crossorigin="anonymous">`,
  '<meta data-mobile-workbench-head name="mobile-web-app-capable" content="yes">',
  '<meta data-mobile-workbench-head name="apple-mobile-web-app-capable" content="yes">',
  '<meta data-mobile-workbench-head name="apple-mobile-web-app-title" content="DSH">',
  '<meta data-mobile-workbench-head name="apple-mobile-web-app-status-bar-style" content="default">',
  `<link data-mobile-workbench-head rel="apple-touch-icon" href="${BASE}/icons/apple-touch-icon.png">`,
].join('\n')

/** Do not replace a pre-existing PWA owner. Only the shell index is transformed;
 * auth plugins' separately served login pages are not touched.
 */
export function injectHead(html: string): string {
  if (/data-mobile-workbench-head/i.test(html)) return html
  if (/<link\b[^>]*\brel\s*=\s*(?:["']manifest["']|manifest(?=\s|>))/i.test(html)) return html
  if (!/<head(?:\s[^>]*)?>/i.test(html)) return html
  // Retain the host's viewport, font scaling, and zoom. Add safe-area support
  // without creating duplicate viewport tags or disabling accessibility zoom.
  let output = html.replace(/<meta\b(?=[^>]*\bname\s*=\s*["']viewport["'])[^>]*>/gi, (tag) => {
    if (/viewport-fit\s*=/i.test(tag)) return tag
    return tag.replace(/\bcontent\s*=\s*(["'])(.*?)\1/i, (_match, quote: string, value: string) =>
      `content=${quote}${value}, viewport-fit=cover${quote}`)
  })
  if (!/<meta\b[^>]*\bname\s*=\s*["']viewport["']/i.test(output)) {
    output = output.replace(/<head(?:\s[^>]*)?>/i, '$&\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">')
  }
  return output.replace(/<head(?:\s[^>]*)?>/i, `$&\n${HEAD}\n`)
}

export type AssetReader = (name: string) => Buffer
// Bundled entry lives directly in lib/, so ../assets is package-relative.
const defaultAssetReader: AssetReader = name => readFileSync(new URL(`../assets/${name}`, import.meta.url))
const icons = new Set(['icon-192.png', 'icon-512.png', 'maskable-512.png', 'apple-touch-icon.png'])
export const iconPaths = [...icons].map(name => `${BASE}/icons/${name}`)

/** Fixed public installation assets. Register as exact routes only: no broad
 * public prefix, dynamic lookup, query-derived content, or user data. */
export function createPwaHandler(readAsset: AssetReader = defaultAssetReader) {
  return (req: IncomingMessage, res: ServerResponse): void => {
    // Public metadata only. It must remain retrievable by the Android installer,
    // which may not send the signed-in browser's cookies. Never add private data.
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD')
      res.writeHead(405)
      res.end()
      return
    }
    let path: string
    try { path = new URL(req.url ?? '/', 'http://localhost').pathname } catch {
      res.writeHead(400)
      res.end()
      return
    }
    let body: string | Buffer
    if (path === MANIFEST_PATH) {
      res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8')
      body = JSON.stringify(manifest)
    } else if (path === WORKER_PATH) {
      res.setHeader('Content-Type', 'text/javascript; charset=utf-8')
      res.setHeader('Service-Worker-Allowed', '/')
      body = workerScript
    } else {
      const filename = path.startsWith(`${BASE}/icons/`) ? path.slice(`${BASE}/icons/`.length) : ''
      if (!icons.has(filename)) { res.writeHead(404); res.end(); return }
      try { body = readAsset(filename) } catch { res.writeHead(500); res.end(); return }
      res.setHeader('Content-Type', 'image/png')
    }
    // Let the server/compression middleware choose transfer framing. Explicit
    // uncompressed Content-Length survives some auth wrappers and truncates gzip.
    res.writeHead(200)
    res.end(req.method === 'HEAD' ? undefined : body)
  }
}
