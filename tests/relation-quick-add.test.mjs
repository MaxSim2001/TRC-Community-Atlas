import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("related items always expose the expanded inline universal search", async () => {
  const [app, css] = await Promise.all([
    readFile(new URL("../public/assets/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/assets/styles.css", import.meta.url), "utf8"),
  ]);

  assert.match(app, /function\s+quickRelationPickerMarkup\s*\(/);
  assert.match(app, /function\s+quickRelationResultsMarkup\s*\(/);
  assert.match(app, /function\s+createQuickRelation\s*\(/);
  assert.match(app, /assetRegistry\(source\.organizationId\)\.filter\(\(asset\) => asset\.ref !== sourceRef\)/);
  assert.match(app, /data-relation-quick-search/);
  assert.match(app, /const quickRelationControl = canWrite\(\) \? quickRelationPickerMarkup\(asset\) : "";/);
  assert.match(app, /data-action="clear-relation-quick-search"/);
  assert.match(app, /data-action="quick-relate-item"/);
  assert.match(app, /data-relation-quick-type/);
  assert.match(app, /state\.relationQuickType = "related-to"/);
  assert.match(app, /recordRelationshipEvent\(workspace, item, "Relation ajoutée"\)/);
  assert.match(app, /if \(action === "add-related-item"\) \{[\s\S]*?state\.relationQuickAddRef = sourceRef;/);
  assert.doesNotMatch(app, /if \(action === "add-related-item"\)\s+showModal\("relation"/);
  assert.doesNotMatch(app, /relation-quick-trigger/);
  assert.doesNotMatch(app, /data-action="close-relation-quick-add"/);
  assert.doesNotMatch(css, /\.relation-quick-trigger/);
  assert.match(css, /\.relation-quick-toolbar\s*\{[^}]*grid-template-columns:/s);
  assert.match(css, /\.relation-quick-results\s*\{[^}]*max-height:\s*310px/s);
  assert.match(css, /\.relation-quick-result-icon\s*\{[^}]*place-items:\s*center/s);
});
