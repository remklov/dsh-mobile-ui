# Compatibility boundaries

## Supported integration

The initial implementation targets 0.1.5 Web APIs and is built against pinned
`0.1.5-rc.2` declarations/bundles. The CLI in the reference deployment reports
`0.1.5-rc.1`, while its installed Web components report `0.1.5-rc.2`. The plugin
uses neither `@deepseek-ai/dsh-client-runtime` nor obsolete global runtime stores.
Only 0.1.5 is advertised; future prereleases must be tested before widening peers.

Host:
- `inject: ['webServer']`
- `webServer.register({kind:'prefix', path:'/mobile-workbench', handler})`
- `webServer.tapIndex(transform)` to deduplicate manifest/viewport declarations
- Cordis `ctx.effect()` disposers; no private host fields, fallback takeover or monkey patches

Client:
- DSH `window.__ModuleLoader__.load` factory bundle protocol
- `dsh.client.inject`: layout and renderer packages, both actual client owners
- `inject: ['layout','slots']` and additive `shell.overlay` registration
- Public `ctx.layout.toggleSidebar()`; native right-panel fullscreen remains its owner's responsibility
- Pure type imports from ui-slots; React provided by the host, never bundled twice

## Explicit DOM contracts

DSH currently does not expose every responsive geometry setting as a public
service. A small reversible adapter marks only a known AppFrame structure:

- `[data-shell-overlay]` is a direct child of AppFrame.
- AppFrame contains `[data-rightbar-col]` and two otherwise unmarked column
  children: left sidebar then center. `[data-side]` drag handles are excluded.
- `data-sidebar-collapsed` projects the native collapsed state.
- Native fullscreen details uses `[data-sidebar-right-panel="fullscreen"]`
  and `[data-sidebar-right-open]`.
- Composer enhancements use `[data-composer-card]`, `[data-composer-seat]`,
  `[data-composer-input]`, `[data-conversation-scroll]` and existing CSS variables.

No hashed/minified CSS class names are used. Unknown frame structures are left
untouched rather than guessed. The positional column contract is still a
compatibility risk: check the actual upstream AppFrame on every upgrade.

CSS and behavior are scoped to `data-mwb-*` markers. Desktop width preferences
are not rewritten. Mobile is below 768 CSS pixels, matching the native details
panel fullscreen breakpoint. Pinch zoom is not disabled; keyboard viewport
adjustment only applies to an editing, unzoomed, measurably reduced viewport.
No speculative keyboard height is applied when the browser reports none.

The first version has English plugin copy and button/backdrop navigation, not
edge-swipe or native Android history/back interception. Those can be added later
without commandeering browser history or accessibility gestures.

## Auth integration findings

With `@xgone/dsh-remote@0.3.3`, both earlier and later named routes are wrapped
except `/auth/*`, its documented public plane. Android's installation service may
not share the signed-in tab's cookies, so static manifest/icons/lifecycle worker
use the narrow `/auth/mobile-workbench-pwa/*` child and anonymous manifest mode.
The files contain no user data and grant no access; root application/API routes
remain gated. Root-relative URLs survive Host/Origin rewriting. Explicit
Content-Length is omitted because that auth version's gzip wrapper can preserve
an incorrect uncompressed length; the integration test reproduced this.

Its hot-unload behavior has a separate upstream limitation: disposing the auth
plugin leaves its standalone login fallback active even after named routes are
unwrapped. The test documents this rather than weakening an assertion about
protected content. Use normal process restarts, not auth hot-unload, for deployment
changes. The mobile plugin's own route/tap disposal and reactivation are tested.

Do not place PWA routes outside the dedicated `/auth/mobile-workbench-pwa/`
allowlist, under `/assets` or `/plugins`, or append `?rev=`. Public metadata must
remain static and non-sensitive. Real-device installation remains a release check.

Chrome for Android installs a WebAPK through Google's minting service and Google
Play. A Tailscale Serve-only `*.ts.net` name uses split DNS and is not resolvable
from public DNS, so a true WebAPK is not guaranteed even when the phone can load
all assets over its tailnet. Use a public-DNS, Internet-routable HTTPS origin (or
Tailscale Funnel) when WebAPK installation is a requirement; otherwise Chrome may
offer only a browser-managed home-screen shortcut.

## Multi-plugin behavior

- Existing manifest: host head transform leaves it unchanged; client refuses a
  foreign manifest before worker registration.
- Existing foreign root worker/controller: registration returns a visible conflict
  status and never deliberately replaces it. Concurrent competing installations
  across tabs are not an atomic ownership protocol; install one PWA plugin only.
- Own worker reset: unregisters only registrations with our exact same-origin script.
- Native settings/approval portals retain ownership of their modal interaction.
- No blanket changes to session events, authentication, theme or model settings.
- Other CSS-reordering/sidebar plugins may require testing; no universal compatibility promise.
