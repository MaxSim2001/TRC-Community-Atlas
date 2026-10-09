# GitHub installation and signed-update plan

Status: implemented for the current standalone Windows distribution, with the
remaining public Authenticode and clean-VM release gates listed below.

## 1. Goal

Allow a Windows 10 or Windows 11 x64 user to:

1. download Atlas from the official GitHub Releases page;
2. install it without separately installing Node.js or a database;
3. choose the local bind address, port, program path, data path, update channel,
   shortcuts, and background startup;
4. create the first administrator and activate MFA;
5. back up all persistent data;
6. check, verify, approve, and install a signed update;
7. return automatically to the previous working version after failure.

The workflow must preserve accounts, MFA, passwords, vault keys, organizations,
records, attachments, configuration, and backups.

## 2. Fixed decisions

- Repository: `MaxSim2001/TRC-Community-Atlas`.
- Owner: TheRisingCloud.
- License: TRC Community Atlas Source-Available License 1.0.
- Platforms: Windows 10 and Windows 11 x64.
- Stable source: published GitHub Releases only.
- Package trust: Ed25519 manifest signature plus package size and SHA-256.
- Future executable reputation: Azure Artifact Signing.
- Database: local SQLite, with no database service or second port.
- Default listener: `127.0.0.1:9092`.
- Update installation: always human-confirmed and MFA-protected.
- Data authority: the installed Atlas instance, never GitHub or TRC Account.

## 3. Windows layout

Program files and persistent state are separate:

~~~text
Program root
  current program version
  bundled Node.js runtime
  installer and update helper

Instance root
  config/instance.json
  data/atlas.sqlite
  data/vault.json
  data/vault.key
  data/attachments/
  logs/
  backups/
  rollback/
~~~

Program replacement must never delete or silently move the instance root.
SQLite must remain on a supported local filesystem rather than a live network
share.

## 4. GitHub Release contents

A stable Release contains:

- `TRC-Atlas-Portable-X.Y.Z-win-x64.zip`;
- `atlas-release-manifest.json`;
- `atlas-release-manifest.sig`;
- `SHA256SUMS.txt`;
- Release notes.

The signed manifest records the version, channel, platform, architecture,
filename, exact byte size, SHA-256, data-schema compatibility, and required
updater version.

GitHub Actions artifacts are validation outputs. The application must not offer
them as stable updates.

## 5. Trust chain

HTTPS alone is not enough to authorize installation. Atlas verifies:

1. hard-coded repository owner and name;
2. a valid semantic version newer than the installed version;
3. stable/beta channel eligibility;
4. Ed25519 manifest signature with an embedded approved public key;
5. exact asset filename, size, and SHA-256;
6. supported Windows platform and architecture;
7. supported data-schema transition;
8. the same signature and hash again immediately before mutation.

The publishing private key never belongs in Atlas, Git, logs, or an end-user VM.
Atlas refuses installation when any control fails.

## 6. Initial installation

The graphical installer:

1. displays the Atlas version and selected package;
2. checks Windows architecture and available disk space;
3. offers local or advanced network binding;
4. tests the chosen port locally;
5. selects program and persistent-data paths;
6. installs the bundled runtime and Atlas;
7. optionally creates hidden startup and Start menu shortcuts;
8. starts Atlas and checks local health;
9. opens first-administrator setup;
10. leaves DNS, TLS, firewall, router, and reverse-proxy configuration to the
    administrator.

The official script accepts explicit `InstallRoot`, `DataRoot`, `Port`,
`BindAddress`, `AllowedOrigin`, and `Channel` values. It never accepts account
passwords or MFA secrets on the command line.

Avoid `curl ... | iex`. Users should download a versioned package, verify it,
and run the included installer.

See [`INSTALLATION_WINDOWS.md`](INSTALLATION_WINDOWS.md) for the complete user
procedure.

## 7. Update Center

**Settings > Updates** shows:

- installed version and data schema;
- selected `stable` or `beta` channel;
- last check and result;
- available version, notes, size, and compatibility;
- signature and package-verification state;
- required backup/snapshot and free space;
- update history and rollback outcome.

Checking is read-only. Downloading and verifying do not replace active files.
Installation requires a super administrator, CSRF protection, MFA, and the exact
requested version confirmation. Atlas never downloads or installs silently.

![Atlas signed update management](../public/assets/help/settings-updates.png)

## 8. Transactional update

### Online preparation

1. Validate the session, role, CSRF, MFA, and exact confirmation.
2. Acquire an exclusive update lock.
3. Refuse to continue during another update, restore, or backup.
4. Download into a unique temporary directory.
5. Verify the trust chain and compatibility.
6. Check disk space, permissions, service identity, and local health.
7. Record counts of organizations, records, accounts, vault entries, and
   attachments without logging content.

