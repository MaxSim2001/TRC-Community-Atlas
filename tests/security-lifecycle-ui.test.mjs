import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("security policies, self-service sessions and password lifecycle remain wired", async () => {
  const [app, server, styles] = await Promise.all([
    readFile(path.join(root, "public", "assets", "app.js"), "utf8"),
    readFile(path.join(root, "server.mjs"), "utf8"),
    readFile(path.join(root, "public", "assets", "styles.css"), "utf8"),
  ]);

  assert.match(app, /MFA renforcé pour les actions sensibles/);
  assert.match(app, /Expiration et rappels de rotation/);
  assert.match(app, /data-route="my-account"/);
  assert.match(app, /data-form="self-password"/);
  assert.match(app, /recovery-codes-regenerate/);
  assert.match(app, /revoke-own-session/);
  assert.match(app, /vaultRotationPresentation/);
  assert.match(app, /duplicateCount/);
  assert.match(app, /<h2>Cycle de vie<\/h2>/);
  assert.match(app, /name="expiresAt" type="date"/);
  assert.match(app, /name="rotationOwner"/);
  assert.match(server, /\/api\/settings\/security/);
  assert.match(server, /requirePrivilegedMfa/);
  assert.match(server, /\/api\/me\/sessions/);
  assert.match(server, /account-recovery-codes-regenerated/);
  assert.match(server, /passwordFingerprint/);
  assert.match(styles, /\.security-policy-controls/);
  assert.match(styles, /\.account-self-grid/);
  assert.match(styles, /\.vault-health-grid/);
});
