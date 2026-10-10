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
  assert.match(app, /function safeHelpLink/);
  assert.match(app, /class="help-figure"/);
  assert.match(app, /class="help-resource-link"/);
  assert.match(app, /state\.page === "help" && state\.detailId/);
  assert.match(app, /state\.helpMenuOpen && event\.key === "Escape"/);
  assert.match(styles, /\.help-menu-popover/);
  assert.match(styles, /\.help-article-grid/);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*\.help-menu-popover/);

  const helpIndex = index.indexOf("/assets/help-content.js?v=0.15.6");
  const appIndex = index.indexOf("/assets/app.js?v=0.15.6");
  assert.ok(helpIndex >= 0 && appIndex > helpIndex);
  assert.match(worker, /\/assets\/help-content\.js\?v=0\.15\.6/);
  assert.match(source("server.mjs"), /\["\/assets\/help-content\.js", \["assets\/help-content\.js", "text\/javascript; charset=utf-8"\]\]/);

  const imageSources = catalog.articles.flatMap((article) => article.sections.map((section) => section.image?.src).filter(Boolean));
  assert.deepEqual([...new Set(imageSources)].sort(), [
    "/assets/help/github-release-0.15.2.png",
    "/assets/help/settings-backups.png",
    "/assets/help/settings-updates.png",
  ]);
  for (const imageSource of imageSources) {
    const imagePath = imageSource.replace(/^\//, "");
    assert.ok(fs.statSync(path.join(root, "public", imagePath.replace(/^assets\//, "assets/"))).size > 20_000, `${imageSource} should contain a real screenshot`);
    assert.match(worker, new RegExp(imageSource.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(source("server.mjs"), new RegExp(imageSource.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("the official GitHub repository documents the signed Windows release and guarded updater", () => {
  const helpSource = source("public/assets/help-content.js");
  const context = { window: {} };
  vm.runInNewContext(helpSource, context);
  const article = context.window.ATLAS_HELP_CATALOG.articles.find((candidate) => candidate.id === "github-installation");

  assert.ok(article);
  const serialized = JSON.stringify(article);
  assert.match(serialized, /https:\/\/github\.com\/MaxSim2001\/TRC-Community-Atlas/);
  assert.match(serialized, /Installer-Atlas\.cmd/);
  assert.match(serialized, /Release (?:stable porte|Windows signée)/i);
  assert.match(serialized, /signed Windows Release|stable Release includes/i);
  assert.match(serialized, /Ed25519/);
  assert.match(serialized, /SHA-256/);
  assert.match(serialized, /TRC-Atlas-Portable-X\.Y\.Z-win-x64\.zip/);
  assert.match(serialized, /TRC Community Atlas Source-Available License 1\.0/);
  assert.match(serialized, /MSP/);
  assert.match(serialized, /un seul port configurable|one configurable port/);
});

test("backup and updater guides document the complete guarded workflows", () => {
  const helpSource = source("public/assets/help-content.js");
  const context = { window: {} };
  vm.runInNewContext(helpSource, context);
  const backup = context.window.ATLAS_HELP_CATALOG.articles.find((candidate) => candidate.id === "backups");
  const updates = context.window.ATLAS_HELP_CATALOG.articles.find((candidate) => candidate.id === "updates");

  assert.ok(backup);
  assert.ok(updates);
  const backupText = JSON.stringify(backup);
  const updateText = JSON.stringify(updates);
  assert.match(backupText, /Paramètres > Sauvegardes/);
  assert.match(backupText, /DPAPI/);
  assert.match(backupText, /RESTORE_ATLAS/);
  assert.match(backupText, /restore-safety/);
  assert.match(updateText, /Paramètres > Mises à jour/);
  assert.match(updateText, /MFA/);
  assert.match(updateText, /Ed25519/);
  assert.match(updateText, /SHA-256/);
  assert.match(updateText, /retour arrière automatique|automatic rollback/);
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

test("the GitHub showcase uses real Atlas screenshots with fictional demo data", () => {
  const readme = source("README.md");
  const showcase = source("docs/SHOWCASE.md");
  const screenshots = [
    "organization-home-demo.png",
    "organization-home-clinique-boreal.png",
    "password-vault-demo.png",
  ];

  assert.match(readme, /complete product showcase/);
  assert.match(readme, /organization-home-demo\.png/);
  assert.match(showcase, /fictional demonstration data/);
  assert.match(showcase, /organization-home-clinique-boreal\.png/);
  assert.match(showcase, /password-vault-demo\.png/);
  assert.match(showcase, /settings-backups\.png/);
  assert.match(showcase, /settings-updates\.png/);
  assert.match(showcase, /github-release-0\.15\.2\.png/);
  for (const screenshot of screenshots) {
    assert.ok(fs.statSync(path.join(root, "docs", "screenshots", screenshot)).size > 20_000);
  }
});
