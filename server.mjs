import http from "node:http";
import https from "node:https";
import { execFile } from "node:child_process";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, readFile, rename, stat, statfs, unlink, writeFile } from "node:fs/promises";
import { createConnection, isIP } from "node:net";
import path from "node:path";
import { domainToASCII, fileURLToPath } from "node:url";
import { AtlasStore } from "./lib/atlas-store.mjs";
import {
  checkLatestGithubRelease,
  compareStableVersions,
  createManagedBackup,
  enforceBackupRetention,
  inspectManagedBackup,
  launchReleaseUpdater,
  listManagedBackups,
  nextBackupRun,
  normalizeBackupSettings,
  prepareGithubRelease,
  protectBackupSecret,
  validateBackupDestination,
} from "./lib/atlas-operations.mjs";

const modulePath = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(modulePath);
const publicRoot = path.join(projectRoot, "public");
const defaultDataRoot = path.join(projectRoot, "data");
const DEFAULT_JSON_BODY_BYTES = 256 * 1024;
const SENSITIVE_BODY_BYTES = 8 * 1024;
const IMPORT_BODY_BYTES = 16 * 1024 * 1024;
const ATTACHMENT_BODY_BYTES = 12 * 1024 * 1024;
const MAX_WORKSPACE_BYTES = 16 * 1024 * 1024;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_LIMIT = 8;
const MFA_WINDOW_MS = 15 * 60 * 1000;
const MFA_ACCOUNT_LIMIT = 10;
const MFA_IP_LIMIT = 30;
const MFA_CHALLENGE_LIMIT = 5;
const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([".pdf", ".txt", ".md", ".csv", ".json", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".docx", ".xlsx", ".pptx", ".zip", ".7z"]);
const ATLAS_VERSION = "0.15.3";

const staticFiles = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/assets/styles.css", ["assets/styles.css", "text/css; charset=utf-8"]],
  ["/assets/help-content.js", ["assets/help-content.js", "text/javascript; charset=utf-8"]],
  ["/assets/app.js", ["assets/app.js", "text/javascript; charset=utf-8"]],
  ["/assets/trc-atlas-layers-logo.svg", ["assets/trc-atlas-layers-logo.svg", "image/svg+xml"]],
  ["/assets/trc-atlas-icon-192.png", ["assets/trc-atlas-icon-192.png", "image/png"]],
  ["/assets/trc-atlas-icon-512.png", ["assets/trc-atlas-icon-512.png", "image/png"]],
  ["/assets/help/github-release-0.15.2.png", ["assets/help/github-release-0.15.2.png", "image/png"]],
  ["/assets/help/settings-backups.png", ["assets/help/settings-backups.png", "image/png"]],
  ["/assets/help/settings-updates.png", ["assets/help/settings-updates.png", "image/png"]],
  ["/favicon.svg", ["assets/trc-atlas-layers-logo.svg", "image/svg+xml"]],
  ["/manifest.webmanifest", ["manifest.webmanifest", "application/manifest+json; charset=utf-8"]],
  ["/service-worker.js", ["service-worker.js", "text/javascript; charset=utf-8"]],
]);

function parseArgs(argv) {
  const result = { host: "127.0.0.1", port: 9092, dataRoot: defaultDataRoot, allowedOrigins: [], trustedProxies: [] };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--port") result.port = Number(argv[index + 1]);
    if (argv[index] === "--data") result.dataRoot = path.resolve(argv[index + 1]);
    if (argv[index] === "--host") result.host = String(argv[index + 1] || "").trim();
    if (argv[index] === "--origin") result.allowedOrigins.push(String(argv[index + 1] || "").trim());
    if (argv[index] === "--trusted-proxy") result.trustedProxies.push(String(argv[index + 1] || "").trim());
  }
  if (!Number.isInteger(result.port) || result.port < 1024 || result.port > 65535) {
    throw new Error("Le port doit être un entier entre 1024 et 65535.");
  }
  if (!result.host || !/^[a-z0-9.:-]+$/i.test(result.host)) {
    throw new Error("L’adresse d’écoute Atlas est invalide.");
  }
  result.allowedOrigins = result.allowedOrigins.map((origin) => {
    const normalized = normalizeOrigin(origin);
    if (!normalized) throw new Error(`Origine publique Atlas invalide : ${origin}`);
    return normalized;
  });
  if (result.trustedProxies.length > 16 || result.trustedProxies.some((address) => !normalizeProxyAddress(address))) {
    throw new Error("Chaque proxy de confiance doit être une adresse IPv4 ou IPv6 exacte; maximum 16.");
  }
  result.trustedProxies = [...new Set(result.trustedProxies.map(normalizeProxyAddress))];
  return result;
}

function jsonResponse(response, status, body, headers = {}) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  });
  response.end(JSON.stringify(body));
}

function errorResponse(response, status, code, message, headers = {}) {
  jsonResponse(response, status, { error: code, message }, headers);
}

function setSecurityHeaders(response) {
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("x-frame-options", "DENY");
  response.setHeader("referrer-policy", "no-referrer");
  response.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()");
  response.setHeader(
    "content-security-policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  );
}

async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJsonAtomic(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  await rename(temporaryPath, filePath);
}

function requestBodyLimit(method, pathname) {
  if (["GET", "HEAD"].includes(method)) return 0;
  if (method === "POST" && pathname === "/api/attachments") return ATTACHMENT_BODY_BYTES;
  if ((method === "PUT" && pathname === "/api/workspace") || (method === "POST" && pathname === "/api/import")) return IMPORT_BODY_BYTES;
  if (/^\/api\/(?:setup|login|mfa\/|password\/|vault\/unlock|me\/(?:change-password|recovery-codes|mfa\/re-enroll))/.test(pathname)) return SENSITIVE_BODY_BYTES;
  return DEFAULT_JSON_BODY_BYTES;
}

async function readBody(request) {
  const limit = Number.isInteger(request.atlasBodyLimit) ? request.atlasBodyLimit : DEFAULT_JSON_BODY_BYTES;
  const declaredLength = Number(request.headers["content-length"] || 0);
  if (Number.isFinite(declaredLength) && declaredLength > limit) {
    const error = new Error("Corps de requête trop volumineux.");
    error.statusCode = 413;
    error.code = "request_too_large";
    throw error;
  }
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > limit) {
      const error = new Error("Corps de requête trop volumineux.");
      error.statusCode = 413;
      error.code = "request_too_large";
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Corps JSON invalide.");
    error.statusCode = 400;
    throw error;
  }
}

function derivePassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, record) {
  const derived = Buffer.from(derivePassword(password, record.salt).hash, "hex");
  const stored = Buffer.from(record.hash, "hex");
  return derived.length === stored.length && timingSafeEqual(derived, stored);
}

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function encodeBase32(buffer) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function decodeBase32(value) {
  const cleaned = String(value).toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let accumulator = 0;
  const bytes = [];
  for (const character of cleaned) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) continue;
    accumulator = (accumulator << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((accumulator >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function totpAt(secret, timestamp = Date.now()) {
  const counter = Math.floor(timestamp / 30000);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 15;
  const number = (digest.readUInt32BE(offset) & 0x7fffffff) % 1000000;
  return String(number).padStart(6, "0");
}

function verifyTotp(secret, code) {
  const normalized = String(code || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  return [-30000, 0, 30000].some((offset) => {
    const expected = Buffer.from(totpAt(secret, Date.now() + offset));
    const received = Buffer.from(normalized);
    return expected.length === received.length && timingSafeEqual(expected, received);
  });
}

function recoveryHash(code) {
  return createHash("sha256").update(String(code).replace(/[^A-Za-z0-9]/g, "").toUpperCase()).digest("hex");
}

function generateRecoveryCodes() {
  return Array.from({ length: 8 }, () => `${randomBytes(3).toString("hex").toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`);
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    enabled: user.enabled !== false,
    organizationIds: user.role === "administrator" || !Array.isArray(user.organizationIds) ? null : user.organizationIds,
    vaultAccess: user.role === "administrator" || user.vaultAccess !== false,
    organizationPermissions: user.role === "administrator" || !Array.isArray(user.organizationPermissions) ? null : user.organizationPermissions.map((permission) => ({ organizationId: permission.organizationId, role: permission.role === "editor" ? "editor" : "viewer", vaultAccess: permission.vaultAccess === true })),
    mfaEnabled: Boolean(user.mfa?.enabled),
    mustChangePassword: Boolean(user.mustChangePassword),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt || user.createdAt,
    preferences: {
      visibleModules: Array.isArray(user.preferences?.visibleModules) ? user.preferences.visibleModules : null,
    },
  };
}

function normalizedSecuritySettings(settings = {}) {
  const source = settings?.security && typeof settings.security === "object" ? settings.security : {};
  const rotationDays = Number(source.passwordRotationDays);
  const reminderDays = Number(source.passwordRotationReminderDays);
  return {
    privilegedMfaEnabled: source.privilegedMfaEnabled !== false,
    passwordRotationEnabled: source.passwordRotationEnabled === true,
    passwordRotationDays: Number.isInteger(rotationDays) && rotationDays >= 1 && rotationDays <= 730 ? rotationDays : 90,
    passwordRotationReminderDays: Number.isInteger(reminderDays) && reminderDays >= 1 && reminderDays <= 180 ? reminderDays : 14,
  };
}

export function normalizeAtlasDomain(value) {
  const raw = String(value || "").trim().toLowerCase().replace(/\.$/, "");
  if (!raw) return "";
  if (raw.length > 253 || /[\s/:\\@?#]/.test(raw) || isIP(raw)) return null;
  const ascii = domainToASCII(raw);
  if (!ascii || ascii.length > 253 || !ascii.includes(".")) return null;
  const labels = ascii.split(".");
  if (labels.some((label) => !label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) return null;
  return ascii;
}

export function normalizeProxyAddress(value) {
  let normalized = String(value || "").trim().toLowerCase();
  if (normalized.startsWith("[")) normalized = normalized.slice(1, normalized.indexOf("]"));
  if (normalized.startsWith("::ffff:")) normalized = normalized.slice(7);
  normalized = normalized.split("%", 1)[0];
  return isIP(normalized) ? normalized : null;
}

function normalizedTrustedProxies(value) {
  const raw = Array.isArray(value) ? value : String(value || "").split(/[\n,;]+/);
  return [...new Set(raw.map(normalizeProxyAddress).filter(Boolean))].slice(0, 16);
}

export function normalizedDeploymentSettings(settings = {}) {
  const source = settings?.deployment && typeof settings.deployment === "object" ? settings.deployment : settings;
  const rawCode = String(source?.instanceCode || "ATLAS").trim().toUpperCase();
  const instanceCode = /^[A-Z0-9][A-Z0-9-]{1,31}$/.test(rawCode) ? rawCode : "ATLAS";
  const primaryDomain = normalizeAtlasDomain(source?.primaryDomain) || "";
  const domainAliases = [...new Set((Array.isArray(source?.domainAliases) ? source.domainAliases : [])
    .map(normalizeAtlasDomain)
    .filter((domain) => domain && domain !== primaryDomain))].slice(0, 10);
  const accessMode = source?.accessMode === "reverse-proxy" ? "reverse-proxy" : "local";
  const reverseProxy = ["nginx", "iis", "caddy", "other"].includes(source?.reverseProxy) ? source.reverseProxy : "nginx";
  const trustedProxies = normalizedTrustedProxies(source?.trustedProxies);
  return { instanceCode, primaryDomain, domainAliases, accessMode, reverseProxy, trustedProxies, certificateManagement: "reverse-proxy" };
}

function deploymentSettingsFromInput(input = {}) {
  const rawCode = String(input.instanceCode || "").trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{1,31}$/.test(rawCode)) {
    throw Object.assign(new Error("Le code de l’instance doit contenir de 2 à 32 lettres, chiffres ou tirets."), { statusCode: 400, code: "invalid_instance_code" });
  }
  const rawPrimaryDomain = String(input.primaryDomain || "").trim();
  const primaryDomain = normalizeAtlasDomain(rawPrimaryDomain);
  if (rawPrimaryDomain && !primaryDomain) {
    throw Object.assign(new Error("Le domaine principal doit être un nom DNS complet sans protocole, port ni chemin."), { statusCode: 400, code: "invalid_primary_domain" });
  }
  const rawAliases = Array.isArray(input.domainAliases) ? input.domainAliases : String(input.domainAliases || "").split(/[\n,;]+/);
  if (rawAliases.length > 10) throw Object.assign(new Error("Un maximum de 10 domaines secondaires est permis."), { statusCode: 400, code: "too_many_domain_aliases" });
  const domainAliases = [];
  for (const rawAlias of rawAliases) {
    if (!String(rawAlias || "").trim()) continue;
    const alias = normalizeAtlasDomain(rawAlias);
    if (!alias) throw Object.assign(new Error(`Le domaine secondaire « ${String(rawAlias).trim()} » est invalide.`), { statusCode: 400, code: "invalid_domain_alias" });
    if (alias !== primaryDomain && !domainAliases.includes(alias)) domainAliases.push(alias);
  }
  const accessMode = input.accessMode === "reverse-proxy" ? "reverse-proxy" : input.accessMode === "local" ? "local" : null;
  if (!accessMode) throw Object.assign(new Error("Le mode d’accès Atlas est invalide."), { statusCode: 400, code: "invalid_access_mode" });
  if (accessMode === "reverse-proxy" && !primaryDomain) {
    throw Object.assign(new Error("Un domaine principal est requis pour l’accès HTTPS par proxy inverse."), { statusCode: 400, code: "primary_domain_required" });
  }
  const reverseProxy = ["nginx", "iis", "caddy", "other"].includes(input.reverseProxy) ? input.reverseProxy : null;
  if (!reverseProxy) throw Object.assign(new Error("Choisissez le proxy inverse utilisé devant Atlas."), { statusCode: 400, code: "invalid_reverse_proxy" });
  const rawTrustedProxies = Array.isArray(input.trustedProxies) ? input.trustedProxies : String(input.trustedProxies || "").split(/[\n,;]+/);
  if (rawTrustedProxies.filter((entry) => String(entry || "").trim()).length > 16) throw Object.assign(new Error("Un maximum de 16 proxys de confiance est permis."), { statusCode: 400, code: "too_many_trusted_proxies" });
  for (const rawProxy of rawTrustedProxies) {
    if (String(rawProxy || "").trim() && !normalizeProxyAddress(rawProxy)) throw Object.assign(new Error(`L’adresse du proxy « ${String(rawProxy).trim()} » est invalide.`), { statusCode: 400, code: "invalid_trusted_proxy" });
  }
  const trustedProxies = normalizedTrustedProxies(rawTrustedProxies);
  return { instanceCode: rawCode, primaryDomain, domainAliases, accessMode, reverseProxy, trustedProxies, certificateManagement: "reverse-proxy" };
}

function deploymentOrigins(settings = {}) {
  const deployment = normalizedDeploymentSettings(settings);
  return [deployment.primaryDomain, ...deployment.domainAliases].filter(Boolean).map((domain) => `https://${domain}`);
}

function runAutostartManager({ mode, host, port, dataRoot, allowedOrigins, trustedProxies = [] }) {
  if (process.platform !== "win32") {
    return Promise.resolve({ supported: false, installed: false, enabled: false, state: "Unsupported", trigger: "none", runAs: "", hidden: null, lastRunAt: null, lastTaskResult: null, taskName: "TRC Community Atlas", message: "La gestion intégrée du démarrage automatique est disponible dans le paquet Windows Atlas." });
  }
  const scriptPath = path.join(projectRoot, "scripts", "Set-TRCCommunityAtlasAutostart.ps1");
  const systemRoot = process.env.SystemRoot || "C:\\Windows";
  const powershellPath = path.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const args = [
    "-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
    "-File", scriptPath,
    "-Mode", mode[0].toUpperCase() + mode.slice(1),
    "-ProjectRoot", projectRoot,
    "-NodePath", process.execPath,
    "-DataRoot", dataRoot,
    "-Port", String(port),
    "-BindAddress", host,
    "-AllowedOrigins", [...new Set(allowedOrigins)].join("|"),
    "-TrustedProxies", [...new Set(trustedProxies)].join("|"),
    "-Json",
  ];
  return new Promise((resolve, reject) => {
    execFile(powershellPath, args, { windowsHide: true, timeout: 20_000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const detail = String(stderr || stdout || error.message || "").trim().split(/\r?\n/).filter(Boolean).at(-1) || "La tâche Windows n’a pas pu être configurée.";
        reject(Object.assign(new Error(detail), { statusCode: 503, code: "autostart_configuration_failed" }));
        return;
      }
      try {
        const output = String(stdout || "").trim().split(/\r?\n/).filter(Boolean).at(-1);
        resolve(JSON.parse(output));
      } catch {
        reject(Object.assign(new Error("Windows n’a pas retourné un état d’autodémarrage valide."), { statusCode: 503, code: "autostart_status_invalid" }));
      }
    });
  });
}

export function isPublicProbeAddress(address) {
  const version = isIP(address);
  if (version === 4) {
    const octets = address.split(".").map(Number);
    const [a, b] = octets;
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 0 || b === 168)) return false;
    if (a === 198 && (b === 18 || b === 19 || b === 51)) return false;
    if (a === 203 && b === 0) return false;
    return true;
  }
  if (version === 6) {
    const normalized = address.toLowerCase();
    const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    if (mapped) return isPublicProbeAddress(mapped);
    if (normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || /^fe[89ab]/.test(normalized) || normalized.startsWith("ff") || normalized.startsWith("2001:db8")) return false;
    return true;
  }
  return false;
}

async function probePublicAtlasDomain(domain) {
  const normalizedDomain = normalizeAtlasDomain(domain);
  if (!normalizedDomain) throw Object.assign(new Error("Aucun domaine public valide n’est configuré."), { statusCode: 400, code: "invalid_primary_domain" });
  let addresses;
  try {
    addresses = await lookup(normalizedDomain, { all: true, verbatim: true });
  } catch {
    throw Object.assign(new Error("Le domaine enregistré ne peut pas être résolu par DNS."), { statusCode: 502, code: "public_probe_dns_failed" });
  }
  if (!addresses.length || addresses.some((entry) => !isPublicProbeAddress(entry.address))) {
    throw Object.assign(new Error("La vérification publique est refusée : le domaine doit résoudre uniquement vers des adresses Internet publiques."), { statusCode: 400, code: "unsafe_probe_destination" });
  }
  const destination = addresses[0];
  return new Promise((resolve, reject) => {
    let certificate = null;
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(Object.assign(new Error(`La vérification HTTPS a échoué : ${error.message}`), { statusCode: 502, code: "public_probe_failed" }));
    };
    const request = https.request({
      hostname: destination.address,
      family: destination.family,
      port: 443,
      path: "/api/status",
      method: "GET",
      servername: normalizedDomain,
      headers: { host: normalizedDomain, accept: "application/json", "user-agent": "TRC-Atlas-Health-Check" },
      rejectUnauthorized: true,
      timeout: 5000,
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400) {
        response.resume();
        fail(new Error("les redirections ne sont pas suivies"));
        return;
      }
      const chunks = [];
      let size = 0;
      response.on("data", (chunk) => {
        size += chunk.length;
        if (size > 64 * 1024) request.destroy(new Error("réponse trop volumineuse"));
        else chunks.push(chunk);
      });
      response.on("end", () => {
        if (settled) return;
        let payload;
        try { payload = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
        catch { fail(new Error("la réponse /api/status n’est pas un JSON valide")); return; }
        if (response.statusCode !== 200 || payload?.ok !== true) {
          fail(new Error("le domaine ne répond pas comme une instance Atlas"));
          return;
        }
        const validTimestamp = Date.parse(certificate?.valid_to || "");
        const validTo = Number.isFinite(validTimestamp) ? new Date(validTimestamp).toISOString() : "";
        settled = true;
        resolve({
          checkedAt: nowIso(),
          domain: normalizedDomain,
          address: destination.address,
          atlas: { ok: true },
          certificate: {
            subject: String(certificate?.subject?.CN || ""),
            issuer: String(certificate?.issuer?.CN || certificate?.issuer?.O || ""),
            validTo,
            daysRemaining: validTo ? Math.floor((Date.parse(validTo) - Date.now()) / 86400000) : null,
            subjectAltName: String(certificate?.subjectaltname || ""),
          },
        });
      });
    });
    request.on("socket", (socket) => socket.once("secureConnect", () => { certificate = socket.getPeerCertificate(); }));
    request.on("timeout", () => request.destroy(new Error("délai de 5 secondes dépassé")));
    request.on("error", fail);
    request.end();
  });
}

function passwordStrength(password) {
  const value = String(password || "");
  let score = 0;
  if (value.length >= 12) score += 1;
  if (value.length >= 16) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score += 1;
  return Math.min(score, 4);
}

function passwordFingerprint(password, key) {
  return password ? createHmac("sha256", key).update(String(password)).digest("hex") : "";
}

function safeIsoDate(value) {
  if (!value) return "";
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function encryptPayload(value, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return { algorithm: "aes-256-gcm", iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: encrypted.toString("base64") };
}

function decryptPayload(record, key) {
  if (!record || record.algorithm !== "aes-256-gcm") throw new Error("Format de coffre invalide.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(record.iv, "base64"));
  decipher.setAuthTag(Buffer.from(record.tag, "base64"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(record.data, "base64")), decipher.final()]).toString("utf8"));
}

function cleanText(value, maxLength, required = false) {
  if (typeof value !== "string") return required ? null : "";
  const cleaned = value.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").trim();
  if ((required && !cleaned) || cleaned.length > maxLength) return null;
  return cleaned;
}

function isSafeId(value) {
  return typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/i.test(value);
}

function isSafeAssetRef(value) {
  return typeof value === "string" && /^(configuration|site|procedure|module|vault):[a-z0-9][a-z0-9-]{0,63}$/i.test(value);
}

function safeAttachmentName(value) {
  const name = cleanText(value, 180, true);
  if (!name || path.basename(name) !== name || !ALLOWED_ATTACHMENT_EXTENSIONS.has(path.extname(name).toLowerCase())) return null;
  return name;
}

function publicAttachment(item) {
  return {
    id: item.id,
    assetRef: item.assetRef,
    organizationId: item.organizationId,
    name: item.name,
    mimeType: item.mimeType,
    size: item.size,
    createdAt: item.createdAt,
    createdBy: item.createdBy,
  };
}

function nowIso() {
  return new Date().toISOString();
}

function seedWorkspace() {
  const createdAt = nowIso();
  return {
    schemaVersion: 5,
    updatedAt: createdAt,
    organizations: [
      { id: "org-northstar", name: "Northstar Architecture", code: "NSA", industry: "Architecture", owner: "Sophie Tremblay", status: "active", notes: "Bureaux Montréal et Québec" },
      { id: "org-boreal", name: "Clinique Boréal", code: "CBL", industry: "Santé", owner: "Marc Lavoie", status: "active", notes: "Environnement clinique prioritaire" },
      { id: "org-atlas-demo", name: "Atelier Atlas", code: "ATA", industry: "Services", owner: "Équipe TI", status: "active", notes: "Organisation de démonstration" },
    ],
    sites: [
      { id: "site-nsa-mtl", organizationId: "org-northstar", name: "Montréal — Siège", address: "Montréal, QC", timezone: "America/Toronto", status: "active" },
      { id: "site-nsa-qc", organizationId: "org-northstar", name: "Québec — Studio", address: "Québec, QC", timezone: "America/Toronto", status: "active" },
      { id: "site-cbl-lvl", organizationId: "org-boreal", name: "Laval — Clinique", address: "Laval, QC", timezone: "America/Toronto", status: "active" },
      { id: "site-ata-lab", organizationId: "org-atlas-demo", name: "Laboratoire local", address: "Instance locale", timezone: "America/Toronto", status: "active" },
    ],
    configurations: [
      { id: "cfg-nsa-dc01", organizationId: "org-northstar", siteId: "site-nsa-mtl", name: "NSA-DC01", type: "Serveur", os: "Windows Server 2025", ip: "10.20.10.10", owner: "Équipe infrastructure", location: "Salle serveur A", warranty: "2028-05-18", criticality: "critical", status: "documented", lastReviewed: "2026-09-28", rmmId: "", summary: "Contrôleur de domaine principal et DNS du siège.", notes: "Maintenance mensuelle le samedi soir.", procedureIds: ["proc-patching"], relationIds: ["rel-dc01-nas"] },
      { id: "cfg-nsa-nas01", organizationId: "org-northstar", siteId: "site-nsa-mtl", name: "NSA-NAS01", type: "Stockage", os: "TrueNAS SCALE", ip: "10.20.10.20", owner: "Équipe infrastructure", location: "Salle serveur A", warranty: "2027-11-30", criticality: "high", status: "review", lastReviewed: "2026-08-12", rmmId: "", summary: "Stockage central des projets et des sauvegardes locales.", notes: "Validation des restaurations à planifier.", procedureIds: ["proc-backup"], relationIds: ["rel-dc01-nas"] },
      { id: "cfg-cbl-app01", organizationId: "org-boreal", siteId: "site-cbl-lvl", name: "CBL-APP01", type: "Serveur", os: "Windows Server 2022", ip: "10.42.5.15", owner: "Applications cliniques", location: "Local TI", warranty: "2027-02-14", criticality: "critical", status: "documented", lastReviewed: "2026-09-30", rmmId: "", summary: "Serveur applicatif de la clinique.", notes: "Accès restreint aux administrateurs autorisés.", procedureIds: ["proc-incident"], relationIds: [] },
      { id: "cfg-ata-ws01", organizationId: "org-atlas-demo", siteId: "site-ata-lab", name: "ATA-WS01", type: "Poste", os: "Windows 11 Pro", ip: "192.168.10.31", owner: "Camille Roy", location: "Bureau 204", warranty: "2029-01-09", criticality: "normal", status: "draft", lastReviewed: "2026-09-20", rmmId: "", summary: "Poste de conception principal.", notes: "Fiche à compléter après inventaire.", procedureIds: [], relationIds: [] },
    ],
    procedures: [
      { id: "proc-patching", organizationId: "org-northstar", title: "Fenêtre de maintenance — serveurs", category: "Maintenance", owner: "Équipe infrastructure", status: "published", updatedAt: "2026-09-27", summary: "Préparation, validation et retour arrière pour les mises à jour mensuelles.", steps: ["Valider les sauvegardes récentes", "Confirmer la fenêtre avec le propriétaire", "Appliquer les mises à jour", "Tester les services et documenter le résultat"] },
      { id: "proc-backup", organizationId: "org-northstar", title: "Vérification des sauvegardes", category: "Continuité", owner: "Équipe infrastructure", status: "review", updatedAt: "2026-09-22", summary: "Contrôle de la fraîcheur et test de restauration d’un échantillon.", steps: ["Contrôler la dernière exécution", "Choisir un fichier témoin", "Restaurer dans un emplacement isolé", "Consigner le résultat"] },
      { id: "proc-incident", organizationId: "org-boreal", title: "Incident applicatif prioritaire", category: "Incident", owner: "Applications cliniques", status: "published", updatedAt: "2026-09-30", summary: "Triage et escalade d’un incident affectant les opérations cliniques.", steps: ["Qualifier l’impact", "Prévenir la personne responsable", "Collecter les événements", "Appliquer le plan de reprise autorisé"] },
    ],
    relations: [
      { id: "rel-dc01-nas", organizationId: "org-northstar", sourceRef: "configuration:cfg-nsa-dc01", targetRef: "configuration:cfg-nsa-nas01", relationType: "backed-up-to", label: "Sauvegardé vers", reverseLabel: "Reçoit les sauvegardes de", notes: "Sauvegarde de l’état système et des configurations", archived: false, createdAt, createdBy: "Système", updatedAt: createdAt },
    ],
    relationshipEvents: [
      { id: "rev-rel-dc01-nas", relationId: "rel-dc01-nas", at: createdAt, actor: "Système", action: "Relation ajoutée", sourceRef: "configuration:cfg-nsa-dc01", targetRef: "configuration:cfg-nsa-nas01", relationType: "backed-up-to", label: "Sauvegardé vers" },
    ],
    customModuleDefinitions: [],
    activities: [
      { id: "act-1", at: createdAt, actor: "Système", action: "Instance initialisée", target: "TRC Community Atlas", kind: "system" },
      { id: "act-2", at: "2026-09-30T14:20:00.000Z", actor: "Sophie Tremblay", action: "Procédure publiée", target: "Incident applicatif prioritaire", kind: "procedure" },
      { id: "act-3", at: "2026-09-28T16:05:00.000Z", actor: "Marc Lavoie", action: "Configuration révisée", target: "NSA-DC01", kind: "configuration" },
    ],
    settings: {
      instanceName: "Atlas local",
      defaultLocale: "fr",
      deployment: {
        instanceCode: "ATLAS",
        primaryDomain: "",
        domainAliases: [],
        accessMode: "local",
        reverseProxy: "nginx",
        certificateManagement: "reverse-proxy",
      },
      security: {
        privilegedMfaEnabled: true,
        passwordRotationEnabled: false,
        passwordRotationDays: 90,
        passwordRotationReminderDays: 14,
      },
      rmm: { enabled: false, baseUrl: "", lastSyncAt: null },
      sso: { enabled: false, provider: "trc-rmm" },
    },
  };
}

export function validateOrganizationHierarchy(organizations, { allowExternalParents = false } = {}) {
  if (!Array.isArray(organizations)) return false;
  const byId = new Map();
  for (const organization of organizations) {
    if (!organization || !isSafeId(organization.id) || byId.has(organization.id)) return false;
    const parentId = String(organization.parentOrganizationId || "").trim();
    if (parentId && (!isSafeId(parentId) || parentId === organization.id)) return false;
    byId.set(organization.id, organization);
  }
  for (const organization of organizations) {
    let current = organization;
    let depth = 1;
    const visited = new Set([organization.id]);
    while (current?.parentOrganizationId) {
      const parentId = String(current.parentOrganizationId).trim();
      if (visited.has(parentId)) return false;
      visited.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) {
        if (allowExternalParents) break;
        return false;
      }
      depth += 1;
      if (depth > 3) return false;
      current = parent;
    }
  }
  return true;
}

