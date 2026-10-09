import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appUrl = new URL("../public/assets/app.js", import.meta.url);
const stylesUrl = new URL("../public/assets/styles.css", import.meta.url);
const serverUrl = new URL("../server.mjs", import.meta.url);

test("universal bidirectional relationships and full-page records remain wired", async () => {
  const [app, css, server] = await Promise.all([
    readFile(appUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
    readFile(serverUrl, "utf8"),
  ]);

  assert.match(app, /const relationshipTypes = \[/);
  assert.match(app, /function\s+assetRegistry\s*\(/);
  assert.match(app, /function\s+renderAssetPage\s*\(/);
  assert.match(app, /state\.page\s*===\s*"asset"/);
  assert.match(app, /navigate\(`asset\/\$\{encodeURIComponent\(ref\)\}`\)/);
  assert.doesNotMatch(app, /function\s+assetDrawerMarkup\s*\(/);
  assert.doesNotMatch(app, /function\s+relatedItemsPanel\s*\(/);
  assert.doesNotMatch(app, /kind\s*===\s*"vault-details"/);
  assert.match(app, /function\s+impactForAsset\s*\(/);
  assert.match(app, /function\s+syncMentionRelations\s*\(/);
  assert.match(app, /relationshipEvents/);
  assert.match(app, /data-action="add-related-item"/);
  assert.match(app, /data-relation-quick-search/);
  assert.match(app, /data-action="quick-relate-item"/);
  assert.match(app, /data-relate-input/);
  assert.match(app, /data-impact-ref/);
  assert.match(app, /Coffre chiffré \+ MFA/);
  assert.match(app, /data-action="toggle-vault-field"/);
  assert.match(app, /visibleVaultFields/);
  assert.match(app, /function\s+attachmentCardMarkup\s*\(/);
  assert.match(app, /data-attachment-input/);
  assert.match(app, /data-action="download-attachment"/);
  assert.match(app, /\/api\/attachments/);
  assert.match(css, /\.asset-page-layout\s*\{[^}]*grid-template-columns:/s);
  assert.match(css, /\.asset-context-rail\s*\{/);
  assert.match(css, /\.asset-facts-grid\s*\{/);
  assert.match(css, /\.asset-secret-grid \.secret-masked\s*\{/);
  assert.match(css, /\.attachment-upload-control\s*\{/);
  assert.match(css, /\.attachment-list article\s*\{/);
  assert.match(css, /@media\s*\(max-width:\s*680px\)[\s\S]*?\.asset-page-main\s*\{/);
  assert.match(css, /\.mention-picker\s*\{/);
  assert.match(css, /\.impact-explorer\s*\{/);
  assert.match(server, /schemaVersion:\s*5/);
  assert.match(server, /ATLAS_VERSION = "0\.15\.2"/);
});
