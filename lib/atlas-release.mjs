import https from "node:https";
import { createHash, createPublicKey, verify as verifySignature } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat, statfs, writeFile } from "node:fs/promises";
import path from "node:path";

export const ATLAS_RELEASE_REPOSITORY = "MaxSim2001/TRC-Community-Atlas";
export const ATLAS_RELEASE_MANIFEST = "atlas-release-manifest.json";
export const ATLAS_RELEASE_SIGNATURE = "atlas-release-manifest.sig";
const MAX_RELEASE_METADATA_BYTES = 1024 * 1024;
const MAX_RELEASE_PACKAGE_BYTES = 512 * 1024 * 1024;
const GITHUB_ASSET_HOSTS = new Set([
  "github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
  "github-releases.githubusercontent.com",
]);

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

function releaseError(message, code = "release_verification_failed", statusCode = 400) {
  return Object.assign(new Error(message), { code, statusCode });
}

function validateGithubAssetUrl(value) {
  let url;
  try { url = new URL(String(value || "")); }
  catch { throw releaseError("L’URL de téléchargement GitHub est invalide."); }
  if (url.protocol !== "https:" || url.username || url.password || !GITHUB_ASSET_HOSTS.has(url.hostname.toLowerCase())) {
    throw releaseError("Atlas refuse un téléchargement qui ne provient pas d’un hôte GitHub approuvé.");
  }
  return url;
}

async function downloadGithubAsset(urlValue, destination, maximumBytes, redirects = 0) {
  const url = validateGithubAssetUrl(urlValue);
  if (redirects > 4) throw releaseError("GitHub a retourné trop de redirections.", "release_download_failed", 502);
  await mkdir(path.dirname(destination), { recursive: true });
  return new Promise((resolve, reject) => {
    let settled = false;
    let bytes = 0;
    const fail = async (error) => {
      if (settled) return;
      settled = true;
      await rm(destination, { force: true }).catch(() => {});
      reject(error instanceof Error ? error : new Error(String(error)));
    };
    const request = https.get(url, {
      headers: { accept: "application/octet-stream", "user-agent": "TRC-Community-Atlas-Updater" },
      rejectUnauthorized: true,
      timeout: 20_000,
    }, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        response.resume();
        settled = true;
        downloadGithubAsset(new URL(response.headers.location, url).href, destination, maximumBytes, redirects + 1).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        void fail(releaseError(`GitHub a refusé le téléchargement avec le statut ${response.statusCode}.`, "release_download_failed", 502));
        return;
      }
      const advertised = Number(response.headers["content-length"] || 0);
      if (advertised > maximumBytes) {
        response.resume();
        void fail(releaseError("Le fichier de mise à jour dépasse la taille autorisée."));
        return;
      }
      const output = createWriteStream(destination, { flags: "wx" });
      response.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > maximumBytes) request.destroy(releaseError("Le fichier de mise à jour dépasse la taille autorisée."));
      });
      response.pipe(output);
      output.on("finish", () => {
        output.close(() => {
          if (settled) return;
          settled = true;
          resolve({ bytes });
        });
      });
      output.on("error", fail);
    });
    request.on("timeout", () => request.destroy(releaseError("Le téléchargement GitHub a dépassé le délai autorisé.", "release_download_failed", 502)));
    request.on("error", fail);
  });
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

export function publicKeyIdentityCandidates(publicKey) {
  const publicKeyBuffer = Buffer.isBuffer(publicKey) ? publicKey : Buffer.from(String(publicKey), "utf8");
  const publicKeyText = publicKeyBuffer.toString("utf8");
  const lfPem = publicKeyText.replace(/\r\n?/g, "\n");
  const crlfPem = lfPem.replace(/\n/g, "\r\n");
  const canonicalDer = createPublicKey(publicKeyBuffer).export({ type: "spki", format: "der" });
  return new Set([
    createHash("sha256").update(publicKeyBuffer).digest("hex"),
    createHash("sha256").update(lfPem, "utf8").digest("hex"),
    createHash("sha256").update(crlfPem, "utf8").digest("hex"),
    createHash("sha256").update(canonicalDer).digest("hex"),
  ]);
}