function validateWorkspace(value, options = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const collections = { organizations: 1000, sites: 10000, configurations: 20000, procedures: 10000, relations: 30000, activities: 5000 };
  for (const [key, limit] of Object.entries(collections)) {
    if (!Array.isArray(value[key]) || value[key].length > limit) return false;
    if (value[key].some((item) => !item || typeof item !== "object" || !isSafeId(item.id))) return false;
  }
  for (const [key, limit] of [["moduleRecords", 30000], ["templates", 5000], ["relationshipEvents", 30000]]) {
    if (value[key] === undefined) continue;
    if (!Array.isArray(value[key]) || value[key].length > limit) return false;
    if (value[key].some((item) => !item || typeof item !== "object" || !isSafeId(item.id))) return false;
  }
  if (value.customModuleDefinitions !== undefined) {
    if (!Array.isArray(value.customModuleDefinitions) || value.customModuleDefinitions.length > 50) return false;
    const moduleIds = new Set();
    const allowedFieldTypes = new Set(["text", "textarea", "number", "date", "url", "email", "tel", "select"]);
    for (const module of value.customModuleDefinitions) {
      if (!module || !/^local-[a-z0-9][a-z0-9-]{0,55}$/i.test(module.id) || moduleIds.has(module.id)) return false;
      moduleIds.add(module.id);
      if (typeof module.label !== "string" || !module.label.trim() || module.label.length > 80 || typeof module.description !== "string" || module.description.length > 300) return false;
      if (!Array.isArray(module.fields) || module.fields.length < 4 || module.fields.length > 20) return false;
      const fieldKeys = new Set();
      for (const field of module.fields) {
        if (!field || !/^[a-z][a-z0-9]{1,39}$/i.test(field.key) || fieldKeys.has(field.key) || typeof field.label !== "string" || !field.label.trim() || field.label.length > 80 || !allowedFieldTypes.has(field.type)) return false;
        if (/(password|secret|token|api.?key|credential|mot.?de.?passe)/i.test(`${field.key} ${field.label}`)) return false;
        fieldKeys.add(field.key);
        if (field.type === "select" && (!Array.isArray(field.options) || !field.options.length || field.options.length > 30 || field.options.some((option) => typeof option !== "string" || !option.trim() || option.length > 80))) return false;
      }
    }
  }
  if (!validateOrganizationHierarchy(value.organizations, options)) return false;
  if (!value.settings || typeof value.settings !== "object") return false;
  const encodedLength = Buffer.byteLength(JSON.stringify(value), "utf8");
  return encodedLength <= MAX_WORKSPACE_BYTES * 0.9;
}

function parseCookies(request) {
  const result = {};
  for (const part of (request.headers.cookie || "").split(";")) {
    const splitAt = part.indexOf("=");
    if (splitAt < 0) continue;
    result[part.slice(0, splitAt).trim()] = decodeURIComponent(part.slice(splitAt + 1).trim());
  }
  return result;
}

