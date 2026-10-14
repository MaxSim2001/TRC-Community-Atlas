import { DatabaseSync } from "node:sqlite";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const ENTITY_COLLECTIONS = new Map([
  ["organizations", "organization"],
  ["sites", "site"],
  ["configurations", "configuration"],
  ["procedures", "procedure"],
  ["relations", "relation"],
  ["moduleRecords", "module"],
  ["templates", "template"],
]);

const ENTITY_TYPES = new Map([...ENTITY_COLLECTIONS].map(([collection, type]) => [type, collection]));

function searchText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function indexedEntity(entity) {
  const item = entity.value || {};
  const title = String(item.name || item.title || item.label || item.id || "").trim();
  const subtitle = String(item.type || item.category || item.summary || item.address || "").trim().slice(0, 300);
  const updatedAt = String(item.updatedAt || item.lastReviewed || item.createdAt || "");
  const searchable = searchText([
    title,
    subtitle,
    item.code,
    item.owner,
    item.ip,
    item.os,
    item.reference,
    item.tags?.join?.(" "),
    item.notes,
    item.quickNotes,
    item.details ? JSON.stringify(item.details) : "",
  ].filter(Boolean).join(" "));
  return {
    ...entity,
    type: entity.ref.split(":", 1)[0],
    title,
    subtitle,
    status: String(item.status || ""),
    moduleId: String(item.moduleId || ""),
    updatedAt,
    searchText: searchable,
  };
}

async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function normalizedEntities(workspace) {
  const result = new Map();
  for (const [collection, type] of ENTITY_COLLECTIONS) {
    for (const item of Array.isArray(workspace?.[collection]) ? workspace[collection] : []) {
      if (!item?.id) continue;
      const ref = `${type}:${item.id}`;
      result.set(ref, {
        ref,
        collection,
        organizationId: item.organizationId || "",
        value: item,
        encoded: JSON.stringify(item),
      });
    }
  }
  return result;
}

function changeAction(previous, next) {
  if (!previous) return "created";
  if (!next) return "removed";
  const beforeArchived = previous.value?.archived === true || previous.value?.status === "archived";
  const afterArchived = next.value?.archived === true || next.value?.status === "archived";
  if (!beforeArchived && afterArchived) return "archived";
  if (beforeArchived && !afterArchived) return "restored";
  return "updated";
}

export class AtlasStore {
  static async open({ dataRoot, workspacePath, historyPath }) {
    await mkdir(dataRoot, { recursive: true });
    const store = new AtlasStore(path.join(dataRoot, "atlas.sqlite"));
    store.initializeSchema();
    await store.importLegacyIfNeeded(workspacePath, historyPath);
    store.rebuildIndex();
    return store;
  }

  constructor(databasePath) {
    this.databasePath = databasePath;
    this.database = new DatabaseSync(databasePath);
  }

