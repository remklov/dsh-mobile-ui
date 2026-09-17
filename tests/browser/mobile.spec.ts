import { test, expect } from '@playwright/test'
import { createServer, type Server } from 'node:http'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'
import { createPwaHandler, injectHead } from '../../src/host/pwa.js'

let server: Server
let origin: string

test.beforeAll(async () => {
  const fixture = await build({ entryPoints: ['tests/browser/fixture.tsx'], bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic' })
  const appFrame = await readFile('node_modules/@deepseek-ai/dsh-client-ui-layout/lib/client.js')
  const plugin = await readFile('lib/client.js')
  const pwa = createPwaHandler(name => {
    // tests use preloaded real generated PNGs below
    return icons.get(name)!
  })
  const icons = new Map<string, Buffer>()
  for (const name of ['icon-192.png','icon-512.png','maskable-512.png','apple-touch-icon.png']) icons.set(name, await readFile(`assets/${name}`))
  server = createServer((req, res) => {
    const path = new URL(req.url!, 'http://localhost').pathname
    if (path.startsWith('/mobile-workbench/')) return pwa(req, res)
    res.setHeader('Cache-Control', 'no-store')
    const script = path === '/fixture.js' ? fixture.outputFiles[0].contents : path === '/layout.js' ? appFrame : path === '/plugin.js' ? plugin : null
    if (script) { res.setHeader('Content-Type', 'text/javascript'); res.end(script); return }
    if (path === '/foreign-sw.js') { res.setHeader('Content-Type', 'text/javascript'); res.end("self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));"); return }
    if (path === '/') {
      res.setHeader('Content-Type', 'text/html')
      res.end(injectHead(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body,#root{height:100%;margin:0}*{box-sizing:border-box}button,textarea{font:inherit}body{font-family:sans-serif}button{padding:10px}header{display:flex;align-items:center;gap:8px}h1{font-size:16px}textarea{max-width:100%}</style></head><body><div id="root"></div><script src="/fixture.js"></script><script src="/layout.js"></script><script src="/plugin.js"></script><script>fixture.start()</script></body></html>`))
      return
    }
    res.statusCode = 404; res.end()
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('No fixture address')
  origin = `http://127.0.0.1:${address.port}`
})

test.afterAll(() => { server?.closeAllConnections(); server?.close() })

test('phone layout spans screen and drawer opens, traps focus, closes, and restores desktop', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(origin)
  await expect(page.getByRole('button', { name: /open navigation/i })).toBeVisible()
  const main = page.locator('main')
  await expect.poll(async () => (await main.boundingBox())?.width).toBe(390)
  const menu = page.getByRole('button', { name: /open navigation/i })
  await menu.click()
  await expect(page.getByRole('button', { name: 'New session', exact: true })).toBeVisible()
  await expect(main.locator('..')).toHaveAttribute('inert', '')
  const navigation = page.getByRole('dialog', { name: 'Navigation', exact: true })
  await navigation.getByRole('button', { name: 'Settings', exact: true }).focus()
  await page.keyboard.press('Tab')
  await expect(navigation.getByRole('button', { name: 'Close navigation', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu).toHaveAttribute('aria-expanded', 'false')
  await expect(menu).toBeFocused()
  await menu.click()
  await expect(navigation).toBeVisible()
  await page.mouse.click(380, 350)
  await expect(menu).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('[data-mwb-sidebar]')).toBeHidden()
  await page.screenshot({ path: 'test-results/mobile-contract.png', animations: 'disabled' })
  await page.setViewportSize({ width: 1280, height: 900 })
  await expect(menu).toBeHidden()
  await expect.poll(async () => (await main.boundingBox())?.width).toBe(1000)
  expect(errors).toEqual([])
})

test('real manifest and root worker register without caching; disposal restores DOM', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(origin)
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('crossorigin', 'use-credentials')
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration('/'))?.active?.scriptURL)).toBe(`${origin}/mobile-workbench/sw.js`)
  expect(await page.evaluate(() => caches.keys())).toEqual([])
  const manifest = await (await page.request.get(origin + '/mobile-workbench/manifest.webmanifest')).json()
  expect(manifest.display).toBe('standalone')
  await page.evaluate(() => caches.open('unrelated-plugin-test'))
  await page.getByRole('button', { name: 'App', exact: true }).click()
  await page.getByRole('button', { name: 'Reset our PWA support', exact: true }).click()
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration('/')) === undefined)).toBe(true)
  expect(await page.evaluate(() => caches.keys())).toEqual(['unrelated-plugin-test'])
  await page.evaluate(() => caches.delete('unrelated-plugin-test'))
  await page.evaluate(() => (window as any).fixture.stop())
  await expect(page.locator('[data-mwb-frame]')).toHaveCount(0)
  expect(await page.evaluate(() => caches.keys())).toEqual([])
})

test('foreign root worker is not replaced', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(origin + '/missing')
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/foreign-sw.js', { scope: '/' })
    await navigator.serviceWorker.ready
  })
  await page.goto(origin)
  await expect(page.getByRole('button', { name: /open navigation/i })).toBeVisible()
  const script = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration('/'))?.active?.scriptURL)
  expect(script).toBe(`${origin}/foreign-sw.js`)
})
