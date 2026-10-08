import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { breakGlassReset } from "../scripts/atlas-break-glass.mjs";

test("break-glass recovery is local, confirmation-gated and preserves dated backups", async (context) => {
  const dataRoot = await mkdtemp(path.join(tmpdir(), "atlas-break-glass-"));
  context.after(() => rm(dataRoot, { recursive: true, force: true }));
  await writeFile(path.join(dataRoot, "auth.json"), JSON.stringify({ schemaVersion: 3, users: [{ id: "user-admin", username: "admin", displayName: "Admin", role: "administrator", enabled: true, salt: "old", hash: "old", mfa: { enabled: true, secret: "SECRET", recoveryHashes: ["x"] } }] }), "utf8");
  await writeFile(path.join(dataRoot, "sessions.json"), JSON.stringify({ schemaVersion: 1, sessions: [{ tokenHash: "a".repeat(64), id: "session-test", userId: "user-admin" }] }), "utf8");

  await assert.rejects(breakGlassReset({ dataRoot, username: "admin", confirm: "NO" }), /Confirmation refusée/);
  const dryRun = await breakGlassReset({ dataRoot, username: "admin", confirm: "RESET_MFA", dryRun: true });
  assert.equal(dryRun.dryRun, true);

  const result = await breakGlassReset({ dataRoot, username: "admin", confirm: "RESET_MFA" });
  assert.match(result.temporaryPassword, /!Aa9$/);
  const auth = JSON.parse(await readFile(path.join(dataRoot, "auth.json"), "utf8"));
  assert.equal(auth.users[0].mustChangePassword, true);
  assert.equal(auth.users[0].mfa.enabled, false);
  assert.notEqual(auth.users[0].hash, "old");
  const sessions = JSON.parse(await readFile(path.join(dataRoot, "sessions.json"), "utf8"));
  assert.equal(sessions.sessions.length, 0);
  assert.ok(await readFile(path.join(result.backupRoot, "auth.json"), "utf8"));
});
