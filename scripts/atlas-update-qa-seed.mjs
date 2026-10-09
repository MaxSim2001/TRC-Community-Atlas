import { createHmac } from "node:crypto";

const target = new URL(process.argv[2] || "");
if (target.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname)) {
  throw new Error("La préparation QA est limitée à une instance HTTP sur la boucle locale.");
}

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function decodeBase32(value) {
  let bits = 0;
  let accumulator = 0;
  const bytes = [];
  for (const character of value.toUpperCase().replace(/[^A-Z2-7]/g, "")) {
    accumulator = (accumulator << 5) | alphabet.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      bytes.push((accumulator >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function totp(secret) {
  const counter = Math.floor(Date.now() / 30_000);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret)).update(message).digest();
  const offset = digest.at(-1) & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

let cookie = "";
async function request(route, { method = "GET", body, csrf = "" } = {}) {
  const response = await fetch(new URL(route, target), {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...(csrf ? { "x-atlas-csrf": csrf } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";", 1)[0];
  const payload = await response.json();
  if (!response.ok) throw new Error(`${method} ${route}: ${payload.message || response.status}`);
  return payload;
}

await request("/api/setup", { method: "POST", body: { displayName: "Administrateur QA Update", username: "update-qa-admin", password: "Synthetic-Update-QA-Password-2026!" } });
const login = await request("/api/login", { method: "POST", body: { username: "update-qa-admin", password: "Synthetic-Update-QA-Password-2026!" } });
const session = await request("/api/mfa/confirm", { method: "POST", body: { pendingToken: login.pendingToken, code: totp(login.secret) } });
const workspace = await request("/api/workspace");
const organizationId = workspace.data.organizations[0]?.id;
if (!organizationId) throw new Error("Aucune organisation QA n’est disponible.");
await request("/api/vault", {
  method: "POST",
  csrf: session.csrf,
  body: {
    organizationId,
    title: "Secret de validation du retour arrière",
    category: "QA",
    username: "qa-update-user",
    password: "Synthetic-Vault-Update-Secret-2026!",
    url: "https://qa.invalid",
    notes: "Donnée factice servant uniquement à valider le coffre après mise à jour.",
    otpSecret: "JBSWY3DPEHPK3PXP",
  },
});

process.stdout.write(JSON.stringify({ initialized: true, organizationId, users: 1, vaultItems: 1 }));
