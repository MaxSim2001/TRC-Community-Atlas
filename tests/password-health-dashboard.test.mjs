import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("password health is visible globally and in every organization without exposing secrets", async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL("../public/assets/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/assets/styles.css", import.meta.url), "utf8"),
  ]);

  assert.match(app, /passwordHealthCardMarkup\(state\.vaultItems\.filter\(\(item\) => priorities\.organizationIds\.has\(item\.organizationId\)\), \{ global: true, scopeLabel \}\)/);
  assert.match(app, /passwordHealthCardMarkup\(passwords, \{ organizationId: id, scopeLabel: organization\.name \}\)/);
  assert.match(app, /Très faible/);
  assert.match(app, /Non évalué/);
  assert.match(app, /Cette indication mesure seulement la structure du mot de passe/);
  assert.match(app, /Les anciens secrets sont évalués une fois; la note est ensuite recalculée à chaque création ou modification/);
  assert.match(app, /strengthEvaluatedAt/);
  assert.match(app, /data-action="open-password-health-breakdown"/);
  assert.match(app, /data-route="module\/passwords" data-filter-org=/);
  assert.doesNotMatch(app, /passwordHealthSnapshot[\s\S]{0,500}(?:\.password|otpSecret|username)/);
  assert.match(styles, /\.password-health-levels\s*\{[^}]*grid-template-columns:\s*repeat\(6/);
  assert.match(styles, /@media \(max-width: 520px\)[\s\S]*\.password-health-levels\s*\{[^}]*grid-template-columns:\s*repeat\(2/);
});