### Controlled replacement

8. Enter maintenance mode and finish active writes.
9. Checkpoint SQLite and stop Atlas cleanly.
10. Snapshot the program, complete instance state, and startup definition.
11. Verify that the snapshot is readable.
12. Extract the new program into a new immutable version directory.
13. Run idempotent migrations in a transaction where possible.
14. Atomically point the launcher to the new version.
15. Restart Atlas.

### Post-update validation

Verify:

- `/api/status`, program version, and schema version;
- SQLite integrity and expected logical tables;
- before/after business counts, except documented migrations;
- accounts, vault metadata, and attachments;
- an internal vault decryption witness without exposing a secret;
- local sign-in path and automatic startup.

On failure, stop the new version, restore the former pointer and data snapshot
when required, restart the previous version, and verify its health. Restored
sessions may be invalidated; accounts, MFA, and vault contents must survive.

## 9. Backup contract

Atlas uses two distinct protections:

1. a local, ACL-protected rollback snapshot created for the update helper;
2. an operator-created encrypted `.trcatlas` backup with a separately protected
   passphrase.

Backups and snapshots are timestamped and never overwritten. Retention is
explicit, preserves a minimum number of copies, and must not remove the last
known-good state.

![Atlas backup management](../public/assets/help/settings-backups.png)

## 10. Migration contract

Every migration has a unique identifier, source version, target version, and
recorded result. A migration must be:

- idempotent;
- independently testable;
- transactional for SQLite when possible;
- atomic for JSON files;
- free of secrets in logs and errors;
- covered from every supported source version.

Atlas does not attempt an unsafe in-place schema downgrade. Rollback restores
the compatible snapshot.

## 11. Release pipeline

A `vX.Y.Z` Git tag triggers a protected workflow that:

1. matches the tag, package version, manifest, and Release notes;
2. runs JavaScript, API, UI, backup, update, and migration tests;
3. builds from a clean Windows environment;
4. produces the ZIP, checksums, manifest, signature, and provenance;
5. installs the package in a clean Windows test environment;
6. tests update from each supported previous version;
7. tests forced update failure and rollback;
8. creates a draft Release;
9. waits for human approval;
10. publishes immutable assets.

Pre-releases are visible only to the beta channel. Stable selects only published
non-draft, non-pre-release versions.

## 12. Blocking test matrix

Installation:

- Windows 10 and Windows 11 x64;
- administrator and standard user;
- free and occupied ports;
- paths with spaces;
- no system Node.js;
- offline install from an already downloaded package;
- reboot and hidden startup;
- repair while preserving data.

Update:

- every supported previous version to current;
- empty, small, and large fictional datasets;
- multiple accounts, MFA, organization hierarchy, modules, relationships,
  secrets, and attachments;
- insufficient disk, locked database, interrupted download, and GitHub failure;
- invalid hash, signature, key, version, host, and schema;
- interruption at every mutation stage;
- deliberately failed migration and complete rollback.

Acceptance:

- no update begins without a readable snapshot;
- no Atlas data is sent to GitHub;
- public Releases require no user GitHub token;
- every installation is human-confirmed;
- failure automatically returns to a healthy version;
- before/after inventory remains coherent;
- logs contain no password, key, backup passphrase, or MFA code.

## 13. Implementation status

Implemented:

- separate program and instance roots;
- bundled Windows runtime and graphical configurator;
- hidden startup and configurable single port;
- signed manifest and package hash verification;
- administrator Update Center;
- MFA-confirmed transactional installation;
- snapshots, health checks, and automatic rollback;
- backup scheduler and integrity inspection;
- Windows CI and isolated secondary-port deployment tests.

Remaining release gates:

- public Authenticode identity for the future installer executable;
- clean Windows 10 and Windows 11 validation for each published Release;
- formal supported-migration matrix;
- public vulnerability-reporting policy;
- final immutable Release approval by the project owner.

## 14. Out of scope

- silent forced updates;
- automatic network, DNS, router, certificate, or firewall changes;
- transmitting business data to GitHub or TRC Account;
- deleting backups without explicit retention policy;
- claiming Windows Server, Linux, or macOS support before their own validation.

## GitHub technical references

- Releases API: https://docs.github.com/en/rest/releases/releases
- Release assets: https://docs.github.com/en/rest/releases/assets
- Artifact attestations: https://docs.github.com/en/actions/concepts/security/artifact-attestations
- REST API rate limits: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
