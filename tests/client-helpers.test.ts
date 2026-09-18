import assert from 'node:assert/strict'
import test from 'node:test'
import { isAppleMobile, isOwnManifest, isOwnWorker, keyboardViewport, MOBILE_QUERY, shouldRestoreSidebar } from '../src/client/helpers.js'

test('mobile boundary agrees with the current native right-panel fullscreen breakpoint', () => {
  assert.equal(MOBILE_QUERY, '(max-width: 767px)')
})

test('keyboard geometry adjusts only unzoomed, editing, reduced visual viewport', () => {
  assert.deepEqual(keyboardViewport(800, { height: 420, offsetTop: 12, scale: 1 }, true), { height: 420, top: 12 })
  assert.equal(keyboardViewport(800, { height: 420, offsetTop: 12, scale: 2 }, true), null)
  assert.equal(keyboardViewport(800, { height: 780, offsetTop: 0, scale: 1 }, true), null)
  assert.equal(keyboardViewport(800, { height: 420, offsetTop: 0, scale: 1 }, false), null)
  assert.equal(keyboardViewport(800, null, true), null)
  assert.equal(keyboardViewport(800, { height: NaN, offsetTop: 0, scale: 1 }, true), null)
  assert.equal(keyboardViewport(800, { height: 0, offsetTop: 0, scale: 1 }, true), null)
  assert.deepEqual(keyboardViewport(800, { height: 450, offsetTop: -10, scale: 1 }, true), { height: 450, top: 0 })
})

test('worker ownership requires exact same-origin pathname', () => {
  assert.equal(isOwnWorker('https://dsh.example/auth/mobile-workbench-pwa/sw.js', 'https://dsh.example'), true)
  assert.equal(isOwnWorker('https://dsh.example/auth/mobile-workbench-pwa/sw.js?v=2', 'https://dsh.example'), true)
  assert.equal(isOwnWorker('https://other.example/auth/mobile-workbench-pwa/sw.js', 'https://dsh.example'), false)
  assert.equal(isOwnWorker('https://dsh.example/sw.js', 'https://dsh.example'), false)
  assert.equal(isOwnWorker('https://dsh.example/auth/mobile-workbench-pwa/sw.js.bak', 'https://dsh.example'), false)
})

test('manifest ownership never matches another origin or plugin', () => {
  assert.equal(isOwnManifest('/auth/mobile-workbench-pwa/manifest.webmanifest', 'https://dsh.example'), true)
  assert.equal(isOwnManifest('/pwa/manifest.webmanifest', 'https://dsh.example'), false)
  assert.equal(isOwnManifest('https://other.example/auth/mobile-workbench-pwa/manifest.webmanifest', 'https://dsh.example'), false)
})

test('narrow sidebar preference restoration never toggles the separate desktop preference', () => {
  assert.equal(shouldRestoreSidebar(500, true, false), true)
  assert.equal(shouldRestoreSidebar(800, true, false), true)
  assert.equal(shouldRestoreSidebar(1100, true, false), false)
  assert.equal(shouldRestoreSidebar(500, true, true), false)
})

test('iOS guidance also detects desktop-identifying iPad Safari', () => {
  assert.equal(isAppleMobile('iPhone OS', 'iPhone', 1), true)
  assert.equal(isAppleMobile('Safari', 'MacIntel', 5), true)
  assert.equal(isAppleMobile('Safari', 'MacIntel', 0), false)
  assert.equal(isAppleMobile('Android Chrome', 'Linux', 5), false)
})
