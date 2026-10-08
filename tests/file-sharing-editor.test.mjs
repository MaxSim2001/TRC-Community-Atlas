import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/assets/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/assets/styles.css", import.meta.url), "utf8");

test("File Sharing uses a dedicated full-page editor in the active organization", () => {
  assert.match(app, /const FILE_SHARING_MODULE_ID = "service-file-sharing"/);
  assert.match(app, /function renderModuleRecordEditorPage\s*\(/);
  assert.match(app, /state\.page === "record"/);
  assert.match(app, /data-form="module-record"[^>]+data-module-id="\$\{module\.id\}"/);
  assert.match(app, /type="hidden" name="organizationId"/);
  assert.match(app, /Nom du partage/);
  assert.match(app, /Description du partage/);
  assert.match(app, /Lecteur mappé/);
  assert.match(app, /Chemin du partage/);
  assert.match(app, /Chemin sur le disque/);
  assert.match(app, /Groupes ou utilisateurs autorisés sur le partage/);
  assert.match(css, /\.record-editor-page/);
  assert.match(css, /\.record-editor-fields/);
});

test("File Sharing server picker creates controlled bidirectional relations", () => {
  assert.match(app, /data-file-sharing-server-search/);
  assert.match(app, /name="serverConfigurationIds"/);
  assert.match(app, /function syncFileSharingServerRelations\s*\(/);
  assert.match(app, /relationType: type\.id/);
  assert.match(app, /autoFileSharingServer: true/);
  assert.match(app, /Serveur lié au partage/);
  assert.match(app, /configuration\.organizationId === data\.organizationId/);
});

test("all Atlas modules open their create flow as a full-page record editor", () => {
  assert.match(app, /function renderGenericModuleRecordEditor\s*\(/);
  assert.match(app, /function renderConfigurationRecordEditor\s*\(/);
  assert.match(app, /function renderSiteRecordEditor\s*\(/);
  assert.match(app, /function renderVaultRecordEditor\s*\(/);
  assert.match(app, /navigate\(`record\/\$\{encodeURIComponent\(actionTarget\.dataset\.moduleId\)\}`\)/);
  assert.match(app, /navigate\("record\/configurations"\)/);
  assert.match(app, /navigate\("record\/locations"\)/);
  assert.match(app, /navigate\("record\/passwords"\)/);
  assert.match(app, /record-editor-section/);
  assert.match(app, /record-editor-actions/);
  assert.doesNotMatch(app, /if \(actionTarget\.dataset\.moduleId === FILE_SHARING_MODULE_ID\)/);
});
