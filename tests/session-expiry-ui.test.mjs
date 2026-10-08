import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("the browser locks and clears local session data at the eight-hour deadline", async () => {
  const app = await readFile(new URL("../public/assets/app.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../public/assets/styles.css", import.meta.url), "utf8");

  assert.match(app, /function scheduleSessionExpiry\(value\)/);
  assert.match(app, /window\.setTimeout\(\(\) => \{/);
  assert.match(app, /resetClientSession\("Votre session a expiré après 8 heures/);
  assert.match(app, /state\.workspace = null/);
  assert.match(app, /state\.vaultItems = \[\]/);
  assert.match(app, /payload\.error === "authentication_required"/);
  assert.match(app, /expiration automatique après 8 heures/);
  assert.match(styles, /\.auth-notice/);
});
