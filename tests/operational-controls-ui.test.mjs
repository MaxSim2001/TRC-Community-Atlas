import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("asset pages expose durable revisions, interactive checklists and reversible archiving", async () => {
  const [app, styles] = await Promise.all([
    readFile(path.join(root, "public", "assets", "app.js"), "utf8"),
    readFile(path.join(root, "public", "assets", "styles.css"), "utf8"),
  ]);
  assert.match(app, /loadAssetHistory/);
  assert.match(app, /api\/assets\/\$\{encodeURIComponent\(ref\)\}\/history/);
  assert.match(app, /data-action="toggle-checklist-step"/);
  assert.match(app, /checklist-progress/);
  assert.match(app, /data-action="toggle-asset-archive"/);
  assert.match(app, /previousStatus/);
  assert.match(app, /await loadWorkspaceHistory\(\)/);
  assert.match(app, /200 dernières modifications/);
  assert.match(styles, /\.interactive-checklist/);
  assert.match(styles, /\.timeline-dot\.revision/);
});

test("local account management separates documentation, organization and vault access", async () => {
  const [app, server, styles] = await Promise.all([
    readFile(path.join(root, "public", "assets", "app.js"), "utf8"),
    readFile(path.join(root, "server.mjs"), "utf8"),
    readFile(path.join(root, "public", "assets", "styles.css"), "utf8"),
  ]);
  assert.match(app, /Comptes et accès/);
  assert.match(app, /Accès par compagnie/);
  assert.match(app, /organizationPermissions/);
  assert.match(app, /orgRole_/);
  assert.match(app, /data-all-organizations/);
  assert.match(app, /data-organization-access-filter/);
  assert.match(app, /data-organization-custom/);
  assert.match(app, /organization-permission-identity/);
  assert.match(app, /data-vault-access/);
  assert.match(app, /user-password-reset/);
  assert.match(app, /revoke-user-sessions/);
  assert.match(app, /MFA TOTP obligatoire/);
  assert.match(server, /filterWorkspaceForUser/);
  assert.match(server, /mergeRestrictedWorkspace/);
  assert.match(server, /organization_access_required/);
  assert.match(server, /canWriteOrganization/);
  assert.match(server, /vault_access_required/);
  assert.match(server, /reset-password/);
  assert.match(server, /revoke-sessions/);
  assert.match(server, /last_administrator_required/);
  assert.match(styles, /\.account-metrics/);
  assert.match(styles, /\.permission-profile-grid/);
  assert.match(styles, /\.account-actions-menu/);
  assert.match(styles, /\.modal\.account-access-modal/);
  assert.match(styles, /\.organization-permission-search/);
});

test("organization profile fields clearly distinguish the company from its contacts", async () => {
  const [app, styles] = await Promise.all([
    readFile(path.join(root, "public", "assets", "app.js"), "utf8"),
    readFile(path.join(root, "public", "assets", "styles.css"), "utf8"),
  ]);
  assert.match(app, /Nom de la compagnie ou de l’organisation/);
  assert.match(app, /Secteur d’activité/);
  assert.match(app, /Activité de la compagnie, pas sa ville ou sa région/);
  assert.match(app, /Responsable technique principal/);
  assert.match(app, /Gestionnaire de la relation client/);
  assert.match(styles, /\.modal\.organization-profile-modal/);
  assert.match(styles, /\.optional-label/);
});
