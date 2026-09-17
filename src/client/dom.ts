import type { ILayout } from '@deepseek-ai/dsh-client-ui-layout/client'
import { keyboardViewport, MOBILE_QUERY, shouldRestoreSidebar } from './helpers.js'

export interface MobileSnapshot { mobile: boolean; drawerOpen: boolean; detailsOpen: boolean }
export interface MobileAdapter { toggle(): void; close(): void; dispose(): void; frame: HTMLElement }

function setAttributeOwned(element: HTMLElement, name: string, value: string): () => void {
  const original = element.getAttribute(name)
  element.setAttribute(name, value)
  return () => {
    // Do not undo someone else's later write.
    if (element.getAttribute(name) !== value) return
    if (original === null) element.removeAttribute(name)
    else element.setAttribute(name, original)
  }
}

function inertOwned(element: HTMLElement): () => void {
  const wasInert = element.inert
  element.inert = true
  return () => { if (!wasInert) element.inert = false }
}

function focusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('button, a[href], input, textarea, select, [tabindex], [contenteditable="true"]'))
    .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && !element.closest('[inert]') && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden')
}

/**
 * Minimal structural adapter for 0.1.5 AppFrame. No hashed classes or shell copy.
 * The public overlay marker anchors the frame; its two unmarked column children
 * are the native sidebar and center. Unknown structures are left untouched.
 */