function normalizeOrigin(value) {
  try {
    const parsed = new URL(String(value || ""));
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function sameOrigin(request, port, allowedOrigins) {
  const origin = request.headers.origin;
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  return normalized === `http://127.0.0.1:${port}` || normalized === `http://localhost:${port}` || Boolean(normalized && allowedOrigins.has(normalized));
}

function socketAddress(request) {
  return normalizeProxyAddress(request.socket.remoteAddress) || "local";
}

function requestUsesHttps(request, trustedProxies = new Set()) {
  if (request.socket.encrypted) return true;
  if (!trustedProxies.has(socketAddress(request))) return false;
  return String(request.headers["x-forwarded-proto"] || "").split(",", 1)[0].trim().toLowerCase() === "https";
}

function sessionCookie(request, value, maxAge, trustedProxies = new Set()) {
  return `atlas_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${requestUsesHttps(request, trustedProxies) ? "; Secure" : ""}`;
}

export function createAtlasServer(options = {}) {
  const host = options.host || "127.0.0.1";
  const port = options.port || 9092;
  const allowedOrigins = new Set((options.allowedOrigins || []).map(normalizeOrigin).filter(Boolean));
  const savedDeploymentOrigins = new Set();
  const trustedProxies = new Set(normalizedTrustedProxies(options.trustedProxies));
  const savedTrustedProxies = new Set();
  const dataRoot = options.dataRoot || defaultDataRoot;
  const sessionNow = typeof options.now === "function" ? options.now : Date.now;
  const manageAutostart = typeof options.autostartManager === "function" ? options.autostartManager : runAutostartManager;
  const releaseChecker = typeof options.releaseChecker === "function" ? options.releaseChecker : () => checkLatestGithubRelease({ currentVersion: ATLAS_VERSION });
  const releasePreparer = typeof options.releasePreparer === "function" ? options.releasePreparer : prepareGithubRelease;
  const updaterLauncher = typeof options.updateLauncher === "function" ? options.updateLauncher : launchReleaseUpdater;
  const backupSecretProtector = typeof options.backupSecretProtector === "function" ? options.backupSecretProtector : protectBackupSecret;
  const authPath = path.join(dataRoot, "auth.json");
  const sessionsPath = path.join(dataRoot, "sessions.json");
  const workspacePath = path.join(dataRoot, "workspace.json");
  const historyPath = path.join(dataRoot, "workspace-history.json");
  const vaultPath = path.join(dataRoot, "vault.json");
  const vaultKeyPath = path.join(dataRoot, "vault.key");
  const attachmentsPath = path.join(dataRoot, "attachments.json");
  const attachmentFilesRoot = path.join(dataRoot, "attachments");
  const backupSettingsPath = path.join(dataRoot, "backup-settings.json");
  const backupSecretPath = path.join(dataRoot, "backup-secret.clixml");
  const localApiSettingsPath = path.join(dataRoot, "local-api.json");
  const authRateLimitPath = path.join(dataRoot, "auth-rate-limits.json");
  const authRateLimitKeyPath = path.join(dataRoot, "auth-rate-limit.key");
  const backupBaseRoot = path.dirname(dataRoot);
  const updateRoot = options.updateRoot || path.join(backupBaseRoot, "updates");
  const updateStatePath = path.join(updateRoot, "update-state.json");
  const updateJobsRoot = path.join(updateRoot, "jobs");
  const releasePublicKeyPath = options.releasePublicKeyPath || path.join(projectRoot, "resources", "atlas-release-public-key.pem");
  const sessions = new Map();
  const pendingMfa = new Map();
  const pendingPasswordChanges = new Map();
  let writeQueue = Promise.resolve();
  let storePromise = null;
  let vaultSecurityMetadataPromise = null;
  let deploymentOriginsLoaded = false;
  let backupRunning = false;
  let backupTimer = null;
  let lastReleaseCheck = null;
  let authRateLimitKey;
  let authRateLimits = { schemaVersion: 1, entries: {} };

  mkdirSync(dataRoot, { recursive: true });
  try {
    authRateLimitKey = readFileSync(authRateLimitKeyPath);
    if (authRateLimitKey.length !== 32) throw new Error("invalid rate-limit key");
  } catch (error) {
    if (error?.code !== "ENOENT") console.error("[atlas] La clé locale de limitation a été remplacée car elle était invalide.");
    authRateLimitKey = randomBytes(32);
    try { writeFileSync(authRateLimitKeyPath, authRateLimitKey, { flag: "wx", mode: 0o600 }); }
    catch (writeError) {
      if (writeError?.code !== "EEXIST") throw writeError;
      authRateLimitKey = readFileSync(authRateLimitKeyPath);
    }
  }
  try {
    const persistedLimits = JSON.parse(readFileSync(authRateLimitPath, "utf8"));
    if (persistedLimits?.schemaVersion === 1 && persistedLimits.entries && typeof persistedLimits.entries === "object") authRateLimits = persistedLimits;
  } catch (error) {
    if (error?.code !== "ENOENT") console.error("[atlas] Le registre local de limitation des authentifications a été ignoré car il est invalide.");
  }

  try {
    const persisted = JSON.parse(readFileSync(sessionsPath, "utf8"));
    for (const item of persisted?.sessions || []) {
      if (!/^[a-f0-9]{64}$/.test(item?.tokenHash || "") || !isSafeId(item?.userId) || typeof item?.csrf !== "string" || item.csrf.length < 24 || !Number.isFinite(item?.expiresAt) || item.expiresAt <= sessionNow()) continue;
      sessions.set(item.tokenHash, {
        id: isSafeId(item.id) ? item.id : `session-${randomBytes(8).toString("hex")}`,
        userId: item.userId,
        csrf: item.csrf,
        createdAt: Number(item.createdAt) || sessionNow(),
        lastSeenAt: Number(item.lastSeenAt) || Number(item.createdAt) || sessionNow(),
        ip: cleanText(item.ip, 96) || "local",
        userAgent: cleanText(item.userAgent, 300) || "Navigateur inconnu",
        expiresAt: item.expiresAt,
        vaultUnlockedUntil: Math.min(Number(item.vaultUnlockedUntil) || 0, item.expiresAt),
      });
    }
  } catch (error) {
    if (error?.code !== "ENOENT") console.error("[atlas] Le registre de sessions local n’a pas pu être chargé.");
  }

  function enqueueWrite(task) {
    writeQueue = writeQueue.then(task, task);
    return writeQueue;
  }

  async function persistSessions() {
    const now = sessionNow();
    for (const [tokenHash, session] of sessions) if (session.expiresAt <= now) sessions.delete(tokenHash);
    await enqueueWrite(() => writeJsonAtomic(sessionsPath, {
      schemaVersion: 1,
      updatedAt: new Date(now).toISOString(),
      sessions: [...sessions].map(([tokenHash, session]) => ({ tokenHash, id: session.id, userId: session.userId, csrf: session.csrf, createdAt: session.createdAt, lastSeenAt: session.lastSeenAt, ip: session.ip, userAgent: session.userAgent, expiresAt: session.expiresAt, vaultUnlockedUntil: session.vaultUnlockedUntil || 0 })),
    }));
  }

  function requestIp(request) {
    const peer = socketAddress(request);
    const activeTrustedProxies = new Set([...trustedProxies, ...savedTrustedProxies]);
    if (!activeTrustedProxies.has(peer)) return peer;
    const forwarded = String(request.headers["x-forwarded-for"] || "").split(",").map(normalizeProxyAddress).filter(Boolean);
    if (!forwarded.length) {
      const direct = normalizeProxyAddress(request.headers["cf-connecting-ip"] || request.headers["x-real-ip"]);
      return direct || peer;
    }
    const chain = [...forwarded, peer];
    for (let index = chain.length - 1; index >= 0; index -= 1) {
      if (!activeTrustedProxies.has(chain[index])) return chain[index];
    }
    return forwarded[0] || peer;
  }

  function isLocalRequest(request) {
    const peer = socketAddress(request);
    if (["127.0.0.1", "::1"].includes(peer)) return true;
    return Boolean(request.socket.localAddress && normalizeProxyAddress(request.socket.localAddress) === peer);
  }

  function rateLimitKey(scope, subject) {
    return createHmac("sha256", authRateLimitKey).update(`${scope}:${String(subject || "unknown")}`).digest("hex");
  }

  function rateLimitStatus(scope, subject, limit, windowMs) {
    const key = rateLimitKey(scope, subject);
    const cutoff = sessionNow() - windowMs;
    const failures = (authRateLimits.entries[key]?.failures || []).filter((timestamp) => Number.isFinite(timestamp) && timestamp > cutoff);
    if (failures.length) authRateLimits.entries[key] = { scope, failures };
    else delete authRateLimits.entries[key];
    const blocked = failures.length >= limit;
    const retryAfter = blocked ? Math.max(1, Math.ceil((failures[0] + windowMs - sessionNow()) / 1000)) : 0;
    return { key, blocked, retryAfter };
  }

  async function recordRateLimitFailures(entries) {
    for (const { scope, subject, windowMs } of entries) {
      const status = rateLimitStatus(scope, subject, Number.MAX_SAFE_INTEGER, windowMs);
      const current = authRateLimits.entries[status.key] || { scope, failures: [] };
      current.failures.push(sessionNow());
      authRateLimits.entries[status.key] = current;
    }
    const ordered = Object.entries(authRateLimits.entries).sort(([, a], [, b]) => (b.failures?.at(-1) || 0) - (a.failures?.at(-1) || 0)).slice(0, 5000);
    authRateLimits.entries = Object.fromEntries(ordered);
    await enqueueWrite(() => writeJsonAtomic(authRateLimitPath, { schemaVersion: 1, updatedAt: new Date(sessionNow()).toISOString(), entries: authRateLimits.entries }));
  }

  function rejectWhenRateLimited(response, checks) {
    let longestRetry = 0;
    for (const check of checks) {
      const status = rateLimitStatus(check.scope, check.subject, check.limit, check.windowMs);
      if (status.blocked) longestRetry = Math.max(longestRetry, status.retryAfter);
    }
    if (!longestRetry) return false;
    errorResponse(response, 429, "too_many_attempts", "Trop de tentatives. Réessayez plus tard.", { "retry-after": String(longestRetry) });
    return true;
  }

  function publicSession(session, currentSessionId = "") {
    return {
      id: session.id,
      createdAt: new Date(session.createdAt).toISOString(),
      lastSeenAt: new Date(session.lastSeenAt).toISOString(),
      expiresAt: new Date(session.expiresAt).toISOString(),
      ip: session.ip,
      userAgent: session.userAgent,
      current: session.id === currentSessionId,
    };
  }

  function organizationAccess(user) {
    if (user?.role === "administrator" || !Array.isArray(user?.organizationIds)) return null;
    return new Set(user.organizationIds);
  }

  function organizationPermission(user, organizationId) {
    return Array.isArray(user?.organizationPermissions) ? user.organizationPermissions.find((permission) => permission.organizationId === organizationId) || null : null;
  }

  function canAccessOrganization(user, organizationId) {
    const allowed = organizationAccess(user);
    return allowed === null || allowed.has(organizationId);
  }

  function canWriteOrganization(user, organizationId) {
    if (user?.role === "administrator") return true;
    const permission = organizationPermission(user, organizationId);
    if (permission) return permission.role === "editor";
    return user?.role === "editor" && canAccessOrganization(user, organizationId);
  }

  function requireOrganizationWriteAccess(user, organizationId, response) {
    if (canWriteOrganization(user, organizationId)) return true;
    errorResponse(response, 403, "write_permission_required", "Ce compte possède seulement un accès en lecture à cette organisation.");
    return false;
  }

  function requireOrganizationAccess(user, organizationId, response) {
    if (canAccessOrganization(user, organizationId)) return true;
    errorResponse(response, 403, "organization_access_required", "Ce compte n’a pas accès à cette organisation.");
    return false;
  }

  function canAccessVault(user, organizationId = "") {
    if (user?.role === "administrator") return true;
    if (organizationId) {
      const permission = organizationPermission(user, organizationId);
      if (permission) return permission.vaultAccess === true;
    }
    if (Array.isArray(user?.organizationPermissions) && user.organizationPermissions.length) return user.organizationPermissions.some((permission) => permission.vaultAccess === true);
    return user?.vaultAccess !== false;
  }

  function requireVaultAccess(user, response, organizationId = "") {
    if (canAccessVault(user, organizationId)) return true;
    errorResponse(response, 403, "vault_access_required", "Ce compte n’est pas autorisé à consulter le coffre de mots de passe.");
    return false;
  }

  function revokeUserSessions(userId) {
    let revoked = 0;
    for (const [key, value] of sessions) {
      if (value.userId !== userId) continue;
      sessions.delete(key);
      revoked += 1;
    }
    return revoked;
  }

  async function validateUserOrganizationIds(role, requestedIds) {
    if (role === "administrator" || requestedIds === null) return null;
    if (!Array.isArray(requestedIds)) throw Object.assign(new Error("Choisissez les organisations autorisées ou autorisez toutes les organisations."), { statusCode: 400 });
    const organizationIds = [...new Set(requestedIds.filter(isSafeId))];
    if (!organizationIds.length || organizationIds.length > 1000) throw Object.assign(new Error("Choisissez au moins une organisation ou autorisez toutes les organisations."), { statusCode: 400 });
    const workspace = await readWorkspace();
    if (organizationIds.some((id) => !workspace?.data?.organizations?.some((organization) => organization.id === id))) throw Object.assign(new Error("Une organisation sélectionnée est introuvable."), { statusCode: 400 });
    return organizationIds;
  }

  async function validateOrganizationPermissions(role, organizationIds, requestedPermissions, defaultVaultAccess) {
    if (role === "administrator" || organizationIds === null) return null;
    const requested = Array.isArray(requestedPermissions) ? requestedPermissions : [];
    const byId = new Map(requested.filter((permission) => permission && isSafeId(permission.organizationId)).map((permission) => [permission.organizationId, permission]));
    return organizationIds.map((organizationId) => {
      const permission = byId.get(organizationId) || {};
      return { organizationId, role: permission.role === "editor" ? "editor" : permission.role === "viewer" ? "viewer" : role === "editor" ? "editor" : "viewer", vaultAccess: permission.vaultAccess === true || (permission.vaultAccess === undefined && defaultVaultAccess === true) };
    });
  }

  function filterWorkspaceForUser(document, user) {
    const allowed = organizationAccess(user);
    if (!document || allowed === null) return document;
    const data = structuredClone(document.data);
    const belongs = (item) => allowed.has(item?.organizationId);
    data.organizations = (data.organizations || []).filter((item) => allowed.has(item.id));
    for (const key of ["sites", "configurations", "procedures", "relations", "moduleRecords"]) data[key] = (data[key] || []).filter(belongs);
    const relationIds = new Set((data.relations || []).map((item) => item.id));
    data.relationshipEvents = (data.relationshipEvents || []).filter((item) => belongs(item) || relationIds.has(item.relationId));
    data.activities = (data.activities || []).filter(belongs);
    return { revision: document.revision, data };
  }

  function mergeRestrictedWorkspace(currentData, incomingData, user) {
    const allowed = organizationAccess(user);
    if (allowed === null) return incomingData;
    const writable = new Set([...allowed].filter((organizationId) => canWriteOrganization(user, organizationId)));
    const incomingOrganizations = incomingData.organizations || [];
    if (incomingOrganizations.some((item) => !allowed.has(item.id))) throw Object.assign(new Error("Une organisation hors de votre portée a été soumise."), { statusCode: 403 });
    const currentOrganizations = new Map((currentData.organizations || []).map((organization) => [organization.id, organization]));
    if (incomingOrganizations.some((organization) => String(organization.parentOrganizationId || "") !== String(currentOrganizations.get(organization.id)?.parentOrganizationId || ""))) {
      throw Object.assign(new Error("Seul un administrateur peut modifier la hiérarchie des organisations."), { statusCode: 403 });
    }
    for (const key of ["sites", "configurations", "procedures", "relations", "moduleRecords"]) {
      if ((incomingData[key] || []).some((item) => !allowed.has(item.organizationId))) throw Object.assign(new Error("Une fiche hors de votre portée a été soumise."), { statusCode: 403 });
    }
    const stable = (items) => JSON.stringify((items || []).sort((a, b) => String(a.id).localeCompare(String(b.id))));
    const readOnly = new Set([...allowed].filter((organizationId) => !writable.has(organizationId)));
    if (stable((currentData.organizations || []).filter((item) => readOnly.has(item.id))) !== stable(incomingOrganizations.filter((item) => readOnly.has(item.id)))) throw Object.assign(new Error("Une organisation en lecture seule a été modifiée."), { statusCode: 403 });
    for (const key of ["sites", "configurations", "procedures", "relations", "moduleRecords"]) {
      if (stable((currentData[key] || []).filter((item) => readOnly.has(item.organizationId))) !== stable((incomingData[key] || []).filter((item) => readOnly.has(item.organizationId)))) throw Object.assign(new Error("Une fiche en lecture seule a été modifiée."), { statusCode: 403 });
    }
    const merged = structuredClone(currentData);
    merged.organizations = [...(currentData.organizations || []).filter((item) => !writable.has(item.id)), ...incomingOrganizations.filter((item) => writable.has(item.id))];
    for (const key of ["sites", "configurations", "procedures", "relations", "moduleRecords"]) {
      merged[key] = [...(currentData[key] || []).filter((item) => !writable.has(item.organizationId)), ...(incomingData[key] || []).filter((item) => writable.has(item.organizationId))];
    }
    const allowedRelationIds = new Set((merged.relations || []).filter((item) => writable.has(item.organizationId)).map((item) => item.id));
    merged.relationshipEvents = [
      ...(currentData.relationshipEvents || []).filter((item) => !writable.has(item.organizationId) && !allowedRelationIds.has(item.relationId)),
      ...(incomingData.relationshipEvents || []).filter((item) => writable.has(item.organizationId) || allowedRelationIds.has(item.relationId)),
    ];
    merged.activities = [
      ...(currentData.activities || []).filter((item) => !writable.has(item.organizationId)),
      ...(incomingData.activities || []).filter((item) => writable.has(item.organizationId)),
    ];
    return merged;
  }

  function getStore() {
    if (!storePromise) storePromise = AtlasStore.open({ dataRoot, workspacePath, historyPath });
    return storePromise;
  }

  async function readWorkspace() {
    return (await getStore()).readDocument();
  }

  async function readBackupSettings() {
    return normalizeBackupSettings(await readJson(backupSettingsPath, null), backupBaseRoot);
  }

  function normalizedLocalApiSettings(value = {}) {
    const source = value && typeof value === "object" ? value : {};
    const webhookEvents = new Set(["workspace.updated", "backup.completed", "backup.failed"]);
    return {
      schemaVersion: 1,
      enabled: source.enabled === true,
      webhooksEnabled: source.webhooksEnabled === true,
      tokens: Array.isArray(source.tokens) ? source.tokens.filter((token) => token && isSafeId(token.id) && /^[a-f0-9]{64}$/.test(token.hash || "")).slice(0, 100).map((token) => ({
        id: token.id,
        label: cleanText(token.label, 80) || "Intégration locale",
        hash: token.hash,
        scopes: [...new Set((Array.isArray(token.scopes) ? token.scopes : []).filter((scope) => ["read:organizations", "read:records", "read:health"].includes(scope)))],
        organizationIds: token.organizationIds === null ? null : [...new Set((Array.isArray(token.organizationIds) ? token.organizationIds : []).filter(isSafeId))],
        createdAt: String(token.createdAt || ""),
        lastUsedAt: String(token.lastUsedAt || ""),
        revokedAt: String(token.revokedAt || ""),
      })) : [],
      webhooks: Array.isArray(source.webhooks) ? source.webhooks.filter((item) => item && isSafeId(item.id) && item.encryptedSecret?.algorithm === "aes-256-gcm").slice(0, 25).map((item) => ({
        id: item.id,
        label: cleanText(item.label, 80) || "Webhook local",
        url: String(item.url || ""),
        events: [...new Set((Array.isArray(item.events) ? item.events : []).filter((event) => webhookEvents.has(event)))],
        encryptedSecret: item.encryptedSecret,
        enabled: item.enabled !== false,
        createdAt: String(item.createdAt || ""),
        lastDeliveryAt: String(item.lastDeliveryAt || ""),
        lastStatus: Number(item.lastStatus) || 0,
        lastError: String(item.lastError || "").slice(0, 300),
      })) : [],
      updatedAt: String(source.updatedAt || ""),
    };
  }

  async function readLocalApiSettings() {
    return normalizedLocalApiSettings(await readJson(localApiSettingsPath, null));
  }

  async function saveLocalApiSettings(settings) {
    const normalized = normalizedLocalApiSettings({ ...settings, updatedAt: nowIso() });
    await enqueueWrite(() => writeJsonAtomic(localApiSettingsPath, normalized));
    return normalized;
  }

  function publicLocalApiSettings(settings) {
    return {
      enabled: settings.enabled,
      webhooksEnabled: settings.webhooksEnabled,
      updatedAt: settings.updatedAt,
      tokens: settings.tokens.map(({ hash, ...token }) => token),
      webhooks: settings.webhooks.map(({ encryptedSecret, ...webhook }) => webhook),
    };
  }

  function validateLocalWebhookUrl(value) {
    let parsed;
    try { parsed = new URL(String(value || "")); }
    catch { throw Object.assign(new Error("Saisissez une URL HTTP locale valide."), { statusCode: 400, code: "invalid_webhook_url" }); }
    const hostName = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    const localHost = hostName === "localhost" || hostName === "127.0.0.1" || hostName === "::1";
    const targetPort = Number(parsed.port);
    if (parsed.protocol !== "http:" || !localHost || !Number.isInteger(targetPort) || targetPort < 1024 || targetPort > 65535 || parsed.username || parsed.password || parsed.hash || parsed.href.length > 500) {
      throw Object.assign(new Error("Les webhooks Atlas sont limités à une URL HTTP de boucle locale avec un port explicite."), { statusCode: 400, code: "invalid_webhook_url" });
    }
    return parsed.href;
  }

  async function sendLocalWebhook(webhook, eventName, payload) {
    const key = await getVaultKey();
    const secret = decryptPayload(webhook.encryptedSecret, key).secret;
    const body = Buffer.from(JSON.stringify({ id: `event-${randomBytes(8).toString("hex")}`, event: eventName, at: nowIso(), payload }), "utf8");
    const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
    if (typeof options.webhookSender === "function") return options.webhookSender({ url: webhook.url, event: eventName, body, signature });
    const target = new URL(validateLocalWebhookUrl(webhook.url));
    return new Promise((resolve, reject) => {
      const request = http.request({ hostname: target.hostname.replace(/^\[|\]$/g, ""), port: Number(target.port), path: `${target.pathname}${target.search}`, method: "POST", headers: { "content-type": "application/json", "content-length": body.length, "x-atlas-event": eventName, "x-atlas-signature": signature }, timeout: 3000 }, (response) => {
        let received = 0;
        response.on("data", (chunk) => { received += chunk.length; if (received > 64 * 1024) request.destroy(new Error("Réponse webhook trop volumineuse.")); });
        response.on("end", () => {
          if (response.statusCode >= 200 && response.statusCode < 300) resolve({ status: response.statusCode });
          else reject(Object.assign(new Error(`Le webhook local a répondu ${response.statusCode}.`), { status: response.statusCode }));
        });
      });
      request.on("timeout", () => request.destroy(new Error("Délai du webhook local dépassé.")));
      request.on("error", reject);
      request.end(body);
    });
  }

  async function dispatchLocalWebhooks(eventName, payload) {
    const settings = await readLocalApiSettings();
    if (!settings.webhooksEnabled) return;
    const targets = settings.webhooks.filter((item) => item.enabled && item.events.includes(eventName));
    if (!targets.length) return;
    for (const webhook of targets) {
      try {
        const result = await sendLocalWebhook(webhook, eventName, payload);
        webhook.lastDeliveryAt = nowIso();
        webhook.lastStatus = Number(result?.status) || 200;
        webhook.lastError = "";
      } catch (error) {
        webhook.lastDeliveryAt = nowIso();
        webhook.lastStatus = Number(error?.status) || 0;
        webhook.lastError = String(error?.message || "Échec du webhook local").slice(0, 300);
      }
    }
    await saveLocalApiSettings(settings);
  }

  async function requireLocalApiToken(request, response, scope) {
    const settings = await readLocalApiSettings();
    if (!settings.enabled) { errorResponse(response, 403, "local_api_disabled", "L’API locale Atlas est désactivée."); return null; }
    const header = String(request.headers.authorization || "");
    const raw = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!raw || raw.length > 256) { errorResponse(response, 401, "api_token_required", "Un jeton API local est requis."); return null; }
    const incoming = Buffer.from(createHash("sha256").update(raw).digest("hex"), "hex");
    const token = settings.tokens.find((candidate) => {
      const stored = Buffer.from(candidate.hash, "hex");
      return !candidate.revokedAt && stored.length === incoming.length && timingSafeEqual(stored, incoming);
    });
    if (!token || !token.scopes.includes(scope)) { errorResponse(response, 403, "api_scope_required", "Ce jeton ne possède pas la portée requise."); return null; }
    token.lastUsedAt = nowIso();
    await saveLocalApiSettings(settings);
    return token;
  }

  async function saveBackupSettings(settings) {
    const normalized = normalizeBackupSettings(settings, backupBaseRoot);
    normalized.updatedAt = nowIso();
    await enqueueWrite(() => writeJsonAtomic(backupSettingsPath, normalized));
    return normalized;
  }

  async function backupManagerStatus({ includeFiles = true } = {}) {
    const settings = await readBackupSettings();
    let files = [];
    let destinationReady = false;
    let destinationError = "";
    try {
      files = includeFiles ? await listManagedBackups(settings.destination) : [];
      destinationReady = true;
    } catch (error) {
      destinationError = String(error?.message || "Destination inaccessible").slice(0, 500);
    }
    return {
      settings,
      running: backupRunning,
      destinationReady,
      destinationError,
      files,
      restorePolicy: "offline-only",
    };
  }

  async function executeManagedBackup({ passphrase = "", actor = "Planificateur Atlas", scheduled = false } = {}) {
    if (backupRunning) throw Object.assign(new Error("Une sauvegarde complète est déjà en cours."), { statusCode: 409, code: "backup_in_progress" });
    backupRunning = true;
    let settings = await readBackupSettings();
    try {
      const result = await createManagedBackup({ projectRoot, dataRoot, destination: settings.destination, passphrase, secretPath: passphrase ? "" : backupSecretPath });
      let removed = [];
      if (settings.retentionEnabled) removed = await enforceBackupRetention(settings.destination, settings.retentionCount);
      settings = await saveBackupSettings({
        ...settings,
        lastRunAt: result.completedAt,
        lastSuccessAt: result.completedAt,
        lastFile: result.name,
        lastBytes: result.size,
        lastFileCount: result.fileCount,
        lastError: "",
        nextRunAt: settings.enabled ? nextBackupRun(settings, Date.parse(result.completedAt) + 1000) : "",
      });
      await recordAudit(null, scheduled ? "backup-scheduled-completed" : "backup-manual-completed", { details: { actor, file: result.name, size: result.size, fileCount: result.fileCount, removedByRetention: removed.length } });
      void dispatchLocalWebhooks("backup.completed", { scheduled, file: result.name, size: result.size, fileCount: result.fileCount }).catch(() => {});
      return { ...result, removedByRetention: removed, settings };
    } catch (error) {
      const failedAt = nowIso();
      await saveBackupSettings({ ...settings, lastRunAt: failedAt, lastError: String(error?.message || "Échec de sauvegarde").slice(0, 500), nextRunAt: settings.enabled ? nextBackupRun(settings, Date.parse(failedAt) + 1000) : "" });
      await recordAudit(null, scheduled ? "backup-scheduled-failed" : "backup-manual-failed", { details: { actor, message: String(error?.message || "Échec").slice(0, 300) } });
      void dispatchLocalWebhooks("backup.failed", { scheduled, message: String(error?.message || "Échec").slice(0, 300) }).catch(() => {});
      throw error;
    } finally {
      backupRunning = false;
    }
  }

  async function runScheduledBackupIfDue() {
    if (backupRunning) return;
    const settings = await readBackupSettings();
    if (!settings.enabled || !settings.secretConfigured) return;
    let dueAt = Date.parse(settings.nextRunAt || "");
    if (!Number.isFinite(dueAt)) {
      settings.nextRunAt = nextBackupRun(settings, Date.now());
      await saveBackupSettings(settings);
      return;
    }
    if (dueAt > Date.now()) return;
    await executeManagedBackup({ scheduled: true });
  }

  function publicPreparedUpdate(prepared) {
    if (!prepared || typeof prepared !== "object") return null;
    return {
      targetVersion: String(prepared.targetVersion || ""),
      tag: String(prepared.tag || ""),
      preparedAt: String(prepared.preparedAt || ""),
      signatureVerified: prepared.signatureVerified === true,
      packageVerified: prepared.packageVerified === true,
      rollbackReady: prepared.rollbackReady === true,
      installable: prepared.installable === true,
      assetName: String(prepared.manifest?.assetName || ""),
      assetSize: Number(prepared.manifest?.assetSize) || 0,
      sha256: String(prepared.manifest?.sha256 || ""),
      releaseNotesUrl: String(prepared.manifest?.releaseNotesUrl || ""),
    };
  }

  function publicUpdateJob(job) {
    if (!job || typeof job !== "object") return null;
    return {
      jobId: String(job.jobId || ""),
      status: String(job.status || ""),
      message: String(job.message || ""),
      currentVersion: String(job.currentVersion || ""),
      targetVersion: String(job.targetVersion || ""),
      updatedAt: String(job.updatedAt || ""),
      completedAt: String(job.completedAt || ""),
      rolledBackAt: String(job.rolledBackAt || ""),
    };
  }

  async function readUpdateState() {
    const state = await readJson(updateStatePath, { schemaVersion: 1, lastCheck: null, prepared: null, lastJobId: "" });
    const lastJobId = isSafeId(state?.lastJobId) ? state.lastJobId : "";
    const job = lastJobId ? await readJson(path.join(updateJobsRoot, `${lastJobId}.json`), null) : null;
    return { state, job };
  }

  async function updateStatusPayload() {
    const { state, job } = await readUpdateState();
    const storedRelease = lastReleaseCheck || state.lastCheck || null;
    const releaseComparison = storedRelease?.tag ? compareStableVersions(storedRelease.tag, ATLAS_VERSION) : null;
    const normalizedRelease = storedRelease ? {
      ...storedRelease,
      currentVersion: ATLAS_VERSION,
      updateAvailable: releaseComparison === 1,
      sameVersion: releaseComparison === 0,
      versionComparison: releaseComparison,
      installable: false,
      installBlockedReason: releaseComparison === 0 ? "Cette version est déjà installée." : storedRelease.installBlockedReason,
    } : null;
    const prepared = state.prepared && compareStableVersions(state.prepared.targetVersion, ATLAS_VERSION) === 1 ? state.prepared : null;
    return {
      currentVersion: ATLAS_VERSION,
      automaticChecks: false,
      automaticInstall: false,
      lastCheck: normalizedRelease,
      prepared: publicPreparedUpdate(prepared),
      job: publicUpdateJob(job),
    };
  }

  function refreshSavedDeploymentOrigins(settings) {
    savedDeploymentOrigins.clear();
    for (const origin of deploymentOrigins(settings)) savedDeploymentOrigins.add(origin);
    savedTrustedProxies.clear();
    for (const address of normalizedDeploymentSettings(settings).trustedProxies) savedTrustedProxies.add(address);
    deploymentOriginsLoaded = true;
  }

  async function ensureDeploymentOrigins() {
    if (deploymentOriginsLoaded) return;
    const document = await readWorkspace();
    refreshSavedDeploymentOrigins(document?.data?.settings || {});
  }

  async function mirrorStore(store, document) {
    try {
      await writeJsonAtomic(workspacePath, document);
      await writeJsonAtomic(historyPath, { schemaVersion: 2, entries: store.historyDocuments(200) });
    } catch (error) {
      console.error("[atlas] La copie JSON de compatibilité n’a pas pu être actualisée.", error);
    }
  }

  async function getVaultKey() {
    try {
      const encoded = (await readFile(vaultKeyPath, "utf8")).trim();
      const key = Buffer.from(encoded, "base64");
      if (key.length !== 32) throw new Error("Clé de coffre locale invalide.");
      return key;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      await mkdir(dataRoot, { recursive: true });
      const key = randomBytes(32);
      try {
        await writeFile(vaultKeyPath, `${key.toString("base64")}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
        return key;
      } catch (writeError) {
        if (writeError?.code !== "EEXIST") throw writeError;
        return getVaultKey();
      }
    }
  }

  async function ensureVaultSecurityMetadata() {
    if (vaultSecurityMetadataPromise) return vaultSecurityMetadataPromise;
    vaultSecurityMetadataPromise = enqueueWrite(async () => {
      const vault = await readJson(vaultPath, { schemaVersion: 1, items: [] });
      vault.items = Array.isArray(vault.items) ? vault.items : [];
      if (!vault.items.length) return vault;

      const pending = vault.items.filter((item) => {
        const validStrength = Number.isInteger(item.strength) && item.strength >= 0 && item.strength <= 4;
        const validEvaluationDate = typeof item.strengthEvaluatedAt === "string" && Number.isFinite(Date.parse(item.strengthEvaluatedAt));
        return !validStrength || !validEvaluationDate || typeof item.passwordFingerprint !== "string";
      });
      if (!pending.length && Number(vault.schemaVersion) >= 2) return vault;

      const key = await getVaultKey();
      const evaluatedAt = nowIso();
      let migrated = 0;
      let failed = 0;
      for (const item of pending) {
        try {
          const payload = decryptPayload(item.encrypted, key);
          item.strength = passwordStrength(payload.password || "");
          item.strengthEvaluatedAt = evaluatedAt;
          if (typeof item.passwordFingerprint !== "string") item.passwordFingerprint = passwordFingerprint(payload.password || "", key);
          migrated += 1;
        } catch {
          failed += 1;
        }
      }
      if (migrated || Number(vault.schemaVersion) < 2) {
        vault.schemaVersion = 2;
        await writeJsonAtomic(vaultPath, vault);
      }
      if (failed) console.error(`[atlas] ${failed} entrée(s) du coffre n’ont pas pu recevoir leur note de sécurité locale.`);
      return vault;
    }).finally(() => {
      vaultSecurityMetadataPromise = null;
    });
    return vaultSecurityMetadataPromise;
  }

  function vaultMetadata(item, duplicateCount = 0) {
    return {
      id: item.id,
      organizationId: item.organizationId,
      title: item.title,
      category: item.category,
      archived: Boolean(item.archived),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      passwordChangedAt: item.passwordChangedAt || item.createdAt,
      expiresAt: item.expiresAt || "",
      rotationOwner: item.rotationOwner || "",
      rotationIntervalDays: Number(item.rotationIntervalDays) || 0,
      strength: Number.isInteger(item.strength) ? item.strength : null,
      strengthEvaluatedAt: item.strengthEvaluatedAt || "",
      duplicateCount,
    };
  }

  async function assetContext(ref) {
    if (!isSafeAssetRef(ref)) return null;
    const [type, id] = ref.split(":", 2);
    if (type === "vault") {
      const vault = await readJson(vaultPath, { schemaVersion: 1, items: [] });
      const item = vault.items?.find((entry) => entry.id === id);
      return item ? { organizationId: item.organizationId, vault: true } : null;
    }
    const document = await readWorkspace();
    const workspace = document?.data;
    const collection = type === "configuration" ? workspace?.configurations : type === "site" ? workspace?.sites : type === "procedure" ? workspace?.procedures : workspace?.moduleRecords;
    const item = collection?.find((entry) => entry.id === id);
    return item ? { organizationId: item.organizationId, vault: false } : null;
  }

  function requireVaultUnlock(context, session, response) {
    if (!context?.vault || (session.vaultUnlockedUntil || 0) >= sessionNow()) return true;
    errorResponse(response, 403, "vault_locked", "Le coffre a été verrouillé manuellement. Vérifiez votre MFA pour accéder aux pièces jointes de ce mot de passe.");
    return false;
  }

  function getSession(request) {
    const token = parseCookies(request).atlas_session;
    if (!token) return null;
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const session = sessions.get(tokenHash);
    if (!session || session.expiresAt <= sessionNow()) {
      if (session) {
        sessions.delete(tokenHash);
        void persistSessions().catch(() => {});
      }
      return null;
    }
    session.lastSeenAt = sessionNow();
    return session;
  }

  function requireSession(request, response, requireCsrf = false) {
    const session = getSession(request);
    if (!session) {
      errorResponse(response, 401, "authentication_required", "Une connexion locale est requise.");
      return null;
    }
    if (requireCsrf && request.headers["x-atlas-csrf"] !== session.csrf) {
      errorResponse(response, 403, "csrf_rejected", "La requête n’a pas pu être validée.");
      return null;
    }
    return session;
  }

  function createPendingMfa(user, type) {
    const token = randomBytes(32).toString("base64url");
    const secret = type === "enroll" ? encodeBase32(randomBytes(20)) : user.mfa.secret;
    pendingMfa.set(createHash("sha256").update(token).digest("hex"), {
      userId: user.id,
      type,
      secret,
      failures: 0,
      expiresAt: sessionNow() + MFA_CHALLENGE_TTL_MS,
    });
    return { token, secret };
  }

  function readPendingMfa(token) {
    if (typeof token !== "string" || token.length < 32) return null;
    const key = createHash("sha256").update(token).digest("hex");
    const pending = pendingMfa.get(key);
    if (!pending || pending.expiresAt < sessionNow()) {
      pendingMfa.delete(key);
      return null;
    }
    return { key, pending };
  }

  function createPendingPasswordChange(user) {
    const token = randomBytes(32).toString("base64url");
    pendingPasswordChanges.set(createHash("sha256").update(token).digest("hex"), { userId: user.id, expiresAt: sessionNow() + 10 * 60 * 1000 });
    return token;
  }

  function readPendingPasswordChange(token) {
    if (typeof token !== "string" || token.length < 32) return null;
    const key = createHash("sha256").update(token).digest("hex");
    const pending = pendingPasswordChanges.get(key);
    if (!pending || pending.expiresAt < sessionNow()) {
      pendingPasswordChanges.delete(key);
      return null;
    }
    return { key, pending };
  }

  function mfaChallenge(response, user) {
    if (!user.mfa?.enabled) {
      const pending = createPendingMfa(user, "enroll");
      const issuer = encodeURIComponent("TRC Community Atlas");
      const account = encodeURIComponent(user.username);
      return jsonResponse(response, 200, {
        mfaSetupRequired: true,
        pendingToken: pending.token,
        secret: pending.secret,
        otpauthUri: `otpauth://totp/${issuer}:${account}?secret=${pending.secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`,
      });
    }
    const pending = createPendingMfa(user, "verify");
    return jsonResponse(response, 200, { mfaRequired: true, pendingToken: pending.token });
  }

  async function issueSession(request, response, user, extra = {}) {
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const csrf = randomBytes(24).toString("base64url");
    const issuedAt = sessionNow();
    const expiresAt = issuedAt + SESSION_TTL_MS;
    const vaultUnlockedUntil = canAccessVault(user) ? expiresAt : 0;
    sessions.set(tokenHash, {
      id: `session-${randomBytes(8).toString("hex")}`,
      userId: user.id,
      csrf,
      createdAt: issuedAt,
      lastSeenAt: issuedAt,
      ip: requestIp(request),
      userAgent: cleanText(request.headers["user-agent"] || "Navigateur inconnu", 300) || "Navigateur inconnu",
      expiresAt,
      vaultUnlockedUntil,
    });
    await persistSessions();
    return jsonResponse(response, 200, { user: publicUser(user), csrf, ...extra, sessionExpiresAt: new Date(expiresAt).toISOString(), sessionTtlSeconds: SESSION_TTL_MS / 1000, vaultUnlockedUntil: new Date(vaultUnlockedUntil).toISOString() }, {
      "set-cookie": sessionCookie(request, encodeURIComponent(rawToken), SESSION_TTL_MS / 1000, new Set([...trustedProxies, ...savedTrustedProxies])),
    });
  }

  async function requireAdmin(session, response) {
    const auth = await readJson(authPath, null);
    const user = auth?.users?.find((entry) => entry.id === session.userId && entry.enabled !== false);
    if (!user || user.role !== "administrator") {
      errorResponse(response, 403, "administrator_required", "Un compte administrateur local est requis.");
      return null;
    }
    return { auth, user };
  }

  async function requireUser(session, response) {
    const auth = await readJson(authPath, null);
    const user = auth?.users?.find((entry) => entry.id === session.userId && entry.enabled !== false);
    if (!user) {
      errorResponse(response, 401, "authentication_required", "Le compte local n’est plus actif.");
      return null;
    }
    return { auth, user };
  }

  async function requireWriter(session, response) {
    const auth = await readJson(authPath, null);
    const user = auth?.users?.find((entry) => entry.id === session.userId && entry.enabled !== false);
    const hasScopedWrite = Array.isArray(user?.organizationPermissions) && user.organizationPermissions.some((permission) => permission.role === "editor");
    if (!user || (!hasScopedWrite && !["administrator", "editor"].includes(user.role))) {
      errorResponse(response, 403, "write_permission_required", "Ce compte ne peut pas modifier la documentation.");
      return null;
    }
    return { auth, user };
  }

  async function securitySettings() {
    const document = await readWorkspace();
    return normalizedSecuritySettings(document?.data?.settings);
  }

  async function verifyMfaAttempt(request, response, user, code, { challengeRecord = null, challengeKey = "", allowRecovery = false, purpose = "mfa" } = {}) {
    const ip = requestIp(request);
    const userSubject = user?.id || "unknown";
    const checks = [
      { scope: "mfa-account", subject: userSubject, limit: MFA_ACCOUNT_LIMIT, windowMs: MFA_WINDOW_MS },
      { scope: "mfa-ip", subject: ip, limit: MFA_IP_LIMIT, windowMs: MFA_WINDOW_MS },
    ];
    if (rejectWhenRateLimited(response, checks)) return { ok: false, blocked: true, recoveryIndex: -1 };
    if (challengeRecord && challengeRecord.failures >= MFA_CHALLENGE_LIMIT) {
      if (challengeKey) pendingMfa.delete(challengeKey);
      errorResponse(response, 429, "mfa_challenge_locked", "Cette vérification MFA a été invalidée après trop d’échecs. Recommencez la connexion.", { "retry-after": "300" });
      return { ok: false, blocked: true, recoveryIndex: -1 };
    }
    const normalizedCode = String(code || "").trim();
    let valid = Boolean(user?.mfa?.enabled && verifyTotp(user.mfa.secret, normalizedCode));
    let recoveryIndex = -1;
    if (!valid && allowRecovery && Array.isArray(user?.mfa?.recoveryHashes)) {
      recoveryIndex = user.mfa.recoveryHashes.indexOf(recoveryHash(normalizedCode));
      valid = recoveryIndex >= 0;
    }
    if (valid) return { ok: true, blocked: false, recoveryIndex };
    if (challengeRecord) challengeRecord.failures = (challengeRecord.failures || 0) + 1;
    await recordRateLimitFailures(checks);
    if (challengeRecord?.failures >= MFA_CHALLENGE_LIMIT) {
      if (challengeKey) pendingMfa.delete(challengeKey);
      errorResponse(response, 429, "mfa_challenge_locked", "Cette vérification MFA a été invalidée après trop d’échecs. Recommencez la connexion.", { "retry-after": "300" });
      return { ok: false, blocked: true, recoveryIndex: -1 };
    }
    errorResponse(response, 401, "invalid_mfa", purpose === "privileged" ? "Un code MFA administrateur actuel est requis pour cette action sensible." : "Le code MFA ou le code de récupération est incorrect.");
    return { ok: false, blocked: false, recoveryIndex: -1 };
  }

  async function rejectInvalidMfaChallenge(request, response) {
    const check = { scope: "mfa-invalid-token-ip", subject: requestIp(request), limit: 8, windowMs: MFA_WINDOW_MS };
    if (rejectWhenRateLimited(response, [check])) return;
    await recordRateLimitFailures([check]);
    if (rejectWhenRateLimited(response, [check])) return;
    errorResponse(response, 401, "invalid_mfa", "La vérification MFA est invalide ou expirée.");
  }

  async function requirePrivilegedMfa(user, body, response) {
    const settings = await securitySettings();
    if (!settings.privilegedMfaEnabled) return true;
    const result = await verifyMfaAttempt(response.req, response, user, body?.adminMfaCode, { purpose: "privileged" });
    return result.ok;
  }

  async function recordAudit(user, action, { assetRef = "", organizationId = "", details = {} } = {}) {
    const store = await getStore();
    const document = store.readDocument();
    store.insertAudit({ actor: user?.displayName || user?.username || "Système", action, assetRef, organizationId, workspaceRevision: document?.revision || 0, details });
  }

  async function deploymentHealth(request) {
    const document = await readWorkspace();
    const settings = normalizedDeploymentSettings(document?.data?.settings || {});
    const backupSettings = await readBackupSettings();
    const auth = await readJson(authPath, null);
    const activeTrustedProxies = new Set([...trustedProxies, ...savedTrustedProxies]);
    const trustedProxyRequest = activeTrustedProxies.has(socketAddress(request));
    const httpsObserved = requestUsesHttps(request, activeTrustedProxies);
    const forwardedHost = trustedProxyRequest ? cleanText(String(request.headers["x-forwarded-host"] || "").split(",", 1)[0], 253) || "" : "";
    const observedHost = forwardedHost || cleanText(String(request.headers.host || ""), 253) || "";
    const proxyObserved = trustedProxyRequest && Boolean(forwardedHost || request.headers["x-forwarded-proto"] || request.headers["x-real-ip"] || request.headers["x-forwarded-for"] || request.headers["cf-connecting-ip"]);
    let vaultKeyReady = false;
    try {
      const keyInfo = await stat(vaultKeyPath);
      vaultKeyReady = keyInfo.isFile() && keyInfo.size >= 32;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    const publicUrl = settings.primaryDomain ? `https://${settings.primaryDomain}` : "";
    const fileSize = async (filePath) => {
      try { return (await stat(filePath)).size; }
      catch (error) { if (error?.code === "ENOENT") return 0; throw error; }
    };
    const [databaseBytes, vaultBytes, attachmentIndexBytes, disk] = await Promise.all([
      fileSize(path.join(dataRoot, "atlas.sqlite")),
      fileSize(vaultPath),
      fileSize(attachmentsPath),
      statfs(dataRoot).catch(() => null),
    ]);
    const sqlite = (await getStore()).integrityCheck();
    const freeBytes = disk ? Number(disk.bavail) * Number(disk.bsize) : null;
    const totalBytes = disk ? Number(disk.blocks) * Number(disk.bsize) : null;
    const freePercent = Number.isFinite(freeBytes) && Number.isFinite(totalBytes) && totalBytes > 0 ? Math.round((freeBytes / totalBytes) * 100) : null;
    const backupAgeDays = backupSettings.lastSuccessAt ? Math.floor((Date.now() - Date.parse(backupSettings.lastSuccessAt)) / 86400000) : null;
    let autostart;
    try {
      autostart = await manageAutostart({ mode: "status", host, port, dataRoot, allowedOrigins: [...new Set([...allowedOrigins, ...savedDeploymentOrigins])], trustedProxies: [...activeTrustedProxies] });
    } catch (error) {
      autostart = { supported: process.platform === "win32", installed: false, enabled: false, state: "Error", trigger: "none", runAs: "", message: error.message || "L’état du démarrage automatique est indisponible." };
    }
    const listenerAddress = server.address();
    const listenerOpen = server.listening && listenerAddress && typeof listenerAddress === "object";
    const listenerLabel = listenerOpen ? `${listenerAddress.address}:${listenerAddress.port}` : `${host}:${port}`;
    const checks = [
      { id: "application", status: "ok", label: "Service Atlas", message: `Atlas ${ATLAS_VERSION} répond sur ${host}:${port}; disponibilité du processus : ${Math.floor(process.uptime() / 3600)} h ${Math.floor((process.uptime() % 3600) / 60)} min.` },
      { id: "port", status: listenerOpen ? "ok" : "error", label: "Port Atlas local", message: listenerOpen ? `Le listener Atlas est actif sur cet ordinateur (${listenerLabel}).` : `Aucun listener Atlas actif n’est confirmé sur ${listenerLabel}.` },
      { id: "autostart", status: autostart.enabled ? "ok" : autostart.state === "Error" ? "warning" : "neutral", label: "Démarrage automatique", message: autostart.message || (autostart.enabled ? "Atlas démarrera en arrière-plan avec Windows." : "Le démarrage automatique est désactivé.") },
      { id: "storage", status: document && sqlite.ok ? "ok" : "error", label: "Stockage documentaire", message: document && sqlite.ok ? `SQLite répond « ok »; base ${(databaseBytes / 1048576).toFixed(1)} Mo.` : `Le contrôle SQLite signale : ${sqlite.message}.` },
      { id: "disk", status: freePercent === null ? "neutral" : freePercent < 10 ? "error" : freePercent < 20 ? "warning" : "ok", label: "Espace disque", message: freePercent === null ? "L’espace libre n’a pas pu être mesuré." : `${freePercent} % libre (${(freeBytes / 1073741824).toFixed(1)} Go sur ${(totalBytes / 1073741824).toFixed(1)} Go); index coffre ${(vaultBytes / 1048576).toFixed(1)} Mo, index pièces jointes ${(attachmentIndexBytes / 1048576).toFixed(1)} Mo.` },
      { id: "backups", status: backupSettings.lastError ? "error" : backupSettings.lastSuccessAt ? (backupAgeDays > 7 ? "warning" : "ok") : "warning", label: "Sauvegarde complète", message: backupSettings.lastError ? `Dernier échec : ${backupSettings.lastError}` : backupSettings.lastSuccessAt ? `Dernière réussite ${backupAgeDays === 0 ? "aujourd’hui" : `il y a ${backupAgeDays} jour${backupAgeDays === 1 ? "" : "s"}`}; prochain passage ${backupSettings.enabled && backupSettings.nextRunAt ? new Date(backupSettings.nextRunAt).toLocaleString("fr-CA") : "non planifié"}.` : "Aucune sauvegarde complète réussie n’est enregistrée. Configurez la page Sauvegardes." },
      { id: "authentication", status: auth?.users?.length ? "ok" : "error", label: "Authentification locale", message: auth?.users?.length ? `${auth.users.length} compte local configuré${auth.users.length === 1 ? "" : "s"}.` : "Aucun administrateur local n’est configuré." },
      { id: "vault", status: vaultKeyReady ? "ok" : "neutral", label: "Coffre chiffré", message: vaultKeyReady ? "La clé locale du coffre est présente." : "La clé du coffre sera créée localement au premier secret; aucune action n’est requise maintenant." },
      { id: "identity", status: settings.instanceCode !== "ATLAS" || document?.data?.settings?.deployment ? "ok" : "warning", label: "Identité de l’instance", message: `Code actuel : ${settings.instanceCode}.` },
      { id: "domain", status: settings.primaryDomain ? "ok" : settings.accessMode === "local" ? "neutral" : "warning", label: "Domaine public", message: settings.primaryDomain ? `${publicUrl} est enregistré dans Atlas.` : settings.accessMode === "local" ? "Mode local : aucun domaine public requis." : "Ajoutez le domaine public servi par le proxy inverse." },
      { id: "https", status: httpsObserved ? "ok" : settings.accessMode === "local" ? "neutral" : "warning", label: "HTTPS observé", message: httpsObserved ? "Cette requête est arrivée à Atlas avec le protocole HTTPS déclaré." : settings.accessMode === "local" ? "Accès local HTTP attendu; le navigateur public devra passer par HTTPS." : "Atlas ne voit pas X-Forwarded-Proto: https sur cette requête." },
      { id: "reverse-proxy", status: proxyObserved ? "ok" : settings.accessMode === "local" ? "neutral" : "warning", label: "Proxy inverse", message: proxyObserved ? `En-têtes de proxy observés${observedHost ? ` pour ${observedHost}` : ""}.` : settings.accessMode === "local" ? "Aucun proxy requis en mode local." : `Aucun en-tête de proxy n’est visible; vérifiez ${settings.reverseProxy.toUpperCase()}.` },
      { id: "trusted-proxy", status: settings.accessMode === "local" ? "neutral" : activeTrustedProxies.size ? "ok" : "warning", label: "Proxy de confiance", message: settings.accessMode === "local" ? "Aucun proxy de confiance requis en mode local." : activeTrustedProxies.size ? `${activeTrustedProxies.size} adresse${activeTrustedProxies.size === 1 ? "" : "s"} de proxy explicitement autorisée${activeTrustedProxies.size === 1 ? "" : "s"} par l’installation ou les paramètres Atlas.` : "Ajoutez l’adresse IP exacte du proxy; Atlas ignore volontairement ses en-têtes tant qu’elle n’est pas déclarée." },
      { id: "origin", status: settings.primaryDomain && savedDeploymentOrigins.has(`https://${settings.primaryDomain}`) ? "ok" : settings.accessMode === "local" ? "neutral" : "warning", label: "Origine autorisée", message: settings.primaryDomain ? "Les requêtes d’écriture HTTPS de ce domaine sont autorisées par Atlas." : "Aucune origine publique enregistrée." },
      { id: "updates", status: lastReleaseCheck?.updateAvailable ? "warning" : lastReleaseCheck ? "ok" : "neutral", label: "Mises à jour", message: lastReleaseCheck ? (lastReleaseCheck.updateAvailable ? `La version ${lastReleaseCheck.tag} est publiée, mais l’installation reste bloquée jusqu’à la vérification cryptographique et au retour arrière.` : `Dernière vérification : ${lastReleaseCheck.tag || "aucune version stable"}.`) : "La vérification GitHub est manuelle; aucun appel externe automatique n’est effectué." },
    ];
    return {
      checkedAt: nowIso(),
      configured: Boolean(settings.instanceCode && (settings.accessMode === "local" || settings.primaryDomain)),
      settings,
      publicUrl,
      observed: { protocol: httpsObserved ? "https" : "http", host: observedHost, reverseProxyHeaders: proxyObserved },
      autostart,
      storage: { databaseBytes, vaultBytes, attachmentIndexBytes, freeBytes, totalBytes, freePercent, sqlite },
      backups: { ...backupSettings, backupAgeDays },
      updates: lastReleaseCheck,
      summary: {
        ok: checks.filter((check) => check.status === "ok").length,
        warning: checks.filter((check) => check.status === "warning" || check.status === "error").length,
        neutral: checks.filter((check) => check.status === "neutral").length,
        total: checks.length,
      },
      checks,
    };
  }

  async function probeLocalAtlasPort() {
    const address = server.address();
    if (!server.listening || !address || typeof address !== "object") {
      return { checkedAt: nowIso(), open: false, host, port, latencyMs: null, scope: "this-computer-only", message: "Le listener Atlas n’est pas actif." };
    }
    const targetHost = address.address === "0.0.0.0" ? "127.0.0.1" : address.address === "::" ? "::1" : address.address;
    const startedAt = Date.now();
    return new Promise((resolve) => {
      const socket = createConnection({ host: targetHost, port: address.port });
      let settled = false;
      const finish = (open, message) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve({ checkedAt: nowIso(), open, host: targetHost, port: address.port, latencyMs: Date.now() - startedAt, scope: "this-computer-only", message });
      };
      socket.setTimeout(2500, () => finish(false, `Le port ${address.port} n’a pas répondu dans le délai local.`));
      socket.once("connect", () => finish(true, `Le port ${address.port} accepte les connexions sur cet ordinateur.`));
      socket.once("error", () => finish(false, `Le port ${address.port} refuse la connexion locale.`));
    });
  }

  const server = http.createServer({ maxHeaderSize: 16 * 1024, requestTimeout: 30_000, headersTimeout: 15_000, keepAliveTimeout: 5_000 }, async (request, response) => {
    setSecurityHeaders(response);
    try {
      const url = new URL(request.url || "/", `http://${request.headers.host || `${host}:${port}`}`);
      request.atlasBodyLimit = requestBodyLimit(request.method || "GET", url.pathname);
      await ensureDeploymentOrigins();
      const requestOrigins = new Set([...allowedOrigins, ...savedDeploymentOrigins]);
      if (!sameOrigin(request, port, requestOrigins) && request.method !== "GET") {
        return errorResponse(response, 403, "origin_rejected", "Origine de requête refusée.");
      }

      if (request.method === "GET" && url.pathname === "/api/status") {
        return jsonResponse(response, 200, { ok: true });
      }

      if (request.method === "GET" && url.pathname === "/api/bootstrap") {
        const auth = await readJson(authPath, null);
        return jsonResponse(response, 200, { setupRequired: !auth?.users?.length });
      }

      if (request.method === "GET" && url.pathname === "/api/status/details") {
        if (!isLocalRequest(request)) return errorResponse(response, 403, "local_request_required", "Ce diagnostic est disponible seulement depuis cet ordinateur.");
        const auth = await readJson(authPath, null);
        const storage = (await getStore()).readDocument() ? "sqlite" : "uninitialized";
        return jsonResponse(response, 200, { product: "TRC Community Atlas", version: ATLAS_VERSION, initialized: Boolean(auth?.users?.length), storage });
      }

      if (request.method === "GET" && url.pathname === "/api/v1/health") {
        const token = await requireLocalApiToken(request, response, "read:health");
        if (!token) return;
        const store = await getStore();
        const document = store.readDocument();
        return jsonResponse(response, 200, { product: "TRC Community Atlas", version: ATLAS_VERSION, ok: Boolean(document) && store.integrityCheck().ok, storage: document ? "sqlite" : "uninitialized", uptimeSeconds: Math.floor(process.uptime()), checkedAt: nowIso() });
      }

      if (request.method === "GET" && url.pathname === "/api/v1/organizations") {
        const token = await requireLocalApiToken(request, response, "read:organizations");
        if (!token) return;
        const document = await readWorkspace();
        const allowed = token.organizationIds === null ? null : new Set(token.organizationIds);
        const organizations = (document?.data?.organizations || []).filter((organization) => allowed === null || allowed.has(organization.id)).map(({ notes, quickNotes, ...organization }) => organization);
        return jsonResponse(response, 200, { items: organizations, count: organizations.length });
      }

      if (request.method === "GET" && url.pathname === "/api/v1/records") {
        const token = await requireLocalApiToken(request, response, "read:records");
        if (!token) return;
        const document = await readWorkspace();
        const allowed = token.organizationIds === null ? null : new Set(token.organizationIds);
        const requestedOrganization = cleanText(url.searchParams.get("organizationId") || "", 64) || "";
        if (requestedOrganization && allowed !== null && !allowed.has(requestedOrganization)) return errorResponse(response, 403, "organization_scope_required", "Ce jeton n’a pas accès à cette organisation.");
        const belongs = (item) => (!requestedOrganization || item.organizationId === requestedOrganization) && (allowed === null || allowed.has(item.organizationId));
        const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 200, 1), 500);
        const items = [
          ...(document?.data?.sites || []).filter(belongs).map((item) => ({ type: "site", id: item.id, organizationId: item.organizationId, title: item.name, status: item.status })),
          ...(document?.data?.configurations || []).filter(belongs).map((item) => ({ type: "configuration", id: item.id, organizationId: item.organizationId, title: item.name, status: item.status, updatedAt: item.lastReviewed || "" })),
          ...(document?.data?.procedures || []).filter(belongs).map((item) => ({ type: "procedure", id: item.id, organizationId: item.organizationId, title: item.title, status: item.status, updatedAt: item.updatedAt || "" })),
          ...(document?.data?.moduleRecords || []).filter(belongs).map((item) => ({ type: "module", moduleId: item.moduleId, id: item.id, organizationId: item.organizationId, title: item.title, status: item.status, updatedAt: item.updatedAt || "" })),
        ].slice(0, limit);
        return jsonResponse(response, 200, { items, count: items.length, limit });
      }

      if (request.method === "POST" && url.pathname === "/api/setup") {
        if ((await readJson(authPath, null))?.users?.length) {
          return errorResponse(response, 409, "already_initialized", "Cette instance est déjà initialisée.");
        }
        const body = await readBody(request);
        const username = cleanText(body.username, 64, true)?.toLowerCase();
        const displayName = cleanText(body.displayName, 96, true);
        const password = typeof body.password === "string" ? body.password : "";
        if (!username || !/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username)) {
          return errorResponse(response, 400, "invalid_username", "Le nom d’utilisateur doit contenir de 3 à 64 caractères simples.");
        }
        if (!displayName || password.length < 10 || password.length > 256) {
          return errorResponse(response, 400, "invalid_setup", "Le nom est requis et le mot de passe doit contenir au moins 10 caractères.");
        }
        const passwordRecord = derivePassword(password);
        const createdAt = nowIso();
        const user = { id: `user-${randomBytes(8).toString("hex")}`, username, displayName, role: "administrator", organizationIds: null, vaultAccess: true, enabled: true, createdAt, updatedAt: createdAt, preferences: { visibleModules: null }, mfa: { enabled: false, secret: "", recoveryHashes: [] }, ...passwordRecord };
        const auth = { schemaVersion: 3, users: [user] };
        await enqueueWrite(async () => {
          if ((await readJson(authPath, null))?.users?.length) throw Object.assign(new Error("Déjà initialisé."), { statusCode: 409 });
          await writeJsonAtomic(authPath, auth);
          const store = await getStore();
          const document = store.initializeDocument({ revision: 1, data: seedWorkspace() });
          await mirrorStore(store, document);
        });
        return jsonResponse(response, 201, { created: true });
      }

      if (request.method === "POST" && url.pathname === "/api/login") {
        const remote = requestIp(request);
        const ipCheck = { scope: "password-ip", subject: remote, limit: 30, windowMs: LOGIN_WINDOW_MS };
        if (rejectWhenRateLimited(response, [ipCheck])) return;
        const body = await readBody(request);
        const auth = await readJson(authPath, null);
        const username = cleanText(body.username, 64, true)?.toLowerCase() || "";
        const accountCheck = { scope: "password-account", subject: username || "unknown", limit: LOGIN_LIMIT, windowMs: LOGIN_WINDOW_MS };
        if (rejectWhenRateLimited(response, [accountCheck])) return;
        const password = typeof body.password === "string" ? body.password : "";
        const fallback = derivePassword(password || "invalid", "00000000000000000000000000000000");
        const user = auth?.users?.find((entry) => entry.username === username && entry.enabled !== false);
        const valid = user && verifyPassword(password, user);
        void fallback;
        if (!valid) {
          await recordRateLimitFailures([ipCheck, accountCheck]);
          return errorResponse(response, 401, "invalid_credentials", "Nom d’utilisateur ou mot de passe incorrect.");
        }
        const mfaChecks = [
          { scope: "mfa-account", subject: user.id, limit: MFA_ACCOUNT_LIMIT, windowMs: MFA_WINDOW_MS },
          { scope: "mfa-ip", subject: remote, limit: MFA_IP_LIMIT, windowMs: MFA_WINDOW_MS },
        ];
        if (rejectWhenRateLimited(response, mfaChecks)) return;
        if (user.mustChangePassword) {
          return jsonResponse(response, 200, { passwordChangeRequired: true, pendingToken: createPendingPasswordChange(user) });
        }
        return mfaChallenge(response, user);
      }

      if (request.method === "POST" && url.pathname === "/api/password/change-required") {
        const body = await readBody(request);
        const pendingRecord = readPendingPasswordChange(body.pendingToken);
        const password = typeof body.password === "string" ? body.password : "";
        if (!pendingRecord || password.length < 10 || password.length > 256) {
          return errorResponse(response, 400, "invalid_password_change", "La demande a expiré ou le nouveau mot de passe est invalide.");
        }
        let changedUser;
        await enqueueWrite(async () => {
          const auth = await readJson(authPath, null);
          const user = auth?.users?.find((entry) => entry.id === pendingRecord.pending.userId && entry.enabled !== false);
          if (!user) throw Object.assign(new Error("Compte local introuvable."), { statusCode: 401 });
          if (verifyPassword(password, user)) throw Object.assign(new Error("Choisissez un mot de passe différent du mot de passe temporaire."), { statusCode: 400 });
          Object.assign(user, derivePassword(password), { mustChangePassword: false, passwordChangedAt: nowIso(), updatedAt: nowIso() });
          await writeJsonAtomic(authPath, auth);
          changedUser = user;
        });
        pendingPasswordChanges.delete(pendingRecord.key);
        await recordAudit(changedUser, "account-temporary-password-changed", { details: { userId: changedUser.id } });
        return mfaChallenge(response, changedUser);
      }

      if (request.method === "POST" && url.pathname === "/api/mfa/confirm") {
        const body = await readBody(request);
        const pendingRecord = readPendingMfa(body.pendingToken);
        if (!pendingRecord || pendingRecord.pending.type !== "enroll") return await rejectInvalidMfaChallenge(request, response);
        const enrollmentIdentity = { id: pendingRecord.pending.userId, mfa: { enabled: true, secret: pendingRecord.pending.secret, recoveryHashes: [] } };
        const verification = await verifyMfaAttempt(request, response, enrollmentIdentity, body.code, { challengeRecord: pendingRecord.pending, challengeKey: pendingRecord.key });
        if (!verification.ok) return;
        let enrolledUser;
        const recoveryCodes = generateRecoveryCodes();
        await enqueueWrite(async () => {
          const auth = await readJson(authPath, null);
          const user = auth?.users?.find((entry) => entry.id === pendingRecord.pending.userId && entry.enabled !== false);
          if (!user) throw Object.assign(new Error("Compte local introuvable."), { statusCode: 401 });
          user.mfa = { enabled: true, secret: pendingRecord.pending.secret, confirmedAt: nowIso(), recoveryHashes: recoveryCodes.map(recoveryHash) };
          await writeJsonAtomic(authPath, auth);
          enrolledUser = user;
        });
        pendingMfa.delete(pendingRecord.key);
        revokeUserSessions(enrolledUser.id);
        await persistSessions();
        await recordAudit(enrolledUser, "account-mfa-enrolled", { details: { userId: enrolledUser.id } });
        return await issueSession(request, response, enrolledUser, { recoveryCodes });
      }

      if (request.method === "POST" && url.pathname === "/api/mfa/verify") {
        const body = await readBody(request);
        const pendingRecord = readPendingMfa(body.pendingToken);
        const auth = await readJson(authPath, null);
        const user = pendingRecord && auth?.users?.find((entry) => entry.id === pendingRecord.pending.userId && entry.enabled !== false);
        if (!pendingRecord || pendingRecord.pending.type !== "verify" || !user?.mfa?.enabled) {
          return await rejectInvalidMfaChallenge(request, response);
        }
        const code = String(body.code || "").trim();
        const verification = await verifyMfaAttempt(request, response, user, code, { challengeRecord: pendingRecord.pending, challengeKey: pendingRecord.key, allowRecovery: true });
        if (!verification.ok) return;
        if (verification.recoveryIndex >= 0) {
          user.mfa.recoveryHashes.splice(verification.recoveryIndex, 1);
          await enqueueWrite(() => writeJsonAtomic(authPath, auth));
        }
        pendingMfa.delete(pendingRecord.key);
        return await issueSession(request, response, user);
      }

      if (request.method === "GET" && url.pathname === "/api/me") {
        const session = requireSession(request, response);
        if (!session) return;
        const auth = await readJson(authPath, null);
        const user = auth?.users?.find((entry) => entry.id === session.userId && entry.enabled !== false);
        if (!user) return errorResponse(response, 401, "authentication_required", "Le compte local n’est plus actif.");
        return jsonResponse(response, 200, { user: publicUser(user), csrf: session.csrf, sessionExpiresAt: new Date(session.expiresAt).toISOString(), sessionTtlSeconds: SESSION_TTL_MS / 1000, vaultUnlockedUntil: new Date(session.vaultUnlockedUntil || 0).toISOString() });
      }

      if (request.method === "PUT" && url.pathname === "/api/me/preferences") {
        const session = requireSession(request, response, true);
        if (!session) return;
        const body = await readBody(request);
        const visibleModules = body.visibleModules;
        if (!Array.isArray(visibleModules) || visibleModules.length > 300 || visibleModules.some((id) => !isSafeId(id))) {
          return errorResponse(response, 400, "invalid_preferences", "La liste des modules visibles est invalide.");
        }
        let updatedUser;
        await enqueueWrite(async () => {
          const auth = await readJson(authPath, null);
          const user = auth?.users?.find((entry) => entry.id === session.userId && entry.enabled !== false);
          if (!user) throw Object.assign(new Error("Compte local introuvable."), { statusCode: 401 });
          user.preferences = { ...(user.preferences || {}), visibleModules: [...new Set(visibleModules)] };
          await writeJsonAtomic(authPath, auth);
          updatedUser = user;
        });
        return jsonResponse(response, 200, { user: publicUser(updatedUser) });
      }

      if (request.method === "GET" && url.pathname === "/api/me/sessions") {
        const session = requireSession(request, response);
        if (!session) return;
        const userContext = await requireUser(session, response);
        if (!userContext) return;
        const items = [...sessions.values()]
          .filter((entry) => entry.userId === userContext.user.id && entry.expiresAt > sessionNow())
          .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
          .map((entry) => publicSession(entry, session.id));
        return jsonResponse(response, 200, { sessions: items });
      }

      const ownSessionDeleteMatch = url.pathname.match(/^\/api\/me\/sessions\/([a-z0-9-]+)$/i);
      if (request.method === "DELETE" && ownSessionDeleteMatch) {
        const session = requireSession(request, response, true);
        if (!session) return;
        const userContext = await requireUser(session, response);
        if (!userContext) return;
        const target = [...sessions.entries()].find(([, entry]) => entry.id === ownSessionDeleteMatch[1] && entry.userId === userContext.user.id);
        if (!target) return errorResponse(response, 404, "session_not_found", "Cette session est déjà fermée ou introuvable.");
        sessions.delete(target[0]);
        await persistSessions();
        await recordAudit(userContext.user, "session-revoked", { details: { sessionId: target[1].id, current: target[1].id === session.id } });
        return jsonResponse(response, 200, { revoked: true, current: target[1].id === session.id }, target[1].id === session.id ? { "set-cookie": sessionCookie(request, "", 0, new Set([...trustedProxies, ...savedTrustedProxies])) } : {});
      }

      if (request.method === "POST" && url.pathname === "/api/me/change-password") {
        const session = requireSession(request, response, true);
        if (!session) return;
        const body = await readBody(request);
        const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
        const password = typeof body.password === "string" ? body.password : "";
        if (password.length < 10 || password.length > 256) return errorResponse(response, 400, "invalid_password", "Le nouveau mot de passe doit contenir de 10 à 256 caractères.");
        const currentAuth = await readJson(authPath, null);
        const currentUser = currentAuth?.users?.find((entry) => entry.id === session.userId && entry.enabled !== false);
        if (!currentUser || !verifyPassword(currentPassword, currentUser)) return errorResponse(response, 401, "invalid_mfa", "Le mot de passe actuel ou le code MFA est incorrect.");
        if (!(await verifyMfaAttempt(request, response, currentUser, body.code, { purpose: "privileged" })).ok) return;
        let updatedUser;
        await enqueueWrite(async () => {
          const auth = await readJson(authPath, null);
          const user = auth?.users?.find((entry) => entry.id === session.userId && entry.enabled !== false);
          if (!user || !verifyPassword(currentPassword, user)) {
            throw Object.assign(new Error("Le mot de passe actuel ou le code MFA est incorrect."), { statusCode: 401, code: "invalid_mfa" });
          }
          if (verifyPassword(password, user)) throw Object.assign(new Error("Choisissez un nouveau mot de passe différent."), { statusCode: 400 });
          Object.assign(user, derivePassword(password), { mustChangePassword: false, passwordChangedAt: nowIso(), updatedAt: nowIso() });
          await writeJsonAtomic(authPath, auth);
          updatedUser = user;
        });
        for (const [key, entry] of sessions) if (entry.userId === session.userId && entry.id !== session.id) sessions.delete(key);
        await persistSessions();
        await recordAudit(updatedUser, "account-password-changed", { details: { userId: updatedUser.id, otherSessionsRevoked: true } });
        return jsonResponse(response, 200, { changed: true, user: publicUser(updatedUser) });
      }

      if (request.method === "POST" && url.pathname === "/api/me/recovery-codes") {
        const session = requireSession(request, response, true);
        if (!session) return;
        const body = await readBody(request);
        const currentAuth = await readJson(authPath, null);
        const currentUser = currentAuth?.users?.find((entry) => entry.id === session.userId && entry.enabled !== false);
        if (!(await verifyMfaAttempt(request, response, currentUser, body.code, { purpose: "privileged" })).ok) return;
        let updatedUser;
        const recoveryCodes = generateRecoveryCodes();
        await enqueueWrite(async () => {
          const auth = await readJson(authPath, null);
          const user = auth?.users?.find((entry) => entry.id === session.userId && entry.enabled !== false);
          if (!user?.mfa?.enabled) throw Object.assign(new Error("Le code MFA est incorrect."), { statusCode: 401, code: "invalid_mfa" });
          user.mfa.recoveryHashes = recoveryCodes.map(recoveryHash);
          user.updatedAt = nowIso();
          await writeJsonAtomic(authPath, auth);
          updatedUser = user;
        });
        await recordAudit(updatedUser, "account-recovery-codes-regenerated", { details: { userId: updatedUser.id } });
        return jsonResponse(response, 200, { recoveryCodes });
      }

      if (request.method === "POST" && url.pathname === "/api/me/mfa/re-enroll") {
        const session = requireSession(request, response, true);
        if (!session) return;
        const body = await readBody(request);
        const auth = await readJson(authPath, null);
        const user = auth?.users?.find((entry) => entry.id === session.userId && entry.enabled !== false);
        if (!user || !verifyPassword(String(body.password || ""), user)) {
          return errorResponse(response, 401, "invalid_mfa", "Le mot de passe actuel ou le code MFA est incorrect.");
        }
        if (!(await verifyMfaAttempt(request, response, user, body.code, { purpose: "privileged" })).ok) return;
        const pending = createPendingMfa(user, "enroll");
        const issuer = encodeURIComponent("TRC Community Atlas");
        const account = encodeURIComponent(user.username);
        await recordAudit(user, "account-mfa-reenrollment-started", { details: { userId: user.id } });
        return jsonResponse(response, 200, { pendingToken: pending.token, secret: pending.secret, otpauthUri: `otpauth://totp/${issuer}:${account}?secret=${pending.secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30` });
      }

      if (request.method === "GET" && url.pathname === "/api/attachments") {
        const session = requireSession(request, response);
        if (!session) return;
        const userContext = await requireUser(session, response);
        if (!userContext) return;
        const requestedRef = url.searchParams.get("assetRef") || "";
        if (requestedRef && !isSafeAssetRef(requestedRef)) return errorResponse(response, 400, "invalid_asset_ref", "La fiche demandée est invalide.");
        const document = await readJson(attachmentsPath, { schemaVersion: 1, items: [], events: [] });
        const visibleItems = (document.items || []).filter((item) => canAccessOrganization(userContext.user, item.organizationId) && (!item.assetRef?.startsWith("vault:") || canAccessVault(userContext.user, item.organizationId)));
        const visibleAttachmentIds = new Set(visibleItems.map((item) => item.id));
        const items = visibleItems.filter((item) => !requestedRef || item.assetRef === requestedRef).map(publicAttachment);
        const events = (document.events || []).filter((event) => (!event.assetRef?.startsWith("vault:") || canAccessVault(userContext.user, event.organizationId)) && (visibleAttachmentIds.has(event.attachmentId) || canAccessOrganization(userContext.user, event.organizationId)) && (!requestedRef || event.assetRef === requestedRef)).map((event) => ({ id: event.id, attachmentId: event.attachmentId, assetRef: event.assetRef, at: event.at, actor: event.actor, action: event.action, name: event.name }));
        return jsonResponse(response, 200, { items, events });
      }

      if (request.method === "POST" && url.pathname === "/api/attachments") {
        const session = requireSession(request, response, true);
        if (!session) return;
        const writer = await requireWriter(session, response);
        if (!writer) return;
        const body = await readBody(request);
        const assetRef = cleanText(body.assetRef, 96, true);
        const name = safeAttachmentName(body.name);
        const mimeType = cleanText(body.mimeType, 120) || "application/octet-stream";
        const context = assetRef ? await assetContext(assetRef) : null;
        if (!context) return errorResponse(response, 404, "asset_not_found", "La fiche liée à cette pièce jointe est introuvable.");
        if (!requireOrganizationWriteAccess(writer.user, context.organizationId, response)) return;
        if (context.vault && !requireVaultAccess(writer.user, response, context.organizationId)) return;
        if (!requireVaultUnlock(context, session, response)) return;
        if (!name || typeof body.data !== "string" || body.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(body.data)) {
          return errorResponse(response, 400, "invalid_attachment", "Le nom ou le contenu de la pièce jointe est invalide.");
        }
        const content = Buffer.from(body.data, "base64");
        if (!content.length || content.length > MAX_ATTACHMENT_BYTES) return errorResponse(response, 413, "attachment_too_large", "La pièce jointe doit contenir entre 1 octet et 8 Mo.");
        const id = `att-${randomBytes(10).toString("hex")}`;
        const storedName = `${id}.bin`;
        const createdAt = nowIso();
        const item = { id, assetRef, organizationId: context.organizationId, name, mimeType, size: content.length, sha256: createHash("sha256").update(content).digest("hex"), createdAt, createdBy: writer.user.displayName };
        await mkdir(attachmentFilesRoot, { recursive: true });
        await writeFile(path.join(attachmentFilesRoot, storedName), content, { flag: "wx", mode: 0o600 });
        try {
          await enqueueWrite(async () => {
            const document = await readJson(attachmentsPath, { schemaVersion: 1, items: [], events: [] });
            document.items = Array.isArray(document.items) ? document.items : [];
            document.events = Array.isArray(document.events) ? document.events : [];
            document.items.push(item);
            document.events.unshift({ id: `attev-${randomBytes(8).toString("hex")}`, attachmentId: id, assetRef, organizationId: context.organizationId, at: createdAt, actor: writer.user.displayName, action: "Pièce jointe ajoutée", name });
            document.events = document.events.slice(0, 5000);
            await writeJsonAtomic(attachmentsPath, document);
          });
        } catch (error) {
          await unlink(path.join(attachmentFilesRoot, storedName)).catch(() => {});
          throw error;
        }
        return jsonResponse(response, 201, { item: publicAttachment(item) });
      }

      const attachmentDownloadMatch = url.pathname.match(/^\/api\/attachments\/([a-z0-9-]+)\/download$/i);
      if (request.method === "GET" && attachmentDownloadMatch) {
        const session = requireSession(request, response);
        if (!session) return;
        const document = await readJson(attachmentsPath, { schemaVersion: 1, items: [], events: [] });
        const item = document.items?.find((entry) => entry.id === attachmentDownloadMatch[1]);
        if (!item) return errorResponse(response, 404, "attachment_not_found", "Pièce jointe introuvable.");
        const context = await assetContext(item.assetRef);
        if (!context) return errorResponse(response, 404, "asset_not_found", "La fiche liée à cette pièce jointe est introuvable.");
        const userContext = await requireUser(session, response);
        if (!userContext || !requireOrganizationAccess(userContext.user, context.organizationId, response)) return;
        if (context.vault && !requireVaultAccess(userContext.user, response, context.organizationId)) return;
        if (!requireVaultUnlock(context, session, response)) return;
        const content = await readFile(path.join(attachmentFilesRoot, `${item.id}.bin`));
        const fallbackName = item.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
        response.writeHead(200, {
          "content-type": item.mimeType || "application/octet-stream",
          "content-length": content.length,
          "content-disposition": `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(item.name)}`,
          "cache-control": "no-store",
        });
        response.end(content);
        return;
      }

      const attachmentDeleteMatch = url.pathname.match(/^\/api\/attachments\/([a-z0-9-]+)$/i);
      if (request.method === "DELETE" && attachmentDeleteMatch) {
        const session = requireSession(request, response, true);
        if (!session) return;
        const writer = await requireWriter(session, response);
        if (!writer) return;
        let removed;
        await enqueueWrite(async () => {
          const document = await readJson(attachmentsPath, { schemaVersion: 1, items: [], events: [] });
          const index = document.items?.findIndex((entry) => entry.id === attachmentDeleteMatch[1]) ?? -1;
          if (index < 0) throw Object.assign(new Error("Pièce jointe introuvable."), { statusCode: 404 });
          removed = document.items[index];
          const context = await assetContext(removed.assetRef);
          if (!context) throw Object.assign(new Error("La fiche liée à cette pièce jointe est introuvable."), { statusCode: 404 });
          if (!canWriteOrganization(writer.user, context.organizationId)) throw Object.assign(new Error("Ce compte possède seulement un accès en lecture à cette organisation."), { statusCode: 403 });
          if (context.vault && !canAccessVault(writer.user, context.organizationId)) throw Object.assign(new Error("Ce compte n’est pas autorisé à modifier le coffre de mots de passe."), { statusCode: 403, code: "vault_access_required" });
          if (context.vault && (session.vaultUnlockedUntil || 0) < sessionNow()) throw Object.assign(new Error("Déverrouillez le coffre avec le MFA avant de retirer cette pièce jointe."), { statusCode: 403, code: "vault_locked" });
          document.items.splice(index, 1);
          document.events = Array.isArray(document.events) ? document.events : [];
          document.events.unshift({ id: `attev-${randomBytes(8).toString("hex")}`, attachmentId: removed.id, assetRef: removed.assetRef, organizationId: context.organizationId, at: nowIso(), actor: writer.user.displayName, action: "Pièce jointe retirée", name: removed.name });
          document.events = document.events.slice(0, 5000);
          await writeJsonAtomic(attachmentsPath, document);
        });
        await unlink(path.join(attachmentFilesRoot, `${removed.id}.bin`)).catch((error) => { if (error?.code !== "ENOENT") throw error; });
        return jsonResponse(response, 200, { deleted: true, id: removed.id });
      }

      if (request.method === "POST" && url.pathname === "/api/vault/unlock") {
        const session = requireSession(request, response, true);
        if (!session) return;
        const body = await readBody(request);
        const auth = await readJson(authPath, null);
        const user = auth?.users?.find((entry) => entry.id === session.userId && entry.enabled !== false);
        if (!user || !requireVaultAccess(user, response)) return;
        if (!(await verifyMfaAttempt(request, response, user, body.code, { purpose: "privileged" })).ok) return;
        session.vaultUnlockedUntil = session.expiresAt;
        await persistSessions();
        await recordAudit(user, "vault-session-unlocked", { details: { sessionId: session.id } });
        return jsonResponse(response, 200, { unlockedUntil: new Date(session.vaultUnlockedUntil).toISOString() });
      }

      if (request.method === "POST" && url.pathname === "/api/vault/lock") {
        const session = requireSession(request, response, true);
        if (!session) return;
        const userContext = await requireUser(session, response);
        if (!userContext || !requireVaultAccess(userContext.user, response)) return;
        session.vaultUnlockedUntil = 0;
        await persistSessions();
        await recordAudit(userContext.user, "vault-session-locked", { details: { sessionId: session.id } });
        return jsonResponse(response, 200, { locked: true });
      }

      if (request.method === "GET" && url.pathname === "/api/vault") {
        const session = requireSession(request, response);
        if (!session) return;
        const userContext = await requireUser(session, response);
        if (!userContext || !requireVaultAccess(userContext.user, response)) return;
        const vault = await ensureVaultSecurityMetadata();
        const visible = (vault.items || []).filter((item) => canAccessOrganization(userContext.user, item.organizationId) && canAccessVault(userContext.user, item.organizationId));
        const fingerprintCounts = new Map();
        for (const item of visible) if (item.passwordFingerprint) fingerprintCounts.set(item.passwordFingerprint, (fingerprintCounts.get(item.passwordFingerprint) || 0) + 1);
        return jsonResponse(response, 200, { items: visible.map((item) => vaultMetadata(item, item.passwordFingerprint ? fingerprintCounts.get(item.passwordFingerprint) || 0 : 0)) });
      }

      if (request.method === "POST" && url.pathname === "/api/vault") {
        const session = requireSession(request, response, true);
        if (!session) return;
        const writer = await requireWriter(session, response);
        if (!writer || !requireVaultAccess(writer.user, response)) return;
        const body = await readBody(request);
        const title = cleanText(body.title, 160, true);
        const organizationId = cleanText(body.organizationId, 64, true);
        const category = cleanText(body.category, 80) || "Général";
        const username = cleanText(body.username, 300);
        const password = typeof body.password === "string" && body.password.length <= 4096 ? body.password : null;
        const urlValue = cleanText(body.url, 1000);
        const notes = cleanText(body.notes, 5000);
        const otpSecret = typeof body.otpSecret === "string" && /^[A-Z2-7\s-]{0,256}$/i.test(body.otpSecret) ? body.otpSecret.replace(/[^A-Z2-7]/gi, "").toUpperCase() : null;
        const expiresAt = safeIsoDate(body.expiresAt);
        const passwordChangedAt = safeIsoDate(body.passwordChangedAt) || nowIso();
        const rotationIntervalDays = Number(body.rotationIntervalDays) || 0;
        const rotationOwner = cleanText(body.rotationOwner, 120);
        if (!title || !organizationId || password === null || otpSecret === null || expiresAt === null || passwordChangedAt === null || !Number.isInteger(rotationIntervalDays) || rotationIntervalDays < 0 || rotationIntervalDays > 730) return errorResponse(response, 400, "invalid_vault_item", "La fiche de coffre ou ses paramètres de rotation sont invalides.");
        if (!requireOrganizationWriteAccess(writer.user, organizationId, response)) return;
        if (!requireVaultAccess(writer.user, response, organizationId)) return;
        const key = await getVaultKey();
        const createdAt = nowIso();
        const item = { id: `vault-${randomBytes(8).toString("hex")}`, organizationId, title, category, archived: false, createdAt, updatedAt: createdAt, passwordChangedAt, expiresAt, rotationOwner, rotationIntervalDays, strength: passwordStrength(password), strengthEvaluatedAt: createdAt, passwordFingerprint: passwordFingerprint(password, key), encrypted: encryptPayload({ username, password, url: urlValue, notes, otpSecret }, key) };
        await enqueueWrite(async () => {
          const vault = await readJson(vaultPath, { schemaVersion: 1, items: [] });
          vault.items = Array.isArray(vault.items) ? vault.items : [];
          vault.items.push(item);
          await writeJsonAtomic(vaultPath, vault);
        });
        await recordAudit(writer.user, "vault-created", { assetRef: `vault:${item.id}`, organizationId, details: { title, category } });
        return jsonResponse(response, 201, { item: vaultMetadata(item) });
      }

      const vaultRevealMatch = url.pathname.match(/^\/api\/vault\/([a-z0-9-]+)\/reveal$/i);
      if (request.method === "POST" && vaultRevealMatch) {
        const session = requireSession(request, response, true);
        if (!session) return;
        const userContext = await requireUser(session, response);
        if (!userContext || !requireVaultAccess(userContext.user, response)) return;
        if ((session.vaultUnlockedUntil || 0) < sessionNow()) return errorResponse(response, 403, "vault_locked", "Le coffre a été verrouillé manuellement. Vérifiez votre MFA pour le rouvrir.");
        const vault = await readJson(vaultPath, { schemaVersion: 1, items: [] });
        const item = vault.items?.find((entry) => entry.id === vaultRevealMatch[1] && !entry.archived);
        if (!item) return errorResponse(response, 404, "vault_item_not_found", "Fiche de coffre introuvable.");
        if (!requireOrganizationAccess(userContext.user, item.organizationId, response)) return;
        if (!requireVaultAccess(userContext.user, response, item.organizationId)) return;
        const payload = decryptPayload(item.encrypted, await getVaultKey());
        await recordAudit(userContext.user, "vault-revealed", { assetRef: `vault:${item.id}`, organizationId: item.organizationId, details: { title: item.title } });
        return jsonResponse(response, 200, { unlockedUntil: new Date(session.vaultUnlockedUntil).toISOString(), item: { ...vaultMetadata(item), username: payload.username, password: payload.password, url: payload.url, notes: payload.notes, otp: payload.otpSecret ? totpAt(payload.otpSecret) : "", otpExpiresIn: payload.otpSecret ? 30 - (Math.floor(Date.now() / 1000) % 30) : 0 } });
      }

      const vaultAccessEventMatch = url.pathname.match(/^\/api\/vault\/([a-z0-9-]+)\/access-event$/i);
      if (request.method === "POST" && vaultAccessEventMatch) {
        const session = requireSession(request, response, true);
        if (!session) return;
        const userContext = await requireUser(session, response);
        if (!userContext || !requireVaultAccess(userContext.user, response)) return;
        if ((session.vaultUnlockedUntil || 0) < sessionNow()) return errorResponse(response, 403, "vault_locked", "Le coffre est verrouillé.");
        const body = await readBody(request);
        const allowedActions = new Set(["copied-username", "copied-password", "copied-otp", "copied-url"]);
        if (!allowedActions.has(body.action)) return errorResponse(response, 400, "invalid_vault_event", "Événement de coffre invalide.");
        const vault = await readJson(vaultPath, { schemaVersion: 1, items: [] });
        const item = vault.items?.find((entry) => entry.id === vaultAccessEventMatch[1] && !entry.archived);
        if (!item) return errorResponse(response, 404, "vault_item_not_found", "Fiche de coffre introuvable.");
        if (!requireOrganizationAccess(userContext.user, item.organizationId, response)) return;
        if (!requireVaultAccess(userContext.user, response, item.organizationId)) return;
        await recordAudit(userContext.user, `vault-${body.action}`, { assetRef: `vault:${item.id}`, organizationId: item.organizationId, details: { title: item.title } });
        return jsonResponse(response, 200, { recorded: true });
      }

      const vaultUpdateMatch = url.pathname.match(/^\/api\/vault\/([a-z0-9-]+)$/i);
      if (request.method === "PUT" && vaultUpdateMatch) {
        const session = requireSession(request, response, true);
        if (!session) return;
        const writer = await requireWriter(session, response);
        if (!writer || !requireVaultAccess(writer.user, response)) return;
        const body = await readBody(request);
        const title = cleanText(body.title, 160, true);
        const organizationId = cleanText(body.organizationId, 64, true);
        const category = cleanText(body.category, 80) || "Général";
        const password = typeof body.password === "string" && body.password.length <= 4096 ? body.password : null;
        const otpSecret = typeof body.otpSecret === "string" && /^[A-Z2-7\s-]{0,256}$/i.test(body.otpSecret) ? body.otpSecret.replace(/[^A-Z2-7]/gi, "").toUpperCase() : null;
        const expiresAt = safeIsoDate(body.expiresAt);
        const requestedPasswordChangedAt = safeIsoDate(body.passwordChangedAt);
        const rotationIntervalDays = Number(body.rotationIntervalDays) || 0;
        const rotationOwner = cleanText(body.rotationOwner, 120);
        if (!title || !organizationId || password === null || otpSecret === null || expiresAt === null || requestedPasswordChangedAt === null || !Number.isInteger(rotationIntervalDays) || rotationIntervalDays < 0 || rotationIntervalDays > 730) return errorResponse(response, 400, "invalid_vault_item", "La fiche de coffre ou ses paramètres de rotation sont invalides.");
        let updated;
        const key = await getVaultKey();
        await enqueueWrite(async () => {
          const vault = await readJson(vaultPath, { schemaVersion: 1, items: [] });
          const item = vault.items?.find((entry) => entry.id === vaultUpdateMatch[1]);
          if (!item) throw Object.assign(new Error("Fiche de coffre introuvable."), { statusCode: 404 });
          if (!canWriteOrganization(writer.user, item.organizationId) || !canWriteOrganization(writer.user, organizationId)) throw Object.assign(new Error("Ce compte possède seulement un accès en lecture à cette organisation."), { statusCode: 403 });
          if (!canAccessVault(writer.user, item.organizationId) || !canAccessVault(writer.user, organizationId)) throw Object.assign(new Error("Ce compte n’est pas autorisé à modifier le coffre de cette organisation."), { statusCode: 403, code: "vault_access_required" });
          const previousPayload = decryptPayload(item.encrypted, key);
          item.organizationId = organizationId;
          item.title = title;
          item.category = category;
          item.archived = Boolean(body.archived);
          item.updatedAt = nowIso();
          const passwordChanged = password !== previousPayload.password;
          item.passwordChangedAt = requestedPasswordChangedAt || (passwordChanged ? nowIso() : item.passwordChangedAt || item.createdAt);
          item.expiresAt = expiresAt;
          item.rotationOwner = rotationOwner;
          item.rotationIntervalDays = rotationIntervalDays;
          item.strength = passwordStrength(password);
          item.strengthEvaluatedAt = nowIso();
          item.passwordFingerprint = passwordFingerprint(password, key);
          item.encrypted = encryptPayload({ username: cleanText(body.username, 300), password, url: cleanText(body.url, 1000), notes: cleanText(body.notes, 5000), otpSecret: otpSecret || previousPayload.otpSecret || "" }, key);
          await writeJsonAtomic(vaultPath, vault);
          updated = item;
        });
        await recordAudit(writer.user, "vault-updated", { assetRef: `vault:${updated.id}`, organizationId: updated.organizationId, details: { title: updated.title, category: updated.category, archived: updated.archived } });
        return jsonResponse(response, 200, { item: vaultMetadata(updated) });
      }

      if (request.method === "POST" && url.pathname === "/api/logout") {
        const session = requireSession(request, response, true);
        if (!session) return;
        const token = parseCookies(request).atlas_session;
        sessions.delete(createHash("sha256").update(token).digest("hex"));
        await persistSessions();
        return jsonResponse(response, 200, { signedOut: true }, { "set-cookie": sessionCookie(request, "", 0, new Set([...trustedProxies, ...savedTrustedProxies])) });
      }

      if (request.method === "GET" && url.pathname === "/api/users") {
        const session = requireSession(request, response);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        return jsonResponse(response, 200, { users: context.auth.users.map((user) => ({ ...publicUser(user), activeSessions: [...sessions.values()].filter((entry) => entry.userId === user.id && entry.expiresAt > sessionNow()).length })) });
      }

      const userSessionsMatch = url.pathname.match(/^\/api\/users\/([a-z0-9-]+)\/sessions$/i);
      if (request.method === "GET" && userSessionsMatch) {
        const session = requireSession(request, response);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        const user = context.auth.users.find((entry) => entry.id === userSessionsMatch[1]);
        if (!user) return errorResponse(response, 404, "user_not_found", "Compte local introuvable.");
        const items = [...sessions.values()].filter((entry) => entry.userId === user.id && entry.expiresAt > sessionNow()).sort((a, b) => b.lastSeenAt - a.lastSeenAt).map((entry) => publicSession(entry, session.id));
        return jsonResponse(response, 200, { user: publicUser(user), sessions: items });
      }

      if (request.method === "POST" && url.pathname === "/api/users") {
        const session = requireSession(request, response, true);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        const body = await readBody(request);
        if (!(await requirePrivilegedMfa(context.user, body, response))) return;
        const username = cleanText(body.username, 64, true)?.toLowerCase();
        const displayName = cleanText(body.displayName, 96, true);
        const password = typeof body.password === "string" ? body.password : "";
        const role = ["administrator", "editor", "viewer"].includes(body.role) ? body.role : null;
        if (!username || !/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username) || !displayName || !role || password.length < 10 || password.length > 256) {
          return errorResponse(response, 400, "invalid_user", "Le compte, le rôle ou le mot de passe est invalide.");
        }
        if (context.auth.users.some((entry) => entry.username === username)) {
          return errorResponse(response, 409, "username_exists", "Ce nom d’utilisateur existe déjà.");
        }
        const organizationIds = await validateUserOrganizationIds(role, body.organizationIds);
        const organizationPermissions = await validateOrganizationPermissions(role, organizationIds, body.organizationPermissions, body.vaultAccess === true);
        const createdAt = nowIso();
        const user = { id: `user-${randomBytes(8).toString("hex")}`, username, displayName, role, organizationIds, organizationPermissions, vaultAccess: role === "administrator" || body.vaultAccess === true, enabled: true, mustChangePassword: true, createdAt, updatedAt: createdAt, preferences: { visibleModules: null }, mfa: { enabled: false, secret: "", recoveryHashes: [] }, ...derivePassword(password) };
        context.auth.users.push(user);
        context.auth.schemaVersion = Math.max(Number(context.auth.schemaVersion) || 1, 3);
        await enqueueWrite(() => writeJsonAtomic(authPath, context.auth));
        await recordAudit(context.user, "account-created", { details: { userId: user.id, username: user.username, role: user.role, organizationIds: user.organizationIds, vaultAccess: user.vaultAccess } });
        return jsonResponse(response, 201, { user: publicUser(user) });
      }

      const updateUserMatch = url.pathname.match(/^\/api\/users\/([a-z0-9-]+)$/i);
      if (request.method === "PUT" && updateUserMatch) {
        const session = requireSession(request, response, true);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        const user = context.auth.users.find((entry) => entry.id === updateUserMatch[1]);
        if (!user) return errorResponse(response, 404, "user_not_found", "Compte local introuvable.");
        if (user.id === context.user.id) return errorResponse(response, 400, "self_access_change_rejected", "Utilisez un autre administrateur pour modifier les droits de votre propre compte.");
        const body = await readBody(request);
        if (!(await requirePrivilegedMfa(context.user, body, response))) return;
        const displayName = cleanText(body.displayName, 96, true);
        const role = ["administrator", "editor", "viewer"].includes(body.role) ? body.role : null;
        if (!displayName || !role) return errorResponse(response, 400, "invalid_user", "Le nom affiché ou le rôle est invalide.");
        if (user.role === "administrator" && role !== "administrator" && user.enabled !== false && context.auth.users.filter((entry) => entry.role === "administrator" && entry.enabled !== false).length <= 1) {
          return errorResponse(response, 409, "last_administrator_required", "Conservez au moins un administrateur local actif.");
        }
        user.displayName = displayName;
        user.role = role;
        user.organizationIds = await validateUserOrganizationIds(role, body.organizationIds);
        user.organizationPermissions = await validateOrganizationPermissions(role, user.organizationIds, body.organizationPermissions, body.vaultAccess === true);
        user.vaultAccess = role === "administrator" || body.vaultAccess === true;
        user.updatedAt = nowIso();
        context.auth.schemaVersion = Math.max(Number(context.auth.schemaVersion) || 1, 3);
        await enqueueWrite(() => writeJsonAtomic(authPath, context.auth));
        const revokedSessions = revokeUserSessions(user.id);
        await persistSessions();
        await recordAudit(context.user, "account-access-updated", { details: { userId: user.id, username: user.username, role: user.role, organizationIds: user.organizationIds, vaultAccess: user.vaultAccess, revokedSessions } });
        return jsonResponse(response, 200, { user: publicUser(user), revokedSessions });
      }

      const toggleMatch = url.pathname.match(/^\/api\/users\/([a-z0-9-]+)\/toggle$/i);
      if (request.method === "POST" && toggleMatch) {
        const session = requireSession(request, response, true);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        const body = await readBody(request);
        if (!(await requirePrivilegedMfa(context.user, body, response))) return;
        const user = context.auth.users.find((entry) => entry.id === toggleMatch[1]);
        if (!user) return errorResponse(response, 404, "user_not_found", "Compte local introuvable.");
        if (user.id === context.user.id) return errorResponse(response, 400, "self_disable_rejected", "Vous ne pouvez pas désactiver votre propre compte.");
        if (user.role === "administrator" && user.enabled !== false && context.auth.users.filter((entry) => entry.role === "administrator" && entry.enabled !== false).length <= 1) {
          return errorResponse(response, 409, "last_administrator_required", "Conservez au moins un administrateur local actif.");
        }
        user.enabled = user.enabled === false;
        user.updatedAt = nowIso();
        await enqueueWrite(() => writeJsonAtomic(authPath, context.auth));
        if (!user.enabled) {
          revokeUserSessions(user.id);
          await persistSessions();
        }
        await recordAudit(context.user, user.enabled ? "account-enabled" : "account-disabled", { details: { userId: user.id, username: user.username } });
        return jsonResponse(response, 200, { user: publicUser(user) });
      }

      const resetMfaMatch = url.pathname.match(/^\/api\/users\/([a-z0-9-]+)\/reset-mfa$/i);
      if (request.method === "POST" && resetMfaMatch) {
        const session = requireSession(request, response, true);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        const body = await readBody(request);
        if (!(await requirePrivilegedMfa(context.user, body, response))) return;
        const user = context.auth.users.find((entry) => entry.id === resetMfaMatch[1]);
        if (!user) return errorResponse(response, 404, "user_not_found", "Compte local introuvable.");
        if (user.id === context.user.id) return errorResponse(response, 400, "self_mfa_reset_rejected", "Utilisez un autre administrateur pour réinitialiser votre MFA.");
        user.mfa = { enabled: false, secret: "", recoveryHashes: [] };
        user.updatedAt = nowIso();
        await enqueueWrite(() => writeJsonAtomic(authPath, context.auth));
        revokeUserSessions(user.id);
        await persistSessions();
        await recordAudit(context.user, "account-mfa-reset", { details: { userId: user.id, username: user.username } });
        return jsonResponse(response, 200, { user: publicUser(user) });
      }

      const resetPasswordMatch = url.pathname.match(/^\/api\/users\/([a-z0-9-]+)\/reset-password$/i);
      if (request.method === "POST" && resetPasswordMatch) {
        const session = requireSession(request, response, true);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        const user = context.auth.users.find((entry) => entry.id === resetPasswordMatch[1]);
        if (!user) return errorResponse(response, 404, "user_not_found", "Compte local introuvable.");
        if (user.id === context.user.id) return errorResponse(response, 400, "self_password_reset_rejected", "Utilisez un autre administrateur pour réinitialiser votre propre mot de passe.");
        const body = await readBody(request);
        if (!(await requirePrivilegedMfa(context.user, body, response))) return;
        const password = typeof body.password === "string" ? body.password : "";
        if (password.length < 10 || password.length > 256) return errorResponse(response, 400, "invalid_password", "Le mot de passe temporaire doit contenir de 10 à 256 caractères.");
        Object.assign(user, derivePassword(password), { updatedAt: nowIso(), passwordResetAt: nowIso(), mustChangePassword: true });
        await enqueueWrite(() => writeJsonAtomic(authPath, context.auth));
        const revokedSessions = revokeUserSessions(user.id);
        await persistSessions();
        await recordAudit(context.user, "account-password-reset", { details: { userId: user.id, username: user.username, revokedSessions, changeRequired: true } });
        return jsonResponse(response, 200, { user: publicUser(user), revokedSessions });
      }

      const revokeSessionsMatch = url.pathname.match(/^\/api\/users\/([a-z0-9-]+)\/revoke-sessions$/i);
      if (request.method === "POST" && revokeSessionsMatch) {
        const session = requireSession(request, response, true);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        const body = await readBody(request);
        if (!(await requirePrivilegedMfa(context.user, body, response))) return;
        const user = context.auth.users.find((entry) => entry.id === revokeSessionsMatch[1]);
        if (!user) return errorResponse(response, 404, "user_not_found", "Compte local introuvable.");
        if (user.id === context.user.id) return errorResponse(response, 400, "self_session_revoke_rejected", "Utilisez la déconnexion pour fermer votre session actuelle.");
        const revokedSessions = revokeUserSessions(user.id);
        await persistSessions();
        await recordAudit(context.user, "account-sessions-revoked", { details: { userId: user.id, username: user.username, revokedSessions } });
        return jsonResponse(response, 200, { revokedSessions });
      }

      if (request.method === "GET" && url.pathname === "/api/workspace") {
        const session = requireSession(request, response);
        if (!session) return;
        const userContext = await requireUser(session, response);
        if (!userContext) return;
        const document = await readWorkspace();
        if (!document) return errorResponse(response, 500, "workspace_missing", "Les données de l’instance sont absentes.");
        return jsonResponse(response, 200, filterWorkspaceForUser(document, userContext.user));
      }

      if (request.method === "GET" && url.pathname === "/api/workspace/history") {
        if (!requireSession(request, response)) return;
        return jsonResponse(response, 200, { entries: (await getStore()).historyMetadata(200) });
      }

      const restoreMatch = url.pathname.match(/^\/api\/workspace\/history\/(\d+)\/restore$/);
      if (request.method === "POST" && restoreMatch) {
        const session = requireSession(request, response, true);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        let restored;
        await enqueueWrite(async () => {
          const store = await getStore();
          restored = store.restoreDocument(Number(restoreMatch[1]), context.user.displayName);
          if (!validateWorkspace(restored.data)) throw Object.assign(new Error("Révision invalide."), { statusCode: 400 });
          await mirrorStore(store, restored);
        });
        return jsonResponse(response, 200, restored);
      }

      if (request.method === "GET" && url.pathname === "/api/export") {
        const session = requireSession(request, response);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        const workspace = await readWorkspace();
        return jsonResponse(response, 200, { format: "trc-atlas-export", version: 1, exportedAt: nowIso(), workspace }, { "content-disposition": `attachment; filename="trc-atlas-export-${new Date().toISOString().slice(0, 10)}.json"` });
      }

      if (request.method === "POST" && url.pathname === "/api/import") {
        const session = requireSession(request, response, true);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        const body = await readBody(request);
        const incoming = body?.format === "trc-atlas-export" ? body.workspace?.data : body?.data;
        if (!validateWorkspace(incoming)) return errorResponse(response, 400, "invalid_import", "Le fichier d’import Atlas est invalide.");
        let imported;
        await enqueueWrite(async () => {
          const store = await getStore();
          const current = store.readDocument();
          if (!current) throw Object.assign(new Error("Espace de travail introuvable."), { statusCode: 500 });
          imported = store.commitDocument(current.revision, structuredClone(incoming), context.user.displayName, "workspace-imported");
          await mirrorStore(store, imported);
        });
        return jsonResponse(response, 200, imported);
      }

      const organizationDeleteMatch = url.pathname.match(/^\/api\/organizations\/([a-z0-9-]+)$/i);
      if (request.method === "DELETE" && organizationDeleteMatch) {
        const session = requireSession(request, response, true);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        const body = await readBody(request);
        if (!(await verifyMfaAttempt(request, response, context.user, body.code, { purpose: "privileged" })).ok) return;
        const confirmation = cleanText(body.confirmation, 120, true);
        if (!confirmation) return errorResponse(response, 400, "organization_confirmation_required", "Confirmez le nom exact de l’organisation.");

        let nextDocument;
        let deletedOrganization;
        let removedAttachmentIds = [];
        let removed = {};
        let detachedChildOrganizations = 0;
        await enqueueWrite(async () => {
          const store = await getStore();
          const current = store.readDocument();
          if (!current) throw Object.assign(new Error("Espace de travail introuvable."), { statusCode: 500 });
          const organizationId = organizationDeleteMatch[1];
          const organization = current.data.organizations?.find((entry) => entry.id === organizationId);
          if (!organization) throw Object.assign(new Error("Organisation introuvable."), { statusCode: 404 });
          if (confirmation !== organization.name) throw Object.assign(new Error("Le nom de confirmation ne correspond pas à l’organisation."), { statusCode: 400, code: "organization_confirmation_mismatch" });

          const nextData = structuredClone(current.data);
          for (const collection of ["sites", "configurations", "procedures", "moduleRecords", "relations", "relationshipEvents", "activities"]) {
            if (!Array.isArray(nextData[collection])) nextData[collection] = [];
          }
          const removedSites = new Set(nextData.sites.filter((item) => item.organizationId === organizationId).map((item) => item.id));
          const removedConfigurations = new Set(nextData.configurations.filter((item) => item.organizationId === organizationId).map((item) => item.id));
          const removedProcedures = new Set(nextData.procedures.filter((item) => item.organizationId === organizationId).map((item) => item.id));
          const removedRecords = new Set(nextData.moduleRecords.filter((item) => item.organizationId === organizationId).map((item) => item.id));
          const removedRelations = new Set(nextData.relations.filter((item) => item.organizationId === organizationId).map((item) => item.id));
          const removedAssetRefs = new Set([
            ...[...removedSites].map((id) => `site:${id}`),
            ...[...removedConfigurations].map((id) => `configuration:${id}`),
            ...[...removedProcedures].map((id) => `procedure:${id}`),
            ...[...removedRecords].map((id) => `module:${id}`),
          ]);

          nextData.organizations = nextData.organizations.filter((item) => item.id !== organizationId);
          for (const child of nextData.organizations) {
            if (child.parentOrganizationId !== organizationId) continue;
            child.parentOrganizationId = "";
            detachedChildOrganizations += 1;
          }
          nextData.sites = nextData.sites.filter((item) => item.organizationId !== organizationId);
          nextData.configurations = nextData.configurations.filter((item) => item.organizationId !== organizationId);
          nextData.procedures = nextData.procedures.filter((item) => item.organizationId !== organizationId);
          nextData.moduleRecords = nextData.moduleRecords.filter((item) => item.organizationId !== organizationId);
          nextData.relations = nextData.relations.filter((item) => item.organizationId !== organizationId && !removedAssetRefs.has(item.sourceRef) && !removedAssetRefs.has(item.targetRef));
          nextData.relationshipEvents = (nextData.relationshipEvents || []).filter((item) => item.organizationId !== organizationId && !removedRelations.has(item.relationId));
          nextData.activities = (nextData.activities || []).filter((item) => item.organizationId !== organizationId);
          for (const configuration of nextData.configurations) {
            configuration.procedureIds = (configuration.procedureIds || []).filter((id) => !removedProcedures.has(id));
            configuration.relationIds = (configuration.relationIds || []).filter((id) => !removedRelations.has(id));
          }

          const originalVault = await readJson(vaultPath, { schemaVersion: 1, items: [] });
          const nextVault = structuredClone(originalVault);
          const removedVaultItems = (nextVault.items || []).filter((item) => item.organizationId === organizationId);
          nextVault.items = (nextVault.items || []).filter((item) => item.organizationId !== organizationId);

          const originalAttachments = await readJson(attachmentsPath, { schemaVersion: 1, items: [], events: [] });
          const nextAttachments = structuredClone(originalAttachments);
          const removedAttachments = (nextAttachments.items || []).filter((item) => item.organizationId === organizationId);
          removedAttachmentIds = removedAttachments.map((item) => item.id);
          const removedAttachmentIdSet = new Set(removedAttachmentIds);
          nextAttachments.items = (nextAttachments.items || []).filter((item) => item.organizationId !== organizationId);
          nextAttachments.events = (nextAttachments.events || []).filter((item) => item.organizationId !== organizationId && !removedAttachmentIdSet.has(item.attachmentId));

          const originalAuth = context.auth;
          const nextAuth = structuredClone(originalAuth);
          let updatedUsers = 0;
          for (const user of nextAuth.users || []) {
            if (!Array.isArray(user.organizationIds) || !user.organizationIds.includes(organizationId)) continue;
            user.organizationIds = user.organizationIds.filter((id) => id !== organizationId);
            if (Array.isArray(user.organizationPermissions)) user.organizationPermissions = user.organizationPermissions.filter((permission) => permission.organizationId !== organizationId);
            updatedUsers += 1;
          }

          if (!validateWorkspace(nextData)) throw Object.assign(new Error("La suppression produirait un espace de travail invalide."), { statusCode: 500 });
          try {
            await writeJsonAtomic(vaultPath, nextVault);
            await writeJsonAtomic(attachmentsPath, nextAttachments);
            await writeJsonAtomic(authPath, nextAuth);
            nextDocument = store.commitDocument(current.revision, nextData, context.user.displayName, `organization-deleted:${organizationId}`);
            await mirrorStore(store, nextDocument);
          } catch (error) {
            await Promise.allSettled([
              writeJsonAtomic(vaultPath, originalVault),
              writeJsonAtomic(attachmentsPath, originalAttachments),
              writeJsonAtomic(authPath, originalAuth),
            ]);
            throw error;
          }

          deletedOrganization = { id: organization.id, name: organization.name, code: organization.code };
          removed = {
            sites: removedSites.size,
            configurations: removedConfigurations.size,
            procedures: removedProcedures.size,
            records: removedRecords.size,
            relations: removedRelations.size,
            passwords: removedVaultItems.length,
            attachments: removedAttachments.length,
            userScopes: updatedUsers,
          };
        });

        await Promise.all(removedAttachmentIds.map((id) => unlink(path.join(attachmentFilesRoot, `${id}.bin`)).catch((error) => {
          if (error?.code !== "ENOENT") console.error(`[atlas] Pièce jointe orpheline après suppression de l’organisation : ${id}`, error);
        })));
        return jsonResponse(response, 200, { deleted: true, organization: deletedOrganization, removed, detachedChildOrganizations, workspace: nextDocument });
      }

      if (request.method === "PUT" && url.pathname === "/api/settings/security") {
        const session = requireSession(request, response, true);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        const body = await readBody(request);
        if (!(await requirePrivilegedMfa(context.user, body, response))) return;
        const nextSecurity = normalizedSecuritySettings({ security: body });
        let nextDocument;
        await enqueueWrite(async () => {
          const store = await getStore();
          const current = store.readDocument();
          if (!current || current.revision !== body.revision) throw Object.assign(new Error("Les données ont changé depuis leur ouverture."), { statusCode: 409, code: "revision_conflict" });
          const nextData = structuredClone(current.data);
          nextData.settings = { ...(nextData.settings || {}), security: nextSecurity };
          nextDocument = store.commitDocument(current.revision, nextData, context.user.displayName, "security-settings-updated");
          await mirrorStore(store, nextDocument);
        });
        await recordAudit(context.user, "security-policy-updated", { details: nextSecurity });
        return jsonResponse(response, 200, filterWorkspaceForUser(nextDocument, context.user));
      }

      if (request.method === "GET" && url.pathname === "/api/settings/backups") {
        const session = requireSession(request, response);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        return jsonResponse(response, 200, await backupManagerStatus());
      }

      if (request.method === "PUT" && url.pathname === "/api/settings/backups") {
        const session = requireSession(request, response, true);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        const body = await readBody(request);
        if (!(await requirePrivilegedMfa(context.user, body, response))) return;
        const current = await readBackupSettings();
        const destination = validateBackupDestination(body.destination || current.destination);
        const next = normalizeBackupSettings({
          ...current,
          enabled: body.enabled === true,
          destination,
          cadence: body.cadence,
          hour: body.hour,
          minute: body.minute,
          weekday: body.weekday,
          retentionEnabled: body.retentionEnabled === true,
          retentionCount: body.retentionCount,
        }, backupBaseRoot);
        const passphrase = typeof body.passphrase === "string" ? body.passphrase : "";
        if (passphrase) {
          await backupSecretProtector({ projectRoot, secretPath: backupSecretPath, passphrase });
          next.secretConfigured = true;
        }
        if (next.enabled && !next.secretConfigured) return errorResponse(response, 400, "backup_secret_required", "Ajoutez une phrase secrète d’au moins 12 caractères avant d’activer la planification.");
        next.nextRunAt = next.enabled ? nextBackupRun(next, Date.now()) : "";
        const saved = await saveBackupSettings(next);
        await recordAudit(context.user, "backup-settings-updated", { details: { enabled: saved.enabled, destination: saved.destination, cadence: saved.cadence, hour: saved.hour, minute: saved.minute, weekday: saved.weekday, retentionEnabled: saved.retentionEnabled, retentionCount: saved.retentionCount, secretChanged: Boolean(passphrase) } });
        return jsonResponse(response, 200, await backupManagerStatus());
      }

      if (request.method === "POST" && url.pathname === "/api/settings/backups/run") {
        const session = requireSession(request, response, true);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        const body = await readBody(request);
        if (!(await requirePrivilegedMfa(context.user, body, response))) return;
        const settings = await readBackupSettings();
        const passphrase = typeof body.passphrase === "string" ? body.passphrase : "";
        if (!passphrase && !settings.secretConfigured) return errorResponse(response, 400, "backup_secret_required", "Entrez la phrase secrète de sauvegarde ou configurez la planification chiffrée.");
        if (passphrase && passphrase.length < 12) return errorResponse(response, 400, "backup_secret_too_short", "La phrase secrète doit contenir au moins 12 caractères.");
        const result = await executeManagedBackup({ passphrase, actor: context.user.displayName });
        return jsonResponse(response, 200, { result, status: await backupManagerStatus() });
      }

      if (request.method === "POST" && url.pathname === "/api/settings/backups/inspect") {
        const session = requireSession(request, response, true);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        const body = await readBody(request);
        if (!(await requirePrivilegedMfa(context.user, body, response))) return;
        if (typeof body.passphrase !== "string" || body.passphrase.length < 12) return errorResponse(response, 400, "backup_secret_required", "Entrez la phrase secrète de cette sauvegarde.");
        const settings = await readBackupSettings();
        const result = await inspectManagedBackup({ destination: settings.destination, name: String(body.name || ""), passphrase: body.passphrase });
        await recordAudit(context.user, "backup-integrity-tested", { details: { file: result.name, valid: true, fileCount: result.fileCount } });
        return jsonResponse(response, 200, result);
      }

      if (request.method === "GET" && url.pathname === "/api/settings/updates") {
        const session = requireSession(request, response);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        return jsonResponse(response, 200, await updateStatusPayload());
      }

      if (request.method === "POST" && url.pathname === "/api/settings/updates/check") {
        const session = requireSession(request, response, true);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        lastReleaseCheck = await releaseChecker();
        const { state } = await readUpdateState();
        await writeJsonAtomic(updateStatePath, { ...state, schemaVersion: 1, lastCheck: lastReleaseCheck, updatedAt: nowIso() });
        await recordAudit(context.user, "github-release-checked", { details: { repository: lastReleaseCheck.repository || "MaxSim2001/TRC-Community-Atlas", tag: lastReleaseCheck.tag || "", updateAvailable: lastReleaseCheck.updateAvailable === true, installable: lastReleaseCheck.installable === true } });
        return jsonResponse(response, 200, await updateStatusPayload());
      }

      if (request.method === "POST" && url.pathname === "/api/settings/updates/prepare") {
        const session = requireSession(request, response, true);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        if (backupRunning) return errorResponse(response, 409, "backup_in_progress", "Attendez la fin de la sauvegarde avant de préparer une mise à jour.");
        const { state } = await readUpdateState();
        const release = lastReleaseCheck || state.lastCheck;
        const prepared = await releasePreparer({ release, currentVersion: ATLAS_VERSION, publicKeyPath: releasePublicKeyPath, updateRoot });
        await writeJsonAtomic(updateStatePath, { ...state, schemaVersion: 1, lastCheck: release, prepared, updatedAt: nowIso() });
        await recordAudit(context.user, "github-release-prepared", { details: { repository: prepared.repository, tag: prepared.tag, targetVersion: prepared.targetVersion, signatureVerified: true, packageVerified: true } });
        return jsonResponse(response, 200, await updateStatusPayload());
      }

      if (request.method === "POST" && url.pathname === "/api/settings/updates/apply") {
        const session = requireSession(request, response, true);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        const body = await readBody(request);
        if (!(await requirePrivilegedMfa(context.user, body, response))) return;
        if (backupRunning) return errorResponse(response, 409, "backup_in_progress", "Attendez la fin de la sauvegarde avant d’installer une mise à jour.");
        const { state, job } = await readUpdateState();
        const prepared = state.prepared;
        if (!prepared?.installable || !prepared.signatureVerified || !prepared.packageVerified || !prepared.rollbackReady) return errorResponse(response, 409, "update_not_prepared", "Téléchargez et vérifiez la Release avant de l’installer.");
        if (["starting", "verifying", "waiting-for-shutdown", "snapshotting", "installing"].includes(job?.status)) return errorResponse(response, 409, "update_in_progress", "Une mise à jour Atlas est déjà en cours.");
        const confirmation = `INSTALLER ${prepared.targetVersion}`;
        if (String(body.confirmation || "").trim() !== confirmation) return errorResponse(response, 400, "update_confirmation_required", `Saisissez exactement « ${confirmation} » pour confirmer l’arrêt et la mise à jour.`);
        const jobId = `update-${Date.now()}-${randomBytes(4).toString("hex")}`;
        const jobPath = path.join(updateJobsRoot, `${jobId}.json`);
        await writeJsonAtomic(jobPath, { schemaVersion: 1, jobId, status: "starting", message: "L’assistant de mise à jour démarre.", currentVersion: ATLAS_VERSION, targetVersion: prepared.targetVersion, updatedAt: nowIso() });
        await writeJsonAtomic(updateStatePath, { ...state, schemaVersion: 1, lastJobId: jobId, updatedAt: nowIso() });
        let launch;
        try {
          launch = await updaterLauncher({
            projectRoot,
            jobId,
            installRoot: projectRoot,
            dataRoot,
            updateRoot,
            packagePath: prepared.packagePath,
            manifestPath: prepared.manifestPath,
            signaturePath: prepared.signaturePath,
            publicKeyPath: releasePublicKeyPath,
            expectedVersion: prepared.targetVersion,
            taskName: "TRC Community Atlas",
            port,
            host,
            allowedOrigins: [...new Set([...allowedOrigins, ...savedDeploymentOrigins])],
            trustedProxies: [...new Set([...trustedProxies, ...savedTrustedProxies])],
          });
        } catch (error) {
          await writeJsonAtomic(jobPath, { schemaVersion: 1, jobId, status: "failed", message: "L’assistant de mise à jour n’a pas pu démarrer.", currentVersion: ATLAS_VERSION, targetVersion: prepared.targetVersion, failedReason: String(error?.message || error).slice(0, 500), updatedAt: nowIso() });
          throw error;
        }
        await recordAudit(context.user, "github-release-install-started", { details: { jobId, targetVersion: prepared.targetVersion, processId: launch.processId || null } });
        jsonResponse(response, 202, { jobId, status: "starting", targetVersion: prepared.targetVersion, message: "Atlas va redémarrer. Cette page se reconnectera automatiquement." });
        setTimeout(() => {
          if (typeof options.updateShutdownHandler === "function") {
            options.updateShutdownHandler({ server, jobId });
            return;
          }
          server.close(() => process.exit(0));
          server.closeAllConnections?.();
        }, 750).unref?.();
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/settings/local-api") {
        const session = requireSession(request, response);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        return jsonResponse(response, 200, publicLocalApiSettings(await readLocalApiSettings()));
      }

      if (request.method === "PUT" && url.pathname === "/api/settings/local-api") {
        const session = requireSession(request, response, true);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        const body = await readBody(request);
        if (!(await requirePrivilegedMfa(context.user, body, response))) return;
        const current = await readLocalApiSettings();
        const saved = await saveLocalApiSettings({ ...current, enabled: body.enabled === true, webhooksEnabled: body.webhooksEnabled === true });
        await recordAudit(context.user, "local-api-settings-updated", { details: { enabled: saved.enabled, webhooksEnabled: saved.webhooksEnabled } });
        return jsonResponse(response, 200, publicLocalApiSettings(saved));
      }

      if (request.method === "POST" && url.pathname === "/api/settings/local-api/tokens") {
        const session = requireSession(request, response, true);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        const body = await readBody(request);
        if (!(await requirePrivilegedMfa(context.user, body, response))) return;
        const label = cleanText(body.label, 80, true);
        const scopes = [...new Set((Array.isArray(body.scopes) ? body.scopes : []).filter((scope) => ["read:organizations", "read:records", "read:health"].includes(scope)))];
        if (!label || !scopes.length) return errorResponse(response, 400, "invalid_api_token", "Ajoutez un nom et au moins une portée au jeton.");
        const document = await readWorkspace();
        const organizationIds = body.allOrganizations === true ? null : [...new Set((Array.isArray(body.organizationIds) ? body.organizationIds : []).filter(isSafeId))];
        if (organizationIds !== null && (!organizationIds.length || organizationIds.some((id) => !document.data.organizations.some((organization) => organization.id === id)))) return errorResponse(response, 400, "invalid_api_organizations", "Choisissez au moins une organisation valide ou toutes les organisations.");
        const settings = await readLocalApiSettings();
        const rawToken = `atlas_${randomBytes(32).toString("base64url")}`;
        const token = { id: `token-${randomBytes(8).toString("hex")}`, label, hash: createHash("sha256").update(rawToken).digest("hex"), scopes, organizationIds, createdAt: nowIso(), lastUsedAt: "", revokedAt: "" };
        settings.tokens.push(token);
        const saved = await saveLocalApiSettings(settings);
        await recordAudit(context.user, "local-api-token-created", { details: { tokenId: token.id, label, scopes, organizationIds } });
        return jsonResponse(response, 201, { token: rawToken, item: publicLocalApiSettings(saved).tokens.find((item) => item.id === token.id) });
      }

      const localApiTokenMatch = url.pathname.match(/^\/api\/settings\/local-api\/tokens\/([a-z0-9-]+)$/i);
      if (request.method === "DELETE" && localApiTokenMatch) {
        const session = requireSession(request, response, true);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        const body = await readBody(request);
        if (!(await requirePrivilegedMfa(context.user, body, response))) return;
        const settings = await readLocalApiSettings();
        const token = settings.tokens.find((item) => item.id === localApiTokenMatch[1]);
        if (!token) return errorResponse(response, 404, "api_token_not_found", "Jeton API introuvable.");
        token.revokedAt = token.revokedAt || nowIso();
        const saved = await saveLocalApiSettings(settings);
        await recordAudit(context.user, "local-api-token-revoked", { details: { tokenId: token.id, label: token.label } });
        return jsonResponse(response, 200, publicLocalApiSettings(saved));
      }

      if (request.method === "POST" && url.pathname === "/api/settings/local-api/webhooks") {
        const session = requireSession(request, response, true);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        const body = await readBody(request);
        if (!(await requirePrivilegedMfa(context.user, body, response))) return;
        const label = cleanText(body.label, 80, true);
        const webhookUrl = validateLocalWebhookUrl(body.url);
        const events = [...new Set((Array.isArray(body.events) ? body.events : []).filter((event) => ["workspace.updated", "backup.completed", "backup.failed"].includes(event)))];
        if (!label || !events.length) return errorResponse(response, 400, "invalid_webhook", "Ajoutez un nom et au moins un événement au webhook.");
        const settings = await readLocalApiSettings();
        const secret = `whsec_${randomBytes(32).toString("base64url")}`;
        const item = { id: `webhook-${randomBytes(8).toString("hex")}`, label, url: webhookUrl, events, encryptedSecret: encryptPayload({ secret }, await getVaultKey()), enabled: true, createdAt: nowIso(), lastDeliveryAt: "", lastStatus: 0, lastError: "" };
        settings.webhooks.push(item);
        const saved = await saveLocalApiSettings(settings);
        await recordAudit(context.user, "local-webhook-created", { details: { webhookId: item.id, label, url: webhookUrl, events } });
        return jsonResponse(response, 201, { secret, item: publicLocalApiSettings(saved).webhooks.find((webhook) => webhook.id === item.id) });
      }

      const localWebhookMatch = url.pathname.match(/^\/api\/settings\/local-api\/webhooks\/([a-z0-9-]+)$/i);
      if (request.method === "DELETE" && localWebhookMatch) {
        const session = requireSession(request, response, true);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        const body = await readBody(request);
        if (!(await requirePrivilegedMfa(context.user, body, response))) return;
        const settings = await readLocalApiSettings();
        const index = settings.webhooks.findIndex((item) => item.id === localWebhookMatch[1]);
        if (index < 0) return errorResponse(response, 404, "webhook_not_found", "Webhook local introuvable.");
        const [removed] = settings.webhooks.splice(index, 1);
        const saved = await saveLocalApiSettings(settings);
        await recordAudit(context.user, "local-webhook-removed", { details: { webhookId: removed.id, label: removed.label } });
        return jsonResponse(response, 200, publicLocalApiSettings(saved));
      }

      const localWebhookTestMatch = url.pathname.match(/^\/api\/settings\/local-api\/webhooks\/([a-z0-9-]+)\/test$/i);
      if (request.method === "POST" && localWebhookTestMatch) {
        const session = requireSession(request, response, true);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        const body = await readBody(request);
        if (!(await requirePrivilegedMfa(context.user, body, response))) return;
        const settings = await readLocalApiSettings();
        const webhook = settings.webhooks.find((item) => item.id === localWebhookTestMatch[1]);
        if (!webhook) return errorResponse(response, 404, "webhook_not_found", "Webhook local introuvable.");
        try {
          const delivered = await sendLocalWebhook(webhook, "workspace.updated", { test: true, actor: context.user.displayName });
          webhook.lastDeliveryAt = nowIso(); webhook.lastStatus = Number(delivered?.status) || 200; webhook.lastError = "";
        } catch (error) {
          webhook.lastDeliveryAt = nowIso(); webhook.lastStatus = Number(error?.status) || 0; webhook.lastError = String(error?.message || "Échec du webhook local").slice(0, 300);
          await saveLocalApiSettings(settings);
          await recordAudit(context.user, "local-webhook-tested", { details: { webhookId: webhook.id, success: false, message: webhook.lastError } });
          return errorResponse(response, 502, "webhook_delivery_failed", webhook.lastError);
        }
        const saved = await saveLocalApiSettings(settings);
        await recordAudit(context.user, "local-webhook-tested", { details: { webhookId: webhook.id, success: true, status: webhook.lastStatus } });
        return jsonResponse(response, 200, publicLocalApiSettings(saved));
      }

      if (request.method === "GET" && url.pathname === "/api/settings/deployment/health") {
        const session = requireSession(request, response);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        return jsonResponse(response, 200, await deploymentHealth(request));
      }

      if (request.method === "POST" && url.pathname === "/api/settings/deployment/probe") {
        const session = requireSession(request, response, true);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        const document = await readWorkspace();
        const deployment = normalizedDeploymentSettings(document?.data?.settings || {});
        if (!deployment.primaryDomain) return errorResponse(response, 400, "primary_domain_required", "Enregistrez d’abord un domaine public.");
        const probe = typeof options.probePublicSite === "function" ? options.probePublicSite : probePublicAtlasDomain;
        const result = await probe(deployment.primaryDomain);
        await recordAudit(context.user, "deployment-public-probe", { details: { domain: deployment.primaryDomain, success: true } });
        return jsonResponse(response, 200, result);
      }

      if (request.method === "POST" && url.pathname === "/api/settings/deployment/port-check") {
        const session = requireSession(request, response, true);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        const result = await probeLocalAtlasPort();
        await recordAudit(context.user, "deployment-local-port-probe", { details: { host: result.host, port: result.port, open: result.open } });
        return jsonResponse(response, 200, result);
      }

      if (request.method === "PUT" && url.pathname === "/api/settings/autostart") {
        const session = requireSession(request, response, true);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        const body = await readBody(request);
        if (typeof body.enabled !== "boolean") return errorResponse(response, 400, "invalid_autostart_setting", "Choisissez si le démarrage automatique doit être activé ou désactivé.");
        if (!(await requirePrivilegedMfa(context.user, body, response))) return;
        await ensureDeploymentOrigins();
        const result = await manageAutostart({ mode: body.enabled ? "enable" : "disable", host, port, dataRoot, allowedOrigins: [...new Set([...allowedOrigins, ...savedDeploymentOrigins])], trustedProxies: [...new Set([...trustedProxies, ...savedTrustedProxies])] });
        if (result.supported === false) return errorResponse(response, 409, "autostart_not_supported", result.message || "Cette plateforme ne prend pas en charge la tâche Windows Atlas.");
        await recordAudit(context.user, "autostart-settings-updated", { details: { enabled: result.enabled === true, trigger: result.trigger || "none", taskName: result.taskName || "TRC Community Atlas" } });
        return jsonResponse(response, 200, result);
      }

      if (request.method === "PUT" && url.pathname === "/api/settings/deployment") {
        const session = requireSession(request, response, true);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        const body = await readBody(request);
        if (!(await requirePrivilegedMfa(context.user, body, response))) return;
        const nextDeployment = deploymentSettingsFromInput(body);
        let nextDocument;
        await enqueueWrite(async () => {
          const store = await getStore();
          const current = store.readDocument();
          if (!current || current.revision !== body.revision) throw Object.assign(new Error("Les données ont changé depuis leur ouverture."), { statusCode: 409, code: "revision_conflict" });
          const nextData = structuredClone(current.data);
          nextData.settings = { ...(nextData.settings || {}), deployment: nextDeployment };
          nextDocument = store.commitDocument(current.revision, nextData, context.user.displayName, "deployment-settings-updated");
          await mirrorStore(store, nextDocument);
        });
        refreshSavedDeploymentOrigins(nextDocument.data.settings);
        await recordAudit(context.user, "deployment-settings-updated", { details: { instanceCode: nextDeployment.instanceCode, primaryDomain: nextDeployment.primaryDomain, domainAliases: nextDeployment.domainAliases, accessMode: nextDeployment.accessMode, reverseProxy: nextDeployment.reverseProxy } });
        return jsonResponse(response, 200, filterWorkspaceForUser(nextDocument, context.user));
      }

      if (request.method === "PUT" && url.pathname === "/api/workspace") {
        const session = requireSession(request, response, true);
        if (!session) return;
        const context = await requireWriter(session, response);
        if (!context) return;
        const body = await readBody(request);
        if (!Number.isInteger(body.revision) || !validateWorkspace(body.data, { allowExternalParents: context.user.role !== "administrator" })) {
          return errorResponse(response, 400, "invalid_workspace", "Le format des données est invalide.");
        }
        let nextDocument;
        await enqueueWrite(async () => {
          const store = await getStore();
          const current = store.readDocument();
          if (!current || current.revision !== body.revision) throw Object.assign(new Error("Les données ont changé depuis leur ouverture."), { statusCode: 409, code: "revision_conflict" });
          if (JSON.stringify(normalizedSecuritySettings(current.data.settings)) !== JSON.stringify(normalizedSecuritySettings(body.data.settings))) {
            throw Object.assign(new Error("Modifiez les politiques de sécurité depuis la section Sécurité des paramètres."), { statusCode: 403 });
          }
          if (JSON.stringify(normalizedDeploymentSettings(current.data.settings)) !== JSON.stringify(normalizedDeploymentSettings(body.data.settings))) {
            throw Object.assign(new Error("Modifiez le domaine et le proxy depuis la section Configuration initiale des paramètres."), { statusCode: 403 });
          }
          if (context.user.role !== "administrator" && JSON.stringify(current.data.customModuleDefinitions || []) !== JSON.stringify(body.data.customModuleDefinitions || [])) {
            throw Object.assign(new Error("Seul un administrateur peut modifier les définitions de modules personnalisés."), { statusCode: 403 });
          }
          const nextData = mergeRestrictedWorkspace(current.data, body.data, context.user);
          if (!validateWorkspace(nextData)) throw Object.assign(new Error("La hiérarchie des organisations est invalide ou dépasse trois niveaux."), { statusCode: 400, code: "invalid_organization_hierarchy" });
          nextDocument = store.commitDocument(body.revision, nextData, context.user.displayName);
          await mirrorStore(store, nextDocument);
        });
        void dispatchLocalWebhooks("workspace.updated", { revision: nextDocument.revision, actor: context.user.displayName }).catch(() => {});
        return jsonResponse(response, 200, filterWorkspaceForUser(nextDocument, context.user));
      }

      const assetHistoryMatch = url.pathname.match(/^\/api\/assets\/([^/]+)\/history$/);
      if (request.method === "GET" && assetHistoryMatch) {
        const session = requireSession(request, response);
        if (!session) return;
        const userContext = await requireUser(session, response);
        if (!userContext) return;
        const assetRef = decodeURIComponent(assetHistoryMatch[1]);
        const asset = isSafeAssetRef(assetRef) ? await assetContext(assetRef) : null;
        if (!asset) return errorResponse(response, 404, "asset_not_found", "Fiche introuvable.");
        if (!requireOrganizationAccess(userContext.user, asset.organizationId, response)) return;
        if (asset.vault && !requireVaultAccess(userContext.user, response, asset.organizationId)) return;
        return jsonResponse(response, 200, { entries: (await getStore()).assetHistory(assetRef, 100) });
      }

      if (request.method === "GET" && url.pathname === "/api/audit") {
        const session = requireSession(request, response);
        if (!session) return;
        const context = await requireAdmin(session, response);
        if (!context) return;
        const organizationId = cleanText(url.searchParams.get("organizationId") || "", 64) || "";
        const assetRef = cleanText(url.searchParams.get("assetRef") || "", 96) || "";
        const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 200, 1), 1000);
        return jsonResponse(response, 200, { entries: (await getStore()).auditEvents({ organizationId, assetRef, limit }) });
      }

      if (request.method === "GET" && staticFiles.has(url.pathname)) {
        const [relativePath, contentType] = staticFiles.get(url.pathname);
        const filePath = path.join(publicRoot, relativePath);
        await stat(filePath);
        response.writeHead(200, { "content-type": contentType, "cache-control": "no-cache" });
        response.end(await readFile(filePath));
        return;
      }

      errorResponse(response, 404, "not_found", "Ressource introuvable.");
    } catch (error) {
      const status = error?.statusCode || (error?.code === "ENOENT" ? 404 : 500);
      const code = ["revision_conflict", "invalid_mfa", "vault_locked"].includes(error?.code) ? error.code : status === 500 ? "internal_error" : "request_error";
      if (status === 500) console.error("[atlas]", error);
      errorResponse(response, status, code, status === 500 ? "Une erreur locale est survenue." : error.message);
    }
  });
  server.maxRequestsPerSocket = 100;

  server.on("close", () => {
    sessions.clear();
    if (backupTimer) clearInterval(backupTimer);
    if (storePromise) void storePromise.then((store) => store.close()).catch(() => {});
  });
  server.on("listening", () => {
    void ensureVaultSecurityMetadata().catch(() => {
      console.error("[atlas] La migration locale des notes de sécurité du coffre n’a pas pu être exécutée.");
    });
    backupTimer = setInterval(() => {
      void runScheduledBackupIfDue().catch((error) => console.error("[atlas] La sauvegarde planifiée a échoué :", error.message));
    }, 60_000);
    backupTimer.unref?.();
    void runScheduledBackupIfDue().catch((error) => console.error("[atlas] La vérification du planificateur de sauvegarde a échoué :", error.message));
  });
  return server;
}

if (path.resolve(process.argv[1] || "") === modulePath) {
  const options = parseArgs(process.argv.slice(2));
  const server = createAtlasServer(options);
  server.listen(options.port, options.host, () => {
    console.log(`TRC Community Atlas est prêt : http://${options.host}:${options.port}`);
    console.log(`Données locales : ${options.dataRoot}`);
  });
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    server.close(() => process.exit(0));
    server.closeAllConnections?.();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

