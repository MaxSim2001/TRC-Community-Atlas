import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : "";
}

async function readPassphrase() {
  process.stdin.setEncoding("utf8");
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  const value = input.trim();
  if (value.length < 32) throw new Error("La phrase secrète de signature est insuffisante.");
  return value;
}

async function writeNew(filePath, value, encoding) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, value, { encoding, flag: "wx" });
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

const command = process.argv[2];
if (command === "generate-key") {
  const privatePath = path.resolve(argument("private"));
  const publicPath = path.resolve(argument("public"));
  const passphrase = await readPassphrase();
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const encryptedPrivate = privateKey.export({ type: "pkcs8", format: "pem", cipher: "aes-256-cbc", passphrase });
  const publicPem = publicKey.export({ type: "spki", format: "pem" });
  await writeNew(privatePath, encryptedPrivate, "utf8");
  await writeNew(publicPath, publicPem, "utf8");
  const fingerprint = createHash("sha256").update(publicPem).digest("hex");
  process.stdout.write(JSON.stringify({ publicPath, fingerprint }));
} else if (command === "sign") {
  const privatePath = path.resolve(argument("private"));
  const manifestPath = path.resolve(argument("manifest"));
  const signaturePath = path.resolve(argument("signature"));
  const passphrase = await readPassphrase();
  const [privatePem, manifest] = await Promise.all([readFile(privatePath, "utf8"), readFile(manifestPath)]);
  const signature = sign(null, manifest, { key: privatePem, passphrase });
  if (signature.length !== 64) throw new Error("La signature Ed25519 produite est invalide.");
  await writeNew(signaturePath, `${signature.toString("base64")}\n`, "utf8");
  process.stdout.write(JSON.stringify({ signaturePath, bytes: signature.length, manifestBytes: manifest.length }));
} else if (command === "manifest") {
  const packagePath = path.resolve(argument("package"));
  const outputPath = path.resolve(argument("output"));
  const version = argument("version");
  const publicKeyPath = path.resolve(argument("public"));
  const packageInfo = await stat(packagePath);
  const [packageSha256, publicPem] = await Promise.all([sha256File(packagePath), readFile(publicKeyPath, "utf8")]);
  const manifest = {
    formatVersion: 1,
    product: "TRC Community Atlas",
    repository: "MaxSim2001/TRC-Community-Atlas",
    version,
    channel: "stable",
    publishedAt: new Date().toISOString(),
    minimumUpgradableVersion: "0.14.3",
    minimumDataSchema: 5,
    targetDataSchema: 5,
    platform: "win32-x64",
    assetName: path.basename(packagePath),
    assetSize: packageInfo.size,
    sha256: packageSha256,
    publicKeyId: createHash("sha256").update(publicPem).digest("hex"),
    requiresRestart: true,
    backupRequired: true,
    rollbackMode: "snapshot",
    releaseNotesUrl: `https://github.com/MaxSim2001/TRC-Community-Atlas/releases/tag/v${version}`,
  };
  await writeNew(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  process.stdout.write(JSON.stringify({ outputPath, manifest }));
} else {
  throw new Error("Commande attendue : generate-key, manifest ou sign.");
}
