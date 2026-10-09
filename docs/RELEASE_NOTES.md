# TRC Community Atlas release notes

## 0.15.6 — Profile consolidated in the header

- Removed the duplicate profile block from the bottom of navigation.
- Added a compact top-right profile menu with account identity, local-account
  status, vault permission, administrator settings, and sign out.
- Added keyboard navigation, Escape/outside-click closing, and responsive layout.

## 0.15.5 — Webhook MFA confirmation refined

- Reorganized the webhook MFA card vertically so its title, explanation, and
  code field remain readable at every supported width.

## 0.15.4 — Local integrations realigned

- Rebuilt the Integrations hierarchy around enablement, MFA confirmation, token
  creation, and existing access.
- Standardized scope checkboxes and descriptions.
- Separated creation and list cards to remove forced height and empty space.
- Added narrow-screen layout without horizontal scrolling.

## 0.15.3 — Expanded Help Center and guided alerts

- Added GitHub, Windows installation, signed update, backup, restore, and
  official-link help paths.
- Added real screenshots produced from fictional local QA data.
- Mirrored the critical-alert count on the Settings destination that can fix it.
- Routed alerts to Initial configuration, Backups, Updates, or Accounts and
  access according to the failing control.
- Preserved configured trusted proxies during Windows update installation.
- Rotated the PWA cache and expanded regression tests.

## 0.15.2 — Git line-ending tolerant update verification

- Verified the publishing-key identity from the actual Ed25519 key while
  accepting LF and CRLF PEM representations.
- Added an explicit Git LF rule for reproducible PEM files.
- Added regression coverage for `release_key_mismatch` caused only by line
  endings.

## 0.15.1 — Authentication and proxy security fixes

- Added persistent password and MFA throttling by account and client address.
- Reduced MFA challenges to five minutes and invalidated them after five wrong
  codes.
- Applied endpoint-specific body limits.
- Required exact trusted-proxy addresses before honoring forwarded headers.
- Reduced public status to `{ "ok": true }`, kept details local, and returned
  real `404` responses for unpublished paths.
- Removed environment-specific infrastructure details from public QA reports.

## 0.15.0 — Signed Release and transactional update

- Added Ed25519-signed Release manifests with the private key kept outside Git.
- Restricted downloads to approved GitHub hosts and verified size and SHA-256
  twice before mutation.
- Required super-administrator permission, CSRF, MFA, and exact-version
  confirmation.
- Snapshotted the program, SQLite, vault, accounts, attachments, and instance
  configuration.
- Added post-restart program, database, vault, and business-count checks with
  automatic rollback.
- Added isolated Windows update-test tasks for QA ports.

## 0.14.3 — Hardened GitHub update checks

- Compared the installed version with the published stable tag.
- Distinguished up-to-date, update-detected, and no-release states.
- Treated manifest presence as a hint only; cryptographic verification and a
  ready rollback remain mandatory.
- Added administrator-authentication, CSRF, audit, and route-absence tests.

## 0.14.2 — Responsive sign-in

- Switched sign-in to one column before minimum widths could overflow.
- Validated desktop, narrow-window, and phone rendering.
- Rotated the cache key for immediate public delivery.

## 0.14.1 — Responsive visual completion

- Preserved complete long organization names.
- Changed Settings navigation to a phone-friendly grid.
- Added responsive desktop-table and mobile-card account views.
- Increased primary touch targets to 44 px.
- Rotated the PWA cache key.

## 0.14.0 — Operations center and advanced documentation

- Added full-backup management with local or UNC destination, daily/weekly
  scheduling, DPAPI-protected secret, explicit retention, history, and
  inspection without restore.
- Expanded site health with SQLite integrity, disk space, data volume, backup
  age, and version-check status.
- Added manual GitHub Release checks without installation until signed-manifest
  and rollback requirements pass.
- Added local module schema builder and document review workflow.
- Added guided CSV import with preview, mapping, organization scope, and
  revision rollback.
- Added optional minimal local API tokens and loopback-only signed webhooks.

## 0.13.2 — Background startup and local port check

- Added background-startup controls under Initial configuration.
- Protected the hidden Windows task with administrator rights, CSRF, and
  reinforced MFA.
- Reused the active address, port, origins, and data directory.
- Added real task state and safe local-listener testing to Site health.
- Added isolated Windows task tests.

## 0.13.1 — Complete deployment configuration

- Added the graphical `Installer-Atlas.cmd` configurator.
- Added port, bind address, HTTPS origin, folder, channel, and startup choices.
- Added local port availability tests without network scanning.
- Added safe active-instance reconfiguration with SQLite preservation.
- Added a separate Start menu configuration shortcut.
- Refused UNC live-data folders to protect SQLite.

## 0.13.0 — Simplified Windows installation

- Added double-click guided installation.
- Bundled Node.js in the standalone Windows package.
- Separated program, configuration, logs, and persistent data.
- Preserved accounts, MFA, vault, and attachments during repair.
- Added Start menu shortcuts and hidden automatic startup.
- Added clean deployment testing on `127.0.0.1:9095`.
- Generated a validation ZIP and SHA-256 in Windows CI.

## 0.12.9 — Reorganized Settings overview

- Moved compact Settings navigation above content.
- Separated instance administration from preferences.
- Improved card width and typography.
- Reduced the administrator notice to a short banner.
- Published the official source and added Windows GitHub Actions tests.

## 0.12.8 — Dedicated Settings pages

- Replaced the mixed settings form with dedicated pages.
- Restricted Initial configuration and Site health to administrators.
- Placed MFA fields directly inside protected pages.
- Kept one Settings entry point and linked Accounts and access from the overview.

## 0.12.7 — Initial configuration and site health

- Added instance code, primary domain, aliases, reverse proxy, and reinforced
  MFA configuration.
- Loaded exact HTTPS origins without changing DNS, certificate, router, or
  firewall.
- Added factual health checks and a manual TLS-validating public probe.
- Added self-hosting operations documentation.

## 0.12.6 — Integrated Help Center

- Added the header `?` menu, local searchable Help Center, and categories.
- Added English and French articles with desktop and mobile layouts.
- Added visible version and What's New access.
- Added user, security, and operations guides.

## 0.12.5 — Quick Notes

- Added per-organization Markdown Quick Notes.
- Kept the default state empty.
- Updated search and activity without mixing organizations.

## 0.12 — Administration and experience

- Added per-organization accounts and permissions.
- Added organization hierarchy limited to three levels.
- Added full-page module forms.
- Added password health.
- Added mobile PWA installation.
- Scoped navigation and counters to the active organization.

