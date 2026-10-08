import test from "node:test";
import assert from "node:assert/strict";
import { isPublicProbeAddress, normalizeAtlasDomain, normalizedDeploymentSettings } from "../server.mjs";

test("deployment domains are normalized without accepting URLs, ports or local addresses", () => {
  assert.equal(normalizeAtlasDomain("Atlas.ABCP.com."), "atlas.abcp.com");
  assert.equal(normalizeAtlasDomain("https://atlas.abcp.com"), null);
  assert.equal(normalizeAtlasDomain("atlas.abcp.com:443"), null);
  assert.equal(normalizeAtlasDomain("localhost"), null);
  assert.equal(normalizeAtlasDomain("127.0.0.1"), null);

  assert.deepEqual(normalizedDeploymentSettings({ deployment: {
    instanceCode: "abc",
    primaryDomain: "Atlas.ABCP.com",
    domainAliases: ["Documentation.ABCP.com", "atlas.abcp.com", "documentation.abcp.com"],
    accessMode: "reverse-proxy",
    reverseProxy: "nginx",
  } }), {
    instanceCode: "ABC",
    primaryDomain: "atlas.abcp.com",
    domainAliases: ["documentation.abcp.com"],
    accessMode: "reverse-proxy",
    reverseProxy: "nginx",
    certificateManagement: "reverse-proxy",
  });
});

test("the public probe refuses private and reserved destinations", () => {
  for (const address of ["127.0.0.1", "10.0.0.2", "172.16.0.1", "192.168.50.12", "169.254.1.2", "100.64.0.1", "::1", "fd00::1", "fe80::1", "2001:db8::1"]) {
    assert.equal(isPublicProbeAddress(address), false, address);
  }
  assert.equal(isPublicProbeAddress("8.8.8.8"), true);
  assert.equal(isPublicProbeAddress("2606:4700:4700::1111"), true);
});

test("the UI exposes dedicated protected setup and health pages", async () => {
  const { readFile } = await import("node:fs/promises");
  const app = await readFile(new URL("../public/assets/app.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../public/assets/styles.css", import.meta.url), "utf8");
  const help = await readFile(new URL("../public/assets/help-content.js", import.meta.url), "utf8");
  assert.match(app, /Configuration initiale/);
  assert.match(app, /route: "settings\/deployment"/);
  assert.match(app, /route: "settings\/health"/);
  assert.match(app, /data-form="settings-deployment"/);
  assert.match(app, /data-form="settings-security"/);
  assert.match(app, /name="instanceCode"/);
  assert.match(app, /name="primaryDomain"/);
  assert.match(app, /name="adminMfaCode"/);
  assert.match(app, /Code MFA actuel/);
  assert.match(app, /Seul le super administrateur Atlas/);
  assert.doesNotMatch(app, /data-scroll-target="settings-/);
  assert.match(app, /sidebar-system-link[\s\S]*?<strong>Paramètres<\/strong><small>Administration Atlas<\/small>/);
  assert.doesNotMatch(app, /<strong>Configuration de l’instance<\/strong>/);
  assert.doesNotMatch(app, /class="nav-item[^\n]+data-route="accounts"/);
  assert.match(app, /data-action="probe-public-site"/);
  assert.match(app, /Atlas ne modifie jamais le DNS/);
  assert.match(css, /\.deployment-health-grid/);
  assert.match(css, /\.settings-sensitive-confirmation/);
  assert.match(css, /\.settings-overview-grid/);
  assert.match(app, /settings-overview-section/);
  assert.match(app, /settings-overview-grid admin/);
  assert.match(app, /settings-overview-grid preferences/);
  assert.match(css, /\.settings-layout \{ display: block; \}/);
  assert.match(css, /\.settings-content \{ display: grid; grid-template-columns: minmax\(0, 1fr\); align-items: start;/);
  assert.match(css, /\.settings-admin-note \{ grid-column: 1 \/ -1;/);
  assert.doesNotMatch(css, /\.settings-layout \{[^}]*grid-template-columns: 190px/);
  assert.match(css, /\.sidebar-system-link/);
  assert.match(help, /initial-deployment/);
});