function validateManifestPolicy(manifest, { currentVersion, expectedRepository, expectedTag, publicKeyIds }) {
  if (manifest.formatVersion !== 1 || manifest.product !== "TRC Community Atlas") throw releaseError("Le format du manifeste Atlas est incompatible.");
  if (manifest.repository !== expectedRepository) throw releaseError("Le manifeste ne provient pas du dépôt Atlas approuvé.");
  if (!parseStableVersion(manifest.version) || (expectedTag && `v${manifest.version}` !== String(expectedTag))) throw releaseError("La version du manifeste ne correspond pas à la Release GitHub.");
  if (!parseStableVersion(manifest.minimumUpgradableVersion)) throw releaseError("La version minimale du manifeste est invalide.");
  if (compareStableVersions(manifest.version, currentVersion) !== 1) throw releaseError("La version préparée n’est pas plus récente que la version installée.", "release_not_newer", 409);
  if (compareStableVersions(currentVersion, manifest.minimumUpgradableVersion) === -1) throw releaseError(`Cette mise à jour exige au minimum Atlas ${manifest.minimumUpgradableVersion}.`, "release_upgrade_path_required", 409);
  if (manifest.channel !== "stable" || manifest.platform !== "win32-x64") throw releaseError("Le canal ou la plateforme de la Release est incompatible.");
  if (path.basename(String(manifest.assetName || "")) !== manifest.assetName || !/^TRC-Atlas-Portable-\d+\.\d+\.\d+-win-x64\.zip$/.test(manifest.assetName)) throw releaseError("Le nom du paquet signé est invalide.");
  if (!Number.isSafeInteger(manifest.assetSize) || manifest.assetSize <= 0 || manifest.assetSize > MAX_RELEASE_PACKAGE_BYTES) throw releaseError("La taille déclarée du paquet est invalide.");
  if (!/^[a-f0-9]{64}$/.test(String(manifest.sha256 || ""))) throw releaseError("L’empreinte du paquet est absente ou invalide.");
  if (!/^[a-f0-9]{64}$/.test(String(manifest.publicKeyId || "")) || !publicKeyIds.has(manifest.publicKeyId)) throw releaseError("L’identifiant de la clé de publication ne correspond pas à la clé Atlas approuvée.", "release_key_mismatch");
  if (!Number.isSafeInteger(manifest.minimumDataSchema) || !Number.isSafeInteger(manifest.targetDataSchema) || manifest.minimumDataSchema > 5 || manifest.targetDataSchema < 5 || manifest.targetDataSchema < manifest.minimumDataSchema) throw releaseError("La compatibilité du schéma de données n’est pas prise en charge.", "release_schema_incompatible", 409);
  if (manifest.backupRequired !== true || manifest.rollbackMode !== "snapshot" || manifest.requiresRestart !== true) throw releaseError("La Release ne déclare pas les protections de sauvegarde et de retour arrière requises.");
}

export async function verifyAtlasReleaseFiles({ manifestPath, signaturePath, packagePath, publicKeyPath, currentVersion, expectedRepository = ATLAS_RELEASE_REPOSITORY, expectedTag = "" }) {
  const [manifestBuffer, signatureText, publicKey, packageInfo] = await Promise.all([
    readFile(manifestPath),
    readFile(signaturePath, "utf8"),
    readFile(publicKeyPath, "utf8"),
    stat(packagePath),
  ]);
  if (manifestBuffer.length > MAX_RELEASE_METADATA_BYTES) throw releaseError("Le manifeste de mise à jour est trop volumineux.");
  const signature = Buffer.from(signatureText.trim(), "base64");
  if (signature.length !== 64 || !verifySignature(null, manifestBuffer, publicKey, signature)) {
    throw releaseError("La signature Ed25519 du manifeste est invalide.", "release_signature_invalid");
  }
  let manifest;
  try { manifest = JSON.parse(manifestBuffer.toString("utf8")); }
  catch { throw releaseError("Le manifeste signé n’est pas un document JSON valide."); }
  const publicKeyIds = publicKeyIdentityCandidates(publicKey);
  validateManifestPolicy(manifest, { currentVersion, expectedRepository, expectedTag, publicKeyIds });
  if (packageInfo.size !== manifest.assetSize) throw releaseError("La taille du paquet ne correspond pas au manifeste signé.", "release_size_mismatch");
  const sha256 = await sha256File(packagePath);
  if (sha256 !== manifest.sha256) throw releaseError("L’empreinte SHA-256 du paquet ne correspond pas au manifeste signé.", "release_hash_mismatch");
  return {
    manifest,
    signatureVerified: true,
    packageVerified: true,
    sha256,
    size: packageInfo.size,
  };
}

