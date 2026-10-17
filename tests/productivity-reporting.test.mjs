import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createAtlasServer } from "../server.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
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

test("personal productivity tools remain account-scoped and exclude vault bulk edits", async () => {
  const [app, server] = await Promise.all([
    readFile(path.join(root, "public", "assets", "app.js"), "utf8"),
    readFile(path.join(root, "server.mjs"), "utf8"),
  ]);

  for (const field of ["favoriteAssetRefs", "savedViews", "dashboardWidgets", "snoozedActions", "importProfiles"]) {
    assert.match(server, new RegExp(field));
    assert.match(app, new RegExp(field));
  }
  assert.match(app, /renderActionCenter/);
  assert.match(app, /data-form="bulk-edit"/);
  assert.match(app, /asset\.type !== "vault"/);
  assert.match(app, /showModal\("command-palette"\)/);
  assert.match(app, /data-form="dashboard-widgets"/);
  assert.match(app, /data-form="saved-view"/);
  assert.match(app, /data-import-profile/);
  assert.match(server, /DASHBOARD_WIDGET_IDS/);
  assert.match(server, /SAVED_VIEW_PAGES/);
});

test("client reporting is printable and JSON export is explicitly minimized", async () => {
  const [app, styles] = await Promise.all([
    readFile(path.join(root, "public", "assets", "app.js"), "utf8"),
    readFile(path.join(root, "public", "assets", "styles.css"), "utf8"),
  ]);

  assert.match(app, /function renderOrganizationReport/);
  assert.match(app, /data-action="print-report"/);
  assert.match(app, /download-report-json/);
  assert.match(app, /free-form notes, detailed fields and private Quick Notes are excluded/);
  assert.doesNotMatch(app, /records:\s*state\.workspace\.moduleRecords\.filter\(\(item\) => item\.organizationId === organizationId\),/);
  assert.match(styles, /@media print/);
  assert.match(styles, /\.report-page/);
});

