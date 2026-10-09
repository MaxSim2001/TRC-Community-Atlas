import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { AtlasStore } from "../lib/atlas-store.mjs";

async function loadModuleQa() {
  const source = await readFile(new URL("../public/assets/app.js", import.meta.url), "utf8");
  const emptyElement = () => ({ innerHTML: "", addEventListener() {}, classList: { add() {}, remove() {}, toggle() {} } });
  const window = {
    __ATLAS_TEST_NO_BOOT__: true,
    addEventListener() {},
    clearTimeout,
    setTimeout,
    location: { hash: "" },
    scrollTo() {},
  };
  const sandbox = {
    console,
    clearTimeout,
    setTimeout,
    structuredClone,
    URL,
    Blob,
    window,
    location: window.location,
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    document: {
      body: { append() {} },
      documentElement: { dataset: {} },
      getElementById() { return emptyElement(); },
      addEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      createElement() { return emptyElement(); },
    },
    requestAnimationFrame(callback) { callback(); },
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: "public/assets/app.js" });
  return window.__ATLAS_MODULE_QA__;
}

test("the complete Atlas module catalog has valid business schemas", async () => {
  const qa = await loadModuleQa();
  const report = qa.report();

  assert.equal(report.total, 179, "the IT Glue-compatible catalog must keep all 179 modules");
  assert.deepEqual(JSON.parse(JSON.stringify(report.groups)), { core: 9, services: 22, custom: 148 });
  assert.equal(report.issues.length, 0, report.issues.join("\n"));
  assert.ok(report.profileCount >= 30, `expected broad business coverage, got ${report.profileCount} profiles`);
  assert.ok(report.genericCount <= 10, `too many modules still use the generic profile: ${report.genericCount}`);
  assert.equal(new Set(report.modules.map((module) => module.id)).size, report.total, "module ids must be unique");
  const profileOf = (id) => report.modules.find((module) => module.id === id)?.profileKey;
  assert.equal(profileOf("custom-composant-reseau"), "network", "Composant réseau must not collide with the SAN storage acronym");
  assert.equal(profileOf("custom-san"), "storage");
  assert.equal(profileOf("custom-nas"), "storage");
  assert.equal(profileOf("custom-sql-server"), "database");
  assert.equal(profileOf("custom-camera"), "physicalSecurity");
  assert.equal(profileOf("custom-pbx-ip"), "telephony");
  assert.equal(profileOf("custom-ssl"), "certificate");
  assert.equal(profileOf("custom-documents"), "documents");
  assert.equal(profileOf("custom-exchange-server"), "messaging");
  assert.equal(profileOf("custom-probe-virtuel"), "monitoring");
  assert.equal(qa.pwaInstallDecision({ mobile: true, standalone: false, dismissed: false, installed: false }), true);
  assert.equal(qa.pwaInstallDecision({ mobile: true, standalone: true, dismissed: false, installed: false }), false);
  assert.equal(qa.pwaInstallDecision({ mobile: false, standalone: false, dismissed: false, installed: false }), false);
  const health = qa.passwordHealthSnapshot([
    { strength: 0, archived: false },
    { strength: 1, archived: false },
    { strength: 2, archived: false },
    { strength: 3, archived: false },
    { strength: 4, archived: false },
    { strength: null, archived: false },
    { strength: 0, archived: true },
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(health)), {
    total: 6,
    evaluated: 5,
    attention: 3,
    strong: 2,
    counts: { veryWeak: 1, weak: 1, fair: 1, strong: 1, veryStrong: 1, notEvaluated: 1 },
  });

  for (const module of report.modules) {
    assert.ok(module.fieldCount >= 4, `${module.label} needs at least four useful business fields`);
    assert.ok(module.profileLabel, `${module.label} needs a visible profile label`);
    if (module.editorKind === "dedicated") continue;
    const markup = qa.fieldsMarkup(module.id);
    assert.ok(markup.length > 0, `${module.label} did not render any business field`);
    for (const field of module.fields) {
      assert.match(markup, new RegExp(`name=["']detail_${field.key}["']`), `${module.label} did not render ${field.key}`);
    }
  }
});

test("the public shell cache-busts the audited module release", async () => {
  const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(index, /assets\/styles\.css\?v=0\.15\.2-help-1/);
  assert.match(index, /assets\/help-content\.js\?v=0\.15\.2-help-1/);
  assert.match(index, /assets\/app\.js\?v=0\.15\.2-help-1/);
});

test("every shared module schema survives a SQLite round trip", async (context) => {
  const qa = await loadModuleQa();
  const report = qa.report();
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "trc-atlas-all-modules-"));
  context.after(() => import("node:fs/promises").then(({ rm }) => rm(dataRoot, { recursive: true, force: true })));
  const workspacePath = path.join(dataRoot, "workspace.json");
  const historyPath = path.join(dataRoot, "workspace-history.json");
  const organizationId = "org-all-modules-qa";
  const sharedModules = report.modules.filter((module) => module.editorKind !== "dedicated");
  const sampleValue = (field) => field.type === "date" ? "2027-01-15" : field.type === "number" ? "1" : field.type === "select" ? (field.options.find(Boolean) || "Non précisé") : `Valeur QA ${field.label}`;
  const moduleRecords = sharedModules.map((module, index) => ({
    id: `qa-module-${String(index + 1).padStart(3, "0")}`,
    moduleId: module.id,
    organizationId,
    siteId: "",
    title: `[QA] ${module.label}`,
    owner: "Équipe QA Atlas",
    status: "active",
    expiresOn: "2027-12-31",
    reference: `QA-${String(index + 1).padStart(3, "0")}`,
    tags: ["qa", module.profileKey],
    summary: `Validation complète du module ${module.label}.`,
    notes: "Données réalistes mais factices; aucun secret.",
    updatedAt: "2026-10-06",
    details: Object.fromEntries(module.fields.map((field) => [field.key, sampleValue(field)])),
    checklist: [],
  }));
  const initial = {
    revision: 1,
    data: {
      schemaVersion: 5,
      updatedAt: "2026-10-06T12:00:00.000Z",
      organizations: [{ id: organizationId, name: "[QA] Tous les modules", status: "active" }],
      sites: [], configurations: [], procedures: [], relations: [], activities: [], moduleRecords: [], templates: [], relationshipEvents: [], settings: {},
    },
  };
  await writeFile(workspacePath, `${JSON.stringify(initial)}\n`, "utf8");
  await writeFile(historyPath, `${JSON.stringify({ schemaVersion: 1, entries: [] })}\n`, "utf8");

  let store = await AtlasStore.open({ dataRoot, workspacePath, historyPath });
  const next = structuredClone(store.readDocument().data);
  next.moduleRecords = moduleRecords;
  const saved = store.commitDocument(1, next, "QA Atlas", "all-modules-roundtrip");
  assert.equal(saved.data.moduleRecords.length, sharedModules.length);
  store.close();

  store = await AtlasStore.open({ dataRoot, workspacePath, historyPath });
  const persisted = store.readDocument().data.moduleRecords;
  assert.equal(persisted.length, sharedModules.length);
  for (const module of sharedModules) {
    const record = persisted.find((item) => item.moduleId === module.id);
    assert.ok(record, `${module.label} was not persisted`);
    assert.deepEqual(Object.keys(record.details).sort(), Array.from(module.fields, (field) => field.key).sort(), `${module.label} lost profile fields`);
  }
  store.close();
});

