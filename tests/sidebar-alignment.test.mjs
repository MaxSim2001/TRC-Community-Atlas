import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const stylesheetUrl = new URL("../public/assets/styles.css", import.meta.url);
const applicationUrl = new URL("../public/assets/app.js", import.meta.url);

test("centered UI tokens keep their layout against text selectors", async () => {
  const [css, app] = await Promise.all([
    readFile(stylesheetUrl, "utf8"),
    readFile(applicationUrl, "utf8"),
  ]);

  assert.match(css, /\.instance-initial\s*\{[^}]*display:\s*grid;[^}]*place-items:\s*center;[^}]*line-height:\s*1;/s);
  assert.match(css, /\.avatar\s*\{[^}]*display:\s*grid;[^}]*place-items:\s*center;[^}]*line-height:\s*1;/s);
  assert.match(css, /\.instance-card\s*>\s*div\s+strong,\s*\.instance-card\s*>\s*div\s+span\s*\{\s*display:\s*block;/);
  assert.doesNotMatch(css, /\.instance-card\s+strong,\s*\.instance-card\s+span\s*\{\s*display:\s*block;/);
  assert.doesNotMatch(app, /class="sidebar-user"/);
  assert.match(app, /function profileMenuMarkup\(\)/);
  assert.match(app, /data-action="toggle-profile-menu"/);
  assert.match(app, /role="menuitem" data-action="logout"/);
  assert.match(css, /\.profile-menu-popover\s*\{[^}]*position:\s*absolute;[^}]*right:\s*0;/s);
  assert.match(css, /\.metric-icon\s*\{[^}]*display:\s*grid;[^}]*place-items:\s*center;[^}]*line-height:\s*1;/s);
  assert.match(css, /\.metric-card\s*>\s*div\s+strong,\s*\.metric-card\s*>\s*div\s+span,\s*\.metric-card\s*>\s*div\s+small\s*\{\s*display:\s*block;/);
  assert.doesNotMatch(css, /\.metric-card\s+strong,\s*\.metric-card\s+span,\s*\.metric-card\s+small\s*\{\s*display:\s*block;/);
  assert.match(css, /\.timeline-row\s*>\s*div\s+strong,\s*\.timeline-row\s*>\s*div\s+span,\s*\.timeline-row\s*>\s*div\s+small\s*\{\s*display:\s*block;/);
  assert.doesNotMatch(css, /\.timeline-row\s+strong,\s*\.timeline-row\s+span,\s*\.timeline-row\s+small\s*\{\s*display:\s*block;/);
  assert.match(css, /\.priority-dialog-summary\s*>\s*div\s*>\s*strong,\s*\.priority-dialog-summary\s*>\s*div\s*>\s*span\s*\{\s*display:\s*block;/);
  assert.doesNotMatch(css, /\.priority-dialog-summary\s+strong,\s*\.priority-dialog-summary\s+span\s*\{\s*display:\s*block;/);
  assert.doesNotMatch(css, /\.priority-dialog-summary\s+span\s*\{[^}]*margin-top:/s);
});