test("offline shell and local webhook retries keep security boundaries", async () => {
  const [app, worker, server] = await Promise.all([
    readFile(path.join(root, "public", "assets", "app.js"), "utf8"),
    readFile(path.join(root, "public", "service-worker.js"), "utf8"),
    readFile(path.join(root, "server.mjs"), "utf8"),
  ]);

  assert.match(app, /Mode hors ligne limité/);
  assert.match(app, /window\.addEventListener\("offline"/);
  assert.match(worker, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.doesNotMatch(worker, /cache\.put\([^\n]*\/api\//);
  assert.match(server, /attempt <= 3/);
  assert.match(server, /consecutiveFailures/);
  assert.match(server, /validateLocalWebhookUrl/);
  assert.match(server, /hostName === "localhost" \|\| hostName === "127\.0\.0\.1" \|\| hostName === "::1"/);
});

test("release documentation covers the current release and the 0.17.0 workflows", async () => {
  const [readme, notes, guide, help] = await Promise.all([
    readFile(path.join(root, "README.md"), "utf8"),
    readFile(path.join(root, "docs", "RELEASE_NOTES.md"), "utf8"),
    readFile(path.join(root, "docs", "USER_GUIDE.md"), "utf8"),
    readFile(path.join(root, "public", "assets", "help-content.js"), "utf8"),
  ]);
  assert.match(readme, /Current version: \*\*0\.17\.1\*\*/);
  assert.match(notes, /0\.17\.1 — Larger configuration attachments/);
  assert.match(notes, /0\.17\.0 — Personal productivity and client reporting/);
  assert.match(guide, /Personal workspace and action center/);
  assert.match(help, /Version 0\.17\.1/);
  assert.match(help, /Version 0\.17\.0/);
});

test("account productivity preferences survive a restart and automatic webhooks retry twice", async (context) => {
  const dataRoot = await mkdtemp(path.join(tmpdir(), "trc-atlas-productivity-"));
  let webhookAttempts = 0;
  let failuresRemaining = 2;
  const webhookSender = async () => {
    webhookAttempts += 1;
    if (failuresRemaining > 0) {
      failuresRemaining -= 1;
      throw new Error("Échec local simulé");
    }
    return { status: 204 };
  };
  let server = createAtlasServer({ host: "127.0.0.1", port: 9092, dataRoot, webhookSender });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let base = `http://127.0.0.1:${server.address().port}`;
  let cookie = "";

  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(dataRoot, { recursive: true, force: true });
  });

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

  let result = await request("/api/setup", { method: "POST", body: { displayName: "Administrateur QA", username: "productivity-admin", password: "correct-horse-battery-productivity" } });
  assert.equal(result.response.status, 201);
  result = await request("/api/login", { method: "POST", body: { username: "productivity-admin", password: "correct-horse-battery-productivity" } });
  const adminSecret = result.payload.secret;
  result = await request("/api/mfa/confirm", { method: "POST", body: { pendingToken: result.payload.pendingToken, code: totp(adminSecret) } });
  assert.equal(result.response.status, 200);
  const csrf = result.payload.csrf;

  const until = new Date(Date.now() + 7 * 86400000).toISOString();
  const preferences = {
    visibleModules: ["configurations", "documents"],
    favoriteAssetRefs: ["configuration:cfg-nsa-dc01"],
    dashboardWidgets: ["priorities", "metrics", "quick-access"],
    savedViews: [{ id: "view-review-qa", name: "À réviser", page: "configurations", moduleId: "", organizationId: "org-northstar", status: "review", search: "serveur" }],
    snoozedActions: [{ key: "configuration:cfg-nsa-dc01", until }],
    importProfiles: [{ id: "profile-config-qa", name: "Configurations QA", target: "configurations", mapping: { name: "Name", type: "Type" } }],
  };
  result = await request("/api/me/preferences", { method: "PUT", csrf, body: preferences });
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.payload.user.preferences, preferences);

  await new Promise((resolve) => server.close(resolve));
  server = createAtlasServer({ host: "127.0.0.1", port: 9092, dataRoot, webhookSender });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  result = await request("/api/me");
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.payload.user.preferences, preferences);

  result = await request("/api/settings/local-api", { method: "PUT", csrf, body: { enabled: false, webhooksEnabled: true, adminMfaCode: totp(adminSecret) } });
  assert.equal(result.response.status, 200);
  result = await request("/api/settings/local-api/webhooks", { method: "POST", csrf, body: { label: "Retry QA", url: "http://127.0.0.1:9199/atlas-events", events: ["workspace.updated"], adminMfaCode: totp(adminSecret) } });
  assert.equal(result.response.status, 201);
  const webhookId = result.payload.item.id;

  result = await request("/api/workspace");
  const configuration = result.payload.data.configurations[0];
  const ref = `configuration:${configuration.id}`;
  result = await request("/api/workspace/changeset", {
    method: "POST",
    csrf,
    body: {
      operations: [{ collection: "configurations", id: configuration.id, expectedVersion: result.payload.entityVersions[ref], value: { ...configuration, owner: "Équipe QA" } }],
      action: "bulk-owner",
      activity: { action: "Action en lot", target: "1 fiche · owner", kind: "bulk", organizationId: configuration.organizationId },
    },
  });
  assert.equal(result.response.status, 200);

  const deadline = Date.now() + 4000;
  let webhook;
  do {
    await new Promise((resolve) => setTimeout(resolve, 100));
    result = await request("/api/settings/local-api");
    webhook = result.payload.webhooks.find((item) => item.id === webhookId);
  } while ((!webhook || webhook.deliveryCount < 3) && Date.now() < deadline);

  assert.equal(webhookAttempts, 3);
  assert.equal(webhook.deliveryCount, 3);
  assert.equal(webhook.lastStatus, 204);
  assert.equal(webhook.consecutiveFailures, 0);
  assert.ok(webhook.lastSuccessAt);
});
