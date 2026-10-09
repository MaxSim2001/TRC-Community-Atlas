import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("the Windows installer keeps program and instance data separate", () => {
  const wrapper = source("Install-Atlas.cmd");
  const installer = source("scripts/Install-TRCCommunityAtlas.ps1");
  const configurator = source("scripts/Configure-TRCCommunityAtlas.ps1");

  assert.match(wrapper, /Configure-TRCCommunityAtlas\.ps1/);
  assert.match(wrapper, /Install-TRCCommunityAtlas\.ps1/);
  assert.match(installer, /Programs\\TRC Community Atlas/);
  assert.match(installer, /TRC Community Atlas\\data/);
  assert.match(installer, /--data/);
  assert.match(installer, /--trusted-proxy/);
  assert.match(installer, /trustedProxies = @\(\$TrustedProxy\)/);
  assert.match(installer, /New-ScheduledTaskSettingsSet[\s\S]*-Hidden/);
  assert.match(installer, /LogonType S4U/);
  assert.match(installer, /TRC Community Atlas - \$\(\[int\]\$previousConfiguration\.port\)/);
  assert.doesNotMatch(installer, /192\.168\.50\.|Administrateur\.AD-01/);
  assert.doesNotMatch(installer, /New-NetFirewallRule|Set-DnsClient|netsh/);
  assert.match(configurator, /NumericUpDown/);
  assert.match(configurator, /Tester le port/);
  assert.match(configurator, /aucun serveur ni port de base de donnees/);
  assert.match(configurator, /AllowedOrigin = \$origins/);
  assert.match(configurator, /TrustedProxy = \$trustedProxies/);
  assert.match(configurator, /Proxys de confiance/);
});

test("the portable package includes a runtime, a hash and a real port 9095 deployment test", () => {
  const builder = source("scripts/New-TRCCommunityAtlasPortablePackage.ps1");
  const installer = source("scripts/Install-TRCCommunityAtlas.ps1");
  const deploymentTest = source("scripts/Test-TRCCommunityAtlasDeployment.ps1");
  const updateLifecycleTest = source("scripts/Test-AtlasSignedUpdateLifecycle.ps1");
  const releaseUpdater = source("scripts/Invoke-AtlasReleaseUpdate.ps1");
  const operations = source("lib/atlas-operations.mjs");
  const autostartManager = source("scripts/Set-TRCCommunityAtlasAutostart.ps1");
  const workflow = source(".github/workflows/tests.yml");

  assert.match(builder, /runtimeDirectory/);
  assert.match(builder, /'node\.exe'/);
  assert.match(builder, /SHA256SUMS\.txt/);
  assert.match(builder, /Compress-Archive/);
  assert.match(builder, /'resources'/);
  assert.match(installer, /'resources'/);
  assert.match(installer, /\[string\]\$TaskName = 'TRC Community Atlas'/);
  assert.match(deploymentTest, /\[int\]\$Port = 9095/);
  assert.match(deploymentTest, /\[int\]\$ReconfiguredPort = 9096/);
  assert.match(deploymentTest, /api\/status/);
  assert.match(deploymentTest, /Result = 'PASS'/);
  assert.match(deploymentTest, /DatabasePreserved = \$true/);
  assert.match(deploymentTest, /ConfiguratorReload = 'PASS'/);
  assert.match(deploymentTest, /Autostart = \$autostartResult/);
  assert.match(updateLifecycleTest, /SuccessfulUpdate = \$successState\.status/);
  assert.match(updateLifecycleTest, /Rollback = \$rollbackState\.status/);
  assert.match(updateLifecycleTest, /-SimulateHealthFailure/);
  assert.match(releaseUpdater, /\[string\]\$TrustedProxies = ''/);
  assert.match(releaseUpdater, /-TrustedProxy \$trustedProxyList/);
  assert.match(operations, /deployment\.trustedProxies/);
  assert.match(operations, /"-TrustedProxies"/);
  assert.match(autostartManager, /ValidateSet\('Status', 'Enable', 'Disable'\)/);
  assert.match(autostartManager, /TaskName = 'TRC Community Atlas'/);
  assert.match(autostartManager, /New-ScheduledTaskSettingsSet[\s\S]*-Hidden/);
  assert.match(autostartManager, /Disable-ScheduledTask/);
  assert.match(autostartManager, /--trusted-proxy/);
  assert.doesNotMatch(autostartManager, /New-NetFirewallRule|Set-NetFirewallProfile|netsh|Remove-ScheduledTask/);
  assert.match(workflow, /Test-TRCCommunityAtlasDeployment\.ps1/);
  assert.match(workflow, /-Port 9095/);
  assert.match(workflow, /-TestAutostart/);
  assert.match(workflow, /actions\/upload-artifact@v7/);
});
