import type { Context } from '@deepseek-ai/cordis'
import type { ILayout } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { PropsRuntime, SlotCore } from '@deepseek-ai/dsh-client-ui-slots'
import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { attachMobileAdapter } from './dom.js'
import type { MobileAdapter, MobileSnapshot } from './dom.js'
import { isAppleMobile } from './helpers.js'
import { registerOwnWorker, unregisterOwnWorkers } from './pwa.js'
import type { WorkerStatus } from './pwa.js'
import css from './mobile.css'

export const name = 'dsh-mobile-workbench'
export const inject = ['layout', 'slots']

type ClientContext = Context & { layout: ILayout; slots: Pick<SlotCore, 'register'> }
type Props = PropsRuntime<'shell.overlay'> & { layout: Pick<ILayout, 'toggleSidebar'> }
interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
const RESET_KEY = 'dsh-mobile-workbench:worker-disabled'

function readReset(): boolean { try { return localStorage.getItem(RESET_KEY) === '1' } catch { return false } }
function saveReset(disabled: boolean): void { try { if (disabled) localStorage.setItem(RESET_KEY, '1'); else localStorage.removeItem(RESET_KEY) } catch { /* blocked storage is optional */ } }

function useDialogFocus(open: boolean, ref: RefObject<HTMLDivElement>, adapter: RefObject<MobileAdapter | null>): void {
  useEffect(() => {
    const dialog = ref.current
    const frame = adapter.current?.frame
    if (!open || !dialog || !frame) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const madeInert: HTMLElement[] = []
    // Do not make the overlay containing this dialog inert.
    for (const child of Array.from(frame.children)) if (child instanceof HTMLElement && !child.contains(dialog) && !child.inert) { child.inert = true; madeInert.push(child) }
    const bar = frame.querySelector<HTMLElement>('[data-mwb-bar]')
    if (bar && !bar.inert) { bar.inert = true; madeInert.push(bar) }
    const targets = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]')).filter(element => element.getClientRects().length > 0)
    const focus = () => (targets()[0] ?? dialog).focus({ preventScroll: true })
    focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const items = targets()
      const first = items[0] ?? dialog
      const last = items[items.length - 1] ?? dialog
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus() }
    }
    const onFocus = (event: FocusEvent) => { if (event.target instanceof Node && frame.contains(event.target) && !dialog.contains(event.target)) focus() }
    document.addEventListener('keydown', onKey)
    document.addEventListener('focusin', onFocus)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('focusin', onFocus)
      for (const element of madeInert) element.inert = false
      if (previous?.isConnected && !previous.closest('[inert]')) previous.focus({ preventScroll: true })
    }
  }, [open, ref, adapter])
}

