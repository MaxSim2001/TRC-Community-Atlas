import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("every organization exposes isolated Quick Notes that are empty by default", async () => {
  const [app, css] = await Promise.all([
    readFile(new URL("../public/assets/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/assets/styles.css", import.meta.url), "utf8"),
  ]);

  assert.match(app, /organization\.quickNotes\s*=\s*String\(organization\.quickNotes\s*\|\|\s*""\)/);
  assert.match(app, /organization-quick-notes-panel/);
  assert.match(app, /Aucune Quick Note/);
  assert.match(app, /data-action="edit-quick-notes"/);
  assert.match(app, /data-form="quick-notes"/);
  assert.match(app, /name="quickNotes"[^>]*maxlength="8000"/);
  assert.match(app, /renderDocumentMarkdown\(organization\.quickNotes\)/);
  assert.match(app, /quickNotes:\s*existing\?\.quickNotes\s*\|\|\s*""/);
  assert.match(app, /item\.quickNotes\s*=\s*quickNotes/);
  assert.match(app, /"organization-quick-notes"/);
  assert.match(css, /\.organization-quick-notes-panel\s*\{/);
  assert.match(css, /\.quick-notes-editor\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*\.quick-notes-editor\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});
