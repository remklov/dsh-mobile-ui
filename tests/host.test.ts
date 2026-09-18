import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import vm from 'node:vm'
import { createPwaHandler, injectHead, manifest, workerScript, BASE, WORKER_PATH } from '../src/host/pwa.js'
import { MANIFEST_PATH } from '../src/host/pwa.js'
import { isShellManifest, isReplaceableManifest } from '../src/client/helpers.js'

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
  assert.equal(manifest.id, '/auth/mobile-workbench-pwa/app')
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

test('the shell default manifest is replaced, a foreign one is not', () => {
  const head = (link: string) =>
    `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">${link}</head><body></body></html>`

  // dsh-web-frontend writes exactly this. It declares a single SVG icon and no
  // service worker, so leaving it in place makes the app uninstallable — which
  // is precisely what this plugin is here to fix.
  for (const href of ['./manifest.webmanifest', '/manifest.webmanifest', 'manifest.webmanifest']) {
    const output = injectHead(head(`<link rel="manifest" href="${href}">`))
    assert.match(output, new RegExp(`href="${MANIFEST_PATH}"`), `${href} should have been replaced`)
    assert.equal((output.match(/rel="manifest"/g) ?? []).length, 1, `${href} left a duplicate manifest link`)
  }

  // Another plugin claiming the identity is still a reason to stand down
  // completely — including our own head metadata.
  for (const href of ['/other.webmanifest', 'https://example.test/manifest.webmanifest']) {
    const input = head(`<link rel="manifest" href="${href}">`)
    assert.equal(injectHead(input), input, `${href} must be left untouched`)
  }
})

test('shell and own manifests are replaceable, foreign ones are not', () => {
  const origin = 'https://harness.test'
  assert.equal(isShellManifest('./manifest.webmanifest', origin), true)
  assert.equal(isShellManifest('/manifest.webmanifest', origin), true)
  assert.equal(isShellManifest('/other.webmanifest', origin), false)
  assert.equal(isShellManifest('https://example.test/manifest.webmanifest', origin), false,
    'same path on a different origin is not the shell manifest')

  assert.equal(isReplaceableManifest(MANIFEST_PATH, origin), true, 'our own manifest')
  assert.equal(isReplaceableManifest('/manifest.webmanifest', origin), true, 'the shell default')
  assert.equal(isReplaceableManifest('/other.webmanifest', origin), false, 'another plugin')
})

test('worker never intercepts a request and touches no storage', async () => {
  interface WorkerEvent {
    waitUntil(p: Promise<unknown>): void
    respondWith(response: unknown): void
  }
  const events = new Map<string, (event: WorkerEvent) => void>()
  let claimed = 0
  vm.runInNewContext(workerScript, { self: {
    addEventListener: (name: string, cb: (event: WorkerEvent) => void) => events.set(name, cb),
    skipWaiting: async () => {}, clients: { claim: async () => { claimed++ } },
  } })

  // The fetch handler exists only to satisfy Chrome's installability check.
  assert.deepEqual([...events.keys()], ['install', 'activate', 'fetch'])

  for (const name of ['install', 'activate'] as const) {
    let pending: Promise<unknown> | undefined
    events.get(name)!({
      waitUntil: p => { pending = p },
      respondWith: () => assert.fail(`${name} must not call respondWith`),
    })
    await pending
  }
  assert.equal(claimed, 1)

  // The point of the whole design: the browser's network stack stays
  // authoritative. Calling respondWith would be the moment we took over.
  let intercepted = false
  events.get('fetch')!({
    waitUntil: () => assert.fail('the fetch handler must not extend the event'),
    respondWith: () => { intercepted = true },
  })
  assert.equal(intercepted, false, 'the fetch handler must not intercept the request')

  // Interception is proven behaviourally above; this only guards the storage
  // APIs, which a string check can actually rule out.
  assert.doesNotMatch(workerScript, /\b(?:caches|indexedDB|localStorage|cookie)\b/)
})
