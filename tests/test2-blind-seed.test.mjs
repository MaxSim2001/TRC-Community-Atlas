import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const seedScript = path.join(projectRoot, "scripts", "seed-test2-blind.mjs");

function runSeed(dataRoot) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [seedScript, "--data", dataRoot], { cwd: projectRoot, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

test("TEST2 blind seed creates realistic linked data, encrypts secrets and refuses duplicates", async (context) => {
  const dataRoot = await mkdtemp(path.join(tmpdir(), "trc-atlas-test2-"));
  context.after(() => rm(dataRoot, { recursive: true, force: true }));
  const original = {
    revision: 12,
    data: {
      schemaVersion: 5,
      updatedAt: "2026-10-06T12:00:00.000Z",
      organizations: [{ id: "org-existing", name: "Existante", code: "EX", status: "active" }],
      sites: [], configurations: [], procedures: [], relations: [], relationshipEvents: [], activities: [], moduleRecords: [], templates: [],
      settings: { instanceName: "Atlas test", defaultLocale: "fr", workflows: { expiryDays: 30, staleDays: 90, requireOwner: true }, rmm: { enabled: false }, sso: { enabled: false } },
    },
  };
  await writeFile(path.join(dataRoot, "workspace.json"), `${JSON.stringify(original, null, 2)}\n`, "utf8");
  await writeFile(path.join(dataRoot, "vault.json"), `${JSON.stringify({ schemaVersion: 1, items: [] }, null, 2)}\n`, "utf8");
  await writeFile(path.join(dataRoot, "vault.key"), `${randomBytes(32).toString("base64")}\n`, "utf8");

  const first = await runSeed(dataRoot);
  assert.equal(first.code, 0, first.stderr);
  const result = JSON.parse(first.stdout.trim());
  assert.equal(result.organization, "org-test2-aubepine");
  assert.equal(result.revision, 13);
  assert.equal(result.created.sites, 3);
  assert.equal(result.created.configurations, 20);
  assert.equal(result.created.passwords, 12);
  assert.ok(result.created.moduleRecords >= 40);
  assert.ok(result.created.relations >= 30);

  const seeded = JSON.parse(await readFile(path.join(dataRoot, "workspace.json"), "utf8"));
  assert.equal(seeded.data.organizations.at(-1).name, "[TEST2] Groupe Aubépine Distribution inc.");
  assert.equal(seeded.data.organizations.at(-1).details.employeeCount, "128");
  assert.equal(seeded.data.sites.length, 3);
  assert.equal(seeded.data.configurations.length, 20);
  assert.equal(seeded.data.configurations[0].details.serialNumber, "TEST2-R550-0001");
  assert.equal(seeded.data.configurations.find((item) => item.id === "cfg-test2-mtl-sql01").details.parentConfigurationId, "cfg-test2-mtl-hv02");
  assert.match(seeded.data.configurations.find((item) => item.id === "cfg-test2-mtl-sql01").details.networkInterfaces, /10\.77\.20\.30\/24/);
  assert.match(seeded.data.configurations.find((item) => item.id === "cfg-test2-mtl-sql01").details.customAttributes, /entièrement fictives/);
  assert.ok(seeded.data.moduleRecords.some((item) => item.moduleId === "service-active-directory" && item.details.domainControllers.includes("T2-MTL-DC01")));
  assert.ok(seeded.data.moduleRecords.some((item) => item.moduleId === "documents" && item.details.content.includes("Restauration ERP")));
  assert.ok(seeded.data.relations.some((item) => item.sourceRef === "vault:vault-test2-001" && item.targetRef === "configuration:cfg-test2-mtl-fw01"));
  assert.equal(seeded.data.settings.rmm.enabled, false);
  assert.equal(seeded.data.settings.sso.enabled, false);

  const vaultText = await readFile(path.join(dataRoot, "vault.json"), "utf8");
  const vault = JSON.parse(vaultText);
  assert.equal(vault.items.length, 12);
  assert.equal(vault.items[0].encrypted.algorithm, "aes-256-gcm");
  assert.doesNotMatch(vaultText, /TEST2-FW!Az9-NotReal-2026/);
  assert.doesNotMatch(vaultText, /test2-fw-admin/);

  const backups = await readdir(path.join(dataRoot, "qa-backups"));
  assert.equal(backups.length, 2);
  assert.ok(backups.some((name) => /before-test2-blind-.*-workspace\.json$/.test(name)));
  assert.ok(backups.some((name) => /before-test2-blind-.*-vault\.json$/.test(name)));

  const beforeSecondRun = await readFile(path.join(dataRoot, "workspace.json"), "utf8");
  const second = await runSeed(dataRoot);
  assert.notEqual(second.code, 0);
  assert.match(second.stderr, /TEST2 existe déjà/);
  assert.equal(await readFile(path.join(dataRoot, "workspace.json"), "utf8"), beforeSecondRun);
});
