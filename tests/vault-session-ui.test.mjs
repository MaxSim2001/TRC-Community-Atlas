import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the vault reuses the authenticated Atlas session and keeps secrets masked", async () => {
  const app = await readFile(path.join(root, "public", "assets", "app.js"), "utf8");
  const server = await readFile(path.join(root, "server.mjs"), "utf8");

  assert.match(server, /const vaultUnlockedUntil = canAccessVault\(user\) \? expiresAt : 0/);
  assert.match(server, /requireVaultAccess/);
  assert.match(server, /url\.pathname === "\/api\/vault\/lock"/);
  assert.match(server, /const sessionsPath = path\.join\(dataRoot, "sessions\.json"\)/);
  assert.match(app, /function vaultSessionUnlocked\(\)/);
  assert.match(app, /function revealVaultItem\s*\(/);
  assert.match(app, /MFA valide pour la session/);
  assert.match(app, /Verrouiller le coffre/);
  assert.match(app, /secret-masked/);
  assert.doesNotMatch(app, /déverrouiller le coffre pendant cinq minutes/i);
});
