import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { BASE, createPwaHandler, injectHead } from './host/pwa.js'

export const name = 'dsh-mobile-workbench'
export const inject = ['webServer']

/** Host-only entry: no listener, auth cookie, proxy, session, or filesystem state. */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: BASE, handler: createPwaHandler() }),
    'mobile-workbench: static PWA routes')
  // Raw transform is deliberate: inspect for another manifest and modify the
  // existing viewport without emitting duplicate declarations. Disposed by Cordis.
  ctx.effect(() => ctx.webServer.tapIndex(injectHead), 'mobile-workbench: PWA head metadata')
}
