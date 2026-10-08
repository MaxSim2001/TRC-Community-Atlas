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

  assert.match(wrapper, /Install-TRCCommunityAtlas\.ps1/);
  assert.match(wrapper, /-OpenBrowser/);
  assert.match(installer, /Programs\\TRC Community Atlas/);
  assert.match(installer, /TRC Community Atlas\\data/);
  assert.match(installer, /--data/);
  assert.match(installer, /New-ScheduledTaskSettingsSet[\s\S]*-Hidden/);
  assert.match(installer, /LogonType S4U/);
  assert.doesNotMatch(installer, /192\.168\.50\.|Administrateur\.AD-01/);
  assert.doesNotMatch(installer, /New-NetFirewallRule|Set-DnsClient|netsh/);
});

test("the portable package includes a runtime, a hash and a real port 9095 deployment test", () => {
  const builder = source("scripts/New-TRCCommunityAtlasPortablePackage.ps1");
  const deploymentTest = source("scripts/Test-TRCCommunityAtlasDeployment.ps1");
  const workflow = source(".github/workflows/tests.yml");

  assert.match(builder, /runtimeDirectory/);
  assert.match(builder, /'node\.exe'/);
  assert.match(builder, /SHA256SUMS\.txt/);
  assert.match(builder, /Compress-Archive/);
  assert.match(deploymentTest, /\[int\]\$Port = 9095/);
  assert.match(deploymentTest, /api\/status/);
  assert.match(deploymentTest, /Result = 'PASS'/);
  assert.match(workflow, /Test-TRCCommunityAtlasDeployment\.ps1/);
  assert.match(workflow, /-Port 9095/);
  assert.match(workflow, /actions\/upload-artifact@v7/);
});
