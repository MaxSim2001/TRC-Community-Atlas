# GitHub source and distribution status

The official Atlas source is published at
[`MaxSim2001/TRC-Community-Atlas`](https://github.com/MaxSim2001/TRC-Community-Atlas).
The public repository is owned directly by the project owner. Users should
download stable versions from **Releases**. GitHub Actions artifacts are
temporary validation outputs, not production distributions.

The installation, GitHub Release, package-verification, migration, and rollback
design is recorded in
[`PLAN_GITHUB_INSTALL_UPDATE.md`](PLAN_GITHUB_INSTALL_UPDATE.md).

## Confirmed decisions

- Official repository: `MaxSim2001/TRC-Community-Atlas`.
- Rights holder: TheRisingCloud.
- License: TRC Community Atlas Source-Available License 1.0.
- Free use: personal, professional, business, and MSP use.
- Restricted use: resale or commercialization of Atlas itself without written
  permission.
- External contributions: signed copyright assignment before merge.
- Initial platforms: Windows 10 and Windows 11 x64.
- Manifest signing: Ed25519 with an encrypted, access-controlled private key and
  a public key embedded in Atlas.
- Target public Windows reputation: Azure Artifact Signing.
- Self-signed certificates: local release-pipeline testing only.

## Ready now

- Owner-controlled public repository.
- GitHub Actions validation on Windows.
- English README and public documentation.
- One-click Windows configurator with a bundled Node.js runtime.
- Separate program and persistent-data locations.
- Configurable bind address, port, allowed origins, update channel, shortcuts,
  and background startup.
- Clean-deployment testing on a secondary port.
- Windows ZIP and SHA-256 generation.
- Ed25519-signed release manifest.
- Second signature and hash verification immediately before mutation.
- Downloads restricted to approved GitHub hosts.
- MFA and exact-version confirmation before installation.
- Program and data snapshot, before/after inventory, health check, and automatic
  rollback.
- [QA evidence for signed update and rollback](QA_SIGNED_UPDATE_2026-10-09.md).
- Architecture, user, security, operations, licensing, and installation guides.
- Local assets, PWA API-cache exclusions, and no telemetry.

## Remaining distribution work

- Public Authenticode trust for the future Windows installer executable.
- Windows 10 and Windows 11 clean-VM validation for each stable Release.
- A documented security-reporting channel.
- A maintained migration and backup-compatibility matrix.
- Final production-specific HTTPS and reverse-proxy configuration by each
  instance administrator.

## Release rule

A version is described as installable only when:

1. the test workflow passes;
2. the standalone Windows package is built;
3. the manifest is signed with the Atlas Ed25519 release key;
4. package size and SHA-256 are recorded in the signed manifest;
5. installation and post-start health pass on a clean Windows environment;
6. rollback evidence exists for a forced failure;
7. the immutable assets are attached to an official GitHub Release.

Never replace an asset attached to an existing version. Publish a new version
instead.

Atlas must be described as **source-available**, not as OSI-approved open-source
software. See [`LICENSING.md`](LICENSING.md) for permitted MSP services and
restricted product commercialization.

