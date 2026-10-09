import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createManagedBackup,
  enforceBackupRetention,
  inspectManagedBackup,
  launchReleaseUpdater,
  listManagedBackups,
  nextBackupRun,
  compareStableVersions,
  summarizeGithubRelease,
  validateBackupDestination,
} from "../lib/atlas-operations.mjs";
import { verifyAtlasReleaseFiles } from "../lib/atlas-release.mjs";

test("signed Atlas releases verify Ed25519, size and SHA-256 and reject tampering", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "atlas-signed-release-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const packagePath = path.join(root, "TRC-Atlas-Portable-0.15.2-win-x64.zip");
  const manifestPath = path.join(root, "atlas-release-manifest.json");
  const signaturePath = path.join(root, "atlas-release-manifest.sig");
  const publicKeyPath = path.join(root, "atlas-release-public-key.pem");
  const packageBytes = Buffer.from("synthetic signed Atlas package");
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicPem = publicKey.export({ type: "spki", format: "pem" });
  const manifest = {
    formatVersion: 1,
    product: "TRC Community Atlas",
    repository: "MaxSim2001/TRC-Community-Atlas",
    version: "0.15.2",
    channel: "stable",
    minimumUpgradableVersion: "0.14.3",
    platform: "win32-x64",
    assetName: path.basename(packagePath),
    assetSize: packageBytes.length,
    sha256: createHash("sha256").update(packageBytes).digest("hex"),
    publicKeyId: createHash("sha256").update(publicPem).digest("hex"),
    minimumDataSchema: 5,
    targetDataSchema: 5,
    requiresRestart: true,
    backupRequired: true,
    rollbackMode: "snapshot",
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  await Promise.all([
    writeFile(packagePath, packageBytes),
    writeFile(manifestPath, manifestBytes),
    writeFile(signaturePath, `${sign(null, manifestBytes, privateKey).toString("base64")}\n`, "utf8"),
    writeFile(publicKeyPath, publicPem, "utf8"),
  ]);

  const verified = await verifyAtlasReleaseFiles({ manifestPath, signaturePath, packagePath, publicKeyPath, currentVersion: "0.15.1", expectedTag: "v0.15.2" });
  assert.equal(verified.signatureVerified, true);
  assert.equal(verified.packageVerified, true);
  assert.equal(verified.sha256, manifest.sha256);

  await writeFile(packagePath, Buffer.from("tampered package"));
  await assert.rejects(
    verifyAtlasReleaseFiles({ manifestPath, signaturePath, packagePath, publicKeyPath, currentVersion: "0.15.1", expectedTag: "v0.15.2" }),
    /taille|empreinte/i,
  );
  await writeFile(packagePath, packageBytes);
  await writeFile(signaturePath, `${Buffer.alloc(64, 7).toString("base64")}\n`, "utf8");
  await assert.rejects(
    verifyAtlasReleaseFiles({ manifestPath, signaturePath, packagePath, publicKeyPath, currentVersion: "0.15.1", expectedTag: "v0.15.2" }),
    /signature Ed25519/i,
  );
});

test("release key identity remains valid when Git converts PEM line endings", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "atlas-release-key-eol-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const packagePath = path.join(root, "TRC-Atlas-Portable-0.15.2-win-x64.zip");
  const manifestPath = path.join(root, "atlas-release-manifest.json");
  const signaturePath = path.join(root, "atlas-release-manifest.sig");
  const publicKeyPath = path.join(root, "atlas-release-public-key.pem");
  const packageBytes = Buffer.from("line-ending-safe Atlas package");
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const lfPublicPem = String(publicKey.export({ type: "spki", format: "pem" })).replace(/\r\n?/g, "\n");
  const crlfPublicPem = lfPublicPem.replace(/\n/g, "\r\n");
  const manifest = {
    formatVersion: 1,
    product: "TRC Community Atlas",
    repository: "MaxSim2001/TRC-Community-Atlas",
    version: "0.15.2",
    channel: "stable",
    minimumUpgradableVersion: "0.14.3",
    platform: "win32-x64",
    assetName: path.basename(packagePath),
    assetSize: packageBytes.length,
    sha256: createHash("sha256").update(packageBytes).digest("hex"),
    publicKeyId: createHash("sha256").update(lfPublicPem, "utf8").digest("hex"),
    minimumDataSchema: 5,
    targetDataSchema: 5,
    requiresRestart: true,
    backupRequired: true,
    rollbackMode: "snapshot",
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  await Promise.all([
    writeFile(packagePath, packageBytes),
    writeFile(manifestPath, manifestBytes),
    writeFile(signaturePath, `${sign(null, manifestBytes, privateKey).toString("base64")}\n`, "utf8"),
    writeFile(publicKeyPath, crlfPublicPem, "utf8"),
  ]);

  const verified = await verifyAtlasReleaseFiles({ manifestPath, signaturePath, packagePath, publicKeyPath, currentVersion: "0.15.1", expectedTag: "v0.15.2" });
  assert.equal(verified.signatureVerified, true);
  assert.equal(verified.packageVerified, true);
});

test("the integrated updater refuses a source checkout without an installed Windows package", async (context) => {
  if (process.platform !== "win32") return;
  const root = await mkdtemp(path.join(tmpdir(), "atlas-source-update-refusal-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  assert.throws(() => launchReleaseUpdater({
    projectRoot: root,
    jobId: "qa-refusal",
    installRoot: root,
    dataRoot: path.join(root, "data"),
    updateRoot: path.join(root, "updates"),
    packagePath: path.join(root, "package.zip"),
    manifestPath: path.join(root, "manifest.json"),
    signaturePath: path.join(root, "manifest.sig"),
    publicKeyPath: path.join(root, "public.pem"),
    expectedVersion: "0.15.2",
    port: 9095,
    host: "127.0.0.1",
  }), /Installez d’abord le paquet Windows Atlas/i);
});

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
  assert.match(app, /signature Ed25519/i);
  assert.match(app, /data-action="prepare-update"/);
  assert.match(app, /data-form="update-apply"/);
  assert.match(app, /data-form="local-api-token-create"/);
  assert.match(app, /read:organizations/);
  assert.match(app, /WEBHOOKS LOCAUX/);
  assert.match(app, /127\.0\.0\.1/);
  assert.match(styles, /\.local-api-settings/);
  assert.match(app, /local-api-feature-grid/);
  assert.match(app, /local-api-card-header/);
  assert.match(app, /local-api-scope-option/);
  assert.match(styles, /\.local-api-columns\s*\{[^}]*align-items:\s*start/);
  assert.match(styles, /\.local-api-settings input\[type="checkbox"\]\s*\{[^}]*width:\s*18px/);
  assert.match(styles, /\.local-api-form-actions/);
  assert.match(releaseNotes, /0\.14\.0/);
});
