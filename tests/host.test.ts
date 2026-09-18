import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import vm from 'node:vm'
import { createPwaHandler, injectHead, manifest, workerScript, BASE, WORKER_PATH } from '../src/host/pwa.js'

async function listen(server: Server) {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert(address && typeof address !== 'string')
  return `http://127.0.0.1:${address.port}`
}

test('static routes: allowlist, safe URLs, headers, methods, and missing files', async t => {
  const handler = createPwaHandler(name => Buffer.from(`test-icon:${name}`))
  const server = createServer(handler)
  t.after(() => { server.closeAllConnections(); server.close() })
  const base = await listen(server)
  const paths = [`${BASE}/manifest.webmanifest`, WORKER_PATH, `${BASE}/icons/icon-192.png`]
  for (const path of paths) {
    const response = await fetch(base + path)
    assert.equal(response.status, 200)
    assert.match(response.headers.get('cache-control')!, /^public, max-age=/)
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(response.headers.get('vary'), null)
    assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-origin')
    assert.equal((await fetch(base + path, { method: 'HEAD' })).status, 200)
    assert.equal(await (await fetch(base + path, { method: 'HEAD' })).text(), '')
    assert.equal((await fetch(base + path, { method: 'POST' })).status, 405)
  }
  const sw = await fetch(base + WORKER_PATH)
  assert.match(sw.headers.get('content-type')!, /javascript/)
  assert.equal(sw.headers.get('service-worker-allowed'), '/')
  for (const path of ['/unknown', '/icons/secret', '/icons/%2e%2e%2fpackage.json', '/icons/icon-192.png/extra']) {
    assert.equal((await fetch(base + BASE + path)).status, 404)
  }
  assert.ok(paths.every(path => path.startsWith('/auth/mobile-workbench-pwa/')))
  assert.deepEqual(await (await fetch(base + BASE + '/manifest.webmanifest')).json(), manifest)
  assert.equal(manifest.start_url, '/')
  assert.equal(manifest.display, 'standalone')
})

test('head injection preserves zoom, is idempotent, and respects another manifest', () => {
  const input = '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div></body></html>'
  const output = injectHead(input)
  assert.match(output, /crossorigin="anonymous"/)
  assert.match(output, /initial-scale=1, viewport-fit=cover/)
  assert.doesNotMatch(output, /user-scalable|maximum-scale/)
  assert.equal(injectHead(output), output)
  assert.equal((output.match(/name="viewport"/g) ?? []).length, 1)
  const owned = input.replace('</head>', '<link rel="manifest" href="/other.webmanifest"></head>')
  assert.equal(injectHead(owned), owned)
  assert.equal(injectHead('no head'), 'no head')
  assert.match(injectHead('<head></head>'), /name="viewport"/)
})

test('worker is lifecycle-only; no fetch interception or data/cache storage', async () => {
  const events = new Map<string, (event: { waitUntil(p: Promise<unknown>): void }) => void>()
  let claimed = 0
  vm.runInNewContext(workerScript, { self: {
    addEventListener: (name: string, cb: (event: { waitUntil(p: Promise<unknown>): void }) => void) => events.set(name, cb),
    skipWaiting: async () => {}, clients: { claim: async () => { claimed++ } },
  } })
  assert.deepEqual([...events.keys()], ['install', 'activate'])
  for (const listener of events.values()) {
    let pending: Promise<unknown> | undefined
    listener({ waitUntil: p => { pending = p } })
    await pending
  }
  assert.equal(claimed, 1)
  assert.doesNotMatch(workerScript, /\b(?:caches|fetch|indexedDB|localStorage|cookie)\b/)
})
