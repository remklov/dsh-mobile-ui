# Initial validation record

Validation performed on 2026-09-16. This is evidence for the initial build, not a
promise of future DSH or browser compatibility.

## Passed

- TypeScript strict application typecheck and declaration generation.
- Host ESM and DSH client module-loader bundle builds.
- 14 unit tests (PWA routes/headers, injection, worker lifecycle, viewport,
  ownership, reset and mobile-state helpers).
- 3 Chromium browser contract tests using actual DSH AppFrame 0.1.5-rc.2:
  mobile geometry, drawer focus wrap/restore and dismissal, desktop restoration,
  real manifest/worker, reset preserving another cache, foreign worker conflict.
- Full installed DSH smoke with CLI 0.1.5-rc.1 / Web components 0.1.5-rc.2:
  fresh isolated profile through the real loader, normal first-run onboarding,
  mobile client activation, drawer, App dialog, manifest, worker, desktop widths,
  and no unhandled browser exceptions. No real model or session data.
- 228 real authentication integration assertions (114 per load order) with
  @xgone/dsh-remote 0.3.3 and actual DSH WebServer/Connection/FrontendStatic.
- npm audit reported no known vulnerabilities in the installed dependency tree
  during initial setup; production audit also reported none.
- Reviewed package allowlist and checked source for machine paths/private host
  values and common credential patterns. This is not a formal security audit.

## Regression caught and corrected

Auth 0.3.3's compression wrapper could retain a previously set uncompressed
Content-Length. The real integration script reproduced a truncated gzip worker
response; the PWA route now leaves transfer framing to the host. Browser tests
also caught a drawer focus-restoration timing issue, now covered by regression
assertions.

## Known limitations

- Actual Android/iOS home-screen installation and virtual keyboard behavior need
  the manual device checks in TESTING.md. Desktop Chromium emulation does not
  verify OS install permissions, cookie containers, safe areas or keyboards.
- Auth 0.3.3 hot-unload retains its standalone login fallback; the integration
  suite explicitly warns about this upstream behavior. Use normal restarts.
- Additional third-party layouts/sidebar plugins have not all been tested.
- No offline operation, Web Push, edge-swipe or browser-back interception in v0.1.
- No live profile was modified or restarted, and no repository/package published.
