import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createAtlasServer, validateOrganizationHierarchy } from "../server.mjs";

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

test("la hiérarchie accepte trois niveaux et refuse les références invalides", () => {
  const valid = [
    { id: "org-parent", name: "Compagnie A" },
    { id: "org-child", name: "Compagnie D", parentOrganizationId: "org-parent" },
    { id: "org-grandchild", name: "Division D1", parentOrganizationId: "org-child" },
  ];
  assert.equal(validateOrganizationHierarchy(valid), true);
  assert.equal(validateOrganizationHierarchy([...valid, { id: "org-level-four", parentOrganizationId: "org-grandchild" }]), false);
  assert.equal(validateOrganizationHierarchy([{ id: "org-a", parentOrganizationId: "org-b" }, { id: "org-b", parentOrganizationId: "org-a" }]), false);
  assert.equal(validateOrganizationHierarchy([{ id: "org-child", parentOrganizationId: "org-hidden" }]), false);
  assert.equal(validateOrganizationHierarchy([{ id: "org-child", parentOrganizationId: "org-hidden" }], { allowExternalParents: true }), true);
});

test("l'API conserve les données des sous-compagnies et les détache lors de la suppression du parent", async (context) => {
  const dataRoot = await mkdtemp(path.join(tmpdir(), "trc-atlas-hierarchy-"));
  const server = createAtlasServer({ host: "127.0.0.1", port: 9092, dataRoot });
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

  let result = await request("/api/setup", { method: "POST", body: { displayName: "Admin Hiérarchie", username: "admin-hierarchy", password: "hierarchy-test-password-2026" } });
  assert.equal(result.response.status, 201);
  result = await request("/api/login", { method: "POST", body: { username: "admin-hierarchy", password: "hierarchy-test-password-2026" } });
  const secret = result.payload.secret;
  result = await request("/api/mfa/confirm", { method: "POST", body: { pendingToken: result.payload.pendingToken, code: totp(secret) } });
  assert.equal(result.response.status, 200);
  const csrf = result.payload.csrf;

  result = await request("/api/workspace");
  const data = structuredClone(result.payload.data);
  data.organizations.push(
    { id: "org-parent-test", name: "Compagnie A", code: "A", status: "active" },
    { id: "org-child-test", name: "Compagnie D", code: "D", status: "active", parentOrganizationId: "org-parent-test" },
    { id: "org-grandchild-test", name: "Division D1", code: "D1", status: "active", parentOrganizationId: "org-child-test" },
  );
  data.configurations.push(
    { id: "cfg-parent-test", organizationId: "org-parent-test", name: "A-SRV", type: "Serveur", status: "documented" },
    { id: "cfg-child-test", organizationId: "org-child-test", name: "D-SRV", type: "Serveur", status: "documented" },
  );
  result = await request("/api/workspace", { method: "PUT", csrf, body: { revision: result.payload.revision, data } });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.data.configurations.filter((item) => item.organizationId === "org-parent-test").length, 1);
  assert.equal(result.payload.data.configurations.filter((item) => item.organizationId === "org-child-test").length, 1);
  const revision = result.payload.revision;

  const fourthLevel = structuredClone(result.payload.data);
  fourthLevel.organizations.push({ id: "org-level-four-test", name: "Niveau 4", code: "L4", parentOrganizationId: "org-grandchild-test" });
  result = await request("/api/workspace", { method: "PUT", csrf, body: { revision, data: fourthLevel } });
  assert.equal(result.response.status, 400);

  const cycle = structuredClone(data);
  cycle.organizations.find((organization) => organization.id === "org-parent-test").parentOrganizationId = "org-grandchild-test";
  result = await request("/api/workspace", { method: "PUT", csrf, body: { revision, data: cycle } });
  assert.equal(result.response.status, 400);

  result = await request("/api/organizations/org-parent-test", { method: "DELETE", csrf, body: { confirmation: "Compagnie A", code: totp(secret) } });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.detachedChildOrganizations, 1);
  assert.equal(result.payload.workspace.data.organizations.find((organization) => organization.id === "org-child-test").parentOrganizationId, "");
  assert.equal(result.payload.workspace.data.organizations.find((organization) => organization.id === "org-grandchild-test").parentOrganizationId, "org-child-test");
  assert.equal(result.payload.workspace.data.configurations.some((item) => item.id === "cfg-parent-test"), false);
  assert.equal(result.payload.workspace.data.configurations.some((item) => item.id === "cfg-child-test"), true);
});
