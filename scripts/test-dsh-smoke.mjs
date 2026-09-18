// Optional full installed-DSH smoke test. Never uses the user's home/profile.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, isAbsolute, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const runtime = process.env.DSH_RUNTIME_ROOT
assert(runtime && isAbsolute(runtime), 'Set DSH_RUNTIME_ROOT to the installed DSH package directory')
const temporary = await mkdtemp(join(tmpdir(), 'dsh-mobile-smoke-'))
let child
let browser
let output = ''
let closed
try {
  const home = join(temporary, 'home')
  const dshHome = join(temporary, 'dsh')
  const profile = join(dshHome, 'profiles', 'web')
  const workspace = join(temporary, 'workspace')
  await Promise.all([mkdir(home), mkdir(workspace), mkdir(join(profile, 'node_modules'), { recursive: true })])
  await symlink(root, join(profile, 'node_modules', 'dsh-mobile-workbench'), 'dir')
  await writeFile(join(profile, 'package.json'), JSON.stringify({ name: 'mobile-test-profile', private: true,
    dependencies: { 'dsh-mobile-workbench': `link:${root}` },
    dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'dsh-mobile-workbench'] } },
  }))
  const env = { PATH: process.env.PATH, HOME: home, USERPROFILE: home, DSH_HOME: dshHome,
    XDG_CONFIG_HOME: join(temporary, 'config'), XDG_DATA_HOME: join(temporary, 'data'),
    XDG_CACHE_HOME: join(temporary, 'cache'), DSH_TELEMETRY_DISABLED: '1', NO_COLOR: '1' }
  child = spawn(process.execPath, [join(runtime, 'lib/bin.js'), '--profile', 'web', '--host', '127.0.0.1', '--port', '0', '--no-open'],
    { cwd: workspace, env, stdio: ['ignore', 'pipe', 'pipe'] })
  closed = new Promise(resolve => child.once('close', resolve))
  const ready = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Isolated DSH did not start in 30 seconds')), 30_000)
    const consume = chunk => {
      output += chunk.toString()
      const match = output.match(/dsh web: (http:\/\/127\.0\.0\.1:\d+[^\s]*)/)
      if (match) { clearTimeout(timeout); resolve(match[1]) }
    }
    child.stdout.on('data', consume); child.stderr.on('data', consume)
    child.once('error', error => { clearTimeout(timeout); reject(error) })
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Isolated DSH exited before startup (${code})`)) })
  })
  browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(ready, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Open navigation', exact: true }).waitFor({ timeout: 30_000 })
  assert.equal(await page.locator('[data-mwb-frame]').count(), 1)
  const center = await page.locator('[data-mwb-center]').boundingBox()
  assert.equal(Math.round(center.width), 390)
  // Normal first-run notice in this fresh synthetic profile; leave its behavior
  // intact and acknowledge via its real UI rather than hiding the overlay.
  const notice = page.getByRole('dialog').filter({ hasText: 'Internal Testing Notice' })
  await notice.waitFor({ state: 'visible' })
  await notice.getByRole('button', { name: 'Continue', exact: true }).click()
  await notice.waitFor({ state: 'hidden' })
  const onboarding = page.getByRole('dialog').filter({ hasText: 'Add an API key to get started' })
  await onboarding.waitFor({ state: 'visible' })
  await onboarding.getByRole('button', { name: 'Configure later', exact: true }).click()
  await onboarding.waitFor({ state: 'hidden' })
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click({ timeout: 5000 })
  await page.locator('[data-mwb-drawer-open]').waitFor()
  await page.keyboard.press('Escape')
  await page.locator('[data-mwb-frame]:not([data-mwb-drawer-open])').waitFor()
  await page.getByRole('button', { name: 'App', exact: true }).click()
  await page.getByRole('dialog', { name: 'DSH on your home screen' }).waitFor()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration('/'))?.active?.scriptURL.endsWith('/auth/mobile-workbench-pwa/sw.js'))
  assert.deepEqual(await page.evaluate(() => caches.keys()), [])
  const manifest = await page.evaluate(async () => await (await fetch('/auth/mobile-workbench-pwa/manifest.webmanifest', { credentials: 'same-origin' })).json())
  assert.equal(manifest.display, 'standalone')
  await page.locator('[data-mwb-sidebar]').waitFor({ state: 'hidden' })
  await mkdir(join(root, 'test-results'), { recursive: true })
  await page.screenshot({ path: join(root, 'test-results/dsh-mobile-smoke.png'), animations: 'disabled' })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole('button', { name: 'Open navigation', exact: true }).waitFor({ state: 'hidden' })
  assert.deepEqual(errors, [], 'Unhandled browser exceptions in real DSH')
  console.log('PASS: full installed DSH loads mobile host/client bundles; drawer, App dialog, manifest, worker and desktop checks passed.')
} catch (error) {
  // Startup URLs contain fresh TEST tokens; do not print them even on failure.
  console.error(output.replace(/([?&]token=)[^\s&)]+/g, '$1<redacted>'))
  throw error
} finally {
  await browser?.close()
  if (child && child.exitCode === null && child.signalCode === null) {
    child.kill('SIGTERM')
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000)
    await closed
    clearTimeout(timer)
  }
  await rm(temporary, { recursive: true, force: true })
}
