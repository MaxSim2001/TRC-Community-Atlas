import https from "node:https";
import { execFile } from "node:child_process";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { createFullBackup, readFullBackup } from "../scripts/atlas-full-backup.mjs";

const BACKUP_PREFIX = "TRC_Community_Atlas_Full_Backup_";
const BACKUP_EXTENSION = ".trcatlas";

function nowIso(now = Date.now()) {
  return new Date(now).toISOString();
}

function stamp(now = Date.now()) {
  return new Date(now).toISOString().replace(/T/, "_").replace(/:/g, "-").replace(/\..+/, "");
}

function clampInteger(value, minimum, maximum, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

export function defaultBackupSettings(projectRoot) {
  return {
    schemaVersion: 1,
    enabled: false,
    destination: path.join(projectRoot, "backups"),
    cadence: "daily",
    hour: 2,
    minute: 0,
    weekday: 0,
    retentionEnabled: false,
    retentionCount: 14,
    secretConfigured: false,
    lastRunAt: "",
    lastSuccessAt: "",
    lastFile: "",
    lastBytes: 0,
    lastFileCount: 0,
    lastError: "",
    nextRunAt: "",
    updatedAt: "",
  };
}

export function normalizeBackupSettings(value, projectRoot) {
  const defaults = defaultBackupSettings(projectRoot);
  const source = value && typeof value === "object" ? value : {};
  const destination = String(source.destination || defaults.destination).trim();
  return {
    ...defaults,
    enabled: source.enabled === true,
    destination,
    cadence: source.cadence === "weekly" ? "weekly" : "daily",
    hour: clampInteger(source.hour, 0, 23, defaults.hour),
    minute: clampInteger(source.minute, 0, 59, defaults.minute),
    weekday: clampInteger(source.weekday, 0, 6, defaults.weekday),
    retentionEnabled: source.retentionEnabled === true,
    retentionCount: clampInteger(source.retentionCount, 2, 365, defaults.retentionCount),
    secretConfigured: source.secretConfigured === true,
    lastRunAt: String(source.lastRunAt || ""),
    lastSuccessAt: String(source.lastSuccessAt || ""),
    lastFile: path.basename(String(source.lastFile || "")),
    lastBytes: Math.max(0, Number(source.lastBytes) || 0),
    lastFileCount: Math.max(0, Number(source.lastFileCount) || 0),
    lastError: String(source.lastError || "").slice(0, 500),
    nextRunAt: String(source.nextRunAt || ""),
    updatedAt: String(source.updatedAt || ""),
  };
}

export function validateBackupDestination(value) {
  const destination = String(value || "").trim();
  if (!destination || destination.length > 500 || !path.isAbsolute(destination)) {
    throw Object.assign(new Error("Choisissez un chemin absolu local ou UNC pour les sauvegardes."), { statusCode: 400, code: "invalid_backup_destination" });
  }
  const normalized = path.normalize(destination);
  if (normalized === path.parse(normalized).root) {
    throw Object.assign(new Error("La racine d’un disque ou d’un partage ne peut pas servir directement de destination."), { statusCode: 400, code: "invalid_backup_destination" });
  }
  return normalized;
}

export function nextBackupRun(settings, now = Date.now()) {
  if (!settings?.enabled) return "";
  const candidate = new Date(now);
  candidate.setSeconds(0, 0);
  candidate.setHours(settings.hour, settings.minute, 0, 0);
  if (settings.cadence === "weekly") {
    let days = (settings.weekday - candidate.getDay() + 7) % 7;
    if (days === 0 && candidate.getTime() <= now) days = 7;
    candidate.setDate(candidate.getDate() + days);
  } else if (candidate.getTime() <= now) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate.toISOString();
}

function isManagedBackupName(name) {
  return name.startsWith(BACKUP_PREFIX) && name.endsWith(BACKUP_EXTENSION) && /^[A-Za-z0-9_.-]+$/.test(name);
}

export async function listManagedBackups(destination) {
  const root = validateBackupDestination(destination);
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const backups = [];
  for (const entry of entries) {
    if (!entry.isFile() || !isManagedBackupName(entry.name)) continue;
    const info = await stat(path.join(root, entry.name));
    backups.push({ name: entry.name, size: info.size, createdAt: info.birthtime.toISOString(), modifiedAt: info.mtime.toISOString() });
  }
  return backups.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

export async function enforceBackupRetention(destination, retentionCount) {
  const backups = await listManagedBackups(destination);
  const keep = clampInteger(retentionCount, 2, 365, 14);
  const removed = [];
  for (const backup of backups.slice(keep)) {
    const target = path.join(validateBackupDestination(destination), backup.name);
    await rm(target, { force: false });
    removed.push(backup.name);
  }
  return removed;
}

function windowsPowerShell() {
  const root = process.env.SystemRoot || "C:\\Windows";
  return path.join(root, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
}

function runPowerShell(scriptPath, args, { input = "", timeout = 30_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(windowsPowerShell(), ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath, ...args], {
      windowsHide: true,
      timeout,
      maxBuffer: 2 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (error) {
        const message = String(stderr || stdout || error.message || "L’opération PowerShell a échoué.").trim().slice(0, 1000);
        reject(Object.assign(new Error(message), { cause: error }));
        return;
      }
      resolve(String(stdout || "").trim());
    });
    if (input) child.stdin.end(`${input}\n`);
    else child.stdin.end();
  });
}

export async function protectBackupSecret({ projectRoot, secretPath, passphrase }) {
  if (process.platform !== "win32") throw new Error("La planification chiffrée intégrée nécessite Windows.");
  if (typeof passphrase !== "string" || passphrase.length < 12) throw Object.assign(new Error("La phrase secrète doit contenir au moins 12 caractères."), { statusCode: 400 });
  const scriptPath = path.join(projectRoot, "scripts", "Protect-AtlasBackupSecret.ps1");
  await mkdir(path.dirname(secretPath), { recursive: true });
  await runPowerShell(scriptPath, ["-OutputPath", secretPath], { input: passphrase, timeout: 20_000 });
}

export async function createManagedBackup({ projectRoot, dataRoot, destination, passphrase = "", secretPath = "", now = Date.now() }) {
  const root = validateBackupDestination(destination);
  await mkdir(root, { recursive: true });
  const outputPath = path.join(root, `${BACKUP_PREFIX}${stamp(now)}${BACKUP_EXTENSION}`);
  let result;
  if (passphrase) {
    result = await createFullBackup({ dataRoot, outputPath, passphrase });
  } else {
    if (process.platform !== "win32" || !secretPath) throw new Error("Aucune phrase secrète planifiée n’est disponible.");
    const scriptPath = path.join(projectRoot, "scripts", "Invoke-AtlasScheduledBackup.ps1");
    const output = await runPowerShell(scriptPath, ["-DataRoot", dataRoot, "-OutputPath", outputPath, "-SecretPath", secretPath], { timeout: 10 * 60 * 1000 });
    result = JSON.parse(output.split(/\r?\n/).filter(Boolean).at(-1));
  }
  const fileInfo = await stat(outputPath);
  return { ...result, outputPath, name: path.basename(outputPath), size: fileInfo.size, completedAt: nowIso() };
}

export async function inspectManagedBackup({ destination, name, passphrase }) {
  if (!isManagedBackupName(name)) throw Object.assign(new Error("Le fichier de sauvegarde demandé est invalide."), { statusCode: 400 });
  const inputPath = path.join(validateBackupDestination(destination), name);
  const payload = await readFullBackup({ inputPath, passphrase });
  return { valid: true, name, createdAt: payload.createdAt, fileCount: payload.files.length, sessionsExcluded: payload.sessionsExcluded === true };
}

function parseStableVersion(value) {
  const match = String(value || "").trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/i);
  return match ? match.slice(1).map(Number) : null;
}

