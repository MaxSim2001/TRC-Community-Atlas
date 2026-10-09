import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("Atlas exposes a local searchable bilingual help center from the header", () => {
  const app = source("public/assets/app.js");
  const styles = source("public/assets/styles.css");
  const index = source("public/index.html");
  const worker = source("public/service-worker.js");
  const helpSource = source("public/assets/help-content.js");
  const context = { window: {} };
  vm.runInNewContext(helpSource, context);
  const catalog = context.window.ATLAS_HELP_CATALOG;

  assert.equal(catalog.categories.length, 5);
  assert.ok(catalog.articles.length >= 18);
  for (const article of catalog.articles) {
    assert.ok(article.id);
    assert.ok(catalog.categories.some((category) => category.id === article.category));
    assert.ok(article.title.fr && article.title.en);
    assert.ok(article.summary.fr && article.summary.en);
    assert.ok(article.sections.length >= 2);
  }

  assert.match(app, /data-action="toggle-help-menu"/);
  assert.match(app, /aria-label="\$\{state\.locale === "fr" \? "Ouvrir l’aide Atlas"/);
  assert.match(app, /function renderHelpCenter\(\)/);
  assert.match(app, /function renderHelpArticle\(articleId\)/);
  assert.match(app, /data-help-search/);
  assert.match(app, /helpArticleSearchText/);
  assert.match(app, /state\.page === "help" && state\.detailId/);
  assert.match(app, /state\.helpMenuOpen && event\.key === "Escape"/);
  assert.match(styles, /\.help-menu-popover/);
  assert.match(styles, /\.help-article-grid/);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*\.help-menu-popover/);

  const helpIndex = index.indexOf("/assets/help-content.js?v=0.14.3-update-1");
  const appIndex = index.indexOf("/assets/app.js?v=0.14.3-update-1");
  assert.ok(helpIndex >= 0 && appIndex > helpIndex);
  assert.match(worker, /\/assets\/help-content\.js\?v=0\.14\.3-update-1/);
  assert.match(source("server.mjs"), /\["\/assets\/help-content\.js", \["assets\/help-content\.js", "text\/javascript; charset=utf-8"\]\]/);
});

test("the official GitHub repository documents the self-contained Windows test package", () => {
  const helpSource = source("public/assets/help-content.js");
  const context = { window: {} };
  vm.runInNewContext(helpSource, context);
  const article = context.window.ATLAS_HELP_CATALOG.articles.find((candidate) => candidate.id === "github-installation");

  assert.ok(article);
  const serialized = JSON.stringify(article);
  assert.match(serialized, /https:\/\/github\.com\/MaxSim2001\/TRC-Community-Atlas/);
  assert.match(serialized, /Installer-Atlas\.cmd/);
  assert.match(serialized, /Release stable signée.*restent en préparation/);
  assert.match(serialized, /signed stable Release.*still in preparation/);
});

test("repository guides cover users, security, operations, releases and GitHub readiness", () => {
  const guides = [
    "docs/USER_GUIDE.md",
    "docs/SECURITY_AND_ACCESS.md",
    "docs/OPERATIONS_GUIDE.md",
    "docs/RELEASE_NOTES.md",
    "docs/GITHUB_READINESS.md",
  ];
  for (const guide of guides) {
    const content = source(guide);
    assert.ok(content.length > 500, `${guide} should be substantive`);
    assert.match(content, /0\.12\.6|GitHub|Atlas/);
  }
});
