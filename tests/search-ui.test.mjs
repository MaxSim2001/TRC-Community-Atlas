import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appUrl = new URL("../public/assets/app.js", import.meta.url);
const stylesUrl = new URL("../public/assets/styles.css", import.meta.url);

test("global and organization search surfaces remain available", async () => {
  const [app, css] = await Promise.all([readFile(appUrl, "utf8"), readFile(stylesUrl, "utf8")]);

  assert.match(app, /searchScope:\s*"global"/);
  assert.match(app, /function\s+searchEntries\s*\(/);
  assert.match(app, /function\s+searchResultTypePriority\s*\(/);
  assert.match(app, /result\.kind\s*===\s*"Organisation"\s*\?\s*0\s*:\s*1/);
  assert.match(app, /function\s+compareSearchResults\s*\(/);
  assert.match(app, /searchResultTypePriority\(a\)\s*-\s*searchResultTypePriority\(b\)/);
  assert.match(app, /results\.sort\(\(a, b\)\s*=>\s*compareSearchResults\(a, b, query\)\)/);
  assert.match(app, /function\s+searchResultsMarkup\s*\(/);
  assert.match(app, /data-search-result-section="\$\{key\}"/);
  assert.match(app, /searchResultsMarkup\(results\)/);
  assert.match(app, /function\s+renderOrganizationDetail\s*\(/);
  assert.match(app, /data-search-scope/);
  assert.match(app, /function\s+searchScopeMenuMarkup\s*\(/);
  assert.match(app, /class="search-scope-popover"\s+role="listbox"/);
  assert.match(app, /data-search-scope-query/);
  assert.match(app, /data-action="select-search-scope"/);
  assert.match(app, /aria-selected="\$\{state\.searchScope\s*===\s*organization\.id\}"/);
  assert.match(app, /state\.searchScopeOpen\s*&&\s*event\.key\s*===\s*"Escape"/);
  assert.match(app, /data-organization-search/);
  assert.match(app, /state\.workspace\.organizations/);
  assert.match(app, /state\.workspace\.sites/);
  assert.match(app, /state\.workspace\.configurations/);
  assert.match(app, /state\.workspace\.procedures/);
  assert.match(app, /state\.workspace\.moduleRecords/);
  assert.match(app, /state\.vaultItems/);
  assert.match(app, /edit-module-record/);
  assert.match(css, /\.global-search-scope\s*\{/);
  assert.match(css, /\.search-scope-popover\s*\{/);
  assert.match(css, /\.search-scope-option\.active\s*\{/);
  assert.match(css, /\.search-scope-options\s*\{[^}]*overflow-y:\s*auto;/);
  assert.match(css, /\.organization-workspace-search\s*\{/);
  assert.match(css, /\.organization-search-results-panel\s*\{/);
  assert.match(css, /\.search-result-edit\s*\{/);
  assert.match(css, /\.search-result-open strong,\s*\.search-result-open small\s*\{[^}]*display:\s*block;/);
  assert.match(css, /\.search-result-section-title\s*\{/);
  assert.match(css, /\.search-results-footer\s*\{/);
  assert.match(css, /@media\s*\(max-width:\s*680px\)[\s\S]*?\.search-popover\s*\{[^}]*position:\s*fixed;[^}]*left:\s*10px;[^}]*right:\s*10px;/);
  assert.match(css, /@media\s*\(max-width:\s*680px\)[\s\S]*?\.search-scope-popover\s*\{[^}]*position:\s*fixed;[^}]*left:\s*10px;[^}]*right:\s*10px;/);

  const rankingStart = app.indexOf("  function normalizeSearch");
  const rankingEnd = app.indexOf("  function procedureOrganizationIds", rankingStart);
  assert.ok(rankingStart >= 0 && rankingEnd > rankingStart, "search ranking functions must be extractable");
  const rankingFactory = new Function("state", `${app.slice(rankingStart, rankingEnd)}\nreturn { normalizeSearch, compareSearchResults };`);
  const ranking = rankingFactory({ locale: "fr" });
  const query = ranking.normalizeSearch("boréal");
  const fixtures = [
    ...Array.from({ length: 50 }, (_, index) => ({ kind: "Configuration", label: `Boréal configuration ${String(index + 1).padStart(2, "0")}` })),
    { kind: "Relation", label: "Boréal → Incident prioritaire" },
    { kind: "Site", label: "Laval — Clinique Boréal" },
    { kind: "Organisation", label: "Clinique Boréal" },
  ];
  fixtures.sort((a, b) => ranking.compareSearchResults(a, b, query));
  assert.equal(fixtures[0].kind, "Organisation");
  assert.equal(fixtures[0].label, "Clinique Boréal");
  assert.equal(fixtures.slice(0, 12).some((entry) => entry.kind === "Organisation"), true);
});