export function compareStableVersions(candidate, current) {
  const candidateParts = parseStableVersion(candidate);
  const currentParts = parseStableVersion(current);
  if (!candidateParts || !currentParts) return null;
  for (let index = 0; index < 3; index += 1) {
    if (candidateParts[index] > currentParts[index]) return 1;
    if (candidateParts[index] < currentParts[index]) return -1;
  }
  return 0;
}

export function summarizeGithubRelease(payload, { repository = "MaxSim2001/TRC-Community-Atlas", currentVersion = "" } = {}) {
  const assets = Array.isArray(payload?.assets) ? payload.assets.map((asset) => ({
    name: String(asset?.name || ""),
    size: Number(asset?.size) || 0,
    url: String(asset?.browser_download_url || ""),
  })) : [];
  const tag = String(payload?.tag_name || "");
  const comparison = compareStableVersions(tag, currentVersion);
  const manifest = assets.find((asset) => asset.name === "atlas-release-manifest.json");
  const signature = assets.find((asset) => asset.name === "atlas-release-manifest.sig");
  const artifactSetPresent = Boolean(manifest && signature);
  const updateAvailable = comparison === 1;
  let installBlockedReason = "Le manifeste signé requis est absent; Atlas refuse l’installation automatique.";
  if (comparison === null) installBlockedReason = "La version publiée ne suit pas le format stable vMAJEURE.MINEURE.CORRECTIF; Atlas refuse de la préparer.";
  else if (comparison === 0) installBlockedReason = "Cette version est déjà installée.";
  else if (comparison < 0) installBlockedReason = "La version publiée est plus ancienne que la version installée; Atlas refuse tout retour arrière non préparé.";
  else if (artifactSetPresent) installBlockedReason = "Le manifeste et sa signature sont présents, mais ils ne sont pas encore téléchargés et vérifiés avec une clé de publication approuvée. L’installation reste bloquée.";
  return {
    available: true,
    updateAvailable,
    sameVersion: comparison === 0,
    versionComparison: comparison,
    checkedAt: nowIso(),
    repository,
    currentVersion: String(currentVersion || ""),
    tag,
    name: String(payload?.name || payload?.tag_name || "Version Atlas"),
    publishedAt: String(payload?.published_at || ""),
    notes: String(payload?.body || "").slice(0, 8000),
    pageUrl: String(payload?.html_url || ""),
    assets,
    artifactSetPresent,
    signatureVerified: false,
    packageVerified: false,
    rollbackReady: false,
    installable: false,
    installBlockedReason,
  };
}

