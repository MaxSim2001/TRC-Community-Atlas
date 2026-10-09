import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createAtlasServer } from "../server.mjs";

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
  const counter = Math.floor(Date.now() / 30000);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret)).update(message).digest();
  const offset = digest.at(-1) & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, "0");
}

test("public metadata, body limits, proxy spoofing, soft 404 and MFA throttling are hardened", async (context) => {
  const dataRoot = await mkdtemp(path.join(tmpdir(), "trc-atlas-security-"));
  let server = createAtlasServer({ host: "127.0.0.1", port: 9092, dataRoot });
  const listen = async () => {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    return `http://127.0.0.1:${server.address().port}`;
  };
  let base = await listen();
  context.after(async () => {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    await rm(dataRoot, { recursive: true, force: true });
  });

  async function request(route, { method = "GET", body, headers = {} } = {}) {
    const response = await fetch(`${base}${route}`, {
      method,
      headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { response, payload: await response.json() };
  }

  let result = await request("/api/status");
  assert.deepEqual(result.payload, { ok: true });
  result = await request("/api/bootstrap");
  assert.deepEqual(result.payload, { setupRequired: true });
  result = await request("/.env");
  assert.equal(result.response.status, 404);
  result = await request("/.git/config");
  assert.equal(result.response.status, 404);
  result = await request("/server.mjs");
  assert.equal(result.response.status, 404);
  result = await request("/assets/app.js.map");
  assert.equal(result.response.status, 404);

  result = await request("/api/login", { method: "POST", body: { username: "admin", password: "x".repeat(9 * 1024) } });
  assert.equal(result.response.status, 413);

  result = await request("/api/setup", { method: "POST", body: { displayName: "Admin sécurité", username: "admin", password: "correct-horse-battery" } });
  assert.equal(result.response.status, 201);
  result = await request("/api/login", { method: "POST", body: { username: "admin", password: "correct-horse-battery" } });
  const pendingToken = result.payload.pendingToken;
  const secret = result.payload.secret;
  result = await request("/api/mfa/confirm", { method: "POST", headers: { "x-forwarded-proto": "https", "x-real-ip": "203.0.113.77" }, body: { pendingToken, code: totp(secret) } });
  assert.equal(result.response.status, 200);
  assert.doesNotMatch(result.response.headers.get("set-cookie") || "", /; Secure/i);

  result = await request("/api/login", { method: "POST", body: { username: "admin", password: "correct-horse-battery" } });
  const verificationToken = result.payload.pendingToken;
  const wrongCode = totp(secret) === "000000" ? "111111" : "000000";
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    result = await request("/api/mfa/verify", { method: "POST", body: { pendingToken: verificationToken, code: wrongCode } });
    assert.equal(result.response.status, 401, `code erroné ${attempt}`);
  }
  result = await request("/api/mfa/verify", { method: "POST", body: { pendingToken: verificationToken, code: wrongCode } });
  assert.equal(result.response.status, 429);

  for (let attempt = 1; attempt <= 7; attempt += 1) {
    result = await request("/api/mfa/verify", { method: "POST", body: { pendingToken: "x".repeat(43), code: "000000" } });
    assert.equal(result.response.status, 401, `tentative ${attempt}`);
  }
  result = await request("/api/mfa/verify", { method: "POST", body: { pendingToken: "x".repeat(43), code: "000000" } });
  assert.equal(result.response.status, 429);
  assert.ok(Number(result.response.headers.get("retry-after")) > 0);

  await new Promise((resolve) => server.close(resolve));
  server = createAtlasServer({ host: "127.0.0.1", port: 9092, dataRoot });
  base = await listen();
  result = await request("/api/mfa/verify", { method: "POST", body: { pendingToken: "x".repeat(43), code: "000000" } });
  assert.equal(result.response.status, 429);
});