export async function prepareGithubRelease({ release, currentVersion, publicKeyPath, updateRoot }) {
  if (!release?.updateAvailable || !release?.tag || !Array.isArray(release.assets)) throw releaseError("Aucune mise à jour stable plus récente n’est prête à être téléchargée.", "release_not_available", 409);
  const manifestAsset = release.assets.find((asset) => asset.name === ATLAS_RELEASE_MANIFEST);
  const signatureAsset = release.assets.find((asset) => asset.name === ATLAS_RELEASE_SIGNATURE);
  if (!manifestAsset || !signatureAsset) throw releaseError("La Release ne contient pas le manifeste et sa signature.", "release_assets_missing", 409);
  const safeTag = String(release.tag).replace(/[^a-z0-9_.-]/gi, "");
  if (!safeTag) throw releaseError("Le tag de la Release est invalide.");
  await mkdir(updateRoot, { recursive: true });
  const temporaryRoot = path.join(updateRoot, `.preparing-${safeTag}-${process.pid}-${Date.now()}`);
  const preparedRoot = path.join(updateRoot, `prepared-${safeTag}`);
  await mkdir(temporaryRoot, { recursive: false });
  try {
    const manifestPath = path.join(temporaryRoot, ATLAS_RELEASE_MANIFEST);
    const signaturePath = path.join(temporaryRoot, ATLAS_RELEASE_SIGNATURE);
    await downloadGithubAsset(manifestAsset.url, manifestPath, MAX_RELEASE_METADATA_BYTES);
    await downloadGithubAsset(signatureAsset.url, signaturePath, 32 * 1024);
    const manifestBuffer = await readFile(manifestPath);
    const signature = Buffer.from((await readFile(signaturePath, "utf8")).trim(), "base64");
    const publicKey = await readFile(publicKeyPath, "utf8");
    if (signature.length !== 64 || !verifySignature(null, manifestBuffer, publicKey, signature)) throw releaseError("La signature Ed25519 du manifeste est invalide.", "release_signature_invalid");
    let manifest;
    try { manifest = JSON.parse(manifestBuffer.toString("utf8")); }
    catch { throw releaseError("Le manifeste signé n’est pas un document JSON valide."); }
    const publicKeyIds = publicKeyIdentityCandidates(publicKey);
    validateManifestPolicy(manifest, { currentVersion, expectedRepository: ATLAS_RELEASE_REPOSITORY, expectedTag: release.tag, publicKeyIds });
    const packageAsset = release.assets.find((asset) => asset.name === manifest.assetName);
    if (!packageAsset) throw releaseError("Le paquet déclaré dans le manifeste signé est absent de la Release.", "release_assets_missing", 409);
    if (packageAsset.size && packageAsset.size !== manifest.assetSize) throw releaseError("La taille publiée par GitHub ne correspond pas au manifeste signé.", "release_size_mismatch");
    const packagePath = path.join(temporaryRoot, manifest.assetName);
    const filesystem = await statfs(updateRoot);
    const freeBytes = Number(filesystem.bavail) * Number(filesystem.bsize);
    const requiredBytes = Math.max(Number(manifest.assetSize || 0) * 4, 512 * 1024 * 1024);
    if (!Number.isFinite(freeBytes) || freeBytes < requiredBytes) throw releaseError("L’espace disque libre est insuffisant pour télécharger, sauvegarder et appliquer cette mise à jour.", "release_disk_space_low", 409);
    await downloadGithubAsset(packageAsset.url, packagePath, MAX_RELEASE_PACKAGE_BYTES);
    const verified = await verifyAtlasReleaseFiles({ manifestPath, signaturePath, packagePath, publicKeyPath, currentVersion, expectedTag: release.tag });
    const prepared = {
      schemaVersion: 1,
      repository: ATLAS_RELEASE_REPOSITORY,
      currentVersion,
      targetVersion: verified.manifest.version,
      tag: release.tag,
      preparedAt: new Date().toISOString(),
      preparedRoot,
      manifestPath: path.join(preparedRoot, ATLAS_RELEASE_MANIFEST),
      signaturePath: path.join(preparedRoot, ATLAS_RELEASE_SIGNATURE),
      packagePath: path.join(preparedRoot, verified.manifest.assetName),
      manifest: verified.manifest,
      signatureVerified: true,
      packageVerified: true,
      rollbackReady: true,
      installable: true,
    };
    await writeFile(path.join(temporaryRoot, "prepared.json"), `${JSON.stringify(prepared, null, 2)}\n`, "utf8");
    await rm(preparedRoot, { recursive: true, force: true });
    await rename(temporaryRoot, preparedRoot);
    return prepared;
  } catch (error) {
    await rm(temporaryRoot, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}