export function checkLatestGithubRelease({ repository = "MaxSim2001/TRC-Community-Atlas", currentVersion = "", timeout = 7000 } = {}) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) return Promise.reject(new Error("Dépôt GitHub invalide."));
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (message, statusCode = 502) => {
      if (settled) return;
      settled = true;
      reject(Object.assign(new Error(message), { statusCode, code: "github_release_check_failed" }));
    };
    const request = https.request({
      hostname: "api.github.com",
      port: 443,
      path: `/repos/${repository}/releases/latest`,
      method: "GET",
      headers: { accept: "application/vnd.github+json", "user-agent": "TRC-Community-Atlas-Updater", "x-github-api-version": "2022-11-28" },
      rejectUnauthorized: true,
      timeout,
    }, (response) => {
      const chunks = [];
      let size = 0;
      response.on("data", (chunk) => {
        size += chunk.length;
        if (size > 256 * 1024) request.destroy(new Error("Réponse GitHub trop volumineuse."));
        else chunks.push(chunk);
      });
      response.on("end", () => {
        if (settled) return;
        let payload;
        try { payload = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
        catch { fail("GitHub n’a pas retourné un document JSON valide."); return; }
        if (response.statusCode === 404) { settled = true; resolve({ available: false, reason: "no-stable-release", checkedAt: nowIso(), repository }); return; }
        if (response.statusCode !== 200) { fail(`GitHub a répondu avec le statut ${response.statusCode}.`); return; }
        settled = true;
        resolve(summarizeGithubRelease(payload, { repository, currentVersion }));
      });
    });
    request.on("timeout", () => request.destroy(new Error("Délai GitHub dépassé.")));
    request.on("error", (error) => fail(`Vérification GitHub impossible : ${error.message}`));
    request.end();
  });
}

