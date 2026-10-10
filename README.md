# TRC Community Atlas

Current version: **0.15.6**

[![Atlas tests](https://github.com/MaxSim2001/TRC-Community-Atlas/actions/workflows/tests.yml/badge.svg)](https://github.com/MaxSim2001/TRC-Community-Atlas/actions/workflows/tests.yml)

TRC Community Atlas is a free, self-hosted IT documentation and inventory
platform for individuals, internal IT teams, businesses, and managed service
providers (MSPs).

Atlas keeps accounts, MFA, organizations, documentation, passwords, attachments,
backups, and preferences inside the installed instance. It does not require a
TRC Account, a cloud subscription, telemetry, or a separate database server.

> **MSPs may use Atlas free of charge for any number of clients and
> technicians.** They may charge for installation, configuration, hosting,
> training, support, and maintenance. Selling Atlas itself, commercializing a
> renamed fork, or offering Atlas as the primary paid SaaS product requires
> prior written authorization from TheRisingCloud.

## Table of contents

- [What Atlas includes](#what-atlas-includes)
- [Windows installation](#windows-installation)
- [First sign-in](#first-sign-in)
- [Project showcase](#project-showcase)
- [Install from source](#install-from-source)
- [Network and reverse proxy](#network-and-reverse-proxy)
- [Backups and updates](#backups-and-updates)
- [Security model](#security-model)
- [Documentation](#documentation)
- [License](#license)

## What Atlas includes

- organizations, sites, configurations, contacts, documents, procedures, and
  passwords;
- 179 structured documentation modules;
- organization hierarchies up to three levels without sharing child-company
  passwords or permissions;
- role- and organization-scoped read, edit, and vault permissions;
- mandatory TOTP MFA, one-time recovery codes, durable eight-hour sessions, and
  throttled authentication;
- an AES-256-GCM local password vault with OTP support;
- SQLite storage with transactions, revisions, activity history, and audit
  records;
- bidirectional relationships between records;
- a full-page Markdown document editor;
- encrypted full backups and scheduled backup management;
- signed GitHub updates with Ed25519, SHA-256 verification, MFA confirmation,
  snapshots, and automatic rollback;
- a bilingual English/French interface and mobile PWA support;
- no telemetry and no external content dependency.

## Windows installation

Atlas supports Windows 10 and Windows 11 x64. The standalone Release includes
Node.js, so a non-technical user does not need to install Node.js separately.

### Step-by-step

1. Open the
   [latest official Atlas Release](https://github.com/MaxSim2001/TRC-Community-Atlas/releases/latest).
2. Download `TRC-Atlas-Portable-X.Y.Z-win-x64.zip`. Use a stable Release, not a
   temporary GitHub Actions artifact.
3. Download the release manifest and signature when they are listed with the
   Release.
4. Right-click the ZIP, select **Extract All**, and wait until extraction is
   complete.
5. Open the extracted `TRC Community Atlas X.Y.Z` folder.
6. Double-click `Installer-Atlas.cmd`.
7. Keep **This computer only** for a normal local installation. Choose another
   bind address only when you already understand the proxy and firewall
   requirements.
8. Select the Atlas port, program folder, persistent data folder, automatic
   startup option, and Start menu shortcut.
9. Select **Test port**, then select **Install Atlas**.
10. Open the displayed Atlas address, create the first administrator account,
    activate MFA, and save the recovery codes offline.

The default installation uses:

| Item | Default |
| --- | --- |
| Program | `%LOCALAPPDATA%\Programs\TRC Community Atlas` |
| Persistent data | `%LOCALAPPDATA%\TRC Community Atlas\data` |
| Configuration | `%LOCALAPPDATA%\TRC Community Atlas\config\instance.json` |
| Logs | `%LOCALAPPDATA%\TRC Community Atlas\logs` |
| Local address | `http://127.0.0.1:9092/` |

Atlas uses one configurable HTTP port for both the user interface and API.
SQLite is a local file and opens no additional port.

For the complete installer walkthrough, repair procedure, advanced options, and
troubleshooting, read the
[Windows installation guide](docs/INSTALLATION_WINDOWS.md).

## First sign-in

After installation:

1. create the first local administrator;
2. choose a strong password;
3. scan the TOTP QR code with an authenticator application;
4. enter the current six-digit code;
5. store the recovery codes separately from the Atlas server;
6. open **Settings > Initial setup** and confirm the instance identity;
7. open **Settings > Site health** and resolve any warning;
8. configure and test the first encrypted backup before entering production
   passwords.

Do not store the backup passphrase only inside Atlas.

## Project showcase

### Organization workspace

![Atlas organization home with fictional demonstration data](docs/screenshots/organization-home-demo.png)

The organization home brings service context, sites, configurations, records,
passwords, and organization search into one isolated workspace.

### Official signed Release

![Official TRC Community Atlas GitHub Release](public/assets/help/github-release-0.15.2.png)

Download stable packages from **GitHub Releases**. GitHub Actions artifacts are
intended for validation, not normal user installation.

### Encrypted backup management

![Atlas backup settings](public/assets/help/settings-backups.png)

The backup page groups the destination, schedule, retention, history, and
integrity checks in one place.

### Guarded updates

![Atlas update settings](public/assets/help/settings-updates.png)

Atlas does not silently install updates. Preparation and installation require
an administrator action, cryptographic verification, MFA, and a rollback point.

The screenshots show the French interface. Atlas can be switched to English
from the header.

See the [complete product showcase](docs/SHOWCASE.md) for captions, feature
highlights, and direct links to the installation, security, and operations
guides.

## Install from source

Source-based installation is intended for development and testing. It requires
Node.js 22 or newer.

```powershell
git clone https://github.com/MaxSim2001/TRC-Community-Atlas.git
cd TRC-Community-Atlas
.\Start-TRCCommunityAtlas.ps1
```

Open `http://127.0.0.1:9092/`.

Run the checks before contributing:

```powershell
npm run check
npm test
```

For normal installations, prefer the self-contained Windows Release.

## Network and reverse proxy

The safest default is `127.0.0.1`, which makes Atlas accessible only from the
same computer.

For an HTTPS reverse proxy:

1. choose the exact private bind address instead of `0.0.0.0` when possible;
2. select one internal Atlas port;
3. add every allowed public HTTPS origin;
4. add only the exact IP addresses of trusted proxies;
5. terminate TLS in Nginx, IIS, Caddy, or another managed reverse proxy;
6. forward `X-Forwarded-Proto: https`;
7. configure DNS, the certificate, and firewall separately;
8. verify the result from **Settings > Site health**.

Example:

```powershell
.\Start-TRCCommunityAtlas.ps1 `
  -BindAddress 10.0.0.12 `
  -Port 9092 `
  -AllowedOrigin https://atlas.example.com `
  -TrustedProxy 10.0.0.5
```

Atlas never configures the router, DNS, TLS certificate, or network firewall for
the administrator.

## Backups and updates

### Create and inspect an encrypted backup

```powershell
.\scripts\Invoke-AtlasFullBackup.ps1 -Mode Create

.\scripts\Invoke-AtlasFullBackup.ps1 `
  -Mode Inspect `
  -InputPath .\backups\TRC_Community_Atlas_Full_Backup_YYYY-MM-DD_HH-mm-ss.trcatlas
```

A restore must be performed while Atlas is stopped. It requires the exact
confirmation `RESTORE_ATLAS`, creates a safety copy under
`data\restore-safety\`, and invalidates active sessions.

### Install an update

Use **Settings > Updates**. Atlas checks the official GitHub Release only when
requested. A package is not installable until the Ed25519 signature, package
size, SHA-256 hash, administrator MFA, and rollback preparation all pass.

## Security model

- local accounts and mandatory TOTP MFA;
- `scrypt` password derivation;
- HttpOnly, SameSite=Strict session cookies and CSRF protection;
- absolute eight-hour session lifetime;
- account- and client-address-based password and MFA throttling;
- organization-scoped data, attachment, history, and vault authorization;
- secrets excluded from search, relations, logs, PWA cache, and JSON exports;
- trusted-proxy allowlist;
- endpoint-specific request-size limits;
- no telemetry.

Atlas does not replace disk encryption, operating-system hardening, tested
backups, TLS, or normal infrastructure security.

## Documentation

Start with the [documentation index](docs/README.md).

- [Windows installation](docs/INSTALLATION_WINDOWS.md)
- [Product showcase](docs/SHOWCASE.md)
- [User guide](docs/USER_GUIDE.md)
- [Security and access](docs/SECURITY_AND_ACCESS.md)
- [Operations guide](docs/OPERATIONS_GUIDE.md)
- [Licensing and free MSP use](docs/LICENSING.md)
- [Release notes](docs/RELEASE_NOTES.md)
- [Code signing](docs/CODE_SIGNING.md)
- [Architecture](docs/ARCHITECTURE.md)
- [GitHub distribution readiness](docs/GITHUB_READINESS.md)

## License

TRC Community Atlas is **source-available**, not OSI-approved open source. It is
distributed under the
[TRC Community Atlas Source-Available License 1.0](LICENSE.txt).

Personal, professional, internal business, and MSP use is free. MSPs may manage
unlimited clients and technicians and charge for their professional services.
Reselling Atlas, commercializing a modified or renamed version, or offering a
paid service where Atlas is the primary product requires prior written
authorization from TheRisingCloud.

TheRisingCloud retains ownership of the original software. External
contributions require the copyright-assignment process described in
[CONTRIBUTING.md](CONTRIBUTING.md).

The custom license is published as the project's chosen terms. Independent
legal review remains advisable but is not a technical requirement for using or
publishing Atlas.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Never
include real client data, passwords, tokens, private keys, backups, or internal
infrastructure details in an issue or contribution.
