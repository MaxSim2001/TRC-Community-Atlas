import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/assets/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/assets/styles.css", import.meta.url), "utf8");

test("Printing exposes a dedicated compact register and full-page business editor", () => {
  assert.match(app, /const PRINTING_MODULE_ID = "service-printing"/);
  assert.match(app, /function renderPrintingModulePage\s*\(/);
  assert.match(app, /function renderPrintingRecordEditor\s*\(/);
  assert.match(app, /Filtrer les colonnes ou rechercher/);
  assert.match(app, /Inclure les archivées/);
  assert.match(app, /Serveur\(s\) d’impression/);
  assert.match(app, /Configuration\(s\) d’imprimante/);
  assert.match(app, /Publié dans Active Directory/);
  assert.match(app, /Chemin des pilotes/);
  assert.match(app, /Informations de soutien/);
  assert.match(app, /data-action="export-printing"/);
  assert.match(css, /\.printing-table table/);
  assert.match(css, /\.printing-documentation-section \.document-editor-canvas/);
});

test("Printing configuration links stay organization-scoped and bidirectional", () => {
  assert.match(app, /"printServerConfigurationIds"/);
  assert.match(app, /"printerConfigurationIds"/);
  assert.match(app, /function syncPrintingConfigurationRelations\s*\(/);
  assert.match(app, /autoPrintingRole: role\.id/);
  assert.match(app, /configuration\.organizationId === data\.organizationId/);
  assert.match(app, /syncPrintingConfigurationRelations\(workspace, item, printServerConfigurationIds, printerConfigurationIds\)/);
});

test("Printing switches to readable cards on small screens", () => {
  assert.match(css, /\.printing-table thead \{ display: none; \}/);
  assert.match(css, /content: attr\(data-label\)/);
  assert.match(css, /\.printing-table td \{[^}]*display: grid/s);
});

