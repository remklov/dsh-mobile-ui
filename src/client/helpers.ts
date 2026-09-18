/** Pure, dependency-free mobile calculations; no access to auth or application state. */
export const MOBILE_QUERY = '(max-width: 767px)'
export const WORKER_PATH = '/auth/mobile-workbench-pwa/sw.js'

export interface ViewportSample {
  height: number
  offsetTop: number
  scale: number
}

/** Use the visual viewport only for an unzoomed keyboard-reduced viewport. */
export function keyboardViewport(layoutHeight: number, viewport: ViewportSample | null, editing: boolean): { height: number; top: number } | null {
  if (!editing || !viewport || !Number.isFinite(layoutHeight) || !Number.isFinite(viewport.height) || !Number.isFinite(viewport.offsetTop) || !Number.isFinite(viewport.scale)) return null
  if (Math.abs(viewport.scale - 1) > 0.02 || viewport.height <= 0 || layoutHeight - viewport.height < 100) return null
  return { height: Math.round(Math.min(layoutHeight, viewport.height)), top: Math.round(Math.max(0, viewport.offsetTop)) }
}

export function isOwnWorker(scriptURL: string, origin: string): boolean {
  try {
    const url = new URL(scriptURL, origin)
    return url.origin === origin && url.pathname === WORKER_PATH
  } catch { return false }
}

export function isOwnManifest(href: string, origin: string): boolean {
  try {
    const url = new URL(href, origin)
    return url.origin === origin && url.pathname === '/auth/mobile-workbench-pwa/manifest.webmanifest'
  } catch { return false }
}

export function isAppleMobile(userAgent: string, platform: string, touchPoints: number): boolean {
  return /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && touchPoints > 1)
}

/** Layout 0.1.5 has independent narrow (<1024) and desktop sidebar preferences. */
export function shouldRestoreSidebar(width: number, initialCollapsed: boolean, currentCollapsed: boolean): boolean {
  return width < 1024 && initialCollapsed !== currentCollapsed
}
