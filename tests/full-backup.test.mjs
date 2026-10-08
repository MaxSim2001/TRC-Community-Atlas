import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createFullBackup, readFullBackup, restoreFullBackup } from "../scripts/atlas-full-backup.mjs";

test("full backups encrypt accounts, vault, SQLite and attachments while excluding sessions", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "atlas-full-backup-"));
  const dataRoot = path.join(root, "data");
  const outputPath = path.join(root, "Atlas_Backup.trcatlas");
  const passphrase = "synthetic-backup-passphrase-2026";
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(dataRoot, "attachments"), { recursive: true });
  await writeFile(path.join(dataRoot, "auth.json"), '{"users":[{"username":"admin"}]}', "utf8");
  await writeFile(path.join(dataRoot, "vault.json"), '{"items":[]}', "utf8");
  await writeFile(path.join(dataRoot, "vault.key"), "synthetic-key", "utf8");
  await writeFile(path.join(dataRoot, "attachments.json"), '{"items":[]}', "utf8");
  await writeFile(path.join(dataRoot, "attachments", "att-test.bin"), "attachment", "utf8");
  await writeFile(path.join(dataRoot, "sessions.json"), '{"sessions":[{"tokenHash":"secret-session"}]}', "utf8");
  const database = new DatabaseSync(path.join(dataRoot, "atlas.sqlite"));
  database.exec("CREATE TABLE workspace_state (singleton INTEGER PRIMARY KEY, revision INTEGER); INSERT INTO workspace_state VALUES (1, 1);");
  database.close();

  const created = await createFullBackup({ dataRoot, outputPath, passphrase });
  assert.equal(created.sessionsExcluded, true);
  const raw = await readFile(outputPath, "utf8");
  assert.doesNotMatch(raw, /admin|synthetic-key|secret-session|attachment/);
  await assert.rejects(readFullBackup({ inputPath: outputPath, passphrase: "wrong-passphrase-123" }));
  const payload = await readFullBackup({ inputPath: outputPath, passphrase });
  assert.ok(payload.files.some((file) => file.path === "atlas.sqlite"));
  assert.ok(payload.files.some((file) => file.path === "attachments/att-test.bin"));
  assert.equal(payload.files.some((file) => file.path === "sessions.json"), false);

  await writeFile(path.join(dataRoot, "auth.json"), '{"users":[]}', "utf8");
  await assert.rejects(restoreFullBackup({ dataRoot, inputPath: outputPath, passphrase, confirm: "NO" }), /Confirmation refusée/);
  const restored = await restoreFullBackup({ dataRoot, inputPath: outputPath, passphrase, confirm: "RESTORE_ATLAS" });
  assert.equal(restored.sessionsRestored, false);
  assert.match(await readFile(path.join(dataRoot, "auth.json"), "utf8"), /admin/);
  await assert.rejects(readFile(path.join(dataRoot, "sessions.json"), "utf8"), { code: "ENOENT" });
  assert.match(await readFile(path.join(restored.safetyRoot, "auth.json"), "utf8"), /"users":\[\]/);
});
