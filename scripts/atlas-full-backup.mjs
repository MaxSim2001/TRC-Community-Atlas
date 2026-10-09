import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_FILES = new Set(["auth.json", "vault.json", "vault.key", "attachments.json", "workspace.json", "workspace-history.json", "backup-settings.json", "backup-secret.clixml", "local-api.json", "atlas.sqlite"]);

function stamp() {
  return new Date().toISOString().replace(/T/, "_").replace(/:/g, "-").replace(/\..+/, "");
}

function hash(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function allowedRelativePath(relativePath) {
  const normalized = String(relativePath || "").replace(/\\/g, "/");
  return ROOT_FILES.has(normalized) || /^attachments\/[a-z0-9-]+\.bin$/i.test(normalized);
}

async function exists(filePath) {
  try { await stat(filePath); return true; } catch (error) { if (error?.code === "ENOENT") return false; throw error; }
}

async function atomicWrite(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${randomBytes(5).toString("hex")}.tmp`;
  await writeFile(temporary, data, { flag: "wx" });
  await rename(temporary, filePath);
}

async function attachmentFiles(dataRoot) {
  const root = path.join(dataRoot, "attachments");
  if (!(await exists(root))) return [];
  return (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /^[a-z0-9-]+\.bin$/i.test(entry.name))
    .map((entry) => `attachments/${entry.name}`);
}

async function sqliteSnapshot(dataRoot) {
  const databasePath = path.join(dataRoot, "atlas.sqlite");
  if (!(await exists(databasePath))) return null;
  const snapshotPath = path.join(dataRoot, `.atlas-backup-${process.pid}-${randomBytes(5).toString("hex")}.sqlite`);
  const database = new DatabaseSync(databasePath);
  try { database.exec(`VACUUM INTO '${snapshotPath.replace(/'/g, "''")}'`); }
  finally { database.close(); }
  return snapshotPath;
}

export async function createFullBackup({ dataRoot, outputPath, passphrase }) {
  if (typeof passphrase !== "string" || passphrase.length < 12) throw new Error("La phrase secrète doit contenir au moins 12 caractères.");
  const sqliteCopy = await sqliteSnapshot(dataRoot);
  try {
    const relativePaths = [...ROOT_FILES].filter((name) => name !== "atlas.sqlite" && name !== "sessions.json");
    relativePaths.push(...await attachmentFiles(dataRoot));
    if (sqliteCopy) relativePaths.push("atlas.sqlite");
    const files = [];
    for (const relativePath of relativePaths) {
      const source = relativePath === "atlas.sqlite" && sqliteCopy ? sqliteCopy : path.join(dataRoot, relativePath);
      if (!(await exists(source))) continue;
      const data = await readFile(source);
      files.push({ path: relativePath.replace(/\\/g, "/"), size: data.length, sha256: hash(data), data: data.toString("base64") });
    }
    if (!files.some((file) => file.path === "auth.json") || !files.some((file) => file.path === "vault.key") || !files.some((file) => file.path === "atlas.sqlite")) throw new Error("La source ne contient pas une instance Atlas complète.");
    const payload = Buffer.from(JSON.stringify({ format: "trc-atlas-full-backup-payload", version: 1, createdAt: new Date().toISOString(), sessionsExcluded: true, files }), "utf8");
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const key = scryptSync(passphrase, salt, 32);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
    const envelope = { format: "trc-atlas-full-backup", version: 1, createdAt: new Date().toISOString(), kdf: "scrypt", cipher: "aes-256-gcm", salt: salt.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: encrypted.toString("base64") };
    await atomicWrite(outputPath, `${JSON.stringify(envelope)}\n`);
    return { outputPath, fileCount: files.length, bytes: files.reduce((sum, file) => sum + file.size, 0), sessionsExcluded: true };
  } finally {
    if (sqliteCopy) await rm(sqliteCopy, { force: true });
  }
}

export async function readFullBackup({ inputPath, passphrase }) {
  if (typeof passphrase !== "string" || passphrase.length < 12) throw new Error("Phrase secrète absente ou trop courte.");
  const envelope = JSON.parse(await readFile(inputPath, "utf8"));
  if (envelope.format !== "trc-atlas-full-backup" || envelope.version !== 1 || envelope.kdf !== "scrypt" || envelope.cipher !== "aes-256-gcm") throw new Error("Format de sauvegarde Atlas invalide.");
  const key = scryptSync(passphrase, Buffer.from(envelope.salt, "base64"), 32);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const payload = JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data, "base64")), decipher.final()]).toString("utf8"));
  if (payload.format !== "trc-atlas-full-backup-payload" || payload.version !== 1 || !Array.isArray(payload.files)) throw new Error("Contenu de sauvegarde Atlas invalide.");
  for (const file of payload.files) {
    if (!allowedRelativePath(file.path)) throw new Error(`Chemin interdit dans la sauvegarde : ${file.path}`);
    const data = Buffer.from(file.data, "base64");
    if (data.length !== file.size || hash(data) !== file.sha256) throw new Error(`Intégrité invalide pour ${file.path}`);
  }
  return payload;
}

export async function restoreFullBackup({ dataRoot, inputPath, passphrase, confirm = "" }) {
  if (confirm !== "RESTORE_ATLAS") throw new Error("Confirmation refusée. Utilisez exactement --confirm RESTORE_ATLAS.");
  const payload = await readFullBackup({ inputPath, passphrase });
  const safetyRoot = path.join(dataRoot, "restore-safety", `Atlas_PreRestore_${stamp()}`);
  await mkdir(safetyRoot, { recursive: true });
  const moveAside = async (relativePath) => {
    const source = path.join(dataRoot, relativePath);
    if (!(await exists(source))) return;
    const destination = path.join(safetyRoot, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await rename(source, destination);
  };
  for (const relativePath of ["sessions.json", "atlas.sqlite-wal", "atlas.sqlite-shm", ...payload.files.map((file) => file.path)]) await moveAside(relativePath);
  for (const file of payload.files) await atomicWrite(path.join(dataRoot, file.path), Buffer.from(file.data, "base64"));
  return { restored: true, fileCount: payload.files.length, safetyRoot, sessionsRestored: false };
}

function parseArgs(argv) {
  const result = { command: argv[0] };
  for (let index = 1; index < argv.length; index += 1) {
    if (argv[index] === "--data") result.dataRoot = path.resolve(argv[++index]);
    else if (argv[index] === "--output") result.outputPath = path.resolve(argv[++index]);
    else if (argv[index] === "--input") result.inputPath = path.resolve(argv[++index]);
    else if (argv[index] === "--confirm") result.confirm = argv[++index];
  }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const passphrase = process.env.ATLAS_BACKUP_PASSPHRASE || "";
    delete process.env.ATLAS_BACKUP_PASSPHRASE;
    if (args.command === "create" && args.dataRoot && args.outputPath) console.log(JSON.stringify(await createFullBackup({ ...args, passphrase })));
    else if (args.command === "inspect" && args.inputPath) { const payload = await readFullBackup({ ...args, passphrase }); console.log(JSON.stringify({ createdAt: payload.createdAt, fileCount: payload.files.length, sessionsExcluded: payload.sessionsExcluded })); }
    else if (args.command === "restore" && args.dataRoot && args.inputPath) console.log(JSON.stringify(await restoreFullBackup({ ...args, passphrase })));
    else throw new Error("Usage : create --data <dossier> --output <fichier> | inspect --input <fichier> | restore --data <dossier> --input <fichier> --confirm RESTORE_ATLAS");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
