import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("shared visual components keep readable type and centered identity marks", async () => {
  const css = await readFile(new URL("../public/assets/styles.css", import.meta.url), "utf8");

  assert.match(css, /\.sidebar-logo\s*\{[^}]*width:\s*38px;[^}]*height:\s*38px/s);
  assert.match(css, /\.sidebar-brand\s*\{[^}]*align-items:\s*center/s);
  assert.match(css, /\.modal-heading h2\s*\{[^}]*font-size:\s*23px/s);
  assert.match(css, /\.priority-dialog-list strong\s*\{[^}]*font-size:\s*13px/s);
  assert.match(css, /\.priority-dialog-list small\s*\{[^}]*font-size:\s*10\.5px/s);
  assert.match(css, /\.table-primary strong, \.table-link strong\s*\{[^}]*font-size:\s*12\.5px/s);
  assert.match(css, /@media \(max-width:\s*1024px\)/);
  assert.match(css, /\.modal-backdrop\s*\{[^}]*padding:\s*10px/s);
});
