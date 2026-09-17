#!/usr/bin/env node
/**
 * OPTIONAL, isolated integration against the actual DSH HTTP/auth implementations.
 *
 * First run `npm run build`, then:
 *   DSH_RUNTIME_ROOT=/path/to/dsh \
 *   DSH_AUTH_PLUGIN_PATH=/path/to/@xgone/dsh-remote \
 *   node scripts/test-auth-integration.mjs
 *
 * The auth path can also name lib/index.js. No machine-specific defaults, profile
 * loaders, real credential providers, or live DSH endpoints are used. Each order
 * runs in a fresh child with temporary HOME, DSH_HOME, XDG directories and cwd,
 * an allowlisted environment, random synthetic accounts and an in-memory
 * credential provider. The ONLY listener is 127.0.0.1 on an OS-assigned port.
 *
 * Isolation audit: auth 0.3.3 resolves account/files/locale paths via DSH_HOME;
 * store.load/save and filesRoots.load are confined there. The file viewer is
 * disabled. Core connection receives only the in-memory credential fixture.
 * Only the audited package versions below are executed; re-audit before widening.
 * These tests do not prove native browser manifest-cookie, install, or SW behavior.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomBytes, createHmac } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { request } from 'node:http'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'

const self = fileURLToPath(import.meta.url)
const repository = resolve(dirname(self), '..')
const mobileEntry = join(repository, 'lib/index.js')
const BASE = '/mobile-workbench'
const MANIFEST = `${BASE}/manifest.webmanifest`
const SW = `${BASE}/sw.js`
const AUDITED_RUNTIME = '0.1.5-rc.2'
const AUDITED_AUTH = '0.3.3'
const childOrder = process.argv[2]

function requiredPath(name) {
  const value = process.env[name]
  assert(value && isAbsolute(value), `Set ${name} to an absolute installation path; no live-profile default is used.`)
  return realpathSync(value)
}

function inspectInstallations() {
  const runtimeRoot = requiredPath('DSH_RUNTIME_ROOT')
  const runtimeRequire = createRequire(join(runtimeRoot, 'package.json'))
  const authInput = requiredPath('DSH_AUTH_PLUGIN_PATH')
  const authEntry = statSync(authInput).isDirectory() ? join(authInput, 'lib/index.js') : authInput
  const authRoot = resolve(dirname(authEntry), '..')
  const authMeta = JSON.parse(readFileSync(join(authRoot, 'package.json'), 'utf8'))
  assert.equal(authMeta.name, '@xgone/dsh-remote')
  assert.equal(authMeta.version, AUDITED_AUTH, 'Auth version changed: re-audit filesystem isolation before running this script.')
  const paths = {}
  for (const name of ['dsh-host-webserver', 'dsh-client-connection', 'dsh-host-frontend-static']) {
    const specifier = `@deepseek-ai/${name}`
    const metadata = JSON.parse(readFileSync(runtimeRequire.resolve(`${specifier}/package.json`), 'utf8'))
    assert.equal(metadata.version, AUDITED_RUNTIME, `${specifier} changed: re-audit before running.`)
    paths[name] = runtimeRequire.resolve(specifier)
  }
  paths.cordis = runtimeRequire.resolve('@deepseek-ai/cordis')
  assert(existsSync(mobileEntry), 'Missing lib/index.js; run npm run build first. This script does not build or modify repository files.')
  return { runtimeRoot, authEntry, authRoot, paths }
}

async function supervisor() {
  const installs = inspectInstallations()
  for (const order of ['auth-first', 'mobile-first']) {
    const temporary = mkdtempSync(join(tmpdir(), 'dsh-mobile-auth-test-'))
    try {
      const home = join(temporary, 'home')
      const dshHome = join(temporary, 'dsh-home')
      const cwd = join(temporary, 'cwd')
      for (const dir of [home, dshHome, cwd, join(temporary, 'tmp')]) mkdirSync(dir, { recursive: true, mode: 0o700 })
      // Do NOT inherit NODE_OPTIONS, preload hooks, DSH_* settings, credentials,
      // proxies, cloud variables, or the user's normal HOME/cwd.
      const env = {
        HOME: home, USERPROFILE: home, DSH_HOME: dshHome,
        XDG_CONFIG_HOME: join(temporary, 'config'), XDG_DATA_HOME: join(temporary, 'data'),
        XDG_CACHE_HOME: join(temporary, 'cache'), XDG_STATE_HOME: join(temporary, 'state'),
        TMPDIR: join(temporary, 'tmp'), TMP: join(temporary, 'tmp'), TEMP: join(temporary, 'tmp'),
        DSH_RUNTIME_ROOT: installs.runtimeRoot, DSH_AUTH_PLUGIN_PATH: installs.authEntry,
        DSH_MOBILE_TEST_ROOT: temporary, NODE_ENV: 'test', NO_COLOR: '1',
      }
      // Windows' loader may need these, but no environment settings are otherwise inherited.
      for (const key of ['SystemRoot', 'WINDIR']) if (process.env[key]) env[key] = process.env[key]
      const result = spawnSync(process.execPath, [self, order], {
        cwd, env, encoding: 'utf8', timeout: 45_000, killSignal: 'SIGKILL', maxBuffer: 2 * 1024 * 1024,
      })
      if (result.stdout) process.stdout.write(result.stdout)
      if (result.stderr) process.stderr.write(result.stderr)
      if (result.error) throw result.error
      assert.equal(result.status, 0, `${order} child failed${result.signal ? ` (${result.signal})` : ''}`)
    } finally {
      // Deletes only the fresh path produced by mkdtemp in this supervisor.
      rmSync(temporary, { recursive: true, force: true })
    }
  }
  console.log('PASS: both composition orders, real HTTP/auth/core-cookie integration and disposal. Browser installation remains a separate manual test.')
}

async function isolatedChild(order) {
  assert(['auth-first', 'mobile-first'].includes(order))
  const temporary = requiredPath('DSH_MOBILE_TEST_ROOT')
  assert.equal(realpathSync(process.cwd()), realpathSync(join(temporary, 'cwd')))
  assert.equal(requiredPath('HOME'), realpathSync(join(temporary, 'home')))
  assert.equal(requiredPath('DSH_HOME'), realpathSync(join(temporary, 'dsh-home')))
  const installs = inspectInstallations()
  const authRequire = createRequire(installs.authEntry)
  // Confirm the actual home helper resolved by THIS auth installation, before
  // importing or activating auth. Importing the helper itself has no state I/O.
  const homeHelper = await import(pathToFileURL(authRequire.resolve('@deepseek-ai/dsh-home-paths')))
  assert.equal(realpathSync(homeHelper.dshHomePath()), requiredPath('DSH_HOME'))
  const authStore = await import(pathToFileURL(join(installs.authRoot, 'lib/store.js')))
  const filesStore = await import(pathToFileURL(join(installs.authRoot, 'lib/files-store.js')))
  assert.equal(authStore.defaultStorePath(), join(process.env.DSH_HOME, 'auth/store.json'))
  assert.equal(filesStore.filesRootsPath(), join(process.env.DSH_HOME, 'dsh-remote-files.json'))

  const [{ Context }, { default: WebServer }, connection, frontend, auth, mobile] = await Promise.all([
    import(pathToFileURL(installs.paths.cordis)),
    import(pathToFileURL(installs.paths['dsh-host-webserver'])),
    import(pathToFileURL(installs.paths['dsh-client-connection'])),
    import(pathToFileURL(installs.paths['dsh-host-frontend-static'])),
    import(pathToFileURL(installs.authEntry)),
    import(pathToFileURL(mobileEntry)),
  ])
  const app = new Context()
  const records = new Map()
  const secret = randomBytes(32).toString('base64url')
  const password = randomBytes(24).toString('base64url')
  let assertions = 0
  let port
  const check = (condition, message) => { assert(condition, message); assertions++ }
  const equal = (actual, expected, message) => { assert.equal(actual, expected, message); assertions++ }

  try {
    // This is the ONLY substitute service: real connection/browser auth uses its
    // public credential interface but no persistent credential provider is loaded.
    await app.plugin({
      name: 'synthetic-memory-credentials',
      apply(ctx) {
        ctx.provide('credentials', {
          async readRecord(key) { return records.get(key) },
          async modifyRecord(key, update) {
            const next = await update(records.get(key))
            if (next !== undefined) records.set(key, next)
            return records.get(key)
          },
        })
      },
    })
    await app.plugin(WebServer, { host: '127.0.0.1', port: 0, compression: 'gzip', compressionThresholdBytes: 1 })
    port = app.webServer.port
    check(Number.isInteger(port) && port > 0, 'WebServer bound an ephemeral port')
    equal(app.webServer.host, '127.0.0.1', 'Never listen publicly')
    await app.plugin(connection, { trustedHosts: ['mobile-test.invalid'], maxRequestBodyBytes: 1024 * 1024 })
    const fixtureIndex = join(process.cwd(), 'index.html')
    writeFileSync(fixtureIndex, '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>ISOLATED SHELL</body></html>')
    await app.plugin(frontend, { distIndex: fixtureIndex })

    const authConfig = {
      enabled: true, secret, adminOnly: false, trustProxy: true, enforceRoles: true,
      accounts: [
        { username: 'fixture-admin', password, role: 'admin' },
        { username: 'fixture-guest', password, role: 'guest' },
      ],
      session: { cookieName: 'fixture_session', secure: false, ttlSeconds: 3600, sameSite: 'strict' },
      browserAuth: { enabled: true, cookieTtlSeconds: 3600 },
      files: { enabled: false, roots: [], maxListing: 100 },
      mfa: { enabled: false, issuer: 'Isolated Test', window: 1, backupCodes: 0 },
      gzip: { enabled: true, remoteOnly: true, minBytes: 1 },
      rateLimit: { maxAttempts: 20, windowMs: 60_000 },
    }
    let authFiber
    let mobileFiber
    if (order === 'auth-first') {
      authFiber = await app.plugin(auth, authConfig)
      mobileFiber = await app.plugin(mobile)
    } else {
      mobileFiber = await app.plugin(mobile)
      authFiber = await app.plugin(auth, authConfig)
    }

    // Node HTTP rather than fetch: explicit synthetic cookie jar, exact Host,
    // raw gzip responses, and no implicit redirects/cookies from any user agent.
    async function call(path, { jar, method = 'GET', json, gzip = false, headers = {} } = {}) {
      const body = json === undefined ? undefined : JSON.stringify(json)
      return new Promise((resolveResponse, reject) => {
        const req = request({
          hostname: '127.0.0.1', port, path, method, agent: false,
          headers: {
            Host: 'mobile-test.invalid', Origin: 'https://mobile-test.invalid',
            'Sec-Fetch-Site': 'same-origin', 'Accept-Encoding': gzip ? 'gzip' : 'identity',
            ...(jar?.size ? { Cookie: [...jar].map(([key, value]) => `${key}=${value}`).join('; ') } : {}),
            ...(body === undefined ? {} : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }),
            ...headers,
          },
        }, (res) => {
          const chunks = []
          res.on('data', chunk => chunks.push(chunk))
          res.on('error', error => reject(new Error(`${method} ${path} gzip=${gzip}: response failed (status=${res.statusCode}, encoding=${res.headers['content-encoding']}, length=${res.headers['content-length']}, received=${Buffer.concat(chunks).length})`, { cause: error })))
          res.on('end', () => {
            try {
              const raw = Buffer.concat(chunks)
              const bytes = res.headers['content-encoding'] === 'gzip' && raw.length ? gunzipSync(raw) : raw
              if (jar) for (const cookie of res.headers['set-cookie'] ?? []) {
                const pair = cookie.split(';', 1)[0]
                const at = pair.indexOf('=')
                if (/Max-Age=0(?:;|$)/i.test(cookie)) jar.delete(pair.slice(0, at))
                else jar.set(pair.slice(0, at), pair.slice(at + 1))
              }
              resolveResponse({ status: res.statusCode, headers: res.headers, bytes, text: bytes.toString('utf8') })
            } catch (error) { reject(error) }
          })
        })
        req.setTimeout(5000, () => req.destroy(new Error(`Request timed out: ${method} ${path}`)))
        req.on('error', reject)
        req.end(body)
      })
    }
    const login = async (username) => {
      const jar = new Map()
      const response = await call('/auth/login', { jar, method: 'POST', json: { username, password } })
      equal(response.status, 200, 'Synthetic login succeeds')
      check(JSON.parse(response.text).ok, 'Login result is successful')
      check(jar.has('fixture_session'), 'Auth session issued')
      check([...jar.keys()].filter(key => key.startsWith('dsh-auth-')).length >= 2, 'Real login minted external and loopback core cookies')
      return jar
    }
    const assets = [MANIFEST, SW, `${BASE}/icons/icon-192.png`, `${BASE}/icons/icon-512.png`, `${BASE}/icons/apple-touch-icon.png`]
    for (const path of assets) {
      const response = await call(path)
      equal(response.status, 403, `Unauthenticated named route is gated: ${path}`)
      equal(JSON.parse(response.text).error, 'unauthorized')
      check(response.headers['cache-control'].includes('no-store'), 'Auth denial is not cacheable')
    }
    const loginPage = await call('/')
    equal(loginPage.status, 200, 'Unauthenticated root is self-contained login HTML')
    check(loginPage.headers['content-type'].startsWith('text/html'), 'Login MIME')
    check(!loginPage.text.includes('data-mobile-workbench-head'), 'PWA taps do not modify standalone login')

    const admin = await login('fixture-admin')
    for (const gzip of [false, true]) {
      for (const path of assets) {
        const response = await call(path, { jar: admin, gzip })
        equal(response.status, 200, `Authenticated asset ${path}, gzip=${gzip}`)
        check(response.headers['cache-control'].includes('no-store'), 'No-store survives real middleware')
        check(!response.headers['cache-control'].includes('immutable'), 'No immutable override for namespace')
        equal(response.headers['x-content-type-options'], 'nosniff')
        if (path === MANIFEST) {
          const metadata = JSON.parse(response.text)
          equal(metadata.start_url, '/')
          equal(metadata.scope, '/')
          check(metadata.icons.every(icon => icon.src.startsWith(`${BASE}/`)), 'No normalized host leaks into icons')
          check(!response.text.includes('127.0.0.1') && !response.text.includes('token='), 'Manifest contains no host/token')
        }
        if (path === SW) {
          equal(response.headers['service-worker-allowed'], '/')
          check(response.headers['content-type'].startsWith('text/javascript'), 'SW has executable MIME')
          check(!/\bcaches\.|respondWith\(|addEventListener\(\s*['"]fetch['"]/.test(response.text), 'Worker does not intercept/cache requests')
        }
      }
    }
    const shell = await call('/', { jar: admin })
    equal(shell.status, 200, 'Authenticated real frontend-static serves index')
    check(shell.text.includes('ISOLATED SHELL'), 'Not a login error page')
    check(shell.text.includes('crossorigin="use-credentials"'), 'Credentialed manifest injected after auth')
    const head = await call(SW, { jar: admin, method: 'HEAD', gzip: true })
    equal(head.status, 200)
    equal(head.bytes.length, 0, 'HEAD remains empty through auth/gzip')
    equal(head.headers['service-worker-allowed'], '/')

    // Core browser-cookie healing takes effect on the NEXT request, not by
    // modifying current request headers. Named PWA routes need only outer auth.
    const sessionOnly = new Map([['fixture_session', admin.get('fixture_session')]])
    equal((await call(MANIFEST, { jar: sessionOnly })).status, 200, 'PWA still works when core cookie was evicted')
    check([...sessionOnly.keys()].some(key => key.startsWith('dsh-auth-')), 'PWA response self-heals loopback core cookie')
    const indexOnlySession = new Map([['fixture_session', admin.get('fixture_session')]])
    equal((await call('/', { jar: indexOnlySession })).status, 401, 'First index request without core cookie is 401')
    equal((await call('/', { jar: indexOnlySession })).status, 200, 'Index succeeds after cookie healing')
    equal((await call('/api/nonexistent', { jar: new Map([['fixture_session', admin.get('fixture_session')]]) })).status, 401, 'Core API cookie check still runs')
    equal((await call('/api/nonexistent', { jar: admin })).status, 404, 'Authenticated unknown API reaches real connection routing')
    equal((await call('/api/nonexistent', { jar: admin, headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403, 'Core cross-site fence stays intact')

    const guest = await login('fixture-guest')
    equal((await call(MANIFEST, { jar: guest })).status, 200, 'Guest may fetch static metadata')
    const removed = await call('/auth/accounts', { jar: admin, method: 'POST', json: { action: 'remove', username: 'fixture-guest' } })
    check(JSON.parse(removed.text).removed, 'Synthetic guest removed through real auth endpoint')
    equal((await call(MANIFEST, { jar: guest })).status, 403, 'Removed account cannot use old session')

    // Sign only a SYNTHETIC expired session with this test's explicit secret;
    // never read the generated account store or any real credential material.
    const payload = Buffer.from(JSON.stringify({ sub: 'fixture-admin', role: 'admin', iat: Date.now() - 120_000, exp: Date.now() - 60_000 })).toString('base64url')
    const expired = `v1.${payload}.${createHmac('sha256', secret).update(`v1.${payload}`).digest('base64url')}`
    equal((await call(SW, { jar: new Map([['fixture_session', expired]]) })).status, 403, 'Expired session prevents worker update')

    const logout = await call('/auth/logout', { jar: admin, method: 'POST', json: {} })
    equal(logout.status, 200)
    check(!admin.has('fixture_session'), 'Logout removed outer session from test jar')
    check([...admin.keys()].some(key => key.startsWith('dsh-auth-')), 'Core cookies remain, matching real auth logout')
    equal((await call(SW, { jar: admin })).status, 403, 'Remaining core cookies cannot bypass outer auth')

    const active = await login('fixture-admin')
    await mobileFiber.dispose()
    equal((await call(MANIFEST, { jar: active })).status, 404, 'Plugin disposal removes namespaced routes')
    check(!(await call('/', { jar: active })).text.includes('data-mobile-workbench-head'), 'Disposal removes index tap')
    mobileFiber = await app.plugin(mobile)
    equal((await call(MANIFEST, { jar: active })).status, 200, 'Reactivation works without duplicate-route failure')
    equal((await call(MANIFEST)).status, 403, 'Reactivated route stays auth gated')
    await authFiber.dispose()
    equal((await call(MANIFEST)).status, 200, 'Auth disposal unwraps plugin route; only public static metadata remains')
    const afterAuthDispose = await call('/')
    check(!afterAuthDispose.text.includes('ISOLATED SHELL'), 'Auth disposal never exposes unauthenticated core document')
    // Real auth 0.3.3 currently leaves its login fallback wrapped in this Cordis
    // fixture even though named routes are unwrapped. Characterize (not conceal)
    // this upstream unload defect; it is not mobile-plugin disposal behavior.
    if (afterAuthDispose.status === 200 && afterAuthDispose.text.includes('/auth/login')) {
      console.warn(`KNOWN UPSTREAM LIMITATION (${order}): auth 0.3.3 disposal leaves standalone login fallback; full host restart required to remove auth cleanly.`)
    } else {
      equal(afterAuthDispose.status, 401, 'Core index rejects unauthenticated requests after outer auth removal')
    }
    await mobileFiber.dispose()
    equal((await call(MANIFEST, { jar: active })).status, 404, 'Final plugin disposal leaves no asset handler (authenticated jar passes any stale upstream fallback)')
    console.log(`PASS ${order}: ${assertions} assertions, real auth + WebServer + Connection + FrontendStatic; synthetic state only.`)
  } finally {
    await app.fiber.dispose()
    records.clear()
  }
}

try {
  if (childOrder) await isolatedChild(childOrder)
  else await supervisor()
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exitCode = 1
}
