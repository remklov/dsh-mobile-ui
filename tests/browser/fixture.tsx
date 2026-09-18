// Browser contract fixture using the UNMODIFIED published DSH AppFrame and store.
// Slot mounting is a small test adapter, not a replacement DSH server or shell.
import React, { useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import * as jsx from 'react/jsx-runtime'
import * as store from '@deepseek-ai/dsh-client-store'

declare global { interface Window { fixture: any; __ModuleLoader__: any } }
const modules = new Map<string, any>([['react', React], ['react/jsx-runtime', jsx], ['@deepseek-ai/dsh-client-store', store]])
window.__ModuleLoader__ = { load: ({ id, factory }: any) => modules.set(id, factory((name: string) => {
  if (!modules.has(name)) throw new Error(`Unexpected runtime import: ${name}`)
  return modules.get(name)
})) }
const cleanup: (() => void)[] = []
let AppFrame: any
let frameStore: any
let Overlay: any
let overlayOptions: any
let root: ReturnType<typeof createRoot>
const ctx: any = {
  effect(fn: () => () => void, label: string) {
    if (label === 'ui-layout: theme presenter') return () => {}
    const dispose = fn()
    cleanup.push(dispose)
    return dispose
  },
  reflect: { provide(name: string, value: any) { ctx[name] = value; return () => { delete ctx[name] } } },
  slots: {
    provideRoot() { return () => {} }, subscribe() { return () => {} },
    entries() { return [] },
    register(options: any, Component: any) {
      if (options.name === 'root') { AppFrame = Component; frameStore = options.store.create() }
      else if (options.name === 'shell.overlay') { Overlay = Component; overlayOptions = options }
      else throw new Error(`Unexpected slot: ${options.name}`)
      return () => { if (options.name === 'shell.overlay') Overlay = null }
    },
  },
}
function useStore<T>(selector: (snapshot: any) => T): T {
  const snapshot = useSyncExternalStore(frameStore.subscribe, frameStore.getSnapshot)
  return selector(snapshot)
}
const usePanelInfo = (selector: any) => useStore((state: any) => selector(state.panelInfo))
const useSessions = (selector: any) => selector({ current: undefined, byId: {} })
function renderSlot(name: string, props: any) {
  if (name === 'sidebar') return <nav aria-label="Sessions" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
    <button onClick={() => ctx.layout.toggleSidebar()}>Native sidebar toggle</button>
    {!props.collapsed && <><button>New session</button><a href="#session">Example session</a><button>Settings</button></>}
  </nav>
  if (name === 'main') return <main style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
    <header data-conversation-header><h1>Fixture conversation</h1><span data-conversation-header-corner><button data-sidebar-right-expand onClick={() => frameStore.actions.openRightbar(false, true)}>Open details</button></span></header>
    <section style={{ flex: 1, overflow: 'auto' }}><p>Contract fixture using the actual DSH AppFrame.</p><button>Conversation action</button></section>
    <form data-composer style={{ padding: 12 }} onSubmit={e => e.preventDefault()}><textarea placeholder="Message"/><button>Send</button></form>
  </main>
  if (name === 'rightbar') return <Details />
  if (name === 'shell.overlay' && Overlay) {
    const injected: Record<string, any> = {}
    Object.assign(injected, typeof overlayOptions?.inject === 'function' ? overlayOptions.inject() : overlayOptions?.inject ?? {})
    return <Overlay {...injected} usePanelInfo={usePanelInfo} useSessions={useSessions} />
  }
  return null
}
function Details() {
  const open = useStore((state: any) => state.layoutInfo.rightbarFullscreen)
  return open ? <aside role="dialog" aria-label="Details" style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'white' }}><button onClick={() => frameStore.actions.closeRightbar()}>Close details</button></aside> : null
}
window.fixture = {
  start() {
    modules.get('@deepseek-ai/dsh-client-ui-layout').apply(ctx)
    modules.get('dsh-mobile-workbench').apply(ctx)
    root = createRoot(document.getElementById('root')!)
    root.render(<AppFrame useStore={useStore} useSessions={useSessions} usePanelInfo={usePanelInfo} actions={frameStore.actions} renderSlot={renderSlot} t={(key: string) => key}/>)
  },
  stop() { root.unmount(); cleanup.reverse().forEach(dispose => dispose?.()) },
  state() { return frameStore.getSnapshot() },
}
