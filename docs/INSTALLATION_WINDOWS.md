# Install TRC Community Atlas on Windows

Guide version: **0.15.6**

This guide describes the recommended installation on Windows 10 or Windows 11
x64. The standalone Release contains its own Node.js runtime. A normal user does
not need to install Node.js, SQLite, Docker, or a separate database server.

Atlas is self-hosted. Accounts, MFA, organizations, documentation, passwords,
attachments, and backups remain in the data directory selected during setup.

## Before you begin

Have the following information ready:

- the TCP port Atlas should use, or accept the default `9092`;
- whether Atlas should be reachable only from this computer or through a
  deliberately configured reverse proxy;
- a program folder and a persistent data folder;
- an offline location in which to store the first administrator's MFA recovery
  codes;
- a separate backup destination with enough free space.

If you are replacing an existing installation, create and verify a backup
before continuing. Never use the program folder as the only backup location.

## Step 1 — Download the official Release

1. Open the
   [latest official Atlas Release](https://github.com/MaxSim2001/TRC-Community-Atlas/releases/latest).
2. Confirm that the page belongs to `MaxSim2001/TRC-Community-Atlas`.
3. Download `TRC-Atlas-Portable-X.Y.Z-win-x64.zip`.
4. Download `atlas-release-manifest.json`,
   `atlas-release-manifest.sig`, and `SHA256SUMS.txt` when they are offered.
5. Do not use a temporary GitHub Actions artifact for a production installation.

![Example of an official Atlas GitHub Release](../public/assets/help/github-release-0.15.2.png)

The screenshot is an example Release page and may show an older version. Always
select the newest stable Release. Some older screenshots show the French
interface; the installed application can be switched to English.

## Step 2 — Extract all files

1. Open **Downloads** in File Explorer.
2. Right-click the downloaded ZIP.
3. Select **Extract All**.
4. Choose a temporary extraction folder.
5. Wait for Windows to finish extracting the complete archive.
6. Open the extracted `TRC Community Atlas X.Y.Z` folder.

Do not run the installer from inside the ZIP preview. If Windows marks the
download as blocked, open the ZIP **Properties**, select **Unblock**, apply the
change, and extract it again.

## Step 3 — Start the installer

1. Double-click `Installer-Atlas.cmd`.
2. Accept the Windows prompt only if it identifies the expected local installer.
3. The graphical configurator opens.
4. Existing Atlas values are loaded automatically when this is an upgrade or
   repair.

The installer does not silently open Windows Firewall, change DNS, configure a
router, or issue a TLS certificate.

## Step 4 — Choose the access mode and port

For most installations, choose **This computer only**. Atlas then listens on
`127.0.0.1`, which prevents direct access from other computers.

Choose an advanced network bind address only when an administrator has already
planned the firewall and reverse-proxy path.

1. Select an Atlas port from `1024` to `65535`.
2. Select **Test port**.
3. If the test fails, select another unused port.
4. Record the chosen address and port.

### How many ports are required?

Atlas needs one TCP port. The web interface and API share the same HTTP
listener. SQLite is a local file named `atlas.sqlite`; it does not run a
database service and does not need another port.

With a reverse proxy, browsers normally connect to public HTTPS port `443`.
Nginx, IIS, or Caddy forwards that traffic to the single internal Atlas port,
for example `9092`. Port `443` belongs to the proxy, not to Atlas.

## Step 5 — Select program and data folders

The installer keeps application files and user data separate.

| Item | Default location |
| --- | --- |
| Program | `%LOCALAPPDATA%\Programs\TRC Community Atlas` |
| Data | `%LOCALAPPDATA%\TRC Community Atlas\data` |
| Configuration | `%LOCALAPPDATA%\TRC Community Atlas\config\instance.json` |
| Logs | `%LOCALAPPDATA%\TRC Community Atlas\logs` |
| Local URL | `http://127.0.0.1:9092/` |

The data folder contains the database, vault material, attachments, and other
persistent state. Repairing or replacing the program folder must not delete the
data folder.

For a service-style installation, use a stable local data path with access
restricted to the Atlas service identity. Do not place live Atlas data in a
public web folder or a consumer synchronization folder.

## Step 6 — Choose startup and shortcuts

The installer can create:

- a hidden Windows startup task;
- a Start menu shortcut that opens Atlas;
- a **Configure TRC Community Atlas** shortcut;
- a `stable` or `beta` update-channel setting.

With administrator rights, the hidden task can start Atlas with Windows under
`SYSTEM`. With a standard account, it starts when that user signs in. No
PowerShell window should remain visible on the desktop.

## Step 7 — Install and check local health

1. Review the displayed folders, address, port, and startup choice.
2. Select **Install Atlas**.
3. Wait for the program copy and health check to complete.
4. Open the URL displayed by the installer.
5. If the browser does not open automatically, enter the local URL manually.

A new instance responds at `/api/status` with a minimal health result. Detailed
local diagnostics are available at `/api/status/details` only from the VM.

## Step 8 — Create the first administrator

1. Enter the first administrator's display name and sign-in identifier.
2. Create a unique, long password.
3. Scan the TOTP QR code with an authenticator application.
4. Enter the current six-digit code.
5. Save the one-time recovery codes in an offline, protected location.
6. Sign out and sign in again to confirm the password and MFA flow.

Do not store the MFA seed or recovery codes inside the same Atlas instance.

## Step 9 — Complete initial configuration

After signing in as the super administrator:

1. Open **Settings > Initial configuration**.
2. Confirm the instance name, public domain if applicable, proxy mode, and
   trusted proxy addresses.
3. Open **Settings > Site health**.
4. Run the local listener and storage checks.
5. If a reverse proxy is configured, run the public-domain test separately.
6. Resolve every critical warning before importing production data.

Trusted proxy addresses must be exact. Atlas ignores forwarded client headers
from addresses that have not been configured as trusted proxies.

## Step 10 — Create the first backup

1. Open **Settings > Backups**.
2. Select a protected backup destination.
3. Select **Create backup now**.
4. Wait for the backup to finish.
5. Verify that the backup appears in the history.
6. Perform a dry-run validation or restore test before relying on the schedule.
7. Configure retention and a schedule only after the first manual backup passes.

![Atlas backup management](../public/assets/help/settings-backups.png)

A backup is useful only when it can be found, decrypted, and restored. Keep at
least one copy outside the Atlas program and data folders.

## Configure a reverse proxy

Atlas never configures an Internet-facing proxy automatically.

1. Keep Atlas on a private or loopback listener whenever possible.
2. Install and configure Nginx, IIS, or Caddy separately.
3. Terminate TLS at the proxy with a certificate for the intended domain.
4. Forward requests to the selected internal Atlas address and port.
5. Forward the HTTPS scheme and original host.
6. In Atlas, add only the proxy's exact source IP to the trusted-proxy list.
7. Add the exact HTTPS origin to the allowed-origin list.
8. Test the local Atlas health endpoint first.
9. Test the public domain second.
10. Confirm MFA, attachments, logout, and update checks through the proxy.

Do not expose Atlas directly to the Internet without a deliberate security
review of TLS, authentication, backups, update signing, proxy trust, and
monitoring.

## Advanced scripted installation

Administrators can run the installer script directly:

~~~powershell
.\scripts\Install-TRCCommunityAtlas.ps1 `
  -Port 9095 `
  -InstallRoot 'C:\Atlas\program' `
  -DataRoot 'D:\Atlas\data'
~~~

Useful options:

- `-BindAddress 127.0.0.1` keeps Atlas local;
- `-AllowedOrigin https://atlas.example.com` permits one exact HTTPS origin;
- `-Channel stable` or `-Channel beta` selects the update channel;
- `-SkipAutostart` omits the startup task;
- `-SkipShortcuts` omits Start menu shortcuts;
- `-SkipStart` installs without starting Atlas;
- `-OpenBrowser` opens the initial setup after a successful health check.

## Reconfigure or repair an installation

1. Open **Configure TRC Community Atlas** from the Start menu.
2. Review the detected program and data paths.
3. Make the smallest necessary change.
4. Test a new port before applying it.
5. Apply the configuration.
6. Confirm that Atlas restarted and uses the same persistent data folder.
7. Sign in and verify the organization count and backup settings.

Changing only the port must not replace the database, vault key, accounts, MFA
settings, or attachments.

## Update Atlas

1. Create a fresh backup.
2. Open **Settings > Updates**.
3. Select **Check for updates**.
4. Review the version, channel, release notes, and verification status.
5. Enter MFA when requested.
6. Confirm the exact version to install.
7. Atlas verifies the signed Ed25519 manifest, package size, and SHA-256 hash.
8. Atlas creates a rollback snapshot before replacing program files.
9. Wait for Atlas to restart.
10. Sign in and review **Site health** and the update result.

![Atlas signed update management](../public/assets/help/settings-updates.png)

If validation or the post-update health check fails, Atlas must refuse the
package or restore the prior snapshot. Never replace a signed asset attached to
an existing GitHub Release.

## Troubleshooting

### The selected port is unavailable

- Run **Test port** again.
- Close the unrelated application that owns the port, or select another port.
- Do not terminate an unknown process without identifying it first.

### Atlas does not start

- Review `atlas.error.log` in the configured log folder.
- Confirm that the data and program folders still exist.
- Confirm that the startup identity can read the program folder and write to the
  data and log folders.
- Reopen the configurator and repair only the program files.
- Do not delete the data folder as a troubleshooting step.

### The browser cannot reach Atlas

- Verify the exact bind address and port in the configurator.
- Try the local URL from the same computer.
- Check **Site health**.
- If a proxy is used, test the internal Atlas URL before testing the public URL.
- Treat proxy, certificate, DNS, and network-firewall changes as separate
  administrator actions.

### Sign-in or MFA fails

- Confirm the computer and authenticator clocks are synchronized.
- Use one unused recovery code if the authenticator is unavailable.
- Respect the retry delay after repeated failures.
- Use the documented local recovery procedure rather than editing the database.

## Upgrade and removal safety

An upgrade must preserve the data directory. Before moving, repairing, or
removing Atlas:

1. create a current backup;
2. record the current program, data, configuration, and log paths;
3. stop the Atlas startup task;
4. verify the backup independently;
5. remove program files only after confirming the persistent data path.

Do not delete the data folder unless the explicit goal is permanent destruction
and a verified backup exists.

## Final security checklist

- [ ] The first administrator uses a unique password.
- [ ] TOTP MFA works and recovery codes are stored offline.
- [ ] Atlas listens only on the intended address and port.
- [ ] No unexpected firewall or router rule was created.
- [ ] Trusted proxy addresses and allowed origins are exact.
- [ ] A manual encrypted backup completed successfully.
- [ ] Backup validation or a restore rehearsal succeeded.
- [ ] Automatic startup is visible in **Site health**.
- [ ] The update channel is correct.
- [ ] Production data is not stored in the program folder.
