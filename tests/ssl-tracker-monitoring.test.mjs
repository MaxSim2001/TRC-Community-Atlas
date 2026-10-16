import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  createAtlasServer,
  normalizeTlsHostname,
  parseTlsHostnames,
  probeTlsCertificateHost,
  summarizeCertificateChecks,
} from "../server.mjs";

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
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac("sha1", decodeBase32(secret)).update(message).digest();
  const offset = digest.at(-1) & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, "0");
}

test("les domaines TLS sont normalisés, dédupliqués et limités à des noms publics", async () => {
  assert.equal(normalizeTlsHostname(" PORTAIL.Example.COM. "), "portail.example.com");
  assert.equal(normalizeTlsHostname("https://example.com"), "");
  assert.equal(normalizeTlsHostname("*.example.com"), "");
  assert.equal(normalizeTlsHostname("192.168.50.12"), "");
  assert.deepEqual(parseTlsHostnames("a.example.com\nB.example.com, a.example.com"), ["a.example.com", "b.example.com"]);
  assert.throws(() => parseTlsHostnames("localhost"), /invalide/);
  await assert.rejects(
    probeTlsCertificateHost("private.example.com", { lookupFn: async () => [{ address: "192.168.50.14", family: 4 }] }),
    (error) => error.code === "unsafe_probe_destination",
  );
});

test("le résumé conserve des échéances indépendantes par domaine", () => {
  const now = Date.parse("2026-10-16T12:00:00.000Z");
  const summary = summarizeCertificateChecks([
    { host: "a.example.com", status: "valid", validTo: "2027-01-15T00:00:00.000Z", lastSuccessfulAt: "2026-10-16T12:00:00.000Z", checkedAt: "2026-10-16T12:00:00.000Z" },
    { host: "b.example.com", status: "expiring", validTo: "2026-10-30T00:00:00.000Z", lastSuccessfulAt: "2026-10-16T12:00:00.000Z", checkedAt: "2026-10-16T12:00:00.000Z" },
  ], now);
  assert.equal(summary.status, "expiring");
  assert.equal(summary.counts.total, 2);
  assert.equal(summary.counts.valid, 1);
  assert.equal(summary.counts.expiring, 1);
  assert.equal(summary.earliestValidTo, "2026-10-30T00:00:00.000Z");
});

test("l'interface présente une ligne distincte par domaine et un contrôle manuel", async () => {
  const [app, styles, help] = await Promise.all([
    readFile(new URL("../public/assets/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/assets/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../public/assets/help-content.js", import.meta.url), "utf8"),
  ]);
  assert.match(app, /function certificateChecksMarkup/);
  assert.match(app, /certificate-domain-row/);
  assert.match(app, /data-action="check-ssl-record"/);
  assert.match(app, /Chaque domaine conserve sa propre échéance/);
  assert.match(styles, /grid-template-columns: minmax\(220px/);
  assert.match(help, /Échéances indépendantes/);
});

test("l'API vérifie chaque domaine et persiste sa propre date d'expiration", async (context) => {
  const dataRoot = await mkdtemp(path.join(tmpdir(), "trc-atlas-ssl-monitor-"));
  const certificateProbe = async (host) => ({
    host,
    status: host.startsWith("soon") ? "expiring" : "valid",
    checkedAt: "2026-10-16T12:00:00.000Z",
    lastSuccessfulAt: "2026-10-16T12:00:00.000Z",
    address: host.startsWith("soon") ? "203.0.113.20" : "203.0.113.21",
    subject: host,
    issuer: host.startsWith("soon") ? "CA Alpha" : "CA Beta",
    serialNumber: host.startsWith("soon") ? "AA01" : "BB02",
    validFrom: "2026-09-01T00:00:00.000Z",
    validTo: host.startsWith("soon") ? "2026-10-30T00:00:00.000Z" : "2027-02-20T00:00:00.000Z",
    daysRemaining: host.startsWith("soon") ? 14 : 127,
    subjectAltNames: [host],
    hostnameValid: true,
    trusted: true,
    authorizationError: "",
  });
  const server = createAtlasServer({ host: "127.0.0.1", port: 9092, dataRoot, certificateProbe });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = "";
  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(dataRoot, { recursive: true, force: true });
  });
  async function request(route, { method = "GET", body, csrf } = {}) {
    const response = await fetch(`${base}${route}`, {
      method,
      headers: { ...(body ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}), ...(csrf ? { "x-atlas-csrf": csrf } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";", 1)[0];
    return { response, payload: await response.json() };
  }

  let result = await request("/api/setup", { method: "POST", body: { displayName: "Admin SSL", username: "admin-ssl", password: "ssl-monitor-test-password-2026" } });
  assert.equal(result.response.status, 201);
  result = await request("/api/login", { method: "POST", body: { username: "admin-ssl", password: "ssl-monitor-test-password-2026" } });
  result = await request("/api/mfa/confirm", { method: "POST", body: { pendingToken: result.payload.pendingToken, code: totp(result.payload.secret) } });
  const csrf = result.payload.csrf;
  result = await request("/api/workspace");
  const record = {
    id: "ssl-multi-domain", moduleId: "ssl-tracker", schemaVersion: 1, organizationId: "org-atlas-demo", siteId: "",
    title: "TRC Suite", owner: "Équipe TI", status: "active", expiresOn: "", reference: "", tags: ["tls"], summary: "Certificats publics", notes: "", updatedAt: "2026-10-16",
    details: { hosts: "soon.example.com\nlong.example.com", autoCheck: "Activée", autoRenew: "Oui" }, checklist: [],
  };
  result.payload.data.moduleRecords = [...(result.payload.data.moduleRecords || []), record];
  result = await request("/api/workspace", { method: "PUT", csrf, body: { revision: result.payload.revision, data: result.payload.data } });
  assert.equal(result.response.status, 200);

  result = await request("/api/ssl-tracker/ssl-multi-domain/check", { method: "POST", csrf, body: {} });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.result.counts.total, 2);
  assert.equal(result.payload.result.counts.expiring, 1);
  assert.equal(result.payload.result.counts.valid, 1);
  const saved = result.payload.document.data.moduleRecords.find((item) => item.id === record.id);
  assert.equal(saved.details.certificateChecks.length, 2);
  assert.notEqual(saved.details.certificateChecks[0].validTo, saved.details.certificateChecks[1].validTo);
  assert.equal(saved.expiresOn, "2026-10-30");
  assert.equal(saved.reference, "2 émetteurs détectés");
  assert.ok(saved.details.certificateChecks.every((check) => check.nextCheckAt));
});
