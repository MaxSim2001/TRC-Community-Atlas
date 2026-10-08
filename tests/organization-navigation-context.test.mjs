import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../public/assets/app.js", import.meta.url), "utf8");

function loadQa() {
  const emptyElement = () => ({ innerHTML: "", addEventListener() {}, classList: { add() {}, remove() {}, toggle() {} } });
  const window = { __ATLAS_TEST_NO_BOOT__: true, addEventListener() {}, clearTimeout, setTimeout, location: { hash: "" }, history: { replaceState() {} }, scrollTo() {} };
  const sandbox = {
    console, clearTimeout, setTimeout, structuredClone, URL, Blob, window, location: window.location, history: window.history,
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    document: { body: { append() {} }, documentElement: { dataset: {} }, getElementById() { return emptyElement(); }, addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, createElement() { return emptyElement(); } },
    requestAnimationFrame(callback) { callback(); },
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: "public/assets/app.js" });
  return window.__ATLAS_MODULE_QA__;
}

test("la navigation et les compteurs suivent uniquement l'organisation active", () => {
  const qa = loadQa();
  const workspace = {
    organizations: [{ id: "org-a", name: "Compagnie A" }, { id: "org-b", name: "Compagnie B" }],
    configurations: [{ id: "a-1", organizationId: "org-a" }, { id: "a-2", organizationId: "org-a" }, { id: "b-1", organizationId: "org-b" }],
    sites: [{ id: "site-a", organizationId: "org-a" }, { id: "site-b", organizationId: "org-b" }],
    procedures: [], moduleRecords: [], relations: [], settings: {},
  };
  const vaultItems = [{ id: "vault-a", organizationId: "org-a", archived: false }, { id: "vault-b", organizationId: "org-b", archived: false }];

  const global = qa.organizationContextSnapshot({ workspace, vaultItems });
  assert.equal(global.organizationId, "");
  assert.equal(global.scopedNavigation, false);
  assert.equal(global.configurationCount, 0);
  assert.doesNotMatch(global.breadcrumb, /TRC Atlas|Compagnie A|Compagnie B/);

  const companyA = qa.organizationContextSnapshot({ workspace, vaultItems, organizationId: "org-a" });
  assert.equal(companyA.organizationId, "org-a");
  assert.equal(companyA.scopedNavigation, true);
  assert.equal(companyA.configurationCount, 2);
  assert.equal(companyA.locationCount, 1);
  assert.equal(companyA.passwordCount, 1);
  assert.match(companyA.breadcrumb, /Compagnie A[\s\S]*Configurations/);
  assert.doesNotMatch(companyA.breadcrumb, /TRC Atlas/);

  const companyB = qa.organizationContextSnapshot({ workspace, vaultItems, organizationId: "org-b" });
  assert.equal(companyB.configurationCount, 1);
  assert.equal(companyB.locationCount, 1);
  assert.equal(companyB.passwordCount, 1);
});

test("les modules et outils du menu sont rendus seulement avec une organisation active", () => {
  assert.match(source, /function\s+renderOrganizationNavigation\s*\(\)\s*\{\s*if\s*\(!activeOrganizationId\(\)\)\s*return\s*"";/);
  assert.match(source, /\$\{renderOrganizationNavigation\(\)\}/);
  assert.doesNotMatch(source, /return\s+organizations\.length\s*===\s*1\s*\?/, "une organisation unique ne doit pas etre selectionnee implicitement");
});

test("le fil d’Ariane suit les organisations imbriquées sans changer les compteurs directs", () => {
  const qa = loadQa();
  const workspace = {
    organizations: [
      { id: "org-a", name: "Compagnie A" },
      { id: "org-d", name: "Compagnie D", parentOrganizationId: "org-a" },
      { id: "org-d1", name: "Division D1", parentOrganizationId: "org-d" },
    ],
    configurations: [{ id: "a-1", organizationId: "org-a" }, { id: "d-1", organizationId: "org-d" }],
    sites: [], procedures: [], moduleRecords: [], relations: [], settings: {},
  };
  const hierarchy = qa.organizationHierarchySnapshot({ workspace, organizationId: "org-d1" });
  assert.deepEqual([...hierarchy.path], ["org-a", "org-d", "org-d1"]);
  assert.equal(hierarchy.depth, 3);
  assert.match(hierarchy.breadcrumb, /Compagnie A[\s\S]*Compagnie D[\s\S]*Division D1/);

  const child = qa.organizationContextSnapshot({ workspace, organizationId: "org-d" });
  assert.equal(child.configurationCount, 1, "le compteur ne doit pas inclure les configurations du parent");
  assert.match(child.breadcrumb, /Compagnie A[\s\S]*Compagnie D[\s\S]*Configurations/);
});

test("l’interface explique la limite et l’isolation des sous-compagnies", () => {
  assert.match(source, /Organisation parente/);
  assert.match(source, /limitée à trois niveaux/);
  assert.match(source, /Aucun mot de passe, permission ou contenu n’est hérité/);
  assert.match(source, /Compagnies rattachées/);
});
