# TRC Community Atlas architecture

## Authority and data ownership

TRC Community Atlas is autonomous. It owns its local accounts, sessions,
organizations, sites, roles, preferences, and documentation data. It does not
communicate with or depend on TRC Account.

TRC Community RMM is a separate product. Two integrations may be configured
independently in a future dedicated phase:

1. an inventory connector for explicitly selected metadata;
2. optional OIDC SSO provided by TRC Community RMM.

Both remain disabled by default. Enabling a data connector must not enable SSO,
and SSO must not start synchronization. Atlas retains its own sessions,
permissions, roles, and business data.

## Runtime

- Node.js server with no runtime package dependency;
- one configurable HTTP listener for the UI and API;
- local SQLite database in WAL mode;
- static local front end with no CDN, external font, telemetry, or required
  outbound content service;
- Windows standalone package with its own Node.js runtime;
- separate immutable program and persistent instance-data directories.

SQLite is an embedded file and does not open a database port. PostgreSQL is not
required for the current single-node local architecture.

## Identity and authorization

- Local administrator, editor, and viewer roles.
- Mandatory TOTP MFA and one-time recovery codes.
- Persistent sessions stored as token hashes, never raw cookie tokens.
- HttpOnly, SameSite Strict cookies and CSRF protection.
- Absolute eight-hour session lifetime.
- Separate per-organization documentation and vault permissions.
- Persistent password and MFA throttling by account and trusted client address.

## Documentation storage

- SQLite transactions and integrity constraints.
- Durable record revisions and audit events.
- Compatibility JSON mirror and versioned documentation import/export.
- Universal bidirectional relationships scoped to one organization.
- Typed references for sites, configurations, procedures, modules, and vault
  metadata.
- Multi-level impact graph and `@record` mention synchronization.
- Organization hierarchies limited to three levels and checked for cycles.

A parent-child organization link grants no permission and never merges sites,
records, relationships, attachments, or passwords.

## Vault and attachments

- AES-256-GCM vault with a separate random local key.
- Vault unlock bound to an MFA-authorized local session.
- Secrets hidden by default and never copied into search, relationships, PWA
  caches, normal exports, or logs.
- Attachments stored separately under `data/attachments/`.
- Attachment metadata and audit information stored locally.
- Executable file extensions rejected and upload size limited.

Disk encryption, operating-system access control, and protected backup storage
remain required. Application encryption does not replace host security.

## Search and interface

- Global or single-organization search built from authorized metadata only.
- Organization results before record results.
- No indexing of vault plaintext.
- Pagination for large collections.
- Full organization home page, Quick Notes, module shortcuts, and internal
  search.
- Mobile Progressive Web App with a static-shell cache only.
- All `/api/` routes remain network-only and are never cached by the service
  worker.

## Installation and instance configuration

The Windows installer configures:

- program and data roots;
- bind address and a single port;
- exact HTTPS allowed origins;
- update channel;
- shortcuts and hidden Windows startup.

It does not change DNS, install a TLS private key, open Windows Firewall, edit a
router, or expose Atlas to the Internet. Those remain explicit administrator
actions outside Atlas.

The super administrator can record an instance code, public domain, aliases,
reverse-proxy type, and exact trusted proxy addresses. Forwarded client headers
are accepted only from configured proxies.

## Health and updates

The administrator health dashboard checks the local process, listener, storage,
vault metadata, backup state, startup task, update state, and configured domain.
The public HTTPS probe is manual, limited to the recorded domain, rejects
redirects, and refuses private, local, reserved, and documentation addresses.

Stable updates use:

1. an Ed25519-signed manifest;
2. package size and SHA-256 verification;
3. an MFA-protected exact-version confirmation;
4. a program and data snapshot;
5. transactional replacement and migration;
6. post-restart health and business-count checks;
7. automatic rollback after failure.

## Optional local integrations

The local read-only API uses the existing Atlas port and minimal scopes.
Webhook destinations are limited to explicit loopback URLs. Vault plaintext,
MFA material, Quick Notes, and attachments are excluded.

No module label by itself enables an external integration, network discovery,
RMM connection, PSA synchronization, or public API.

