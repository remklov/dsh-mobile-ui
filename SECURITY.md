# Security policy

## Boundary

This plugin supplies presentation and static PWA metadata. It is not an access
control mechanism. Keep DSH and any authentication plugin updated, and serve the
existing application over HTTPS. Nothing opens a listener, exposes a tunnel,
creates a login, bypasses a host gate, or reads authentication cookies.

The worker contains lifecycle handlers only: **no fetch handler, no CacheStorage,
no offline shell, no persistent conversation data**. Existing browser HTTP caches,
bfcache and host application memory are outside this plugin's control. Logout and
revocation remain the host's responsibility. A browser may retain displayed data
in memory; this plugin does not promise to erase the host's state.

The manifest, icons, and lifecycle-only worker contain only public application
metadata/code. They deliberately use `/auth/mobile-workbench-pwa/`, a narrow child
of the auth plugin's documented public route plane, because Android installation
services may not carry the signed-in tab's cookie jar. This does **not** expose the
DSH shell, APIs, sessions, or files; `start_url` remains protected normally. Never
add user-specific data, secrets, tokens, dynamic proxying, or write endpoints to
this prefix. The independent name also avoids immutable `/assets/` or `/plugins/`
policies. Do not append `?rev=`: some auth versions force such responses public and
immutable. The manifest is requested anonymously by design.

A worker registration at `/` cannot coexist with a different worker at the same
scope. The client refuses a foreign worker instead of replacing it. Unregister
only this plugin's worker before removal; never delete all origin caches.

## Reporting

Do not post credentials, private hostnames, session exports, or exploit details
in public issues. Once hosted on GitHub, use its **Report a vulnerability** / private
security advisory mechanism if the repository owner has enabled it. If unavailable,
ask the owner for a private reporting channel without disclosing the vulnerability.
There is intentionally no invented contact address in this template.

## Before public release

- Enable private security advisories on the repository.
- Review the publish allowlist and `npm pack --dry-run` output.
- Keep secrets in the host's credential storage, not this repository.
- Run automated checks plus the real-device/auth matrix in `docs/TESTING.md`.
- A passing simulated browser test is not proof of iOS/Android OS install behavior.