  initializeSchema() {
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = FULL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;

      CREATE TABLE IF NOT EXISTS workspace_state (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        revision INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        data_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workspace_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        revision INTEGER NOT NULL,
        saved_at TEXT NOT NULL,
        saved_by TEXT NOT NULL,
        updated_at TEXT,
        data_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS workspace_history_revision_idx ON workspace_history(revision DESC);

      CREATE TABLE IF NOT EXISTS asset_revisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_ref TEXT NOT NULL,
        collection_name TEXT NOT NULL,
        organization_id TEXT NOT NULL DEFAULT '',
        workspace_revision INTEGER NOT NULL,
        saved_at TEXT NOT NULL,
        saved_by TEXT NOT NULL,
        action TEXT NOT NULL,
        data_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS asset_revisions_ref_idx ON asset_revisions(asset_ref, id DESC);
      CREATE INDEX IF NOT EXISTS asset_revisions_org_idx ON asset_revisions(organization_id, id DESC);

      CREATE TABLE IF NOT EXISTS audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        at TEXT NOT NULL,
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        asset_ref TEXT NOT NULL DEFAULT '',
        organization_id TEXT NOT NULL DEFAULT '',
        workspace_revision INTEGER NOT NULL,
        details_json TEXT NOT NULL DEFAULT '{}'
      );
      CREATE INDEX IF NOT EXISTS audit_events_at_idx ON audit_events(id DESC);
      CREATE INDEX IF NOT EXISTS audit_events_asset_idx ON audit_events(asset_ref, id DESC);
      CREATE INDEX IF NOT EXISTS audit_events_org_idx ON audit_events(organization_id, id DESC);

      CREATE TABLE IF NOT EXISTS asset_index (
        asset_ref TEXT PRIMARY KEY,
        collection_name TEXT NOT NULL,
        asset_type TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        organization_id TEXT NOT NULL DEFAULT '',
        module_id TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL DEFAULT '',
        subtitle TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT '',
        search_text TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS asset_index_org_idx ON asset_index(organization_id, asset_type, title);
      CREATE INDEX IF NOT EXISTS asset_index_module_idx ON asset_index(module_id, organization_id, title);
      CREATE INDEX IF NOT EXISTS asset_index_status_idx ON asset_index(status, organization_id);
    `);
  }

  async importLegacyIfNeeded(workspacePath, historyPath) {
    if (this.database.prepare("SELECT revision FROM workspace_state WHERE singleton = 1").get()) return;
    const document = await readJson(workspacePath, null);
    if (!document?.data || !Number.isInteger(document.revision)) return;
    const history = await readJson(historyPath, { entries: [] });
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.insertState(document);
      const insertHistory = this.database.prepare("INSERT INTO workspace_history (revision, saved_at, saved_by, updated_at, data_json) VALUES (?, ?, ?, ?, ?)");
      for (const entry of Array.isArray(history.entries) ? [...history.entries].reverse() : []) {
        if (!Number.isInteger(entry?.revision) || !entry?.data) continue;
        insertHistory.run(entry.revision, entry.savedAt || nowIso(), entry.savedBy || "Migration JSON", entry.data.updatedAt || null, JSON.stringify(entry.data));
      }
      this.captureChanges({}, document.data, document.revision, "Migration JSON", "migrated");
      this.insertAudit({ actor: "Système", action: "sqlite-migration", workspaceRevision: document.revision, details: { source: "workspace.json" } });
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  insertState(document) {
    this.database.prepare("INSERT INTO workspace_state (singleton, revision, updated_at, data_json) VALUES (1, ?, ?, ?)")
      .run(document.revision, document.data.updatedAt || nowIso(), JSON.stringify(document.data));
  }

  readDocument() {
    const row = this.database.prepare("SELECT revision, data_json FROM workspace_state WHERE singleton = 1").get();
    return row ? { revision: Number(row.revision), data: JSON.parse(row.data_json) } : null;
  }

  initializeDocument(document, actor = "Système") {
    const existing = this.readDocument();
    if (existing) return existing;
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.insertState(document);
      this.captureChanges({}, document.data, document.revision, actor, "created");
      this.rebuildIndex(document.data);
      this.insertAudit({ actor, action: "workspace-created", workspaceRevision: document.revision });
      this.database.exec("COMMIT");
      return document;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  commitDocument(expectedRevision, nextData, actor, auditAction = "workspace-updated") {
    const current = this.readDocument();
    if (!current || current.revision !== expectedRevision) {
      const error = new Error("Les données ont changé depuis leur ouverture.");
      error.code = "revision_conflict";
      error.statusCode = 409;
      throw error;
    }
    const next = { revision: current.revision + 1, data: { ...nextData, updatedAt: nowIso() } };
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database.prepare("INSERT INTO workspace_history (revision, saved_at, saved_by, updated_at, data_json) VALUES (?, ?, ?, ?, ?)")
        .run(current.revision, nowIso(), actor, current.data.updatedAt || null, JSON.stringify(current.data));
      this.captureChanges(current.data, next.data, next.revision, actor);
      this.database.prepare("UPDATE workspace_state SET revision = ?, updated_at = ?, data_json = ? WHERE singleton = 1")
        .run(next.revision, next.data.updatedAt, JSON.stringify(next.data));
      this.rebuildIndex(next.data);
      this.insertAudit({ actor, action: auditAction, workspaceRevision: next.revision });
      this.database.prepare("DELETE FROM workspace_history WHERE id NOT IN (SELECT id FROM workspace_history ORDER BY id DESC LIMIT 200)").run();
      this.database.prepare("DELETE FROM audit_events WHERE id NOT IN (SELECT id FROM audit_events ORDER BY id DESC LIMIT 50000)").run();
      this.database.exec("COMMIT");
      return next;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  historyMetadata(limit = 200) {
    return this.database.prepare("SELECT revision, saved_at, saved_by, updated_at FROM workspace_history ORDER BY id DESC LIMIT ?")
      .all(Math.min(Math.max(Number(limit) || 200, 1), 500))
      .map((row) => ({ revision: Number(row.revision), savedAt: row.saved_at, savedBy: row.saved_by, updatedAt: row.updated_at || null }));
  }

  historyDocuments(limit = 200) {
    return this.database.prepare("SELECT revision, saved_at, saved_by, data_json FROM workspace_history ORDER BY id DESC LIMIT ?")
      .all(Math.min(Math.max(Number(limit) || 200, 1), 500))
      .map((row) => ({ revision: Number(row.revision), savedAt: row.saved_at, savedBy: row.saved_by, data: JSON.parse(row.data_json) }));
  }

  restoreDocument(revision, actor) {
    const row = this.database.prepare("SELECT data_json FROM workspace_history WHERE revision = ? ORDER BY id DESC LIMIT 1").get(revision);
    if (!row) {
      const error = new Error("Révision introuvable ou invalide.");
      error.statusCode = 404;
      throw error;
    }
    const current = this.readDocument();
    return this.commitDocument(current.revision, JSON.parse(row.data_json), actor, `workspace-restored:${revision}`);
  }

  assetHistory(assetRef, limit = 50) {
    return this.database.prepare("SELECT id, workspace_revision, saved_at, saved_by, action, data_json FROM asset_revisions WHERE asset_ref = ? ORDER BY id DESC LIMIT ?")
      .all(assetRef, Math.min(Math.max(Number(limit) || 50, 1), 200))
      .map((row) => ({ id: Number(row.id), workspaceRevision: Number(row.workspace_revision), savedAt: row.saved_at, savedBy: row.saved_by, action: row.action, data: JSON.parse(row.data_json) }));
  }

  auditEvents({ organizationId = "", assetRef = "", limit = 200 } = {}) {
    const clauses = [];
    const values = [];
    if (organizationId) { clauses.push("organization_id = ?"); values.push(organizationId); }
    if (assetRef) { clauses.push("asset_ref = ?"); values.push(assetRef); }
    values.push(Math.min(Math.max(Number(limit) || 200, 1), 1000));
    const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
    return this.database.prepare(`SELECT id, at, actor, action, asset_ref, organization_id, workspace_revision, details_json FROM audit_events${where} ORDER BY id DESC LIMIT ?`)
      .all(...values)
      .map((row) => ({ id: Number(row.id), at: row.at, actor: row.actor, action: row.action, assetRef: row.asset_ref, organizationId: row.organization_id, workspaceRevision: Number(row.workspace_revision), details: JSON.parse(row.details_json) }));
  }

  integrityCheck() {
    const row = this.database.prepare("PRAGMA quick_check").get();
    const value = String(row?.quick_check || Object.values(row || {})[0] || "");
    return { ok: value.toLowerCase() === "ok", message: value || "Résultat SQLite indisponible" };
  }

  rebuildIndex(workspace = null) {
    const data = workspace || this.readDocument()?.data || {};
    const insert = this.database.prepare(`INSERT INTO asset_index
      (asset_ref, collection_name, asset_type, asset_id, organization_id, module_id, title, subtitle, status, updated_at, search_text)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    this.database.prepare("DELETE FROM asset_index").run();
    for (const entity of normalizedEntities(data).values()) {
      const indexed = indexedEntity(entity);
      insert.run(indexed.ref, indexed.collection, indexed.type, indexed.value.id, indexed.organizationId, indexed.moduleId, indexed.title, indexed.subtitle, indexed.status, indexed.updatedAt, indexed.searchText);
    }
  }

  entityVersions({ organizationIds = null } = {}) {
    const clauses = [];
    const values = [];
    if (Array.isArray(organizationIds)) {
      if (!organizationIds.length) return {};
      clauses.push(`organization_id IN (${organizationIds.map(() => "?").join(",")})`);
      values.push(...organizationIds);
    }
    const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.database.prepare(`SELECT asset_ref, MAX(id) AS version FROM asset_revisions${where} GROUP BY asset_ref`).all(...values);
    return Object.fromEntries(rows.map((row) => [row.asset_ref, Number(row.version)]));
  }

  assetVersion(assetRef) {
    const row = this.database.prepare("SELECT id FROM asset_revisions WHERE asset_ref = ? ORDER BY id DESC LIMIT 1").get(assetRef);
    return Number(row?.id) || 0;
  }

  applyChangeset(operations, actor, auditAction = "workspace-changeset", validator = null, activity = null) {
    if (!Array.isArray(operations) || !operations.length || operations.length > 1000) {
      throw Object.assign(new Error("Le lot de modifications est vide ou trop volumineux."), { statusCode: 400, code: "invalid_changeset" });
    }
    const current = this.readDocument();
    if (!current) throw Object.assign(new Error("Espace de travail introuvable."), { statusCode: 500 });
    const nextData = structuredClone(current.data);
    const seen = new Set();
    for (const operation of operations) {
      const collection = String(operation?.collection || "");
      const type = ENTITY_COLLECTIONS.get(collection);
      const id = String(operation?.id || "");
      if (!type || !/^[a-z0-9][a-z0-9-]{0,63}$/i.test(id) || seen.has(`${collection}:${id}`)) {
        throw Object.assign(new Error("Une modification ciblée est invalide."), { statusCode: 400, code: "invalid_changeset" });
      }
      seen.add(`${collection}:${id}`);
      const ref = `${type}:${id}`;
      const collectionItems = Array.isArray(nextData[collection]) ? nextData[collection] : (nextData[collection] = []);
      const index = collectionItems.findIndex((item) => item.id === id);
      const actualVersion = this.assetVersion(ref);
      const expectedVersion = Number(operation.expectedVersion) || 0;
      if (actualVersion !== expectedVersion) {
        throw Object.assign(new Error("Cette fiche a été modifiée par une autre session."), { statusCode: 409, code: "asset_revision_conflict", assetRef: ref, actualVersion });
      }
      if (operation.delete === true) {
        if (index >= 0) collectionItems.splice(index, 1);
        continue;
      }
      if (!operation.value || typeof operation.value !== "object" || Array.isArray(operation.value) || operation.value.id !== id) {
        throw Object.assign(new Error("Le contenu d’une fiche ciblée est invalide."), { statusCode: 400, code: "invalid_changeset" });
      }
      if (index >= 0) collectionItems[index] = operation.value;
      else collectionItems.push(operation.value);
    }
    if (activity && typeof activity === "object") {
      if (!Array.isArray(nextData.activities)) nextData.activities = [];
      nextData.activities.unshift(activity);
      nextData.activities = nextData.activities.slice(0, 500);
    }
    if (typeof validator === "function" && !validator(nextData)) {
      throw Object.assign(new Error("Le lot de modifications produirait un espace de travail invalide."), { statusCode: 400, code: "invalid_changeset" });
    }
    return this.commitDocument(current.revision, nextData, actor, auditAction);
  }

  searchAssets({ query = "", organizationIds = null, organizationId = "", types = [], moduleId = "", status = "", offset = 0, limit = 50 } = {}) {
    const clauses = [];
    const values = [];
    const normalizedQuery = searchText(query);
    if (normalizedQuery) { clauses.push("search_text LIKE ? ESCAPE '\\'"); values.push(`%${normalizedQuery.replace(/[\\%_]/g, "\\$&")}%`); }
    if (Array.isArray(organizationIds)) {
      if (!organizationIds.length) return { items: [], total: 0, offset: 0, limit };
      clauses.push(`organization_id IN (${organizationIds.map(() => "?").join(",")})`);
      values.push(...organizationIds);
    }
    if (organizationId) { clauses.push("organization_id = ?"); values.push(organizationId); }
    const safeTypes = [...new Set(types.filter((type) => ENTITY_TYPES.has(type)))];
    if (safeTypes.length) { clauses.push(`asset_type IN (${safeTypes.map(() => "?").join(",")})`); values.push(...safeTypes); }
    if (moduleId) { clauses.push("module_id = ?"); values.push(moduleId); }
    if (status) { clauses.push("status = ?"); values.push(status); }
    const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const safeOffset = Math.max(Number(offset) || 0, 0);
    const total = Number(this.database.prepare(`SELECT COUNT(*) AS count FROM asset_index${where}`).get(...values)?.count) || 0;
    const rows = this.database.prepare(`SELECT asset_ref, asset_type, asset_id, organization_id, module_id, title, subtitle, status, updated_at FROM asset_index${where} ORDER BY title COLLATE NOCASE, asset_ref LIMIT ? OFFSET ?`).all(...values, safeLimit, safeOffset);
    return {
      items: rows.map((row) => ({ ref: row.asset_ref, type: row.asset_type, id: row.asset_id, organizationId: row.organization_id, moduleId: row.module_id, title: row.title, subtitle: row.subtitle, status: row.status, updatedAt: row.updated_at })),
      total,
      offset: safeOffset,
      limit: safeLimit,
    };
  }

  qualityReport({ organizationIds = null, organizationId = "", staleDays = 180 } = {}) {
    const document = this.readDocument();
    const workspace = document?.data || {};
    const allowed = Array.isArray(organizationIds) ? new Set(organizationIds) : null;
    const belongs = (item) => (!organizationId || item.organizationId === organizationId) && (!allowed || allowed.has(item.organizationId));
    const organizations = new Set((workspace.organizations || []).filter((item) => (!organizationId || item.id === organizationId) && (!allowed || allowed.has(item.id))).map((item) => item.id));
    const records = [
      ...(workspace.sites || []).filter(belongs).map((item) => ({ ref: `site:${item.id}`, item, label: item.name || item.id, kind: "Site" })),
      ...(workspace.configurations || []).filter(belongs).map((item) => ({ ref: `configuration:${item.id}`, item, label: item.name || item.id, kind: "Configuration" })),
      ...(workspace.procedures || []).filter(belongs).map((item) => ({ ref: `procedure:${item.id}`, item, label: item.title || item.id, kind: "Procédure" })),
      ...(workspace.moduleRecords || []).filter(belongs).map((item) => ({ ref: `module:${item.id}`, item, label: item.title || item.id, kind: "Module" })),
    ];
    const issues = [];
    const push = (record, code, label, severity = "warning") => issues.push({ ref: record.ref, organizationId: record.item.organizationId, title: record.label, kind: record.kind, code, label, severity });
    const now = Date.now();
    const definitions = new Map((workspace.customModuleDefinitions || []).map((definition) => [definition.id, Number(definition.schemaVersion) || 1]));
    const seen = new Map();
    for (const record of records) {
      const item = record.item;
      const responsible = item.owner || item.reviewOwner || (record.kind === "Site" ? item.details?.onsiteContact : "");
      if (!String(responsible || "").trim()) push(record, "missing-owner", "Responsable manquant");
      const dateValue = item.lastReviewed || item.updatedAt || item.createdAt;
      if (dateValue && Number.isFinite(Date.parse(dateValue)) && (now - Date.parse(dateValue)) / 86400000 > staleDays) push(record, "stale", `Aucune révision depuis plus de ${staleDays} jours`);
      if (!organizations.has(item.organizationId)) push(record, "orphan-organization", "Organisation introuvable", "error");
      if (record.kind === "Module" && definitions.has(item.moduleId) && (Number(item.schemaVersion) || 1) < definitions.get(item.moduleId)) push(record, "schema-outdated", "Schéma de fiche à mettre à niveau");
      const identifier = searchText(record.kind === "Configuration" ? (item.ip || item.name || "") : (item.name || item.title || ""));
      if (identifier) {
        const key = `${item.organizationId}:${record.kind}:${record.kind === "Module" ? `${item.moduleId}:` : ""}${identifier}`;
        if (seen.has(key)) { push(record, "duplicate", "Identifiant ou titre en double"); push(seen.get(key), "duplicate", "Identifiant ou titre en double"); }
        else seen.set(key, record);
      }
    }
    const refs = new Set(records.map((record) => record.ref));
    for (const relation of (workspace.relations || []).filter(belongs)) {
      const missing = [relation.sourceRef, relation.targetRef].some((ref) => !String(ref || "").startsWith("vault:") && !refs.has(ref));
      if (missing) issues.push({ ref: `relation:${relation.id}`, organizationId: relation.organizationId, title: relation.label || relation.id, kind: "Relation", code: "broken-relation", label: "Relation vers une fiche absente", severity: "error" });
    }
    const uniqueIssues = [...new Map(issues.map((issue) => [`${issue.ref}:${issue.code}`, issue])).values()];
    const counts = uniqueIssues.reduce((result, issue) => { result[issue.code] = (result[issue.code] || 0) + 1; return result; }, {});
    return { generatedAt: nowIso(), workspaceRevision: document?.revision || 0, staleDays, totalAssets: records.length, healthyAssets: Math.max(0, records.length - new Set(uniqueIssues.map((issue) => issue.ref)).size), counts, issues: uniqueIssues.slice(0, 500) };
  }

  captureChanges(previousWorkspace, nextWorkspace, workspaceRevision, actor, forcedAction = "") {
    const previous = normalizedEntities(previousWorkspace);
    const next = normalizedEntities(nextWorkspace);
    const refs = new Set([...previous.keys(), ...next.keys()]);
    const insertRevision = this.database.prepare("INSERT INTO asset_revisions (asset_ref, collection_name, organization_id, workspace_revision, saved_at, saved_by, action, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    for (const ref of refs) {
      const before = previous.get(ref);
      const after = next.get(ref);
      if (before?.encoded === after?.encoded) continue;
      const source = after || before;
      const action = forcedAction || changeAction(before, after);
      const value = after?.value || before?.value || {};
      const at = nowIso();
      insertRevision.run(ref, source.collection, source.organizationId, workspaceRevision, at, actor, action, JSON.stringify(value));
      this.insertAudit({ actor, action: `asset-${action}`, assetRef: ref, organizationId: source.organizationId, workspaceRevision, details: { collection: source.collection, label: value.name || value.title || "" } });
    }
  }

  insertAudit({ actor, action, assetRef = "", organizationId = "", workspaceRevision, details = {} }) {
    this.database.prepare("INSERT INTO audit_events (at, actor, action, asset_ref, organization_id, workspace_revision, details_json) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(nowIso(), actor || "Système", action, assetRef, organizationId, workspaceRevision, JSON.stringify(details));
  }

  close() {
    this.database.close();
  }
}
