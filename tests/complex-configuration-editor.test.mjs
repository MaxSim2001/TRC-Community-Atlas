import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/assets/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/assets/styles.css", import.meta.url), "utf8");

test("complex configurations keep structured infrastructure details and a parent relation", () => {
  assert.match(app, /function renderConfigurationRecordEditor\s*\(/);
  assert.match(app, /name="parentConfigurationId"/);
  assert.match(app, /name="networkInterfaces"/);
  assert.match(app, /name="operationalDependencies"/);
  assert.match(app, /name="customAttributes"/);
  assert.match(app, /function syncConfigurationParentRelation\s*\(/);
  assert.match(app, /autoConfigurationParent: true/);
  assert.match(app, /relation\.relationType === type\.id/);
  assert.match(app, /syncConfigurationParentRelation\(workspace, item, item\.details\.parentConfigurationId\)/);
  assert.match(app, /Configuration parente/);
  assert.match(app, /asset-structured-text/);
  assert.match(css, /\.asset-structured-text\s*\{/);
  assert.match(css, /\.inline-asset-link\s*\{/);
});
