# Testing and release validation

## Automated checks

```sh
npm ci
npm run check
npx playwright install --with-deps chromium
npm run test:browser
npm pack --dry-run
```

Browser dependencies can require OS packages on Linux. `install --with-deps`
requires permission to install those packages. CI performs this in a disposable
runner. No test uses a production account or contacts a live DSH endpoint.

The browser fixture loads the actual published `0.1.5-rc.2` AppFrame and store
with React and a small test slot renderer. It tests real layout geometry,
sidebar interaction, inert background, keyboard focus wrap/restoration, backdrop
closure, desktop restoration, worker registration, worker reset, preservation of
an unrelated cache, and refusal to replace a foreign worker. It is not a complete
end-to-end test of every DSH component.

## Full installed-DSH smoke (optional)

```sh
DSH_RUNTIME_ROOT=/absolute/path/to/installed/dsh \
  node scripts/test-dsh-smoke.mjs
```

This starts the actual DSH CLI in a child with a fresh temporary HOME/DSH_HOME,
empty workspace and test profile. It mounts the built plugin through the normal
profile bundle loader, disables telemetry, chooses a loopback ephemeral port,
opens Chromium, and verifies actual client activation/geometry/navigation/PWA.
It does not install into or restart the user's live profile. The startup token is
only synthetic and redacted from failure logs. Child and temporary data are
removed in `finally`. No model call or user session is made.

## Real authentication integration (optional)

```sh
DSH_RUNTIME_ROOT=/absolute/path/to/installed/dsh \
DSH_AUTH_PLUGIN_PATH=/absolute/path/to/@xgone/dsh-remote \
  npm run test:auth
```

The script requires the versions it audited: host/connection/frontend-static
`0.1.5-rc.2`, auth `0.3.3`. It refuses unknown versions pending an isolation review.
Each composition order runs in its own child, with a stripped environment,
temporary HOME/DSH_HOME/cwd, random synthetic accounts and an in-memory credential
provider. Actual Cordis, WebServer, core browser-cookie handling, static frontend
and authentication code run, not a mocked authentication decision. Only loopback
port 0 is used; child processes and temporary directories are disposed.

It checks both mobile-before-auth and auth-before-mobile:
- Login page vs authenticated shell metadata
- All icon/manifest/worker gates and content types
- Plain and gzip response bodies and cache headers
- Authenticated manifest credentials and relative URLs
- Core cookie recovery, expiry, removed accounts, guest reads, logout and
  same-origin/cross-site behavior
- Mobile plugin unload/reload and registration disposal

**Known upstream warning:** auth 0.3.3 hot-unload leaves the login fallback in
place. The test reports this while checking that protected shell content is not
exposed. It does not treat auth hot-unload as a supported deployment strategy.

## Manual release gate — not automated or claimed complete

Use an HTTPS deployment with the intended auth plugin and actual devices. A
headless desktop test cannot verify Safari/Android OS home-screen installation.

- [ ] Android Chrome/Edge: sign in, manifest/icons load, Install app, launch icon.
- [ ] iPhone Safari: Share → Add to Home Screen, launch standalone, sign in if asked.
- [ ] Installed session expiry, logout and revoked account return to normal login.
- [ ] Background SW update after expiry fails safely and recovers after login.
- [ ] Soft keyboard open/close, multiline composer, portrait/landscape, notches.
- [ ] iOS pinch zoom/accessibility text size and reduced-motion remain usable.
- [ ] Native DSH settings/approvals/details and all intended third-party panels.
- [ ] Offline launch fails normally; no conversation/auth response comes from SW.
- [ ] Browser Back/bfcache logout behavior verified with the auth plugin.
- [ ] Existing foreign worker/manifest conflict is visible and not overwritten.
- [ ] Reset own worker, uninstall package, restart, remove home-screen icon.

Before publishing a public repository, review `git diff --cached`, the package
allowlist and release archive, add the actual repository metadata, and enable
private security reporting. No secrets, private hostnames, screenshots of real
sessions, generated test credentials or absolute machine-specific paths belong
in source control. Do not claim ongoing maintenance without a maintainer and
an update/testing process.
