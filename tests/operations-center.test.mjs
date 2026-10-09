import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createManagedBackup,
  enforceBackupRetention,
  inspectManagedBackup,
  listManagedBackups,
  nextBackupRun,
  compareStableVersions,
  summarizeGithubRelease,
  validateBackupDestination,
} from "../lib/atlas-operations.mjs";

test("GitHub release metadata never becomes installable before cryptographic verification and rollback readiness", () => {
  assert.equal(compareStableVersions("v0.14.3", "0.14.2"), 1);
  assert.equal(compareStableVersions("0.14.2", "0.14.2"), 0);
  assert.equal(compareStableVersions("0.13.9", "0.14.2"), -1);
  assert.equal(compareStableVersions("latest", "0.14.2"), null);

  const release = summarizeGithubRelease({
    tag_name: "v0.14.3",
    name: "Atlas 0.14.3",
    published_at: "2026-10-09T12:00:00.000Z",
    html_url: "https://github.com/MaxSim2001/TRC-Community-Atlas/releases/tag/v0.14.3",
    assets: [
      { name: "atlas-release-manifest.json", size: 512, browser_download_url: "https://github.com/example/manifest" },
      { name: "atlas-release-manifest.sig", size: 256, browser_download_url: "https://github.com/example/signature" },
    ],
  }, { currentVersion: "0.14.2" });

  assert.equal(release.updateAvailable, true);
  assert.equal(release.artifactSetPresent, true);
  assert.equal(release.signatureVerified, false);
  assert.equal(release.packageVerified, false);
  assert.equal(release.rollbackReady, false);
  assert.equal(release.installable, false);
  assert.match(release.installBlockedReason, /pas encore téléchargés et vérifiés/i);
});

test("managed backups are encrypted, inspectable, scheduled and retained without touching unrelated files", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "atlas-operations-"));
  const dataRoot = path.join(root, "data");
  const destination = path.join(root, "managed-backups");
  const passphrase = "synthetic-managed-backup-passphrase";
  context.after(() => rm(root, { recursive: true, force: true }));

  await mkdir(dataRoot, { recursive: true });
  await writeFile(path.join(dataRoot, "auth.json"), '{"users":[{"username":"qa-admin"}]}', "utf8");
  await writeFile(path.join(dataRoot, "vault.json"), '{"items":[]}', "utf8");
  await writeFile(path.join(dataRoot, "vault.key"), "synthetic-key", "utf8");
  await writeFile(path.join(dataRoot, "attachments.json"), '{"items":[]}', "utf8");
  const database = new DatabaseSync(path.join(dataRoot, "atlas.sqlite"));
  database.exec("CREATE TABLE workspace_state (singleton INTEGER PRIMARY KEY, revision INTEGER); INSERT INTO workspace_state VALUES (1, 1);");
  database.close();

  assert.equal(validateBackupDestination(destination), path.normalize(destination));
  assert.throws(() => validateBackupDestination(path.parse(destination).root), /racine/i);
  assert.equal(nextBackupRun({ enabled: false }), "");
  const scheduleReference = new Date(2026, 9, 8, 3, 0, 0).getTime();
  const scheduledRun = new Date(nextBackupRun({ enabled: true, cadence: "daily", hour: 2, minute: 30 }, scheduleReference));
  assert.deepEqual(
    {
      year: scheduledRun.getFullYear(),
      month: scheduledRun.getMonth(),
      date: scheduledRun.getDate(),
      hour: scheduledRun.getHours(),
      minute: scheduledRun.getMinutes(),
    },
    { year: 2026, month: 9, date: 9, hour: 2, minute: 30 },
  );

  for (let index = 0; index < 3; index += 1) {
    await createManagedBackup({ projectRoot: root, dataRoot, destination, passphrase, now: Date.parse(`2026-10-0${7 + index}T12:00:0${index}Z`) });
  }
  await writeFile(path.join(destination, "do-not-touch.txt"), "unrelated", "utf8");
  const before = await listManagedBackups(destination);
  assert.equal(before.length, 3);
  assert.ok(before.every((item) => item.name.startsWith("TRC_Community_Atlas_Full_Backup_")));

  const inspected = await inspectManagedBackup({ destination, name: before[0].name, passphrase });
  assert.equal(inspected.valid, true);
  assert.equal(inspected.sessionsExcluded, true);
  assert.ok(inspected.fileCount >= 2);
  await assert.rejects(inspectManagedBackup({ destination, name: before[0].name, passphrase: "wrong-passphrase-123" }));

  const removed = await enforceBackupRetention(destination, 2);
  assert.equal(removed.length, 1);
  assert.equal((await listManagedBackups(destination)).length, 2);
  assert.equal(await readFile(path.join(destination, "do-not-touch.txt"), "utf8"), "unrelated");
});

test("operations UI exposes backup, safe update and scoped local API controls", async () => {
  const [app, styles, releaseNotes] = await Promise.all([
    readFile(new URL("../public/assets/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/assets/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../docs/RELEASE_NOTES.md", import.meta.url), "utf8"),
  ]);
  assert.match(app, /data-form="settings-backups"/);
  assert.match(app, /data-form="backup-inspect"/);
  assert.match(app, /manifeste signé/);
  assert.match(app, /data-form="local-api-token-create"/);
  assert.match(app, /read:organizations/);
  assert.match(app, /WEBHOOKS LOCAUX/);
  assert.match(app, /127\.0\.0\.1/);
  assert.match(styles, /\.local-api-settings/);
  assert.match(releaseNotes, /0\.14\.0/);
});
