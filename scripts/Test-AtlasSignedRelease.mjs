import { verifyAtlasReleaseFiles } from "../lib/atlas-release.mjs";

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : "";
}

const verified = await verifyAtlasReleaseFiles({
  manifestPath: argument("manifest"),
  signaturePath: argument("signature"),
  packagePath: argument("package"),
  publicKeyPath: argument("public"),
  currentVersion: argument("current"),
  expectedTag: argument("tag"),
});
process.stdout.write(JSON.stringify({
  valid: true,
  version: verified.manifest.version,
  sha256: verified.sha256,
  size: verified.size,
  signatureVerified: verified.signatureVerified,
  packageVerified: verified.packageVerified,
}));