export function attachMobileAdapter(root: HTMLElement, layout: Pick<ILayout, 'toggleSidebar'>, changed: (state: MobileSnapshot) => void): MobileAdapter | null {
  const overlay = root.closest<HTMLElement>('[data-shell-overlay]')
  const frame = overlay?.parentElement
  if (!overlay || !frame || !frame.hasAttribute('data-sidebar-collapsed') && !frame.querySelector(':scope > [data-rightbar-col]')) return null
  const columns = Array.from(frame.children).filter((element): element is HTMLElement => element instanceof HTMLElement && element !== overlay && !element.hasAttribute('data-rightbar-col') && !element.hasAttribute('data-side'))
  if (columns.length !== 2) return null
  const [sidebar, center] = columns as [HTMLElement, HTMLElement]
  const right = frame.querySelector<HTMLElement>(':scope > [data-rightbar-col]')
  const disposers = [setAttributeOwned(frame, 'data-mwb-frame', ''), setAttributeOwned(sidebar, 'data-mwb-sidebar', ''), setAttributeOwned(center, 'data-mwb-center', '')]
  const media = window.matchMedia(MOBILE_QUERY)
  let mobile = false
  let activeDrawer = false
  let previousCollapsed = true
  let disposed = false
  let drawerCleanup: (() => void) | null = null
  let scheduled = 0
  let viewportScheduled = 0
  let lastSnapshot = ''
  let triggerFocus: HTMLElement | null = null
  let restoreFocusFrame = 0
  const collapsed = () => frame.hasAttribute('data-sidebar-collapsed')
  const detailsOpen = () => frame.querySelector('[data-sidebar-right-panel="fullscreen"][data-sidebar-right-open]') !== null
  const close = () => { if (media.matches && !collapsed()) layout.toggleSidebar() }

  const updateViewport = () => {
    viewportScheduled = 0
    if (disposed) return
    const active = document.activeElement
    const editing = active instanceof HTMLElement && frame.contains(active) && (active.matches('input, textarea') || active.isContentEditable)
    const visual = window.visualViewport
    const geometry = mobile ? keyboardViewport(window.innerHeight, visual ? { height: visual.height, offsetTop: visual.offsetTop, scale: visual.scale } : null, editing) : null
    if (geometry) {
      frame.style.setProperty('--mwb-viewport-height', `${geometry.height}px`)
      frame.style.setProperty('--mwb-viewport-top', `${geometry.top}px`)
      frame.setAttribute('data-mwb-keyboard', '')
    } else {
      frame.style.removeProperty('--mwb-viewport-height')
      frame.style.removeProperty('--mwb-viewport-top')
      frame.removeAttribute('data-mwb-keyboard')
    }
  }
  const scheduleViewport = () => { if (!viewportScheduled) viewportScheduled = requestAnimationFrame(updateViewport) }

  const activateDrawer = () => {
    const returnFocus = triggerFocus ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    triggerFocus = null
    const temporary = [
      setAttributeOwned(sidebar, 'role', 'dialog'),
      setAttributeOwned(sidebar, 'aria-modal', 'true'),
      setAttributeOwned(sidebar, 'aria-label', 'Navigation'),
      setAttributeOwned(sidebar, 'tabindex', '-1'),
      inertOwned(center),
      ...(right ? [inertOwned(right)] : []),
    ]
    // Other additive overlay entries remain mounted, but cannot receive focus
    // through this modal. Settings/approval portals outside the frame are untouched.
    for (const child of Array.from(overlay.children)) if (child instanceof HTMLElement && child !== root && !child.contains(root)) temporary.push(inertOwned(child))
    const bar = root.querySelector<HTMLElement>('[data-mwb-bar]')
    if (bar) temporary.push(inertOwned(bar))
    const closeButton = document.createElement('button')
    closeButton.type = 'button'
    closeButton.textContent = 'Close navigation'
    closeButton.setAttribute('data-mwb-drawer-close', '')
    closeButton.addEventListener('click', close)
    sidebar.prepend(closeButton)
    // Native sidebar assumes all height is available. CSS allocates the close row.
    const focusFirst = () => (focusable(sidebar)[0] ?? sidebar).focus({ preventScroll: true })
    const externalDialog = () => Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"], dialog[open]')).some(element => {
      if (element === sidebar || sidebar.contains(element) || element.closest('[inert], [hidden], [aria-hidden="true"]') || element.getClientRects().length === 0) return false
      const style = getComputedStyle(element)
      return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse'
    })
    const keydown = (event: KeyboardEvent) => {
      if (externalDialog()) return
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault()
        event.stopPropagation()
        close()
      } else if (event.key === 'Tab') {
        const targets = focusable(sidebar)
        const current = document.activeElement
        if (!targets.length) { event.preventDefault(); sidebar.focus(); return }
        const first = targets[0]!
        const last = targets[targets.length - 1]!
        if (event.shiftKey && (current === first || !sidebar.contains(current))) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && (current === last || !sidebar.contains(current))) { event.preventDefault(); first.focus() }
      }
    }
    const focusin = (event: FocusEvent) => {
      if (event.target instanceof Node && !sidebar.contains(event.target) && !externalDialog()) {
        // A native popup outside AppFrame owns its own focus and keyboard.
        if (!frame.contains(event.target)) return
        focusFirst()
      }
    }
    document.addEventListener('keydown', keydown)
    document.addEventListener('focusin', focusin)
    const focusFrame = requestAnimationFrame(focusFirst)
    return () => {
      cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', keydown)
      document.removeEventListener('focusin', focusin)
      closeButton.removeEventListener('click', close)
      closeButton.remove()
      for (const release of temporary.reverse()) release()
      // React commits aria/disabled updates after the snapshot callback below.
      // Wait one frame, otherwise a formerly disabled trigger cannot take focus.
      cancelAnimationFrame(restoreFocusFrame)
      const restore = () => {
        restoreFocusFrame = 0
        if (returnFocus?.isConnected && !returnFocus.closest('[inert]')) returnFocus.focus({ preventScroll: true })
      }
      if (disposed) restore()
      else restoreFocusFrame = requestAnimationFrame(restore)
    }
  }

  const synchronize = () => {
    scheduled = 0
    if (disposed) return
    const nextMobile = media.matches
    if (nextMobile && !mobile) previousCollapsed = collapsed()
    if (!nextMobile && mobile && shouldRestoreSidebar(window.innerWidth, previousCollapsed, collapsed())) layout.toggleSidebar()
    mobile = nextMobile
    const details = detailsOpen()
    const open = mobile && !collapsed() && !details
    if (open !== activeDrawer) {
      drawerCleanup?.()
      drawerCleanup = null
      activeDrawer = open
      if (open) drawerCleanup = activateDrawer()
    }
    // Keep hidden native rail out of keyboard/assistive navigation while mobile.
    if (mobile && !open) {
      if (!sidebar.hasAttribute('data-mwb-inert-owned') && !sidebar.inert) { sidebar.inert = true; sidebar.setAttribute('data-mwb-inert-owned', '') }
    } else if (sidebar.hasAttribute('data-mwb-inert-owned')) {
      sidebar.inert = false
      sidebar.removeAttribute('data-mwb-inert-owned')
    }
    frame.toggleAttribute('data-mwb-drawer-open', open)
    frame.toggleAttribute('data-mwb-details-open', mobile && details)
    const snapshot = { mobile, drawerOpen: open, detailsOpen: mobile && details }
    const serialized = JSON.stringify(snapshot)
    if (serialized !== lastSnapshot) { lastSnapshot = serialized; changed(snapshot) }
    scheduleViewport()
  }
  const schedule = () => { if (!scheduled) scheduled = requestAnimationFrame(synchronize) }
  const observer = new MutationObserver(records => {
    // Streaming messages may mutate this subtree very frequently. Only drawer
    // markers or a replaced fullscreen panel can affect this adapter.
    if (records.some(record => record.type === 'attributes' || [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)].some(node => node instanceof HTMLElement && (node.matches('[data-sidebar-right-panel]') || node.querySelector('[data-sidebar-right-panel]'))))) schedule()
  })
  observer.observe(frame, { attributes: true, attributeFilter: ['data-sidebar-collapsed', 'data-rightbar-fullscreen', 'data-sidebar-right-open', 'data-sidebar-right-panel'], subtree: true, childList: true })
  media.addEventListener('change', schedule)
  window.addEventListener('resize', scheduleViewport)
  window.visualViewport?.addEventListener('resize', scheduleViewport)
  window.visualViewport?.addEventListener('scroll', scheduleViewport)
  frame.addEventListener('focusin', scheduleViewport)
  frame.addEventListener('focusout', scheduleViewport)
  synchronize()

  return {
    frame,
    toggle() {
      if (!media.matches) return
      if (collapsed()) triggerFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
      layout.toggleSidebar()
    },
    close,
    dispose() {
      disposed = true
      observer.disconnect()
      media.removeEventListener('change', schedule)
      window.removeEventListener('resize', scheduleViewport)
      window.visualViewport?.removeEventListener('resize', scheduleViewport)
      window.visualViewport?.removeEventListener('scroll', scheduleViewport)
      frame.removeEventListener('focusin', scheduleViewport)
      frame.removeEventListener('focusout', scheduleViewport)
      cancelAnimationFrame(scheduled)
      cancelAnimationFrame(viewportScheduled)
      cancelAnimationFrame(restoreFocusFrame)
      drawerCleanup?.()
      if (mobile && shouldRestoreSidebar(window.innerWidth, previousCollapsed, collapsed())) layout.toggleSidebar()
      if (sidebar.hasAttribute('data-mwb-inert-owned')) { sidebar.inert = false; sidebar.removeAttribute('data-mwb-inert-owned') }
      for (const attribute of ['data-mwb-drawer-open', 'data-mwb-details-open', 'data-mwb-keyboard']) frame.removeAttribute(attribute)
      frame.style.removeProperty('--mwb-viewport-height')
      frame.style.removeProperty('--mwb-viewport-top')
      for (const release of disposers.reverse()) release()
    },
  }
}
