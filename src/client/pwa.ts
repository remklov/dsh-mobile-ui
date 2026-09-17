import { isOwnManifest, isOwnWorker, WORKER_PATH } from './helpers.js'

export type WorkerStatus = 'unsupported' | 'registered' | 'conflict' | 'failed' | 'reset'

/** Never take over a different root-scope registration, including waiting/installing workers. */
export function registrationIsOwned(registration: Pick<ServiceWorkerRegistration, 'active' | 'waiting' | 'installing'>, origin: string): boolean {
  const workers = [registration.active, registration.waiting, registration.installing].filter((worker): worker is ServiceWorker => worker !== null)
  return workers.length > 0 && workers.every(worker => isOwnWorker(worker.scriptURL, origin))
}

export async function registerOwnWorker(container: ServiceWorkerContainer | undefined, origin: string, secure: boolean, manifestHrefs: readonly string[] = []): Promise<WorkerStatus> {
  if (!secure || !container) return 'unsupported'
  if (manifestHrefs.some(href => !isOwnManifest(href, origin))) return 'conflict'
  try {
    const existing = await container.getRegistration(`${origin}/`)
    if (existing && !registrationIsOwned(existing, origin)) return 'conflict'
    // A controlling script with an unexpected identity is also a reason not to take over.
    if (container.controller && !isOwnWorker(container.controller.scriptURL, origin)) return 'conflict'
    await container.register(WORKER_PATH, { scope: '/', updateViaCache: 'none' })
    return 'registered'
  } catch { return 'failed' }
}

/** Explicit reset only unregisters our own script; never clears any origin caches. */
export async function unregisterOwnWorkers(container: ServiceWorkerContainer | undefined, origin: string): Promise<number> {
  if (!container) return 0
  const registrations = await container.getRegistrations()
  const owned = registrations.filter(registration => registrationIsOwned(registration, origin))
  const results = await Promise.all(owned.map(registration => registration.unregister()))
  return results.filter(Boolean).length
}
