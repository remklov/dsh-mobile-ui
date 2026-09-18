import assert from 'node:assert/strict'
import test from 'node:test'
import { registerOwnWorker, registrationIsOwned, unregisterOwnWorkers } from '../src/client/pwa.js'

const origin = 'https://dsh.example'
function worker(path: string): ServiceWorker { return { scriptURL: `${origin}${path}` } as ServiceWorker }
function registration(path: string, onUnregister = () => {}): ServiceWorkerRegistration {
  return { active: worker(path), waiting: null, installing: null, unregister: async () => { onUnregister(); return true } } as unknown as ServiceWorkerRegistration
}
function container(existing: ServiceWorkerRegistration | undefined, all: ServiceWorkerRegistration[] = existing ? [existing] : []) {
  const calls: unknown[][] = []
  const mock = {
    controller: null,
    getRegistration: async () => existing,
    getRegistrations: async () => all,
    register: async (...args: unknown[]) => { calls.push(args); return registration('/auth/mobile-workbench-pwa/sw.js') },
  }
  return { mock: mock as unknown as ServiceWorkerContainer, calls }
}

test('registration uses same-origin root scope and avoids HTTP/unsupported contexts', async () => {
  const { mock, calls } = container(undefined)
  assert.equal(await registerOwnWorker(mock, origin, true), 'registered')
  assert.deepEqual(calls, [['/auth/mobile-workbench-pwa/sw.js', { scope: '/', updateViaCache: 'none' }]])
  assert.equal(await registerOwnWorker(mock, origin, false), 'unsupported')
  assert.equal(await registerOwnWorker(undefined, origin, true), 'unsupported')
  assert.equal(calls.length, 1)
})

test('foreign root registration, pending worker, and manifest are never replaced', async () => {
  const foreign = container(registration('/other/sw.js'))
  assert.equal(await registerOwnWorker(foreign.mock, origin, true), 'conflict')
  assert.equal(foreign.calls.length, 0)
  const mixed = registration('/auth/mobile-workbench-pwa/sw.js')
  Object.assign(mixed, { waiting: worker('/other/sw.js') })
  assert.equal(registrationIsOwned(mixed, origin), false)
  assert.equal(await registerOwnWorker(container(mixed).mock, origin, true), 'conflict')
  const noWorker = container(undefined)
  assert.equal(await registerOwnWorker(noWorker.mock, origin, true, ['/other/manifest.json']), 'conflict')
  assert.equal(noWorker.calls.length, 0)
})

test('unknown controlling worker is not silently replaced', async () => {
  const { mock, calls } = container(undefined)
  Object.assign(mock, { controller: worker('/other/sw.js') })
  assert.equal(await registerOwnWorker(mock, origin, true), 'conflict')
  assert.equal(calls.length, 0)
})

test('own existing worker may update, but registration errors are graceful', async () => {
  const { mock, calls } = container(registration('/auth/mobile-workbench-pwa/sw.js'))
  assert.equal(await registerOwnWorker(mock, origin, true), 'registered')
  assert.equal(calls.length, 1)
  Object.assign(mock, { register: async () => { throw new Error('blocked') } })
  assert.equal(await registerOwnWorker(mock, origin, true), 'failed')
})

test('explicit reset unregisters only own workers and never touches caches', async () => {
  const removed: string[] = []
  const own = registration('/auth/mobile-workbench-pwa/sw.js', () => removed.push('own'))
  const foreign = registration('/other/sw.js', () => removed.push('foreign'))
  const mixed = registration('/auth/mobile-workbench-pwa/sw.js', () => removed.push('mixed'))
  Object.assign(mixed, { installing: worker('/other/sw.js') })
  const { mock } = container(own, [own, foreign, mixed])
  assert.equal(await unregisterOwnWorkers(mock, origin), 1)
  assert.deepEqual(removed, ['own'])
  assert.equal(await unregisterOwnWorkers(undefined, origin), 0)
})
