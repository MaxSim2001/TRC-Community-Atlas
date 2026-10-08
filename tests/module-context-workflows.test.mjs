import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("module creation is scoped to the active organization and uses business profiles", async () => {
  const [app, css] = await Promise.all([
    readFile(new URL("../public/assets/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/assets/styles.css", import.meta.url), "utf8"),
  ]);

  assert.match(app, /function\s+activeOrganizationId\s*\(/);
  assert.match(app, /function\s+creationOrganizationId\s*\(/);
  assert.match(app, /function\s+organizationContextField\s*\(/);
  assert.match(app, /type="hidden" name="organizationId"/);
  assert.doesNotMatch(app, /<select name="organizationId"/);
  assert.doesNotMatch(app, /function\s+organizationOptions\s*\(/);
  assert.match(app, /if \(action === "new-module-record"\) \{[\s\S]*?if \(!creationOrganizationId\("ajouter une fiche"\)\) return;/);
  assert.match(app, /if \(action === "new-vault-item"\) \{ if \(!creationOrganizationId\("ajouter un mot de passe"\)\) return;/);
  assert.match(app, /siteOptions\(item\?\.siteId, organizationId\)/);

  assert.match(app, /"domain-tracker": "domain"/);
  assert.match(app, /titleLabel: "Nom de domaine"/);
  assert.match(app, /key: "dnsProvider"/);
  assert.match(app, /key: "nameservers"/);
  assert.match(app, /key: "autoRenew"/);
  assert.match(app, /titleLabel: "Nom commun ou certificat"/);
  assert.match(app, /key: "validationMethod"/);
  assert.match(app, /const details = \{ \.\.\.\(existing\?\.details \|\| \{\}\) \}/);
  assert.match(app, /\.\.\.Object\.values\(item\.details \|\| \{\}\)/);
  assert.match(app, /moduleRenewalMetrics\(records, profile\)/);
  assert.match(css, /\.form-organization-context\s*\{/);
  assert.match(css, /\.status-badge\.danger\s*\{/);
  assert.match(css, /html\s*\{[^}]*overflow-x:\s*hidden/s);
  assert.match(css, /body\s*\{[^}]*overflow-x:\s*hidden/s);
});
