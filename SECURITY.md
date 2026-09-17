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

The manifest and icons contain only public application metadata. They use an
independent `/mobile-workbench/` prefix so authentication middleware does not
mistake them for immutable `/assets/` or `/plugins/` build files. Do not append
`?rev=` to these URLs: some auth versions unconditionally make such responses
public/immutable. The manifest link requests credentials. We never put metadata
under `/auth/` to evade an existing gate.

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
