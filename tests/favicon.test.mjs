import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("le logo Atlas officiel est declare comme favicon versionne", async () => {
  const [index, server, logo] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../server.mjs", import.meta.url), "utf8"),
    readFile(new URL("../public/assets/trc-atlas-layers-logo.svg", import.meta.url), "utf8"),
  ]);

  assert.match(index, /rel="icon" type="image\/svg\+xml" sizes="any" href="\/favicon\.svg\?v=0\.12\.8-atlas-1"/);
  assert.match(index, /rel="shortcut icon" type="image\/svg\+xml" href="\/favicon\.svg\?v=0\.12\.8-atlas-1"/);
  assert.match(index, /rel="apple-touch-icon" sizes="192x192" href="\/assets\/trc-atlas-icon-192\.png\?v=0\.12\.8-atlas-1"/);
  assert.match(server, /\["\/favicon\.svg", \["assets\/trc-atlas-layers-logo\.svg", "image\/svg\+xml"\]\]/);
  assert.match(logo, /<title id="title">TRC Atlas layered knowledge logo<\/title>/);
});
