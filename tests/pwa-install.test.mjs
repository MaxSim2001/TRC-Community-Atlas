import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

test("Atlas exposes a complete standalone mobile application manifest", async () => {
  const [index, manifestText, icon192, icon512] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    stat(new URL("../public/assets/trc-atlas-icon-192.png", import.meta.url)),
    stat(new URL("../public/assets/trc-atlas-icon-512.png", import.meta.url)),
  ]);
  const manifest = JSON.parse(manifestText);

  assert.match(index, /rel="manifest" href="\/manifest\.webmanifest\?v=0\.14\.3-update-1"/);
  assert.match(index, /name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(index, /id="pwa-install-root"/);
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.start_url, "/");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192" && icon.type === "image/png"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512" && icon.type === "image/png"));
  assert.ok(icon192.size > 1000);
  assert.ok(icon512.size > icon192.size);
});

test("the service worker caches only the shell and explicitly bypasses every API route", async () => {
  const [worker, server] = await Promise.all([
    readFile(new URL("../public/service-worker.js", import.meta.url), "utf8"),
    readFile(new URL("../server.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(worker, /trc-atlas-shell-0\.14\.3/);
  assert.match(worker, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(worker, /if \(request\.method !== "GET"\) return/);
  assert.doesNotMatch(worker, /\/api\/(?:status|me|workspace|vault)/);
  assert.match(server, /\["\/manifest\.webmanifest", \["manifest\.webmanifest", "application\/manifest\+json; charset=utf-8"\]\]/);
  assert.match(server, /\["\/service-worker\.js", \["service-worker\.js", "text\/javascript; charset=utf-8"\]\]/);
});

test("the install banner is mobile-only and is always hidden in installed mode", async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL("../public/assets/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/assets/styles.css", import.meta.url), "utf8"),
  ]);

  assert.match(app, /beforeinstallprompt/);
  assert.match(app, /appinstalled/);
  assert.match(app, /window\.navigator\.standalone === true/);
  assert.match(app, /\(display-mode: standalone\)/);
  assert.match(app, /browserNavigator\.serviceWorker\.register\("\/service-worker\.js"/);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*\.pwa-install-banner/);
  assert.match(styles, /@media \(display-mode: standalone\)[\s\S]*#pwa-install-root, \.pwa-install-banner \{ display: none !important; \}/);
});
