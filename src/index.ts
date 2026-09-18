import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { MANIFEST_PATH, WORKER_PATH, createPwaHandler, injectHead, iconPaths } from './host/pwa.js'

export const name = 'dsh-mobile-workbench'
export const inject = ['webServer']

/** Host-only entry: no listener, auth cookie, proxy, session, or filesystem state. */
export function apply(ctx: Context): void {
  const handler = createPwaHandler()
  const routes = [MANIFEST_PATH, WORKER_PATH, ...iconPaths].map(path =>
    ctx.webServer.register({ kind: 'exact', path, handler }))
  ctx.effect(() => () => { for (const dispose of routes.reverse()) dispose() },
    'mobile-workbench: exact static PWA routes')
  // Raw transform is deliberate: inspect for another manifest and modify the
  // existing viewport without emitting duplicate declarations. Disposed by Cordis.
  ctx.effect(() => ctx.webServer.tapIndex(injectHead), 'mobile-workbench: PWA head metadata')
}
