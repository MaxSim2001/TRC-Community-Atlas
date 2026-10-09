# TRC Community Atlas operations guide

Guide version: **0.15.6**

## Instance port and configuration

Atlas uses one port for both its interface and API. SQLite is a local file and
does not open a database port. The default Atlas port is `9092`.

Open **Configure TRC Community Atlas** from the Start menu to review or change
the bind address, port, HTTPS origins, folders, update channel, or automatic
startup. A port change stops only the identified Atlas process, keeps the same
data folder, restarts Atlas, and checks the new listener. It does not modify a
firewall, DNS, certificate, router, or proxy.

The default saved configuration is
`%LOCALAPPDATA%\TRC Community Atlas\config\instance.json`. An installation with
a custom data root keeps the instance configuration with that root and stores a
local pointer for the program.

## Initial domain and proxy configuration

Under **Settings > Initial configuration**, distinguish:

- the short instance code, such as `ABC`;
- the complete public domain, such as `atlas.example.com`;
- optional secondary domains;
- the actual reverse proxy: Nginx, IIS, Caddy, or another product;
- the exact IP address of every trusted proxy.

Atlas records these names and exact HTTPS origins. It does not create a DNS
record, issue or import a certificate, or change a firewall. The TLS private key
belongs only in the reverse proxy.

The proxy must forward the HTTPS scheme and original host. Atlas accepts client
forwarding headers only when the direct connection comes from an explicitly
trusted proxy.

**Test public domain** is a deliberate manual action. It requests only the saved
domain's `/api/status` endpoint over HTTPS, follows no redirect, validates TLS,
and rejects names resolving to private, local, reserved, or documentation
addresses.

## Background startup

The super administrator can enable **Start Atlas automatically** under
**Settings > Initial configuration**, enter MFA when reinforced confirmation is
active, and select **Configure and apply**.

Atlas creates or updates the hidden `TRC Community Atlas` Windows task:

- with administrative rights, it uses a startup trigger and `SYSTEM`;
- otherwise, it starts at sign-in for the current Windows account.

Disabling the option disables the task reversibly. Applying this setting does
not restart the current process or change networking.

## Health checks

Before restarting or modifying Atlas, compare:

1. the Atlas task or process state;
2. the expected local listener;
3. local `/api/status/details`;
4. the public response only when public exposure was deliberately configured;
5. individual checks under **Settings > Site health**;
6. Atlas and reverse-proxy logs.

**Test local port** connects only to the listener already used by the current
Atlas process on this computer. It accepts no browser-provided address or port,
does not scan the LAN, and never contacts another computer.

A public failure while the local API is healthy does not prove Atlas is down.
Check the proxy, certificate, DNS, and allowed origin independently.

## Full encrypted backup

The full backup includes accounts, MFA state, the vault, vault key, SQLite,
attachments, and configuration. Sessions are intentionally excluded.

~~~powershell
.\scripts\Invoke-AtlasFullBackup.ps1 -Mode Create
~~~

Enter the passphrase only through the protected prompt. Never place it in a
command, script, log, issue, or unprotected file.

### Create a backup in the interface

1. Open **Settings > Backups**.
2. Choose an absolute local or UNC destination that the Atlas Windows identity
   can write to.
3. Select **Create backup now**.
4. Wait for the completed result.
5. Confirm the timestamp, size, and validation status.
6. Store the passphrase separately from the backup.
7. Run **Inspect** or a controlled restore rehearsal.

![Atlas backup management](../public/assets/help/settings-backups.png)

### Schedule backups

1. Complete one successful manual backup first.
2. Choose daily or weekly frequency.
3. Choose the execution time.
4. Enable retention only after choosing the minimum number of copies to keep.
5. Save the schedule.
6. Confirm background startup is enabled so Atlas is running at the scheduled
   time.
7. Review the next run and the last result under **Site health**.

The scheduled passphrase is protected with DPAPI for the Windows identity that
runs Atlas. It is never returned by the API after saving.

Retention is disabled by default. When enabled, Atlas removes only old files
with its exact managed-backup prefix and does not touch other files in the
folder.

Validate an existing backup without restoring it:

~~~powershell
.\scripts\Invoke-AtlasFullBackup.ps1 -Mode Inspect `
  -InputPath .\backups\TRC_Community_Atlas_Full_Backup_YYYY-MM-DD_HH-mm-ss.trcatlas
~~~

## Restore

1. Confirm the intended backup path and timestamp.
2. Inspect the backup before stopping Atlas.
3. Record the current data path.
4. Stop Atlas.
5. Start restore and enter the protected passphrase.
6. Enter the exact confirmation `RESTORE_ATLAS`.
7. Keep the automatically created dated safety copy.
8. Start Atlas and check health, organization counts, vault metadata, and
   attachments.
9. Sign in again because restored sessions are invalidated.

Never overwrite or delete the source backup during a restore.

## Documentation import and export

JSON export is documentation-only. It excludes accounts, MFA, sessions, vault
plaintext, vault keys, and binary attachments. Import replaces the active
workspace after creating a rollback revision. It is not a full backup.

## Signed updates

Before every update:

- create a new dated backup without replacing older backups;
- keep the production data directory;
- confirm adequate free space;
- review the target version and Release notes;
- ensure no restore or backup is running.

### Update from the interface

1. Open **Settings > Updates**.
2. Select **Check for updates**.
3. Review the installed version and selected channel.
4. Select **Download and verify**.
5. Confirm that the Ed25519 signature, size, and SHA-256 pass.
6. Enter administrator MFA.
7. Enter the exact requested `INSTALL <version>` confirmation.
8. Start installation.
9. Wait for the snapshot, restart, health checks, and final status.
10. Sign in and review **Site health** and organization counts.

![Atlas signed update management](../public/assets/help/settings-updates.png)

Atlas downloads only from approved GitHub hosts. Downloading and verifying do
not mutate the active program. Installation creates a full rollback snapshot
and verifies the program version, SQLite, vault readability, attachments, and
business counts after restart. A failed control restores the previous version.
Atlas never installs an update silently.

## Optional local API and webhooks

Under **Settings > Integrations**, the super administrator can enable a
read-only API and create tokens with minimal scopes:

- `read:health`;
- `read:organizations`;
- `read:records`.

Tokens use the existing Atlas port, can be restricted to organizations, and are
displayed once. Atlas stores only their SHA-256 fingerprint. Vault plaintext,
passwords, OTP values, Quick Notes, attachments, and MFA material are never
returned.

Local webhooks may report workspace changes and backup results. Destinations
must be explicit loopback HTTP URLs on `localhost`, `127.0.0.1`, or `::1`.
Atlas rejects LAN and Internet destinations. The HMAC secret is displayed once
and encrypted locally.

## Browser cache and PWA

The service worker uses a versioned static cache. CSS, JavaScript, and the
manifest use versioned URLs. `/api/` routes are never cached. After an update,
reload the browser if an old visual asset remains visible.

## Routine operator checklist

Weekly:

- review **Site health**;
- verify the last backup and next scheduled run;
- inspect failed authentication and privileged-action audit events;
- check available signed updates without automatically installing them;
- confirm the expected Windows startup task is healthy.

Monthly:

- inspect or restore-test one backup;
- verify free space for data, attachments, backups, and rollback snapshots;
- review administrators, organization scopes, and vault permissions;
- revoke unused API tokens and local webhooks;
- confirm the proxy certificate and trusted-proxy list.

