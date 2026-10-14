# Migration and backup compatibility

This matrix is a release gate for TRC Community Atlas. It documents what a
stable package must preserve before it can be described as installable.

## Compatibility matrix

| Component | Current format | Read compatibility | Write compatibility | Required validation |
|---|---:|---|---|---|
| Atlas workspace | schema 5 | Current schema and legacy JSON imported by the SQLite store | Current schema only | full test suite, workspace validation, revision rollback |
| SQLite store | WAL, indexed workspace | Existing `atlas.sqlite` opened in place | transactional workspace revisions and asset index rebuild | `PRAGMA quick_check`, search index rebuild, entity-version conflict test |
| Module records | schema 1 per built-in module | Missing version is treated as version 1 | saves record the active module schema version | legacy-field preservation and outdated-schema quality signal |
| Local module definitions | versioned schema history | Missing version is treated as version 1 | field changes increment the version and retain up to 20 snapshots | definition validation and record compatibility test |
| Full backup | encrypted payload version 1 | payload version 1 | payload version 1 | AES-256-GCM authentication, SHA-256 per file, isolated restore drill, SQLite quick check |
| Release manifest | signed manifest version 1 | version 1 with approved Ed25519 public key | immutable release assets only | signature, size, SHA-256, target version, health, forced rollback |

## Upgrade rules

1. Program files and persistent data must remain in separate directories.
2. Before mutation, create a dated rollback snapshot and inventory the data.
3. Never replace or reinitialize `data`, the vault key, authentication data,
   attachments, backup settings, or local API configuration during an update.
4. Rebuild derived search indexes from the authoritative workspace after a
   successful migration.
5. Reject a package whose manifest, signature, hash, size, version, disk-space
   check, or rollback preparation fails.
6. After restart, verify the expected version, SQLite storage, local health,
   authentication, vault witness, and business-record counts.
7. On failure, restore the program snapshot and confirm the previous version is
   healthy before reporting the rollback as complete.

## Backup restore drill

The **Settings > Backups** page can decrypt a selected managed backup into a
temporary local directory, validate every file hash, open the restored SQLite
copy read-only, run `PRAGMA quick_check`, and verify that one workspace state is
present. The temporary directory is removed after the test and active data is
never replaced.

This guided drill proves that a backup is structurally restorable. A full
disaster-recovery exercise must still be performed on an isolated Windows test
machine before relying on a new release or infrastructure design.

## Release evidence

For every stable release, record:

- source commit and version;
- Windows package SHA-256 and signed-manifest fingerprint;
- Node.js 22 and 24 automated test results;
- clean Windows 10 and Windows 11 installation results;
- update, data-preservation, health, and forced-rollback results;
- backup created by the previous version and restore-drill result on the new
  version;
- known incompatibilities and the documented recovery path.

