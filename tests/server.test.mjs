import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createAtlasServer } from "../server.mjs";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function decodeBase32(value) {
  let bits = 0;
  let accumulator = 0;
  const bytes = [];
  for (const character of value.toUpperCase().replace(/[^A-Z2-7]/g, "")) {
    accumulator = (accumulator << 5) | alphabet.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      bytes.push((accumulator >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function totp(secret) {
  const counter = Math.floor(Date.now() / 30000);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret)).update(message).digest();
  const offset = digest.at(-1) & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, "0");
}

test("local setup, explicit public origin, mandatory MFA, workspace revision and account management", async (context) => {
  const dataRoot = await mkdtemp(path.join(tmpdir(), "trc-atlas-test-"));
  const sessionClock = { now: Date.now() };
  const probePublicSite = async (domain) => ({ checkedAt: new Date().toISOString(), domain, address: "203.0.113.20", atlas: { ok: true, version: "0.12.9", storage: "sqlite" }, certificate: { subject: domain, issuer: "Atlas QA CA", validTo: "2027-10-08T00:00:00.000Z", daysRemaining: 365, subjectAltName: `DNS:${domain}` } });
  let server = createAtlasServer({ host: "127.0.0.1", port: 9092, dataRoot, now: () => sessionClock.now, allowedOrigins: ["https://atlas.therisingcloud.com"], probePublicSite });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let address = server.address();
  let base = `http://127.0.0.1:${address.port}`;
  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(dataRoot, { recursive: true, force: true });
  });

  let cookie = "";
  async function request(route, { method = "GET", body, csrf, headers = {} } = {}) {
    const response = await fetch(`${base}${route}`, {
      method,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
        ...(csrf ? { "x-atlas-csrf": csrf } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";", 1)[0];
    const payload = await response.json();
    return { response, payload, setCookie };
  }

  let result = await request("/api/status");
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.initialized, false);
  assert.equal(result.payload.version, "0.12.9");
  assert.equal(result.payload.storage, "uninitialized");
  assert.match(result.response.headers.get("content-security-policy"), /default-src 'self'/);

  result = await request("/api/setup", { method: "POST", headers: { origin: "https://malicious.invalid" }, body: { displayName: "Intrus", username: "intrus", password: "invalid-password" } });
  assert.equal(result.response.status, 403);

  result = await request("/api/setup", { method: "POST", headers: { origin: "https://atlas.therisingcloud.com" }, body: { displayName: "Admin Atlas", username: "admin", password: "correct-horse-battery" } });
  assert.equal(result.response.status, 201);

  result = await request("/api/setup", { method: "POST", body: { displayName: "Deuxième Admin", username: "admin2", password: "correct-horse-battery" } });
  assert.equal(result.response.status, 409);

  result = await request("/api/login", { method: "POST", body: { username: "admin", password: "correct-horse-battery" } });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.mfaSetupRequired, true);
  assert.match(result.payload.secret, /^[A-Z2-7]+$/);
  const adminSecret = result.payload.secret;

  result = await request("/api/mfa/confirm", { method: "POST", headers: { "x-forwarded-proto": "https" }, body: { pendingToken: result.payload.pendingToken, code: totp(adminSecret) } });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.user.mfaEnabled, true);
  assert.equal(result.payload.recoveryCodes.length, 8);
  assert.equal(result.payload.sessionTtlSeconds, 8 * 60 * 60);
  assert.equal(Date.parse(result.payload.sessionExpiresAt), sessionClock.now + (8 * 60 * 60 * 1000));
  assert.equal(result.payload.vaultUnlockedUntil, result.payload.sessionExpiresAt);
  const sessionExpiresAt = result.payload.sessionExpiresAt;
  assert.match(result.setCookie, /Max-Age=28800/);
  assert.match(result.setCookie, /HttpOnly/);
  assert.match(result.setCookie, /SameSite=Strict/);
  assert.match(result.setCookie, /Secure/);
  const csrf = result.payload.csrf;
  const adminCookie = cookie;

  sessionClock.now += 15 * 60 * 1000;
  result = await request("/api/me");
  assert.equal(result.response.status, 200);

  await new Promise((resolve) => server.close(resolve));
  server = createAtlasServer({ host: "127.0.0.1", port: 9092, dataRoot, now: () => sessionClock.now, allowedOrigins: ["https://atlas.therisingcloud.com"], probePublicSite });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  address = server.address();
  base = `http://127.0.0.1:${address.port}`;
  result = await request("/api/me");
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.sessionExpiresAt, sessionExpiresAt);

  result = await request("/api/me");
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.sessionTtlSeconds, 8 * 60 * 60);
  assert.equal(result.payload.sessionExpiresAt, sessionExpiresAt);

  result = await request("/api/workspace");
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.revision, 1);
  assert.ok(result.payload.data.configurations.length >= 4);
  assert.equal(result.payload.data.schemaVersion, 5);
  assert.ok(result.payload.data.procedures.every((procedure) => procedure.organizationId));
  assert.ok(result.payload.data.relations.every((relation) => relation.organizationId && relation.sourceRef && relation.targetRef));
  assert.ok(result.payload.data.relationshipEvents.length >= 1);

  const workspace = result.payload.data;
  workspace.settings.instanceName = "Atlas test";
  workspace.organizations[0].quickNotes = "## Avant intervention\n- Aviser le responsable du site";
  result = await request("/api/workspace", { method: "PUT", csrf, body: { revision: 1, data: workspace } });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.revision, 2);
  assert.equal(result.payload.data.organizations[0].quickNotes, "## Avant intervention\n- Aviser le responsable du site");

  result = await request("/api/workspace", { method: "PUT", csrf, body: { revision: 1, data: workspace } });
  assert.equal(result.response.status, 409);

  const attachmentContent = Buffer.from("Pièce jointe Atlas strictement fictive.", "utf8");
  result = await request("/api/attachments", { method: "POST", csrf, body: { assetRef: "configuration:cfg-nsa-dc01", name: "validation-atlas.txt", mimeType: "text/plain", data: attachmentContent.toString("base64") } });
  assert.equal(result.response.status, 201);
  assert.equal(result.payload.item.name, "validation-atlas.txt");
  assert.equal(result.payload.item.size, attachmentContent.length);
  const attachmentId = result.payload.item.id;

  result = await request("/api/attachments?assetRef=configuration%3Acfg-nsa-dc01");
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.items.length, 1);
  assert.equal(result.payload.events[0].action, "Pièce jointe ajoutée");
  assert.equal("storedName" in result.payload.items[0], false);
  assert.doesNotMatch(await readFile(path.join(dataRoot, "attachments.json"), "utf8"), /Pièce jointe Atlas strictement fictive/);

  const attachmentDownload = await fetch(`${base}/api/attachments/${attachmentId}/download`, { headers: { cookie } });
  assert.equal(attachmentDownload.status, 200);
  assert.match(attachmentDownload.headers.get("content-disposition"), /validation-atlas\.txt/);
  assert.deepEqual(Buffer.from(await attachmentDownload.arrayBuffer()), attachmentContent);

  result = await request("/api/attachments", { method: "POST", csrf, body: { assetRef: "configuration:cfg-nsa-dc01", name: "interdit.exe", mimeType: "application/octet-stream", data: attachmentContent.toString("base64") } });
  assert.equal(result.response.status, 400);

  result = await request(`/api/attachments/${attachmentId}`, { method: "DELETE", csrf, body: {} });
  assert.equal(result.response.status, 200);
  result = await request("/api/attachments?assetRef=configuration%3Acfg-nsa-dc01");
  assert.equal(result.payload.items.length, 0);
  assert.equal(result.payload.events[0].action, "Pièce jointe retirée");

  result = await request("/api/me/preferences", { method: "PUT", body: { visibleModules: ["configurations"] } });
  assert.equal(result.response.status, 403);

  result = await request("/api/workspace/history");
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.entries[0].revision, 1);

  result = await request("/api/me/preferences", { method: "PUT", csrf, body: { visibleModules: ["configurations", "passwords"] } });
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.payload.user.preferences.visibleModules, ["configurations", "passwords"]);

  result = await request("/api/vault", { method: "POST", csrf, body: { organizationId: "org-northstar", title: "", password: "x", otpSecret: "" } });
  assert.equal(result.response.status, 400);

  result = await request("/api/vault", { method: "POST", csrf, body: { organizationId: "org-northstar", title: "Routeur principal", category: "Réseau", username: "local-admin", password: "vault-secret-value", url: "https://router.invalid", notes: "Compte de test", otpSecret: "JBSWY3DPEHPK3PXP" } });
  assert.equal(result.response.status, 201);
  const vaultId = result.payload.item.id;
  assert.equal(result.payload.item.strength, 2);
  assert.ok(Number.isFinite(Date.parse(result.payload.item.strengthEvaluatedAt)));

  const legacyVaultPath = path.join(dataRoot, "vault.json");
  const legacyVault = JSON.parse(await readFile(legacyVaultPath, "utf8"));
  const legacyItem = legacyVault.items.find((item) => item.id === vaultId);
  delete legacyItem.strength;
  delete legacyItem.strengthEvaluatedAt;
  delete legacyItem.passwordFingerprint;
  legacyVault.schemaVersion = 1;
  await writeFile(legacyVaultPath, `${JSON.stringify(legacyVault, null, 2)}\n`, "utf8");

  result = await request("/api/vault");
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.items.length, 1);
  assert.equal(result.payload.items[0].title, "Routeur principal");
  assert.equal(result.payload.items[0].strength, 2);
  assert.ok(Number.isFinite(Date.parse(result.payload.items[0].strengthEvaluatedAt)));
  assert.equal("password" in result.payload.items[0], false);
  const migratedVault = JSON.parse(await readFile(legacyVaultPath, "utf8"));
  const migratedItem = migratedVault.items.find((item) => item.id === vaultId);
  assert.equal(migratedVault.schemaVersion, 2);
  assert.equal(migratedItem.strength, 2);
  assert.ok(Number.isFinite(Date.parse(migratedItem.strengthEvaluatedAt)));
  assert.match(migratedItem.passwordFingerprint, /^[a-f0-9]{64}$/);

  result = await request(`/api/vault/${vaultId}/reveal`, { method: "POST", csrf, body: {} });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.item.password, "vault-secret-value");
  assert.match(result.payload.item.otp, /^\d{6}$/);
  assert.doesNotMatch(await readFile(path.join(dataRoot, "vault.json"), "utf8"), /vault-secret-value|local-admin/);

  result = await request("/api/attachments", { method: "POST", csrf, body: { assetRef: `vault:${vaultId}`, name: "coffre-test.txt", mimeType: "text/plain", data: attachmentContent.toString("base64") } });
  assert.equal(result.response.status, 201);
  const vaultAttachmentId = result.payload.item.id;
  sessionClock.now += 6 * 60 * 1000;
  result = await request("/api/attachments", { method: "POST", csrf, body: { assetRef: `vault:${vaultId}`, name: "coffre-session.txt", mimeType: "text/plain", data: attachmentContent.toString("base64") } });
  assert.equal(result.response.status, 201);
  const sessionAttachmentId = result.payload.item.id;

  result = await request("/api/vault/lock", { method: "POST", csrf, body: {} });
  assert.equal(result.response.status, 200);
  result = await request("/api/attachments", { method: "POST", csrf, body: { assetRef: `vault:${vaultId}`, name: "coffre-verrouille.txt", mimeType: "text/plain", data: attachmentContent.toString("base64") } });
  assert.equal(result.response.status, 403);
  let lockedDownload = await fetch(`${base}/api/attachments/${vaultAttachmentId}/download`, { headers: { cookie } });
  assert.equal(lockedDownload.status, 403);
  result = await request(`/api/vault/${vaultId}/reveal`, { method: "POST", csrf, body: {} });
  assert.equal(result.response.status, 403);

  result = await request("/api/vault/unlock", { method: "POST", csrf, body: { code: "000000" } });
  assert.equal(result.response.status, 401);

  result = await request("/api/vault/unlock", { method: "POST", csrf, body: { code: totp((await readFile(path.join(dataRoot, "auth.json"), "utf8")).match(/\"secret\": \"([^\"]+)/)[1]) } });
  assert.equal(result.response.status, 200);
  assert.equal(Date.parse(result.payload.unlockedUntil), Date.parse((await request("/api/me")).payload.sessionExpiresAt));
  lockedDownload = await fetch(`${base}/api/attachments/${vaultAttachmentId}/download`, { headers: { cookie } });
  assert.equal(lockedDownload.status, 200);
  result = await request(`/api/attachments/${vaultAttachmentId}`, { method: "DELETE", csrf, body: {} });
  assert.equal(result.response.status, 200);
  result = await request(`/api/attachments/${sessionAttachmentId}`, { method: "DELETE", csrf, body: {} });
  assert.equal(result.response.status, 200);

  result = await request(`/api/vault/${vaultId}`, { method: "PUT", csrf, body: { organizationId: "org-northstar", title: "Routeur principal archivé", category: "Réseau", username: "local-admin-2", password: "vault-secret-updated", url: "https://router.invalid", notes: "Archivé", otpSecret: "", archived: true } });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.item.archived, true);
  assert.doesNotMatch(await readFile(path.join(dataRoot, "vault.json"), "utf8"), /vault-secret-updated|local-admin-2/);

  result = await request(`/api/vault/${vaultId}/reveal`, { method: "POST", csrf, body: {} });
  assert.equal(result.response.status, 404);

  result = await request("/api/export");
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.format, "trc-atlas-export");
  assert.equal(result.payload.workspace.revision, 2);

  result = await request("/api/import", { method: "POST", csrf, body: { format: "trc-atlas-export", workspace: { data: { invalid: true } } } });
  assert.equal(result.response.status, 400);

  result = await request("/api/workspace/history/9999/restore", { method: "POST", csrf, body: {} });
  assert.equal(result.response.status, 404);

  result = await request("/api/workspace/history/1/restore", { method: "POST", csrf, body: {} });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.revision, 3);

  result = await request("/api/users");
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.users.length, 1);

  result = await request("/api/users", { method: "POST", csrf, body: { displayName: "Lecteur Local", username: "lecteur", password: "temporary-password-123", role: "viewer", organizationIds: ["org-boreal"], vaultAccess: false, adminMfaCode: totp(adminSecret) } });
  assert.equal(result.response.status, 201);
  assert.equal(result.payload.user.mfaEnabled, false);
  assert.deepEqual(result.payload.user.organizationIds, ["org-boreal"]);
  assert.equal(result.payload.user.vaultAccess, false);
  assert.deepEqual(result.payload.user.organizationPermissions, [{ organizationId: "org-boreal", role: "viewer", vaultAccess: false }]);
  const readerId = result.payload.user.id;

  result = await request(`/api/users/${readerId}/toggle`, { method: "POST", csrf, body: { adminMfaCode: totp(adminSecret) } });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.user.enabled, false);

  cookie = "";
  result = await request("/api/login", { method: "POST", body: { username: "lecteur", password: "temporary-password-123" } });
  assert.equal(result.response.status, 401);

  cookie = adminCookie;
  result = await request(`/api/users/${readerId}/toggle`, { method: "POST", csrf, body: { adminMfaCode: totp(adminSecret) } });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.user.enabled, true);

  cookie = "";
  result = await request("/api/login", { method: "POST", body: { username: "lecteur", password: "temporary-password-123" } });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.passwordChangeRequired, true);
  result = await request("/api/password/change-required", { method: "POST", body: { pendingToken: result.payload.pendingToken, password: "reader-chosen-password-123" } });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.mfaSetupRequired, true);
  const readerPending = result.payload.pendingToken;
  const readerSecret = result.payload.secret;
  result = await request("/api/mfa/confirm", { method: "POST", body: { pendingToken: readerPending, code: totp(readerSecret) } });
  assert.equal(result.response.status, 200);
  let readerCookie = cookie;
  let readerCsrf = result.payload.csrf;

  result = await request("/api/workspace");
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.payload.data.organizations.map((organization) => organization.id), ["org-boreal"]);
  assert.ok(result.payload.data.configurations.every((item) => item.organizationId === "org-boreal"));
  result = await request("/api/vault");
  assert.equal(result.response.status, 403);
  assert.equal(result.payload.error, "vault_access_required");

  cookie = adminCookie;
  result = await request(`/api/users/${readerId}`, { method: "PUT", csrf, body: { displayName: "Lecteur Local", role: "viewer", organizationIds: ["org-boreal"], vaultAccess: true, adminMfaCode: totp(adminSecret) } });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.user.role, "viewer");
  assert.equal(result.payload.user.vaultAccess, true);
  assert.ok(result.payload.revokedSessions >= 1);
  cookie = readerCookie;
  result = await request("/api/me");
  assert.equal(result.response.status, 401);

  cookie = "";
  result = await request("/api/login", { method: "POST", body: { username: "lecteur", password: "reader-chosen-password-123" } });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.mfaRequired, true);
  result = await request("/api/mfa/verify", { method: "POST", body: { pendingToken: result.payload.pendingToken, code: totp(readerSecret) } });
  assert.equal(result.response.status, 200);
  readerCookie = cookie;
  readerCsrf = result.payload.csrf;
  result = await request("/api/vault");
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.items.length, 0);
  result = await request("/api/assets/configuration%3Acfg-nsa-dc01/history");
  assert.equal(result.response.status, 403);
  result = await request("/api/users");
  assert.equal(result.response.status, 403);
  result = await request("/api/export");
  assert.equal(result.response.status, 403);
  result = await request("/api/workspace", { method: "PUT", csrf: readerCsrf, body: { revision: result.payload.revision || 3, data: workspace } });
  assert.equal(result.response.status, 403);
  result = await request("/api/me/preferences", { method: "PUT", csrf: readerCsrf, body: { visibleModules: ["contacts"] } });
  assert.equal(result.response.status, 200);

  result = await request("/api/organizations/org-atlas-demo", { method: "DELETE", csrf: readerCsrf, body: { confirmation: "Atelier Atlas", code: totp(readerSecret) } });
  assert.equal(result.response.status, 403);
  assert.equal(result.payload.error, "administrator_required");

  cookie = adminCookie;
  result = await request(`/api/users/${readerId}/revoke-sessions`, { method: "POST", csrf, body: { adminMfaCode: totp(adminSecret) } });
  assert.equal(result.response.status, 200);
  assert.ok(result.payload.revokedSessions >= 1);
  cookie = readerCookie;
  result = await request("/api/me");
  assert.equal(result.response.status, 401);

  cookie = "";
  result = await request("/api/login", { method: "POST", body: { username: "lecteur", password: "reader-chosen-password-123" } });
  result = await request("/api/mfa/verify", { method: "POST", body: { pendingToken: result.payload.pendingToken, code: totp(readerSecret) } });
  assert.equal(result.response.status, 200);
  readerCookie = cookie;
  readerCsrf = result.payload.csrf;

  cookie = adminCookie;
  result = await request(`/api/users/${readerId}/reset-password`, { method: "POST", csrf, body: { password: "replacement-password-456", adminMfaCode: totp(adminSecret) } });
  assert.equal(result.response.status, 200);
  assert.ok(result.payload.revokedSessions >= 1);
  cookie = "";
  result = await request("/api/login", { method: "POST", body: { username: "lecteur", password: "reader-chosen-password-123" } });
  assert.equal(result.response.status, 401);
  result = await request("/api/login", { method: "POST", body: { username: "lecteur", password: "replacement-password-456" } });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.passwordChangeRequired, true);
  result = await request("/api/password/change-required", { method: "POST", body: { pendingToken: result.payload.pendingToken, password: "reader-final-password-789" } });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.mfaRequired, true);
  result = await request("/api/mfa/verify", { method: "POST", body: { pendingToken: result.payload.pendingToken, code: totp(readerSecret) } });
  assert.equal(result.response.status, 200);
  readerCookie = cookie;

  cookie = adminCookie;
  result = await request(`/api/users/${readerId}/reset-mfa`, { method: "POST", csrf, body: { adminMfaCode: totp(adminSecret) } });
  assert.equal(result.response.status, 200);
  cookie = readerCookie;
  result = await request("/api/me");
  assert.equal(result.response.status, 401);

  cookie = adminCookie;
  result = await request("/api/vault", { method: "POST", csrf, body: { organizationId: "org-atlas-demo", title: "Secret temporaire de suppression", category: "Test", username: "qa", password: "synthetic-delete-secret", url: "", notes: "Suppression QA", otpSecret: "" } });
  assert.equal(result.response.status, 201);
  const deletionVaultId = result.payload.item.id;
  const deletionAttachmentContent = Buffer.from("Pièce jointe temporaire pour la suppression MFA.", "utf8");
  result = await request("/api/attachments", { method: "POST", csrf, body: { assetRef: "configuration:cfg-ata-ws01", name: "suppression-mfa.txt", mimeType: "text/plain", data: deletionAttachmentContent.toString("base64") } });
  assert.equal(result.response.status, 201);
  const deletionAttachmentId = result.payload.item.id;

  result = await request("/api/organizations/org-atlas-demo", { method: "DELETE", csrf, body: { confirmation: "Mauvais nom", code: totp(adminSecret) } });
  assert.equal(result.response.status, 400);
  result = await request("/api/organizations/org-atlas-demo", { method: "DELETE", csrf, body: { confirmation: "Atelier Atlas", code: "000000" } });
  assert.equal(result.response.status, 401);
  assert.equal(result.payload.error, "invalid_mfa");

  result = await request("/api/organizations/org-atlas-demo", { method: "DELETE", csrf, body: { confirmation: "Atelier Atlas", code: totp(adminSecret) } });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.deleted, true);
  assert.equal(result.payload.organization.name, "Atelier Atlas");
  assert.equal(result.payload.removed.sites, 1);
  assert.equal(result.payload.removed.configurations, 1);
  assert.equal(result.payload.removed.passwords, 1);
  assert.equal(result.payload.removed.attachments, 1);
  assert.equal(result.payload.workspace.data.organizations.some((organization) => organization.id === "org-atlas-demo"), false);
  assert.equal(result.payload.workspace.data.configurations.some((item) => item.organizationId === "org-atlas-demo"), false);
  await assert.rejects(readFile(path.join(dataRoot, "attachments", `${deletionAttachmentId}.bin`)), { code: "ENOENT" });

  result = await request("/api/vault");
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.items.some((item) => item.id === deletionVaultId || item.organizationId === "org-atlas-demo"), false);
  result = await request("/api/attachments");
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.items.some((item) => item.id === deletionAttachmentId || item.organizationId === "org-atlas-demo"), false);

  result = await request("/api/logout", { method: "POST", csrf, body: {} });
  assert.equal(result.response.status, 200);
  result = await request("/api/me");
  assert.equal(result.response.status, 401);

  cookie = "";
  result = await request("/api/login", { method: "POST", body: { username: "admin", password: "correct-horse-battery" } });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.mfaRequired, true);
  result = await request("/api/mfa/verify", { method: "POST", body: { pendingToken: result.payload.pendingToken, code: totp(adminSecret) } });
  assert.equal(result.response.status, 200);
  const refreshedCsrf = result.payload.csrf;
  const refreshedSessionExpiresAt = result.payload.sessionExpiresAt;

  result = await request("/api/me/sessions");
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.sessions.length, 1);
  assert.equal(result.payload.sessions[0].current, true);
  assert.match(result.payload.sessions[0].id, /^session-/);

  result = await request("/api/me/recovery-codes", { method: "POST", csrf: refreshedCsrf, body: { code: totp(adminSecret) } });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.recoveryCodes.length, 8);

  result = await request("/api/workspace");
  const securityRevision = result.payload.revision;
  result = await request("/api/settings/security", { method: "PUT", csrf: refreshedCsrf, body: { revision: securityRevision, privilegedMfaEnabled: false, passwordRotationEnabled: true, passwordRotationDays: 60, passwordRotationReminderDays: 10, adminMfaCode: "000000" } });
  assert.equal(result.response.status, 401);
  result = await request("/api/settings/security", { method: "PUT", csrf: refreshedCsrf, body: { revision: securityRevision, privilegedMfaEnabled: false, passwordRotationEnabled: true, passwordRotationDays: 60, passwordRotationReminderDays: 10, adminMfaCode: totp(adminSecret) } });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.data.settings.security.passwordRotationEnabled, true);
  assert.equal(result.payload.data.settings.security.privilegedMfaEnabled, false);

  result = await request(`/api/users/${readerId}/revoke-sessions`, { method: "POST", csrf: refreshedCsrf, body: {} });
  assert.equal(result.response.status, 200);
  result = await request("/api/settings/security", { method: "PUT", csrf: refreshedCsrf, body: { revision: result.payload.revision || securityRevision + 1, privilegedMfaEnabled: true, passwordRotationEnabled: true, passwordRotationDays: 60, passwordRotationReminderDays: 10 } });
  if (result.response.status === 409) {
    const current = await request("/api/workspace");
    result = await request("/api/settings/security", { method: "PUT", csrf: refreshedCsrf, body: { revision: current.payload.revision, privilegedMfaEnabled: true, passwordRotationEnabled: true, passwordRotationDays: 60, passwordRotationReminderDays: 10 } });
  }
  assert.equal(result.response.status, 200);

  result = await request("/api/workspace");
  const deploymentRevision = result.payload.revision;
  result = await request("/api/settings/deployment", { method: "PUT", csrf: refreshedCsrf, body: { revision: deploymentRevision, instanceCode: "ABC", primaryDomain: "https://atlas.abcp.com", domainAliases: [], accessMode: "reverse-proxy", reverseProxy: "nginx", adminMfaCode: totp(adminSecret) } });
  assert.equal(result.response.status, 400);
  result = await request("/api/settings/deployment", { method: "PUT", csrf: refreshedCsrf, body: { revision: deploymentRevision, instanceCode: "ABC", primaryDomain: "atlas.abcp.com", domainAliases: ["documentation.abcp.com"], accessMode: "reverse-proxy", reverseProxy: "nginx", adminMfaCode: totp(adminSecret) } });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.data.settings.deployment.instanceCode, "ABC");
  assert.equal(result.payload.data.settings.deployment.primaryDomain, "atlas.abcp.com");

  result = await request("/api/settings/deployment/health", { headers: { "x-forwarded-proto": "https", "x-forwarded-host": "atlas.abcp.com" } });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.publicUrl, "https://atlas.abcp.com");
  assert.ok(result.payload.checks.some((check) => check.id === "https" && check.status === "ok"));
  assert.ok(result.payload.checks.some((check) => check.id === "origin" && check.status === "ok"));

  await new Promise((resolve) => server.close(resolve));
  server = createAtlasServer({ host: "127.0.0.1", port: 9092, dataRoot, now: () => sessionClock.now, allowedOrigins: ["https://atlas.therisingcloud.com"], probePublicSite });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  address = server.address();
  base = `http://127.0.0.1:${address.port}`;
  result = await request("/api/settings/deployment/probe", { method: "POST", csrf: refreshedCsrf, headers: { origin: "https://atlas.abcp.com" }, body: {} });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.domain, "atlas.abcp.com");
  assert.equal(result.payload.certificate.issuer, "Atlas QA CA");

  result = await request("/api/workspace");
  const forbiddenDeploymentWorkspace = structuredClone(result.payload.data);
  forbiddenDeploymentWorkspace.settings.deployment.primaryDomain = "changed.abcp.com";
  result = await request("/api/workspace", { method: "PUT", csrf: refreshedCsrf, body: { revision: result.payload.revision, data: forbiddenDeploymentWorkspace } });
  assert.equal(result.response.status, 403);

  result = await request("/api/vault", { method: "POST", csrf: refreshedCsrf, body: { organizationId: "org-northstar", title: "Compte avec rotation", category: "Test", username: "rotation-user", password: "Very-Strong-Rotation-Password-2026!", url: "", notes: "Cycle de vie test", otpSecret: "", passwordChangedAt: "2026-10-01", expiresAt: "2026-12-01", rotationOwner: "Équipe sécurité", rotationIntervalDays: 60 } });
  assert.equal(result.response.status, 201);
  assert.equal(result.payload.item.rotationOwner, "Équipe sécurité");
  assert.equal(result.payload.item.rotationIntervalDays, 60);
  assert.equal(result.payload.item.strength, 4);

  result = await request("/api/audit?limit=500");
  assert.equal(result.response.status, 200);
  assert.ok(result.payload.entries.some((entry) => entry.action === "security-policy-updated"));
  assert.ok(result.payload.entries.some((entry) => entry.action === "account-recovery-codes-regenerated"));
  assert.ok(result.payload.entries.some((entry) => entry.action === "vault-created"));
  const hardExpiry = Date.parse(refreshedSessionExpiresAt);
  sessionClock.now = hardExpiry - 1;
  result = await request("/api/me");
  assert.equal(result.response.status, 200);
  sessionClock.now = hardExpiry;
  result = await request("/api/me");
  assert.equal(result.response.status, 401);
  assert.equal(result.payload.error, "authentication_required");

  const logo = await fetch(`${base}/assets/trc-atlas-layers-logo.svg`);
  assert.equal(logo.status, 200);
  assert.match(await logo.text(), /TRC Atlas layered knowledge logo/);
});

