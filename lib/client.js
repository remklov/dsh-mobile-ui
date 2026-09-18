window.__ModuleLoader__.load({ id: "dsh-mobile-workbench", factory: (require) => { const module = { exports: {} }; const exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");

// src/client/helpers.ts
var MOBILE_QUERY = "(max-width: 767px)";
var WORKER_PATH = "/auth/mobile-workbench-pwa/sw.js";
function keyboardViewport(layoutHeight, viewport, editing) {
  if (!editing || !viewport || !Number.isFinite(layoutHeight) || !Number.isFinite(viewport.height) || !Number.isFinite(viewport.offsetTop) || !Number.isFinite(viewport.scale)) return null;
  if (Math.abs(viewport.scale - 1) > 0.02 || viewport.height <= 0 || layoutHeight - viewport.height < 100) return null;
  return { height: Math.round(Math.min(layoutHeight, viewport.height)), top: Math.round(Math.max(0, viewport.offsetTop)) };
}
function isOwnWorker(scriptURL, origin) {
  try {
    const url = new URL(scriptURL, origin);
    return url.origin === origin && url.pathname === WORKER_PATH;
  } catch {
    return false;
  }
}
function isOwnManifest(href, origin) {
  try {
    const url = new URL(href, origin);
    return url.origin === origin && url.pathname === "/auth/mobile-workbench-pwa/manifest.webmanifest";
  } catch {
    return false;
  }
}
function isAppleMobile(userAgent, platform, touchPoints) {
  return /iPad|iPhone|iPod/.test(userAgent) || platform === "MacIntel" && touchPoints > 1;
}
function shouldRestoreSidebar(width, initialCollapsed, currentCollapsed) {
  return width < 1024 && initialCollapsed !== currentCollapsed;
}

// src/client/dom.ts
function setAttributeOwned(element, name2, value) {
  const original = element.getAttribute(name2);
  element.setAttribute(name2, value);
  return () => {
    if (element.getAttribute(name2) !== value) return;
    if (original === null) element.removeAttribute(name2);
    else element.setAttribute(name2, original);
  };
}
function inertOwned(element) {
  const wasInert = element.inert;
  element.inert = true;
  return () => {
    if (!wasInert) element.inert = false;
  };
}
function focusable(root) {
  return Array.from(root.querySelectorAll('button, a[href], input, textarea, select, [tabindex], [contenteditable="true"]')).filter((element) => element.tabIndex >= 0 && !element.matches(":disabled") && !element.closest("[inert]") && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden");
}
function attachMobileAdapter(root, layout, changed) {
  const overlay = root.closest("[data-shell-overlay]");
  const frame = overlay?.parentElement;
  if (!overlay || !frame || !frame.hasAttribute("data-sidebar-collapsed") && !frame.querySelector(":scope > [data-rightbar-col]")) return null;
  const columns = Array.from(frame.children).filter((element) => element instanceof HTMLElement && element !== overlay && !element.hasAttribute("data-rightbar-col") && !element.hasAttribute("data-side"));
  if (columns.length !== 2) return null;
  const [sidebar, center] = columns;
  const right = frame.querySelector(":scope > [data-rightbar-col]");
  const disposers = [setAttributeOwned(frame, "data-mwb-frame", ""), setAttributeOwned(sidebar, "data-mwb-sidebar", ""), setAttributeOwned(center, "data-mwb-center", "")];
  const media = window.matchMedia(MOBILE_QUERY);
  let mobile = false;
  let activeDrawer = false;
  let previousCollapsed = true;
  let disposed = false;
  let drawerCleanup = null;
  let scheduled = 0;
  let viewportScheduled = 0;
  let lastSnapshot = "";
  let triggerFocus = null;
  let restoreFocusFrame = 0;
  const collapsed = () => frame.hasAttribute("data-sidebar-collapsed");
  const detailsOpen = () => frame.querySelector('[data-sidebar-right-panel="fullscreen"][data-sidebar-right-open]') !== null;
  const close = () => {
    if (media.matches && !collapsed()) layout.toggleSidebar();
  };
  const updateViewport = () => {
    viewportScheduled = 0;
    if (disposed) return;
    const active = document.activeElement;
    const editing = active instanceof HTMLElement && frame.contains(active) && (active.matches("input, textarea") || active.isContentEditable);
    const visual = window.visualViewport;
    const geometry = mobile ? keyboardViewport(window.innerHeight, visual ? { height: visual.height, offsetTop: visual.offsetTop, scale: visual.scale } : null, editing) : null;
    if (geometry) {
      frame.style.setProperty("--mwb-viewport-height", `${geometry.height}px`);
      frame.style.setProperty("--mwb-viewport-top", `${geometry.top}px`);
      frame.setAttribute("data-mwb-keyboard", "");
    } else {
      frame.style.removeProperty("--mwb-viewport-height");
      frame.style.removeProperty("--mwb-viewport-top");
      frame.removeAttribute("data-mwb-keyboard");
    }
  };
  const scheduleViewport = () => {
    if (!viewportScheduled) viewportScheduled = requestAnimationFrame(updateViewport);
  };
  const activateDrawer = () => {
    const returnFocus = triggerFocus ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    triggerFocus = null;
    const temporary = [
      setAttributeOwned(sidebar, "role", "dialog"),
      setAttributeOwned(sidebar, "aria-modal", "true"),
      setAttributeOwned(sidebar, "aria-label", "Navigation"),
      setAttributeOwned(sidebar, "tabindex", "-1"),
      inertOwned(center),
      ...right ? [inertOwned(right)] : []
    ];
    for (const child of Array.from(overlay.children)) if (child instanceof HTMLElement && child !== root && !child.contains(root)) temporary.push(inertOwned(child));
    const bar = root.querySelector("[data-mwb-bar]");
    if (bar) temporary.push(inertOwned(bar));
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "Close navigation";
    closeButton.setAttribute("data-mwb-drawer-close", "");
    closeButton.addEventListener("click", close);
    sidebar.prepend(closeButton);
    const focusFirst = () => (focusable(sidebar)[0] ?? sidebar).focus({ preventScroll: true });
    const externalDialog = () => Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"], dialog[open]')).some((element) => {
      if (element === sidebar || sidebar.contains(element) || element.closest('[inert], [hidden], [aria-hidden="true"]') || element.getClientRects().length === 0) return false;
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && style.visibility !== "collapse";
    });
    const keydown = (event) => {
      if (externalDialog()) return;
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        event.stopPropagation();
        close();
      } else if (event.key === "Tab") {
        const targets = focusable(sidebar);
        const current = document.activeElement;
        if (!targets.length) {
          event.preventDefault();
          sidebar.focus();
          return;
        }
        const first = targets[0];
        const last = targets[targets.length - 1];
        if (event.shiftKey && (current === first || !sidebar.contains(current))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (current === last || !sidebar.contains(current))) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const focusin = (event) => {
      if (event.target instanceof Node && !sidebar.contains(event.target) && !externalDialog()) {
        if (!frame.contains(event.target)) return;
        focusFirst();
      }
    };
    document.addEventListener("keydown", keydown);
    document.addEventListener("focusin", focusin);
    const focusFrame = requestAnimationFrame(focusFirst);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("focusin", focusin);
      closeButton.removeEventListener("click", close);
      closeButton.remove();
      for (const release of temporary.reverse()) release();
      cancelAnimationFrame(restoreFocusFrame);
      const restore = () => {
        restoreFocusFrame = 0;
        if (returnFocus?.isConnected && !returnFocus.closest("[inert]")) returnFocus.focus({ preventScroll: true });
      };
      if (disposed) restore();
      else restoreFocusFrame = requestAnimationFrame(restore);
    };
  };
  const synchronize = () => {
    scheduled = 0;
    if (disposed) return;
    const nextMobile = media.matches;
    if (nextMobile && !mobile) previousCollapsed = collapsed();
    if (!nextMobile && mobile && shouldRestoreSidebar(window.innerWidth, previousCollapsed, collapsed())) layout.toggleSidebar();
    mobile = nextMobile;
    const details = detailsOpen();
    const open = mobile && !collapsed() && !details;
    if (open !== activeDrawer) {
      drawerCleanup?.();
      drawerCleanup = null;
      activeDrawer = open;
      if (open) drawerCleanup = activateDrawer();
    }
    if (mobile && !open) {
      if (!sidebar.hasAttribute("data-mwb-inert-owned") && !sidebar.inert) {
        sidebar.inert = true;
        sidebar.setAttribute("data-mwb-inert-owned", "");
      }
    } else if (sidebar.hasAttribute("data-mwb-inert-owned")) {
      sidebar.inert = false;
      sidebar.removeAttribute("data-mwb-inert-owned");
    }
    frame.toggleAttribute("data-mwb-drawer-open", open);
    frame.toggleAttribute("data-mwb-details-open", mobile && details);
    const snapshot = { mobile, drawerOpen: open, detailsOpen: mobile && details };
    const serialized = JSON.stringify(snapshot);
    if (serialized !== lastSnapshot) {
      lastSnapshot = serialized;
      changed(snapshot);
    }
    scheduleViewport();
  };
  const schedule = () => {
    if (!scheduled) scheduled = requestAnimationFrame(synchronize);
  };
  const observer = new MutationObserver((records) => {
    if (records.some((record) => record.type === "attributes" || [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)].some((node) => node instanceof HTMLElement && (node.matches("[data-sidebar-right-panel]") || node.querySelector("[data-sidebar-right-panel]"))))) schedule();
  });
  observer.observe(frame, { attributes: true, attributeFilter: ["data-sidebar-collapsed", "data-rightbar-fullscreen", "data-sidebar-right-open", "data-sidebar-right-panel"], subtree: true, childList: true });
  media.addEventListener("change", schedule);
  window.addEventListener("resize", scheduleViewport);
  window.visualViewport?.addEventListener("resize", scheduleViewport);
  window.visualViewport?.addEventListener("scroll", scheduleViewport);
  frame.addEventListener("focusin", scheduleViewport);
  frame.addEventListener("focusout", scheduleViewport);
  synchronize();
  return {
    frame,
    toggle() {
      if (!media.matches) return;
      if (collapsed()) triggerFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      layout.toggleSidebar();
    },
    close,
    dispose() {
      disposed = true;
      observer.disconnect();
      media.removeEventListener("change", schedule);
      window.removeEventListener("resize", scheduleViewport);
      window.visualViewport?.removeEventListener("resize", scheduleViewport);
      window.visualViewport?.removeEventListener("scroll", scheduleViewport);
      frame.removeEventListener("focusin", scheduleViewport);
      frame.removeEventListener("focusout", scheduleViewport);
      cancelAnimationFrame(scheduled);
      cancelAnimationFrame(viewportScheduled);
      cancelAnimationFrame(restoreFocusFrame);
      drawerCleanup?.();
      if (mobile && shouldRestoreSidebar(window.innerWidth, previousCollapsed, collapsed())) layout.toggleSidebar();
      if (sidebar.hasAttribute("data-mwb-inert-owned")) {
        sidebar.inert = false;
        sidebar.removeAttribute("data-mwb-inert-owned");
      }
      for (const attribute of ["data-mwb-drawer-open", "data-mwb-details-open", "data-mwb-keyboard"]) frame.removeAttribute(attribute);
      frame.style.removeProperty("--mwb-viewport-height");
      frame.style.removeProperty("--mwb-viewport-top");
      for (const release of disposers.reverse()) release();
    }
  };
}

// src/client/pwa.ts
function registrationIsOwned(registration, origin) {
  const workers = [registration.active, registration.waiting, registration.installing].filter((worker) => worker !== null);
  return workers.length > 0 && workers.every((worker) => isOwnWorker(worker.scriptURL, origin));
}
async function registerOwnWorker(container, origin, secure, manifestHrefs = []) {
  if (!secure || !container) return "unsupported";
  if (manifestHrefs.some((href) => !isOwnManifest(href, origin))) return "conflict";
  try {
    const existing = await container.getRegistration(`${origin}/`);
    if (existing && !registrationIsOwned(existing, origin)) return "conflict";
    if (container.controller && !isOwnWorker(container.controller.scriptURL, origin)) return "conflict";
    await container.register(WORKER_PATH, { scope: "/", updateViaCache: "none" });
    return "registered";
  } catch {
    return "failed";
  }
}
async function unregisterOwnWorkers(container, origin) {
  if (!container) return 0;
  const registrations = await container.getRegistrations();
  const owned = registrations.filter((registration) => registrationIsOwned(registration, origin));
  const results = await Promise.all(owned.map((registration) => registration.unregister()));
  return results.filter(Boolean).length;
}

// src/client/mobile.css
var mobile_default = `/* Clean-room extension. Every rule is scoped to an AppFrame we marked. */
[data-mwb-frame] [data-mwb-controls] { display: none; }
@media (max-width: 767px) {
  [data-mwb-frame] {
    grid-template-columns: 0 minmax(0, 1fr) 0 !important;
    transition: none !important;
    --mwb-surface: var(--dsw-alias-bg-base, #fff);
    --mwb-foreground: var(--dsw-alias-label-primary, #202124);
    --mwb-border: var(--dsw-alias-border-l3, #8886);
    --mwb-bar-height: calc(52px + env(safe-area-inset-top, 0px));
    --dsh-chat-user-width: 100%;
    --dsh-composer-side-clearance: 8px;
  }
  [data-mwb-frame][data-mwb-keyboard] {
    position: fixed;
    inset: var(--mwb-viewport-top) 0 auto;
    height: var(--mwb-viewport-height) !important;
  }
  [data-mwb-frame] > [data-mwb-center] {
    grid-column: 2;
    grid-row: 1;
    min-width: 0;
    padding-top: var(--mwb-bar-height);
    padding-left: env(safe-area-inset-left, 0px);
    padding-right: env(safe-area-inset-right, 0px);
    padding-bottom: env(safe-area-inset-bottom, 0px);
    box-sizing: border-box;
  }
  [data-mwb-frame] > [data-rightbar-col] { grid-column: 3; grid-row: 1; }
  [data-mwb-frame] > [data-side] { display: none !important; }
  [data-mwb-frame] > [data-mwb-sidebar] {
    position: absolute;
    z-index: 31;
    top: 0;
    bottom: 0;
    left: 0;
    width: min(86vw, 340px);
    max-width: 100%;
    box-sizing: border-box;
    padding: env(safe-area-inset-top, 0px) 0 env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
    background: var(--dsw-specific-sidebar-fill, var(--mwb-surface));
    visibility: hidden;
    transform: translateX(-100%);
    transition: transform 160ms ease, visibility 160ms;
    overflow: hidden;
  }
  [data-mwb-frame][data-mwb-drawer-open] > [data-mwb-sidebar] {
    visibility: visible;
    transform: translateX(0);
    box-shadow: 6px 0 24px #0003;
  }
  [data-mwb-frame][data-mwb-drawer-open] > [data-mwb-sidebar] > :not([data-mwb-drawer-close]) { height: calc(100% - 48px); width: 100% !important; }
  [data-mwb-frame] [data-mwb-controls] { display: contents; }
  [data-mwb-frame] [data-mwb-bar] {
    position: absolute;
    inset: 0 0 auto;
    box-sizing: border-box;
    height: var(--mwb-bar-height);
    padding: env(safe-area-inset-top, 0px) max(8px, env(safe-area-inset-right, 0px)) 0 max(8px, env(safe-area-inset-left, 0px));
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    color: var(--mwb-foreground);
    background: var(--mwb-surface);
    border-bottom: 1px solid var(--mwb-border);
  }
  [data-mwb-frame][data-mwb-details-open] [data-mwb-bar] { display: none; }
  /* Hide only the duplicated native right-panel trigger on phones. Other
     conversation header actions remain available in their native header. */
  [data-mwb-frame] [data-sidebar-right-expand] { display: none !important; }
  /* dsh-better-sidebar renders a fixed top-right toggle cluster outside the
     AppFrame's native header. Its own mobile panel remains reachable from file
     links; hiding this duplicate keeps the mobile App control unobstructed.

     Scoped with :has() rather than as a descendant of [data-mwb-frame]: the
     cluster is attached with body.appendChild(), so it is never inside the
     frame and a descendant selector can never match it. The :has() form still
     limits the rule to pages where this workbench is actually mounted. */
  body:has([data-mwb-frame]) [data-dsh-panel-host] > [data-dsh-toggle-cluster] { display: none !important; }
  [data-mwb-frame] [data-mwb-title] { flex: 1; font: 600 14px/1.3 system-ui, sans-serif; }
  [data-mwb-frame] [data-mwb-button],
  [data-mwb-frame] [data-mwb-drawer-close] {
    min-height: 44px;
    min-width: 44px;
    border: 1px solid var(--mwb-border);
    border-radius: 10px;
    background: var(--mwb-surface);
    color: var(--mwb-foreground);
    padding: 8px 12px;
    font: inherit;
    line-height: 1.25;
    cursor: pointer;
    touch-action: manipulation;
  }
  [data-mwb-frame] [data-mwb-button]:disabled { cursor: default; opacity: .6; }
  [data-mwb-frame] [data-mwb-button]:focus-visible,
  [data-mwb-frame] [data-mwb-drawer-close]:focus-visible { outline: 3px solid var(--dsw-alias-state-business-primary, #4d6bfe); outline-offset: 2px; }
  [data-mwb-frame] [data-mwb-drawer-close] { display: block; height: 44px; margin: 2px 8px; }
  [data-mwb-frame] [data-mwb-backdrop] { position: absolute; inset: 0; background: #0006; border: none; padding: 0; touch-action: none; }
  [data-mwb-frame] [data-mwb-app-layer] { position: absolute; inset: 0; }
  [data-mwb-frame] [data-mwb-app-panel] {
    position: absolute;
    bottom: max(12px, env(safe-area-inset-bottom, 0px));
    left: max(12px, env(safe-area-inset-left, 0px));
    right: max(12px, env(safe-area-inset-right, 0px));
    max-height: calc(100% - var(--mwb-bar-height) - 24px);
    overflow: auto;
    border-radius: 16px;
    background: var(--mwb-surface);
    color: var(--mwb-foreground);
    border: 1px solid var(--mwb-border);
    box-shadow: 0 8px 32px #0004;
    padding: 20px;
    box-sizing: border-box;
    font: 15px/1.5 system-ui, sans-serif;
    overscroll-behavior: contain;
  }
  [data-mwb-frame] [data-mwb-app-panel] h2 { font-size: 19px; margin: 0 0 12px; }
  [data-mwb-frame] [data-mwb-app-panel] p { margin: 10px 0; }
  [data-mwb-frame] [data-mwb-app-actions] { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
  /* Touch sizes only inside the real workbench, never the login document. */
  [data-mwb-frame] :is(button, [role="button"], select) { min-height: 44px; min-width: 44px; }
  [data-mwb-frame] :is(input:not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"]) { font-size: max(16px, var(--dsh-content-font-size, 16px)); }
  [data-mwb-frame] [data-composer-seat],
  [data-mwb-frame] [data-composer-card],
  [data-mwb-frame] [data-composer-input] { min-width: 0; max-width: 100%; box-sizing: border-box; }
  [data-mwb-frame] [data-composer-card] { --dsh-composer-side-clearance: 8px; }
  /* The native last card child is the toolbar; its two flex groups may wrap.
     This structural boundary is anchored on the public composer-card marker. */
  [data-mwb-frame] [data-composer-card] > :last-child { flex-wrap: wrap; row-gap: 8px; }
  [data-mwb-frame] [data-composer-card] > :last-child > div { min-width: 0; max-width: 100%; flex-wrap: wrap; }
  [data-mwb-frame] [data-composer-input] { overflow-wrap: anywhere; }
  [data-mwb-frame] [data-conversation-scroll] { min-width: 0; overscroll-behavior-y: contain; }
  [data-mwb-frame] [data-sidebar-right-panel="fullscreen"] {
    box-sizing: border-box;
    padding-top: env(safe-area-inset-top, 0px);
    padding-right: env(safe-area-inset-right, 0px);
    padding-bottom: env(safe-area-inset-bottom, 0px);
    padding-left: env(safe-area-inset-left, 0px);
  }
  @media (prefers-reduced-motion: reduce) {
    [data-mwb-frame] > [data-mwb-sidebar] { transition: none; }
  }
}
`;

// src/client/index.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var name = "dsh-mobile-workbench";
var inject = ["layout", "slots"];
var RESET_KEY = "dsh-mobile-workbench:worker-disabled";
function readReset() {
  try {
    return localStorage.getItem(RESET_KEY) === "1";
  } catch {
    return false;
  }
}
function saveReset(disabled) {
  try {
    if (disabled) localStorage.setItem(RESET_KEY, "1");
    else localStorage.removeItem(RESET_KEY);
  } catch {
  }
}
function useDialogFocus(open, ref, adapter) {
  (0, import_react.useEffect)(() => {
    const dialog = ref.current;
    const frame = adapter.current?.frame;
    if (!open || !dialog || !frame) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const madeInert = [];
    for (const child of Array.from(frame.children)) if (child instanceof HTMLElement && !child.contains(dialog) && !child.inert) {
      child.inert = true;
      madeInert.push(child);
    }
    const bar = frame.querySelector("[data-mwb-bar]");
    if (bar && !bar.inert) {
      bar.inert = true;
      madeInert.push(bar);
    }
    const targets = () => Array.from(dialog.querySelectorAll('button:not(:disabled), a[href], [tabindex="0"]')).filter((element) => element.getClientRects().length > 0);
    const focus = () => (targets()[0] ?? dialog).focus({ preventScroll: true });
    focus();
    const onKey = (event) => {
      if (event.key !== "Tab") return;
      const items = targets();
      const first = items[0] ?? dialog;
      const last = items[items.length - 1] ?? dialog;
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      }
      if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    const onFocus = (event) => {
      if (event.target instanceof Node && frame.contains(event.target) && !dialog.contains(event.target)) focus();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocus);
      for (const element of madeInert) element.inert = false;
      if (previous?.isConnected && !previous.closest("[inert]")) previous.focus({ preventScroll: true });
    };
  }, [open, ref, adapter]);
}
function MobileWorkbench({ layout }) {
  const root = (0, import_react.useRef)(null);
  const dialog = (0, import_react.useRef)(null);
  const adapter = (0, import_react.useRef)(null);
  const [state, setState] = (0, import_react.useState)({ mobile: false, drawerOpen: false, detailsOpen: false });
  const [appOpen, setAppOpen] = (0, import_react.useState)(false);
  const [installEvent, setInstallEvent] = (0, import_react.useState)(null);
  const [standalone, setStandalone] = (0, import_react.useState)(false);
  const [workerStatus, setWorkerStatus] = (0, import_react.useState)("starting");
  const [message, setMessage] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [rightPanelAvailable, setRightPanelAvailable] = (0, import_react.useState)(false);
  const workerOperation = (0, import_react.useRef)(Promise.resolve());
  const ios = isAppleMobile(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
  (0, import_react.useEffect)(() => {
    if (!root.current) return;
    adapter.current = attachMobileAdapter(root.current, layout, setState);
    return () => {
      adapter.current?.dispose();
      adapter.current = null;
    };
  }, [layout]);
  (0, import_react.useEffect)(() => {
    const frame = adapter.current?.frame;
    if (!frame) return;
    const refresh = () => setRightPanelAvailable(frame.querySelector("[data-sidebar-right-expand]") !== null);
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(frame, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  (0, import_react.useEffect)(() => {
    let alive = true;
    const standaloneMedia = matchMedia("(display-mode: standalone)");
    const fullscreenMedia = matchMedia("(display-mode: fullscreen)");
    const refresh = () => setStandalone(standaloneMedia.matches || fullscreenMedia.matches || navigator.standalone === true);
    refresh();
    standaloneMedia.addEventListener("change", refresh);
    fullscreenMedia.addEventListener("change", refresh);
    const onInstall = (event) => {
      event.preventDefault();
      setInstallEvent(event);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      refresh();
      setMessage("Installed. You can launch DSH from your home screen.");
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    window.addEventListener("appinstalled", onInstalled);
    if (readReset()) setWorkerStatus("reset");
    else {
      workerOperation.current = registerOwnWorker(navigator.serviceWorker, location.origin, window.isSecureContext, Array.from(document.querySelectorAll('link[rel~="manifest"]'), (link) => link.href)).then((status) => {
        if (alive) setWorkerStatus(status);
      });
    }
    return () => {
      alive = false;
      standaloneMedia.removeEventListener("change", refresh);
      fullscreenMedia.removeEventListener("change", refresh);
      window.removeEventListener("beforeinstallprompt", onInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  (0, import_react.useEffect)(() => {
    if (!state.mobile || state.detailsOpen || state.drawerOpen) setAppOpen(false);
  }, [state.mobile, state.detailsOpen, state.drawerOpen]);
  (0, import_react.useEffect)(() => {
    if (!appOpen) return;
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        setAppOpen(false);
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [appOpen]);
  useDialogFocus(appOpen, dialog, adapter);
  const install = async () => {
    if (!installEvent) return;
    setBusy(true);
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      setMessage(choice.outcome === "accepted" ? "Installation requested. Check your home screen." : "Installation dismissed. You can also use the browser menu.");
    } catch {
      setMessage("The browser could not open its installer. Use the browser menu to add DSH to your home screen.");
    } finally {
      setInstallEvent(null);
      setBusy(false);
    }
  };
  const reset = async () => {
    setBusy(true);
    saveReset(true);
    try {
      await workerOperation.current;
      await unregisterOwnWorkers(navigator.serviceWorker, location.origin);
      setWorkerStatus("reset");
      setInstallEvent(null);
      setMessage("Our service worker is unregistered; existing tabs may stay controlled until closed. No caches, login data, or other plugins were changed. Remove the home-screen icon using your phone\u2019s normal app controls.");
    } catch {
      setMessage("Could not unregister the worker. You can retry or manage this site in your browser settings.");
    } finally {
      setBusy(false);
    }
  };
  const enable = async () => {
    setBusy(true);
    saveReset(false);
    const operation = registerOwnWorker(navigator.serviceWorker, location.origin, window.isSecureContext, Array.from(document.querySelectorAll('link[rel~="manifest"]'), (link) => link.href));
    workerOperation.current = operation;
    setWorkerStatus(await operation);
    setMessage("");
    setBusy(false);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { ref: root, "data-mwb-controls": "", children: state.mobile && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { "data-mwb-bar": "", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", "data-mwb-button": "", "aria-label": "Open navigation", "aria-expanded": state.drawerOpen, onClick: () => {
        setAppOpen(false);
        adapter.current?.toggle();
      }, children: "\u2630" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "data-mwb-title": "", children: "DSH" }),
      rightPanelAvailable && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", "data-mwb-button": "", "data-mwb-open-details": "", "aria-label": "Open file and details panel", onClick: () => {
        const native = adapter.current?.frame.querySelector("[data-sidebar-right-expand]");
        native?.click();
      }, children: "\u25A3" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", "data-mwb-button": "", "aria-haspopup": "dialog", "aria-expanded": appOpen, onClick: () => {
        adapter.current?.close();
        setAppOpen(true);
      }, children: "App" })
    ] }),
    state.drawerOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", "data-mwb-backdrop": "", tabIndex: -1, "aria-label": "Close navigation", onClick: () => adapter.current?.close() }),
    appOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { "data-mwb-app-layer": "", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", "data-mwb-backdrop": "", tabIndex: -1, "aria-label": "Close app options", onClick: () => setAppOpen(false) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { ref: dialog, "data-mwb-app-panel": "", role: "dialog", "aria-modal": "true", "aria-labelledby": "mwb-app-title", tabIndex: -1, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { id: "mwb-app-title", children: "DSH on your home screen" }),
        standalone ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "You are already using the installed app." }) : ios ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
          "In Safari, tap ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Share \u2192 Add to Home Screen" }),
          ", then Add. Your existing DSH login still applies."
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
          "Use ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Install app" }),
          " or ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Add to Home screen" }),
          " in your browser menu. When supported, the button below opens the browser installer."
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "This app requires an online connection. It does not cache conversations, credentials, or pages." }),
        workerStatus === "conflict" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { role: "status", children: "Another plugin owns a manifest or root service worker. We left it unchanged. Home-screen installation may depend on that plugin." }),
        workerStatus === "unsupported" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { role: "status", children: "Service workers require HTTPS and browser support. Mobile browsers cannot use this feature over a plain HTTP LAN address." }),
        workerStatus === "failed" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { role: "status", children: "Service worker setup failed. Check HTTPS, login, and the plugin\u2019s host routes, then retry." }),
        workerStatus === "reset" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { role: "status", children: "PWA service-worker registration is disabled in this browser." }),
        message && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { role: "status", children: message }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { "data-mwb-app-actions": "", children: [
          installEvent && !standalone && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", "data-mwb-button": "", disabled: busy, onClick: () => void install(), children: "Install app" }),
          (workerStatus === "reset" || workerStatus === "failed") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", "data-mwb-button": "", disabled: busy, onClick: () => void enable(), children: "Enable PWA support" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", "data-mwb-button": "", disabled: busy, onClick: () => void reset(), children: "Reset our PWA support" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", "data-mwb-button": "", onClick: () => setAppOpen(false), children: "Close" })
        ] })
      ] })
    ] })
  ] }) });
}
function apply(ctx) {
  ctx.effect(() => {
    const style = document.createElement("style");
    style.dataset.plugin = name;
    style.textContent = mobile_default;
    document.head.append(style);
    return () => style.remove();
  }, "mobile-workbench: scoped styles");
  ctx.effect(() => ctx.slots.register({ name: "shell.overlay", id: "dsh-mobile-workbench", order: 10, inject: () => ({ layout: ctx.layout }) }, MobileWorkbench), "mobile-workbench: shell overlay");
}
return module.exports; } });
