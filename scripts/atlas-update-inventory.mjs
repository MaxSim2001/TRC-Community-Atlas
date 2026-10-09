import { createDecipheriv } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dataRoot = path.resolve(process.argv[2] || "");
if (!dataRoot || dataRoot === path.parse(dataRoot).root) throw new Error("Dossier de données Atlas invalide.");
const database = new DatabaseSync(path.join(dataRoot, "atlas.sqlite"), { readOnly: true });
const quickCheck = database.prepare("PRAGMA quick_check").get().quick_check;
const row = database.prepare("SELECT revision, data_json FROM workspace_state WHERE singleton = 1").get();
database.close();
if (quickCheck !== "ok" || !row) throw new Error("La base SQLite Atlas est invalide.");
const workspace = JSON.parse(row.data_json);
const [auth, vault, keyText, attachments] = await Promise.all([
  readFile(path.join(dataRoot, "auth.json"), "utf8").then(JSON.parse),
  readFile(path.join(dataRoot, "vault.json"), "utf8").then(JSON.parse),
  readFile(path.join(dataRoot, "vault.key"), "utf8"),
  readFile(path.join(dataRoot, "attachments.json"), "utf8").then(JSON.parse).catch((error) => error?.code === "ENOENT" ? { items: [] } : Promise.reject(error)),
]);
const key = Buffer.from(keyText.trim(), "base64");
if (key.length !== 32) throw new Error("La clé locale du coffre est invalide.");
let vaultWitness = true;
const witness = Array.isArray(vault.items) ? vault.items.find((item) => item?.encrypted) : null;
if (witness) {
  const record = witness.encrypted;
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(record.iv, "base64"));
  decipher.setAuthTag(Buffer.from(record.tag, "base64"));
  JSON.parse(Buffer.concat([decipher.update(Buffer.from(record.data, "base64")), decipher.final()]).toString("utf8"));
}
process.stdout.write(JSON.stringify({
  quickCheck,
  revision: row.revision,
  organizations: workspace.organizations?.length || 0,
  configurations: workspace.configurations?.length || 0,
  moduleRecords: workspace.moduleRecords?.length || 0,
  procedures: workspace.procedures?.length || 0,
  users: auth.users?.length || 0,
  vaultItems: vault.items?.length || 0,
  attachments: attachments.items?.length || 0,
  vaultWitness,
}));
