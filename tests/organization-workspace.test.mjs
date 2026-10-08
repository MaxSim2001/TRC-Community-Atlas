import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appUrl = new URL("../public/assets/app.js", import.meta.url);
const stylesUrl = new URL("../public/assets/styles.css", import.meta.url);

test("organization home is a compact scoped workspace", async () => {
  const [app, css] = await Promise.all([readFile(appUrl, "utf8"), readFile(stylesUrl, "utf8")]);

  assert.match(app, /function\s+renderOrganizationDetail\s*\(id\)/);
  assert.match(app, /organization-workspace-hero/);
  assert.match(app, /organization-workspace-search/);
  assert.match(app, /organization-kpi-grid/);
  assert.match(app, /organization-module-grid/);
  assert.match(app, /organization-recent-panel/);
  assert.match(app, /organization-service-card/);
  assert.match(app, /data-organization-search/);
  assert.match(app, /data-action="edit-organization"/);
  assert.match(app, /data-action="delete-organization"/);
  assert.match(app, /state\.workspace\.sites\.filter\(\(item\)\s*=>\s*item\.organizationId\s*===\s*id\)/);
  assert.match(app, /state\.workspace\.configurations\.filter\(\(item\)\s*=>\s*item\.organizationId\s*===\s*id\)/);
  assert.match(app, /state\.workspace\.moduleRecords\.filter\(\(item\)\s*=>\s*item\.organizationId\s*===\s*id\)/);
  assert.match(app, /state\.vaultItems\.filter\(\(item\)\s*=>\s*item\.organizationId\s*===\s*id/);
  assert.match(app, /data-filter-org="\$\{id\}"/);

  assert.match(css, /\.organization-workspace-hero\s*\{/);
  assert.match(css, /\.organization-workspace-search\s*\{/);
  assert.match(css, /\.organization-kpi-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,/);
  assert.match(css, /\.organization-workspace-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.55fr\)\s+minmax\(285px,\s*\.72fr\)/);
  assert.match(css, /@media\s*\(max-width:\s*680px\)[\s\S]*?\.organization-kpi-grid,\s*\.organization-module-grid,\s*\.organization-workspace-aside\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});
