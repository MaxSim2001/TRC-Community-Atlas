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
