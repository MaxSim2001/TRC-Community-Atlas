import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AtlasStore } from "../lib/atlas-store.mjs";

test("SQLite migrates legacy Atlas data and records durable per-asset revisions", async () => {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "trc-atlas-store-"));
  const workspacePath = path.join(dataRoot, "workspace.json");
  const historyPath = path.join(dataRoot, "workspace-history.json");
  const legacy = {
    revision: 7,
    data: {
      schemaVersion: 5,
      updatedAt: "2026-10-01T12:00:00.000Z",
      organizations: [{ id: "org-test", name: "Organisation test" }],
      sites: [],
      configurations: [{ id: "cfg-test", organizationId: "org-test", name: "SRV-TEST", status: "draft" }],
      procedures: [],
      relations: [],
      activities: [],
      moduleRecords: [],
      templates: [],
      relationshipEvents: [],
      settings: {},
    },
  };

  await writeFile(workspacePath, `${JSON.stringify(legacy)}\n`, "utf8");
  await writeFile(historyPath, `${JSON.stringify({ schemaVersion: 1, entries: [] })}\n`, "utf8");

  let store = await AtlasStore.open({ dataRoot, workspacePath, historyPath });
  assert.deepEqual(store.readDocument(), legacy);

  const nextData = structuredClone(legacy.data);
  nextData.configurations[0].status = "documented";
  const saved = store.commitDocument(7, nextData, "Technicien QA");
  assert.equal(saved.revision, 8);
  assert.equal(store.historyMetadata()[0].revision, 7);
  assert.equal(store.assetHistory("configuration:cfg-test")[0].action, "updated");
  assert.match(JSON.stringify(store.auditEvents({ assetRef: "configuration:cfg-test" })), /asset-updated/);
  store.close();

  store = await AtlasStore.open({ dataRoot, workspacePath, historyPath });
  assert.equal(store.readDocument().revision, 8);
  assert.equal(store.readDocument().data.configurations[0].status, "documented");
  assert.equal(JSON.parse(await readFile(workspacePath, "utf8")).revision, 7, "la migration ne détruit pas le JSON source");
  store.close();
  await rm(dataRoot, { recursive: true, force: true });
});
