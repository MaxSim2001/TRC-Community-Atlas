import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

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

test("release documentation covers the 0.17.0 workflows", async () => {
  const [readme, notes, guide, help] = await Promise.all([
    readFile(path.join(root, "README.md"), "utf8"),
    readFile(path.join(root, "docs", "RELEASE_NOTES.md"), "utf8"),
    readFile(path.join(root, "docs", "USER_GUIDE.md"), "utf8"),
    readFile(path.join(root, "public", "assets", "help-content.js"), "utf8"),
  ]);
  assert.match(readme, /Current version: \*\*0\.17\.0\*\*/);
  assert.match(notes, /0\.17\.0 — Personal productivity and client reporting/);
  assert.match(guide, /Personal workspace and action center/);
  assert.match(help, /Version 0\.17\.0/);
});
