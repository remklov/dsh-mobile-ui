# DSH Mobile Workbench

Source repository: [remklov/dsh-mobile-ui](https://github.com/remklov/dsh-mobile-ui).
The plugin/package name remains `dsh-mobile-workbench`.

An independent, authentication-neutral **mobile layout + installable PWA** plugin
for DeepSeek Harness Web. No tunnel, gateway, pairing code, extra account, or
server port. Your existing application origin and login stay in charge.

**Status: initial implementation, not a published npm release.** Targets DSH
0.1.5 Web APIs. Automated tests and remaining real-device checks are documented
in [docs/TESTING.md](docs/TESTING.md). Do not infer compatibility with every DSH
release from its version number: prerelease APIs can change.

## Features

- Phone-width navigation drawer over a full-width conversation, using the
  existing DSH layout service rather than copying the shell.
- Keyboard-aware viewport sizing, safe-area padding, accessible close controls,
  Escape/backdrop dismissal, and focus management.
- Desktop layout left unchanged at widths of 768 CSS pixels and above.
- Original home-screen icons, credential-aware manifest, Android installation
  prompt where supported, and iOS installation instructions.
- Lifecycle-only service worker: **no request interception and no offline cache**.
- No model, tool, prompt, session, SSH, or authentication modifications.

Web Push and offline operation are deliberately **not included** in v0.1.
Installation does not make the DSH backend run on your phone: the server must
remain running and reachable.

## Build and install

Requires Node.js 22 or newer and an existing DSH Web installation using the 0.1.5
extension APIs. Development is tested against Web packages `0.1.5-rc.2`; the
reference deployment has CLI `0.1.5-rc.1` with those Web packages.

```sh
npm ci
npm run check
npx playwright install chromium
npm run test:browser
npm pack
# Install the generated archive into a TEST profile first:
dsh --profile mobile-test --from-default-profile web --dump-config
dsh plugin --profile mobile-test add /absolute/path/to/dsh-mobile-workbench-0.1.0.tgz
```

Use an isolated DSH home and a separate loopback port for deployment testing. Do
not run two processes against the same profile/data store or replace an existing
GUI server just to preview the plugin. After testing, install the archive into
your intended profile with the same `dsh plugin --profile ... add` command and
restart that profile using its normal process supervisor. **Refresh alone does
not load a newly installed host plugin.** The repository does not manage or kill
your running DSH process.

There is no `postinstall` hook and no automated publish step. The archive contains
prebuilt client/host bundles. For local development, run `npm run build` and use a
local package link in an isolated profile. Native DSH client HMR still requires
the appropriate host build watcher; this project does not claim automatic reload.

Do not run another mobile/PWA layout plugin at the same time. This plugin does
not silently disable any existing plugin. If an existing manifest or foreign
root-scoped worker is detected, it avoids taking ownership instead of overwriting it.

## Add to your home screen

1. Open the **existing HTTPS DSH address** on your phone and sign in normally.
2. On Android Chrome/Edge, use the plugin's install control when offered or the
   browser menu's **Install app / Add to Home screen** command.
3. On iPhone/iPad, open in Safari and choose **Share → Add to Home Screen**.
4. Launch the new icon. If its browser container has no session or the session has
   expired, sign in again. The plugin does not share or copy credentials.

The browser/OS decides when installation is available. HTTP LAN IPs are not
secure contexts; loopback HTTP is only a development exception. Since login
plugins may require authentication even for icons/manifest, OS-level installation
must be checked on the actual phone. Never weaken authentication as an automatic
workaround. Nothing in this plugin makes a local server remotely accessible.

## Authentication and privacy

- Static manifest, icon, and lifecycle-only worker routes use
  `/auth/mobile-workbench-pwa/`, the authentication plugin's documented public
  route family. They contain no user data and grant no DSH access. Android may
  fetch install assets outside the signed-in tab's cookie jar.
- The manifest uses `crossorigin="anonymous"`.
- All generated URLs are root-relative; proxy-rewritten Host headers are ignored.
- The service worker has **no fetch handler**, uses no CacheStorage, and stores no
  documents, API responses, authentication responses, or conversation content.
- Requests continue through the same host and authentication gates. Login,
  logout, session expiry, and revocation remain the auth plugin's responsibility.
- Existing browser HTTP caches and application/bfcache memory are not disabled.
- No telemetry, external CDN, remote fonts, third-party endpoints, or secret files.

`@xgone/dsh-remote@0.3.3` was inspected specifically. It wraps all named routes,
including routes registered later, except its public `/auth/*` plane. This plugin
uses a narrowly named child of that plane only for static installation metadata;
the application, APIs, and conversations remain gated. It avoids the auth
plugin's immutable `/assets/` and `/plugins/` namespaces. See the
[security notes](SECURITY.md) and optional real-auth integration test.

## Uninstall

First use the mobile controls' worker reset/removal action. Then remove the
package from the profile and restart it:

```sh
dsh plugin --profile web remove dsh-mobile-workbench
```

If the plugin was already removed, unregister **only** the worker whose script
ends in `/auth/mobile-workbench-pwa/sw.js` via browser developer tools → Application →
Service Workers. Do not remove unrelated workers or clear all origin caches.
Removing a server package cannot remotely uninstall a home-screen icon; remove
that icon through your phone's normal app controls. The leftover lifecycle-only
worker cannot serve stale pages, but explicit cleanup is recommended.

## Development / public repository

- `npm run check`: types, bundled build, unit tests.
- `npm run test:browser`: Chromium contract tests using the real published DSH
  AppFrame bundle, real React and current layout store, with test slot adapters.
- `npm run test:auth`: optional installed-runtime integration; see `docs/TESTING.md`.
- `npm run icons`: regenerate original PNG icons reproducibly without image tools.
- `npm pack --dry-run`: inspect the explicit publish allowlist.

Commit source, tests, docs, icons, `package-lock.json`, and the reproducible
prebuilt `lib/` output so DSH can install directly from GitHub. Do not commit
`node_modules`, test output, host data, credential files or machine configuration.
The `.gitignore` is defense in depth, not a substitute for reviewing staged files.
The root of this repository must stay separate from your DSH home/configuration.
Before publishing to npm, verify the package name is available (or choose a
scope). Enable GitHub private vulnerability reporting on the repository.
No npm ownership or ongoing-maintenance promise is implied.

## Architecture

- `src/index.ts`: disposable host route and index-transform registration.
- `src/host/pwa.ts`: static metadata, route allowlist, lifecycle-only worker.
- `src/client/`: additive `shell.overlay` UI and reversible DOM adapter.
- `scripts/build.mjs`: DSH module-loader client bundle, host ESM bundle and types.
- `docs/COMPATIBILITY.md`: explicit API and DOM contracts.

Behavioral inspiration: [jasondu/dsh-ui-mobile](https://github.com/jasondu/dsh-ui-mobile).
This implementation does not copy its obsolete runtime integration or caching
worker. Original icon artwork; no DeepSeek brand artwork. See [NOTICE](NOTICE).

## License

MIT. Independent third-party project, not endorsed by DeepSeek.
