# TRC Community Atlas showcase

TRC Community Atlas is a free, self-hosted workspace for IT documentation,
asset inventory, passwords, relationships, procedures, and operations. It is
designed for individuals, internal IT teams, businesses, and MSPs.

The screenshots on this page use fictional demonstration data. They contain no
production password or customer record. Some screens show the French interface;
Atlas also includes English and can be switched from the header.

## Organization workspace

![Atlas organization home with fictional demonstration data](screenshots/organization-home-demo.png)

An organization home keeps service context, sites, documented configurations,
records, passwords, Quick Notes, search, and module shortcuts in one scoped
workspace. Child organizations remain isolated and never merge vault entries
or permissions with their parent.

## Backup management

![Atlas encrypted backup management](../public/assets/help/settings-backups.png)

Administrators can configure encrypted full backups, a local or UNC
destination, daily or weekly scheduling, explicit retention, history, and
integrity inspection. Atlas keeps program files separate from persistent data.

## Signed update center

![Atlas signed update center](../public/assets/help/settings-updates.png)

Atlas checks the official GitHub Release only when requested. Installation
requires a verified Ed25519 manifest, package size and SHA-256, administrator
MFA, an exact-version confirmation, a rollback snapshot, and successful
post-restart health checks.

## Official Windows Release

![Official TRC Community Atlas GitHub Release](../public/assets/help/github-release-0.15.2.png)

The standalone Windows package includes Node.js and uses one configurable Atlas
port. SQLite is local and needs no database server or additional port.

## Product highlights

- 179 structured documentation modules.
- Organizations and three-level child-organization hierarchy.
- Organization-scoped read, edit, and vault permissions.
- AES-256-GCM local vault with TOTP support.
- Sites, configurations, contacts, documents, procedures, and attachments.
- Bidirectional relationships and impact analysis.
- Markdown documentation editor and reusable record templates.
- Password-strength metadata without indexing plaintext secrets.
- Encrypted full backups and guarded signed updates.
- Hidden Windows startup, site health, and configurable local deployment.
- English/French interface and installable mobile PWA.
- No telemetry and no TRC Account dependency.

## Explore the project

- [Install Atlas on Windows](INSTALLATION_WINDOWS.md)
- [Read the user guide](USER_GUIDE.md)
- [Review security and access](SECURITY_AND_ACCESS.md)
- [Review operations and backups](OPERATIONS_GUIDE.md)
- [Understand free MSP use](LICENSING.md)

