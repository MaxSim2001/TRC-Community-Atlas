import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const seedScript = path.join(projectRoot, "scripts", "seed-load-test.mjs");

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

test("QA scale seed creates a recoverable high-volume workspace and refuses duplicates", async (context) => {
  const dataRoot = await mkdtemp(path.join(tmpdir(), "trc-atlas-seed-"));
  context.after(() => rm(dataRoot, { recursive: true, force: true }));
  const original = {
    revision: 7,
    data: {
      schemaVersion: 5,
      updatedAt: "2026-10-05T12:00:00.000Z",
      organizations: [{ id: "org-existing", name: "Existante", code: "EX", status: "active" }],
      sites: [], configurations: [], procedures: [], relations: [], relationshipEvents: [], activities: [], moduleRecords: [], templates: [],
      settings: { instanceName: "Atlas test", defaultLocale: "fr", workflows: { expiryDays: 30, staleDays: 90, requireOwner: true }, rmm: { enabled: false }, sso: { enabled: false } },
    },
  };
  await writeFile(path.join(dataRoot, "workspace.json"), `${JSON.stringify(original, null, 2)}\n`, "utf8");

  const first = await runSeed(dataRoot);
  assert.equal(first.code, 0, first.stderr);
  const result = JSON.parse(first.stdout.trim());
  assert.equal(result.organization, "org-qa-scale");
  assert.equal(result.revision, 8);
  assert.equal(result.created.configurations, 240);
  assert.equal(result.created.moduleRecords, 720);
  assert.ok(result.bytes < 900 * 1024);

  const seeded = JSON.parse(await readFile(path.join(dataRoot, "workspace.json"), "utf8"));
  assert.equal(seeded.revision, 8);
  assert.equal(seeded.data.organizations.length, 2);
  assert.equal(seeded.data.sites.length, 12);
  assert.equal(seeded.data.configurations.length, 240);
  assert.equal(seeded.data.procedures.length, 48);
  assert.equal(seeded.data.relations.length, 180);
  assert.equal(seeded.data.relationshipEvents.length, 180);
  assert.match(seeded.data.relations[0].sourceRef, /^configuration:/);
  assert.equal(seeded.data.relations[0].organizationId, "org-qa-scale");
  assert.equal(seeded.data.moduleRecords.length, 720);
  assert.equal(seeded.data.templates.length, 36);
  assert.equal(seeded.data.activities.length, 90);
  assert.equal(seeded.data.settings.rmm.enabled, false);
  assert.equal(seeded.data.settings.sso.enabled, false);

  const history = JSON.parse(await readFile(path.join(dataRoot, "workspace-history.json"), "utf8"));
  assert.equal(history.entries[0].revision, 7);
  const backups = await readdir(path.join(dataRoot, "qa-backups"));
  assert.equal(backups.length, 1);
  assert.match(backups[0], /^workspace-before-scale-/);

  const beforeSecondRun = await readFile(path.join(dataRoot, "workspace.json"), "utf8");
  const second = await runSeed(dataRoot);
  assert.notEqual(second.code, 0);
  assert.match(second.stderr, /existe déjà/);
  assert.equal(await readFile(path.join(dataRoot, "workspace.json"), "utf8"), beforeSecondRun);
});
