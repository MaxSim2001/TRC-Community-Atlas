import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

test("public documentation does not contain the private deployment identifiers reported by the audit", async () => {
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const docsRoot = path.join(root, "docs");
  const files = [path.join(root, "README.md")];
  for (const entry of await readdir(docsRoot, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".md")) files.push(path.join(docsRoot, entry.name));
  }
  const privateSubnet = ["192", "168", "50"].join(".");
  const localAccount = ["Administrateur", "AD-01"].join(".");
  const findings = [];
  for (const file of files) {
    const content = await readFile(file, "utf8");
    if (content.includes(privateSubnet)) findings.push(`${path.basename(file)} contient l’ancien sous-réseau privé`);
    if (content.includes(localAccount)) findings.push(`${path.basename(file)} contient l’ancien compte Windows`);
  }
  assert.deepEqual(findings, []);
});
