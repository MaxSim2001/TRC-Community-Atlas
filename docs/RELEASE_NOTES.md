# TRC Community Atlas release notes

## 0.17.0 — Personal productivity and client reporting

- Added a unified action center that combines documentation, certificate,
  password-rotation, backup, and instance-health follow-ups with explainable
  severity and per-user snoozing.
- Added personal favorites, configurable overview widgets, reusable saved list
  views, and an `Alt+K` command palette.
- Added audited bulk editing for configurations and module records without any
  bulk path into the password vault.
- Added a printable client report and a deliberately minimized JSON summary
  that excludes vault data, MFA, attachments, free-form notes, and detailed
  custom fields.
- Added reusable CSV column-mapping profiles and three starter template packs
  for MSP onboarding, Microsoft 365, and core networking.
- Expanded the audit explorer with actor, action, organization, and date
  filters plus a CSV export of the visible result page.
- Added an explicit limited-offline indicator. The service worker continues to
  cache only the application shell; APIs and business data remain uncached.
- Added local webhook delivery counters, last-success visibility, and two
  bounded automatic retries while retaining the loopback-only restriction.

## 0.16.2 — Compact expandable SSL overview

- Replaced the redundant SSL Tracker record table with one compact expandable
  row per SSL record.
- Added the domain count, earliest verified expiration, minimum days remaining,
  and overall status to every collapsed row.
- Expanded rows show every configured domain without truncation, including
  records containing 20 domains, with independent expiration and status data.
- Added a responsive card layout for mobile while retaining keyboard-accessible
  native disclosure controls.

## 0.16.1 — Independent TLS certificate monitoring

- Added automatic public TLS certificate checks for SSL Tracker records.
- Stored issuer, subject, serial number, validity, trust, hostname match, last
  check, and next check separately for every documented domain.
- Added a responsive per-domain status view so domains in the same record can
  have different certificate authorities and expiration dates.
- Scheduled normal checks every five days and daily checks when a certificate
  has 30 days or fewer remaining, with an explicit manual check action.
- Kept failed or overdue checks distinct from actual certificate expiration so
  stale dates do not create false renewal alerts.
- Blocked private, local, IP, wildcard, URL, and mixed public/private probe
  destinations; Atlas never requests or stores TLS private keys.

## 0.16.0 — Scalable documentation operations

- Added a local SQLite asset index with server-side search, filtering, and
  pagination.
- Added targeted per-record writes with optimistic conflict detection instead
  of requiring every edit to replace the complete workspace.
- Added a previewed, MFA-confirmed module merge assistant that preserves
  records and templates and leaves a revision rollback point.
- Added an explainable documentation-quality dashboard for ownership, age,
  duplicates, broken relationships, and schema versions.
- Added CSV duplicate handling with skip, fill-missing-fields, and explicit
  create-anyway choices.
- Added versioned local-module schemas and schema history.
- Added an isolated encrypted-backup restore drill with SQLite quick-check.
- Added the public security-reporting policy, migration compatibility matrix,
  and Node.js 22/24 Windows CI coverage.
- Hardened the Windows updater so rollback can stop only the listener proven to
  belong to the configured Atlas scheduled task; the signed lifecycle now
  exercises a failed update, rollback, SQLite integrity, and vault preservation.

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

