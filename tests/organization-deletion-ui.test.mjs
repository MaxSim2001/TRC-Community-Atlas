import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appPath = new URL("../public/assets/app.js", import.meta.url);
const stylesPath = new URL("../public/assets/styles.css", import.meta.url);

test("organization deletion is administrator-only and requires exact-name plus MFA confirmation", async () => {
  const [app, styles] = await Promise.all([
    readFile(appPath, "utf8"),
    readFile(stylesPath, "utf8"),
  ]);

  assert.match(app, /data-action="delete-organization"/);
  assert.match(app, /administratorActions = new Set\(\["delete-organization",/);
  assert.match(app, /data-form="delete-organization"/);
  assert.match(app, /Tapez le nom exact de l’organisation/);
  assert.match(app, /Code MFA actuel/);
  assert.match(app, /api\/organizations\/\$\{encodeURIComponent\(organization\.id\)\}/);
  assert.match(app, /method: "DELETE"/);
  assert.match(styles, /\.primary\.danger/);
  assert.match(styles, /\.destructive-warning/);
});

