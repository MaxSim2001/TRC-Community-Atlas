import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
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

test("GitHub update preparation and installation require admin, CSRF, MFA and exact confirmation", async (context) => {
  const dataRoot = await mkdtemp(path.join(tmpdir(), "trc-atlas-update-test-"));
  const updateRoot = path.join(dataRoot, "update-test");
  let checks = 0;
  let preparations = 0;
  const launches = [];
  let shutdowns = 0;
  const releaseChecker = async () => {
    checks += 1;
    return {
      available: true,
      updateAvailable: true,
      sameVersion: false,
      repository: "MaxSim2001/TRC-Community-Atlas",
      currentVersion: "0.15.5",
      tag: "v0.15.6",
      name: "Atlas 0.15.6 QA",
      checkedAt: "2026-10-09T12:00:00.000Z",
      artifactSetPresent: true,
      signatureVerified: false,
      packageVerified: false,
      rollbackReady: false,
      installable: false,
      installBlockedReason: "Validation cryptographique et retour arrière requis.",
    };
  };
  const releasePreparer = async ({ release, currentVersion, publicKeyPath, updateRoot: requestedUpdateRoot }) => {
    preparations += 1;
    assert.equal(release.tag, "v0.15.6");
    assert.equal(currentVersion, "0.15.5");
    assert.match(publicKeyPath, /atlas-release-public-key\.pem$/);
    assert.equal(requestedUpdateRoot, updateRoot);
    return {
      schemaVersion: 1,
      repository: "MaxSim2001/TRC-Community-Atlas",
      currentVersion,
      targetVersion: "0.15.6",
      tag: "v0.15.6",
      preparedAt: "2026-10-09T12:01:00.000Z",
      preparedRoot: path.join(updateRoot, "prepared-v0.15.6"),
      manifestPath: path.join(updateRoot, "prepared-v0.15.6", "atlas-release-manifest.json"),
      signaturePath: path.join(updateRoot, "prepared-v0.15.6", "atlas-release-manifest.sig"),
      packagePath: path.join(updateRoot, "prepared-v0.15.6", "TRC-Atlas-Portable-0.15.6-win-x64.zip"),
      manifest: { assetName: "TRC-Atlas-Portable-0.15.6-win-x64.zip", assetSize: 1234, sha256: "a".repeat(64), releaseNotesUrl: release.pageUrl || "" },
      signatureVerified: true,
      packageVerified: true,
      rollbackReady: true,
      installable: true,
    };
  };
  const updateLauncher = (options) => {
    launches.push(options);
    return { jobId: options.jobId, processId: 4242, status: "starting" };
  };
  const server = createAtlasServer({
    host: "127.0.0.1",
    port: 9092,
    dataRoot,
    updateRoot,
    releaseChecker,
    releasePreparer,
    updateLauncher,
    updateShutdownHandler: () => { shutdowns += 1; },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(dataRoot, { recursive: true, force: true });
  });

  let cookie = "";
  async function request(route, { method = "GET", body, csrf } = {}) {
    const response = await fetch(`${base}${route}`, {
      method,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
        ...(csrf ? { "x-atlas-csrf": csrf } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";", 1)[0];
    return { response, payload: await response.json() };
  }

  let result = await request("/api/settings/updates");
  assert.equal(result.response.status, 401);

  result = await request("/api/setup", { method: "POST", body: { displayName: "Admin Update QA", username: "update-admin", password: "update-test-password-2026" } });
  assert.equal(result.response.status, 201);
  result = await request("/api/login", { method: "POST", body: { username: "update-admin", password: "update-test-password-2026" } });
  const secret = result.payload.secret;
  result = await request("/api/mfa/confirm", { method: "POST", body: { pendingToken: result.payload.pendingToken, code: totp(secret) } });
  assert.equal(result.response.status, 200);
  const csrf = result.payload.csrf;

  result = await request("/api/settings/updates");
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.currentVersion, "0.15.5");
  assert.equal(result.payload.automaticChecks, false);
  assert.equal(result.payload.automaticInstall, false);
  assert.equal(result.payload.lastCheck, null);

  result = await request("/api/settings/updates/check", { method: "POST", body: {} });
  assert.equal(result.response.status, 403);
  assert.equal(checks, 0);

  result = await request("/api/settings/updates/check", { method: "POST", csrf, body: {} });
  assert.equal(result.response.status, 200);
  assert.equal(checks, 1);
  assert.equal(result.payload.lastCheck.updateAvailable, true);
  assert.equal(result.payload.lastCheck.installable, false);
  assert.equal(result.payload.lastCheck.signatureVerified, false);

  result = await request("/api/settings/updates/prepare", { method: "POST", body: {} });
  assert.equal(result.response.status, 403);
  assert.equal(preparations, 0);

  result = await request("/api/settings/updates/prepare", { method: "POST", csrf, body: {} });
  assert.equal(result.response.status, 200);
  assert.equal(preparations, 1);
  assert.equal(result.payload.prepared.targetVersion, "0.15.6");
  assert.equal(result.payload.prepared.signatureVerified, true);
  assert.equal(result.payload.prepared.packageVerified, true);
  assert.equal(result.payload.prepared.rollbackReady, true);
  assert.equal(result.payload.prepared.packagePath, undefined);

  result = await request("/api/settings/updates/apply", { method: "POST", csrf, body: { confirmation: "INSTALLER 0.15.6", adminMfaCode: "000000" } });
  assert.equal(result.response.status, 401);
  assert.equal(launches.length, 0);

  result = await request("/api/settings/updates/apply", { method: "POST", csrf, body: { confirmation: "installer", adminMfaCode: totp(secret) } });
  assert.equal(result.response.status, 400);
  assert.equal(launches.length, 0);

  result = await request("/api/settings/updates/apply", { method: "POST", csrf, body: { confirmation: "INSTALLER 0.15.6", adminMfaCode: totp(secret) } });
  assert.equal(result.response.status, 202);
  assert.equal(result.payload.targetVersion, "0.15.6");
  assert.equal(launches.length, 1);
  assert.equal(launches[0].expectedVersion, "0.15.6");
  assert.equal(launches[0].updateRoot, updateRoot);
  await new Promise((resolve) => setTimeout(resolve, 850));
  assert.equal(shutdowns, 1);

  result = await request("/api/audit?limit=100");
  assert.equal(result.response.status, 200);
  const actions = new Set(result.payload.entries.map((entry) => entry.action));
  assert.ok(actions.has("github-release-checked"));
  assert.ok(actions.has("github-release-prepared"));
  assert.ok(actions.has("github-release-install-started"));
});
