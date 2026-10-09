import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appUrl = new URL("../public/assets/app.js", import.meta.url);
const stylesUrl = new URL("../public/assets/styles.css", import.meta.url);

test("final visual polish keeps long organization names and touch targets readable", async () => {
  const css = await readFile(stylesUrl, "utf8");

  assert.match(css, /\.organization-workspace-identity h1\s*\{[^}]*overflow-wrap:\s*anywhere;[^}]*white-space:\s*normal;/s);
  assert.match(css, /\.nav-item\s*\{[^}]*min-height:\s*44px;/s);
  assert.match(css, /\.language-button\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/s);
  assert.match(css, /@media \(max-width:\s*900px\)[\s\S]*?\.auth-screen\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
  assert.match(css, /@media \(max-width:\s*900px\)[\s\S]*?\.auth-form-panel\s*\{[^}]*min-height:\s*auto;[^}]*padding:\s*34px 22px 60px;/s);
});

test("settings and account access remain usable without horizontal mobile scrolling", async () => {
  const [app, css] = await Promise.all([readFile(appUrl, "utf8"), readFile(stylesUrl, "utf8")]);

  assert.match(app, /<td data-label="Compte">/);
  assert.match(app, /<td data-label="Documentation">/);
  assert.match(app, /<td data-label="Compagnies">/);
  assert.match(app, /<td data-label="Mots de passe">/);
  assert.match(app, /<td data-label="MFA">/);
  assert.match(app, /<td data-label="Sessions">/);
  assert.match(css, /@media \(max-width:\s*680px\)[\s\S]*?\.settings-nav\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);[^}]*overflow:\s*visible;/s);
  assert.match(css, /@media \(max-width:\s*680px\)[\s\S]*?\.account-access-table \.table-scroll\s*\{[^}]*overflow:\s*visible;/s);
  assert.match(css, /\.account-access-table table\s*\{[^}]*min-width:\s*0;/s);
});
