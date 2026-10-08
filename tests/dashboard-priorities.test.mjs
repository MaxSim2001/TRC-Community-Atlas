import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appUrl = new URL("../public/assets/app.js", import.meta.url);
const stylesUrl = new URL("../public/assets/styles.css", import.meta.url);

test("dashboard priorities use explicit facts instead of an arbitrary coverage score", async () => {
  const [app, css] = await Promise.all([
    readFile(appUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);

  assert.doesNotMatch(app, /COUVERTURE DOCUMENTAIRE|DOCUMENTATION COVERAGE|const coverage\s*=/);
  assert.match(app, /function\s+dashboardPriorities\s*\(/);
  assert.match(app, /function\s+isTestOrganization\s*\(/);
  assert.match(app, /dashboardIncludeTests/);
  assert.match(app, /Sans responsable/);
  assert.match(app, /Jamais révisées/);
  assert.match(app, /Échéances/);
  assert.match(app, /Liens à vérifier/);
  assert.match(app, /À revoir \/ brouillons/);
  assert.match(app, /data-action="open-priorities"/);
  assert.match(app, /data-action="toggle-dashboard-tests"/);
  assert.match(app, /Aucune note arbitraire/);
  assert.match(css, /\.priority-hero\s*\{/);
  assert.match(css, /\.priority-grid\s*\{/);
  assert.match(css, /\.priority-card\s*\{[^}]*min-height:\s*104px/s);
  assert.match(css, /\.priority-modal-shell\s*\{/);
});
