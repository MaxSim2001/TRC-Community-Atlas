import { randomBytes, scryptSync } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

function stamp() {
  return new Date().toISOString().replace(/T/, "_").replace(/:/g, "-").replace(/\..+/, "");
}

function derivePassword(password, salt = randomBytes(16).toString("hex")) {
  return { salt, hash: scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex") };
}

async function writeJsonAtomic(filePath, value) {
  const temporaryPath = `${filePath}.${process.pid}.${randomBytes(5).toString("hex")}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  await rename(temporaryPath, filePath);
}

export async function breakGlassReset({ dataRoot, username, confirm = "", dryRun = false }) {
  if (confirm !== "RESET_MFA") throw new Error("Confirmation refusée. Utilisez exactement --confirm RESET_MFA.");
  const authPath = path.join(dataRoot, "auth.json");
  const sessionsPath = path.join(dataRoot, "sessions.json");
  const auth = JSON.parse(await readFile(authPath, "utf8"));
  const normalizedUsername = String(username || "").trim().toLowerCase();
  const user = auth.users?.find((entry) => entry.username === normalizedUsername);
  if (!user || user.role !== "administrator") throw new Error("Le compte administrateur local demandé est introuvable.");
  if (dryRun) return { dryRun: true, userId: user.id, username: user.username };

  const emergencyRoot = path.join(dataRoot, "emergency-backups");
  await mkdir(emergencyRoot, { recursive: true });
  const backupRoot = path.join(emergencyRoot, `Atlas_BreakGlass_${stamp()}`);
  await mkdir(backupRoot, { recursive: false });
  await copyFile(authPath, path.join(backupRoot, "auth.json"), fsConstants.COPYFILE_EXCL);
  let sessions = { schemaVersion: 1, sessions: [] };
  try {
    sessions = JSON.parse(await readFile(sessionsPath, "utf8"));
    await copyFile(sessionsPath, path.join(backupRoot, "sessions.json"), fsConstants.COPYFILE_EXCL);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const temporaryPassword = `${randomBytes(12).toString("base64url")}!Aa9`;
  Object.assign(user, derivePassword(temporaryPassword), {
    mustChangePassword: true,
    passwordResetAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    mfa: { enabled: false, secret: "", recoveryHashes: [] },
  });
  sessions.sessions = (sessions.sessions || []).filter((entry) => entry.userId !== user.id);
  await writeJsonAtomic(authPath, auth);
  await writeJsonAtomic(sessionsPath, sessions);
  let database;
  try {
    database = new DatabaseSync(path.join(dataRoot, "atlas.sqlite"));
    const revision = Number(database.prepare("SELECT revision FROM workspace_state WHERE singleton = 1").get()?.revision) || 0;
    database.prepare("INSERT INTO audit_events (at, actor, action, asset_ref, organization_id, workspace_revision, details_json) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(new Date().toISOString(), "Récupération locale", "account-break-glass-reset", "", "", revision, JSON.stringify({ userId: user.id, username: user.username, backupRoot }));
  } catch {
    // La copie auth/sessions reste valide même si l'audit SQLite n'est pas encore initialisé.
  } finally {
    database?.close();
  }
  return { dryRun: false, userId: user.id, username: user.username, temporaryPassword, backupRoot };
}

function argsToObject(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--data") result.dataRoot = path.resolve(argv[++index]);
    else if (argv[index] === "--username") result.username = argv[++index];
    else if (argv[index] === "--confirm") result.confirm = argv[++index];
    else if (argv[index] === "--dry-run") result.dryRun = true;
  }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = argsToObject(process.argv.slice(2));
    if (!options.dataRoot || !options.username) throw new Error("Usage : node scripts/atlas-break-glass.mjs --data <dossier> --username <admin> --confirm RESET_MFA [--dry-run]");
    const result = await breakGlassReset(options);
    if (result.dryRun) console.log(`Validation réussie pour l’administrateur ${result.username}; aucune donnée modifiée.`);
    else {
      console.log(`Récupération locale terminée pour ${result.username}.`);
      console.log(`Sauvegarde préalable : ${result.backupRoot}`);
      console.log(`Mot de passe temporaire à transmettre une seule fois : ${result.temporaryPassword}`);
      console.log("Atlas exigera son remplacement puis un nouvel enrôlement MFA à la prochaine connexion.");
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
