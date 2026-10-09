# Security and access

Guide version: **0.15.6**

## Autonomous security model

Atlas owns its local accounts, organizations, roles, sessions, and data. It
does not depend on TRC Account. Any future RMM-provided SSO remains optional,
unconfigured, and disabled by default.

## Accounts and permissions

Atlas supports administrator, editor, and read-only documentation roles.
Documentation access and vault access are separate for every organization. An
account can therefore:

- edit one organization;
- read another organization without editing;
- access one organization's vault without editing its other records;
- receive no data at all from an unauthorized organization.

The server enforces these boundaries for workspaces, vault records,
attachments, history, export, and administrative actions.

## MFA and sessions

TOTP MFA is mandatory at first sign-in. Recovery codes are one-time values. A
session has an absolute lifetime of eight hours; activity does not extend that
deadline.

Password and MFA failures are throttled separately by account and client
address. The counters are persisted locally using hashed subjects, so a restart
does not reset the protection. An MFA challenge expires after five minutes and
becomes unusable after five incorrect codes. Atlas then returns `429` with a
retry delay.

A successful MFA verification unlocks the vault for the current authorized
session. Secrets remain hidden until explicitly revealed. Reveal and copy
events are audited.

## Vault protection

Secrets are encrypted with AES-256-GCM and a separate local key. Passwords, OTP
values, and confidential notes are excluded from:

- documentation search;
- relationships;
- normal JSON export;
- the PWA cache;
- application logs.

Password-strength metadata may be stored after creation or editing, but the
plaintext secret is not stored in the strength dashboard or search index.

## Privileged actions

The reinforced-MFA policy can require fresh verification for sensitive
administrative actions. Deleting an organization always requires its exact
name and MFA confirmation.

Account creation requires MFA enrollment. Authorized administrators can reset
MFA, invalidate sessions, change organization permissions, and separately
control read, edit, and vault access.

## Proxy and public surface

Atlas trusts no proxy header by default. The super administrator must enter the
exact IP address of each proxy under **Settings > Initial configuration**.
`X-Forwarded-For`, `X-Real-IP`, `CF-Connecting-IP`, `X-Forwarded-Proto`, and
`X-Forwarded-Host` are ignored when sent by any other address.

`/api/status` exposes only `{ "ok": true }`. Detailed
`/api/status/details` diagnostics are limited to requests from the VM.
Unpublished paths return a real `404`; they never receive the application shell.

Sensitive JSON bodies are limited to 8 KiB, ordinary requests to 256 KiB,
imports to 16 MiB, and attachment envelopes to 12 MiB.

## Backup and update trust

Backups must be encrypted, stored separately from live data, and restore-tested.
An update is eligible for installation only after Atlas validates the Ed25519
manifest signature, expected package size, and SHA-256 hash. A pre-update
snapshot and automatic rollback protect the previous program and data state.

## Local recovery

Out-of-band recovery is a local administrator procedure and must begin in
dry-run mode. It creates a dated backup, invalidates affected sessions, and
requires a new password and fresh MFA enrollment.

Do not publish databases, logs, MFA material, vault keys, backup archives, or
environment-specific infrastructure details in an issue or support request.

