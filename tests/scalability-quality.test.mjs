import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { AtlasStore } from "../lib/atlas-store.mjs";

function workspace() {
  return {
    schemaVersion: 5,
    updatedAt: "2026-10-14T12:00:00.000Z",
    organizations: [{ id: "org-a", name: "Company A", code: "A", owner: "Team", status: "active" }],
    sites: [{ id: "site-one", organizationId: "org-a", name: "Main office", address: "Montreal", owner: "Office team", status: "active" }],
    configurations: [
      { id: "cfg-one", organizationId: "org-a", name: "APP01", ip: "10.0.0.10", owner: "", status: "documented", lastReviewed: "2020-01-01", details: {} },
      { id: "cfg-two", organizationId: "org-a", name: "APP02", ip: "10.0.0.10", owner: "Ops", status: "documented", lastReviewed: "2026-10-14", details: {} },
    ],
    procedures: [],
    relations: [{ id: "rel-broken", organizationId: "org-a", sourceRef: "configuration:cfg-one", targetRef: "configuration:missing", label: "Depends on" }],
    relationshipEvents: [],
    moduleRecords: [{ id: "rec-one", organizationId: "org-a", moduleId: "local-app", schemaVersion: 1, title: "Application", owner: "Ops", status: "active", updatedAt: "2026-10-14", details: {} }],
    templates: [],
    customModuleDefinitions: [{ id: "local-app", label: "Applications", description: "Local apps", titleLabel: "Name", icon: "grid", schemaVersion: 2, schemaHistory: [], fields: [{ key: "fielda", label: "A", type: "text" }, { key: "fieldb", label: "B", type: "text" }, { key: "fieldc", label: "C", type: "text" }, { key: "fieldd", label: "D", type: "text" }] }],
    activities: [],
    settings: { instanceName: "Atlas QA", defaultLocale: "en", workflows: { staleDays: 90 } },
  };
}

test("server-side asset index paginates search and targeted writes detect per-record conflicts", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "atlas-index-"));
  const store = await AtlasStore.open({ dataRoot: root, workspacePath: path.join(root, "workspace.json"), historyPath: path.join(root, "history.json") });
  context.after(async () => {
    store.close();
    await rm(root, { recursive: true, force: true });
  });
  store.initializeDocument({ revision: 1, data: workspace() }, "QA");

  const page = store.searchAssets({ query: "app", organizationId: "org-a", limit: 1, offset: 0 });
  assert.equal(page.limit, 1);
  assert.equal(page.items.length, 1);
  assert.ok(page.total >= 3);

  const versions = store.entityVersions();
  const current = store.readDocument().data.sites[0];
  const changed = { ...current, address: "Quebec" };
  const document = store.applyChangeset([{ collection: "sites", id: current.id, expectedVersion: versions[`site:${current.id}`], value: changed }], "QA", "targeted-test", () => true);
  assert.equal(document.data.sites[0].address, "Quebec");
  assert.throws(() => store.applyChangeset([{ collection: "sites", id: current.id, expectedVersion: versions[`site:${current.id}`], value: { ...changed, address: "Toronto" } }], "QA", "stale-test", () => true), /autre session/i);
});

test("documentation quality reports only explicit actionable conditions", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "atlas-quality-"));
  const store = await AtlasStore.open({ dataRoot: root, workspacePath: path.join(root, "workspace.json"), historyPath: path.join(root, "history.json") });
  context.after(async () => {
    store.close();
    await rm(root, { recursive: true, force: true });
  });
  store.initializeDocument({ revision: 1, data: workspace() }, "QA");
  const report = store.qualityReport({ organizationId: "org-a", staleDays: 90 });
  assert.equal(report.counts["missing-owner"], 1);
  assert.equal(report.counts.duplicate, 2);
  assert.equal(report.counts["broken-relation"], 1);
  assert.equal(report.counts["schema-outdated"], 1);
  assert.ok(report.issues.every((issue) => issue.ref && issue.code && issue.label));
});

test("UI exposes merge preview, duplicate strategy, restore drill and schema versions", async () => {
  const { readFile } = await import("node:fs/promises");
  const app = await readFile(new URL("../public/assets/app.js", import.meta.url), "utf8");
  assert.match(app, /\/api\/workspace\/changeset/);
  assert.match(app, /\/api\/search\?/);
  assert.match(app, /data-form="module-merge"/);
  assert.match(app, /name="duplicateStrategy"/);
  assert.match(app, /data-form="backup-drill"/);
  assert.match(app, /Schéma v\$\{/);
  assert.match(app, /renderQualityDashboard/);
});