function MobileWorkbench({ layout }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const adapter = useRef<MobileAdapter | null>(null)
  const [state, setState] = useState<MobileSnapshot>({ mobile: false, drawerOpen: false, detailsOpen: false })
  const [appOpen, setAppOpen] = useState(false)
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null)
  const [standalone, setStandalone] = useState(false)
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus | 'starting'>('starting')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const workerOperation = useRef<Promise<unknown>>(Promise.resolve())
  const ios = isAppleMobile(navigator.userAgent, navigator.platform, navigator.maxTouchPoints)

  useEffect(() => {
    if (!root.current) return
    adapter.current = attachMobileAdapter(root.current, layout, setState)
    return () => { adapter.current?.dispose(); adapter.current = null }
  }, [layout])

  useEffect(() => {
    let alive = true
    const standaloneMedia = matchMedia('(display-mode: standalone)')
    const fullscreenMedia = matchMedia('(display-mode: fullscreen)')
    const refresh = () => setStandalone(standaloneMedia.matches || fullscreenMedia.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)
    refresh()
    standaloneMedia.addEventListener('change', refresh)
    fullscreenMedia.addEventListener('change', refresh)
    const onInstall = (event: Event) => { event.preventDefault(); setInstallEvent(event as InstallEvent) }
    const onInstalled = () => { setInstallEvent(null); refresh(); setMessage('Installed. You can launch DSH from your home screen.') }
    window.addEventListener('beforeinstallprompt', onInstall)
    window.addEventListener('appinstalled', onInstalled)
    if (readReset()) setWorkerStatus('reset')
    else {
      workerOperation.current = registerOwnWorker(navigator.serviceWorker, location.origin, window.isSecureContext, Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="manifest"]'), link => link.href)).then(status => { if (alive) setWorkerStatus(status) })
    }
    return () => {
      alive = false
      standaloneMedia.removeEventListener('change', refresh)
      fullscreenMedia.removeEventListener('change', refresh)
      window.removeEventListener('beforeinstallprompt', onInstall)
      window.removeEventListener('appinstalled', onInstalled)
      // Unmount/HMR must not unregister an installed application's worker.
      // The explicit Reset button below is the removal path.
    }
  }, [])

  useEffect(() => { if (!state.mobile || state.detailsOpen || state.drawerOpen) setAppOpen(false) }, [state.mobile, state.detailsOpen, state.drawerOpen])
  useEffect(() => {
    if (!appOpen) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); setAppOpen(false) } }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [appOpen])
  useDialogFocus(appOpen, dialog, adapter)

  const install = async () => {
    if (!installEvent) return
    setBusy(true)
    try {
      await installEvent.prompt()
      const choice = await installEvent.userChoice
      setMessage(choice.outcome === 'accepted' ? 'Installation requested. Check your home screen.' : 'Installation dismissed. You can also use the browser menu.')
    } catch { setMessage('The browser could not open its installer. Use the browser menu to add DSH to your home screen.') }
    finally { setInstallEvent(null); setBusy(false) }
  }
  const reset = async () => {
    setBusy(true)
    saveReset(true)
    try {
      await workerOperation.current
      await unregisterOwnWorkers(navigator.serviceWorker, location.origin)
      setWorkerStatus('reset')
      setInstallEvent(null)
      setMessage('Our service worker is unregistered; existing tabs may stay controlled until closed. No caches, login data, or other plugins were changed. Remove the home-screen icon using your phone’s normal app controls.')
    } catch { setMessage('Could not unregister the worker. You can retry or manage this site in your browser settings.') }
    finally { setBusy(false) }
  }
  const enable = async () => {
    setBusy(true)
    saveReset(false)
    const operation = registerOwnWorker(navigator.serviceWorker, location.origin, window.isSecureContext, Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="manifest"]'), link => link.href))
    workerOperation.current = operation
    setWorkerStatus(await operation)
    setMessage('')
    setBusy(false)
  }

  return <div ref={root} data-mwb-controls="">
    {state.mobile && <>
      <div data-mwb-bar="">
        <button type="button" data-mwb-button="" aria-label="Open navigation" aria-expanded={state.drawerOpen} onClick={() => { setAppOpen(false); adapter.current?.toggle() }}>☰</button>
        <span data-mwb-title="">DSH</span>
        <button type="button" data-mwb-button="" aria-haspopup="dialog" aria-expanded={appOpen} onClick={() => { adapter.current?.close(); setAppOpen(true) }}>App</button>
      </div>
      {state.drawerOpen && <button type="button" data-mwb-backdrop="" tabIndex={-1} aria-label="Close navigation" onClick={() => adapter.current?.close()} />}
      {appOpen && <div data-mwb-app-layer="">
        <button type="button" data-mwb-backdrop="" tabIndex={-1} aria-label="Close app options" onClick={() => setAppOpen(false)} />
        <div ref={dialog} data-mwb-app-panel="" role="dialog" aria-modal="true" aria-labelledby="mwb-app-title" tabIndex={-1}>
          <h2 id="mwb-app-title">DSH on your home screen</h2>
          {standalone ? <p>You are already using the installed app.</p> : ios ? <p>In Safari, tap <strong>Share → Add to Home Screen</strong>, then Add. Your existing DSH login still applies.</p> : <p>Use <strong>Install app</strong> or <strong>Add to Home screen</strong> in your browser menu. When supported, the button below opens the browser installer.</p>}
          <p>This app requires an online connection. It does not cache conversations, credentials, or pages.</p>
          {workerStatus === 'conflict' && <p role="status">Another plugin owns a manifest or root service worker. We left it unchanged. Home-screen installation may depend on that plugin.</p>}
          {workerStatus === 'unsupported' && <p role="status">Service workers require HTTPS and browser support. Mobile browsers cannot use this feature over a plain HTTP LAN address.</p>}
          {workerStatus === 'failed' && <p role="status">Service worker setup failed. Check HTTPS, login, and the plugin’s host routes, then retry.</p>}
          {workerStatus === 'reset' && <p role="status">PWA service-worker registration is disabled in this browser.</p>}
          {message && <p role="status">{message}</p>}
          <div data-mwb-app-actions="">
            {installEvent && !standalone && <button type="button" data-mwb-button="" disabled={busy} onClick={() => void install()}>Install app</button>}
            {(workerStatus === 'reset' || workerStatus === 'failed') && <button type="button" data-mwb-button="" disabled={busy} onClick={() => void enable()}>Enable PWA support</button>}
            <button type="button" data-mwb-button="" disabled={busy} onClick={() => void reset()}>Reset our PWA support</button>
            <button type="button" data-mwb-button="" onClick={() => setAppOpen(false)}>Close</button>
          </div>
        </div>
      </div>}
    </>}
  </div>
}

/** Additive current-layout slot registration; no shell replacement or runtime shim. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = name
    style.textContent = css
    document.head.append(style)
    return () => style.remove()
  }, 'mobile-workbench: scoped styles')
  ctx.effect(() => ctx.slots.register({ name: 'shell.overlay', id: 'dsh-mobile-workbench', order: 10, inject: () => ({ layout: ctx.layout }) }, MobileWorkbench), 'mobile-workbench: shell overlay')
}
