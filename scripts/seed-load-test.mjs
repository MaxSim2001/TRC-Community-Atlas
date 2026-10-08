import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AtlasStore } from "../lib/atlas-store.mjs";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataArgument = process.argv.indexOf("--data");
const dataRoot = dataArgument >= 0 && process.argv[dataArgument + 1]
  ? path.resolve(process.argv[dataArgument + 1])
  : path.join(projectRoot, "data");
const workspacePath = path.join(dataRoot, "workspace.json");
const historyPath = path.join(dataRoot, "workspace-history.json");
const qaOrganizationId = "org-qa-scale";

function isoDate(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
}

function stamp() {
  return new Date().toISOString().replace(/T/, "_").replace(/:/g, "-").replace(/\..+/, "");
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
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  await rename(temporaryPath, filePath);
}

const store = await AtlasStore.open({ dataRoot, workspacePath, historyPath });
const document = store.readDocument();
if (!document || !Number.isInteger(document.revision) || !document.data) {
  store.close();
  throw new Error("Espace de travail Atlas absent ou invalide.");
}
if (document.data.organizations?.some((organization) => organization.id === qaOrganizationId)) {
  store.close();
  throw new Error("Le jeu de charge QA existe déjà; aucune donnée n’a été modifiée.");
}

const workspace = structuredClone(document.data);
for (const key of ["organizations", "sites", "configurations", "procedures", "relations", "relationshipEvents", "activities", "moduleRecords", "templates"]) {
  if (!Array.isArray(workspace[key])) workspace[key] = [];
}

const generatedAt = new Date().toISOString();
const sites = Array.from({ length: 12 }, (_, index) => ({
  id: `site-qa-${String(index + 1).padStart(3, "0")}`,
  organizationId: qaOrganizationId,
  name: `Site de validation ${String(index + 1).padStart(2, "0")}`,
  address: `Adresse fictive ${index + 1}, Québec`,
  timezone: "America/Toronto",
  status: "active",
}));

const procedures = Array.from({ length: 48 }, (_, index) => ({
  id: `proc-qa-${String(index + 1).padStart(3, "0")}`,
  organizationId: qaOrganizationId,
  title: `[TEST] Procédure de validation ${String(index + 1).padStart(3, "0")}`,
  category: ["Maintenance", "Sécurité", "Continuité", "Opérations"][index % 4],
  owner: `Équipe QA ${(index % 6) + 1}`,
  status: index % 5 === 0 ? "review" : "published",
  updatedAt: isoDate(-(index % 120)),
  summary: "Donnée fictive générée pour valider la navigation, la recherche et la pagination.",
  steps: ["[TEST] Préparer la validation", "Exécuter les contrôles locaux", "Consigner le résultat", "Fermer le scénario"],
}));

const configurations = Array.from({ length: 240 }, (_, index) => ({
  id: `cfg-qa-${String(index + 1).padStart(4, "0")}`,
  organizationId: qaOrganizationId,
  siteId: sites[index % sites.length].id,
  name: `QA-${["SRV", "WS", "NET", "STO"][index % 4]}-${String(index + 1).padStart(4, "0")}`,
  type: ["Serveur", "Poste", "Réseau", "Stockage"][index % 4],
  os: ["Windows Server 2025", "Windows 11 Pro", "Linux", "Appliance"][index % 4],
  ip: `192.0.2.${(index % 250) + 1}`,
  owner: `Responsable QA ${(index % 10) + 1}`,
  location: sites[index % sites.length].name,
  warranty: isoDate(30 + (index % 720)),
  criticality: ["normal", "low", "high", "critical"][index % 4],
  status: ["documented", "documented", "review", "draft"][index % 4],
  lastReviewed: isoDate(-(index % 180)),
  rmmId: "",
  summary: "Configuration fictive réservée aux tests de charge locaux.",
  notes: "Aucune donnée réelle. Ne pas raccorder à un service externe.",
  procedureIds: [procedures[index % procedures.length].id],
  relationIds: [],
}));

const relations = Array.from({ length: 180 }, (_, index) => ({
  id: `rel-qa-${String(index + 1).padStart(4, "0")}`,
  organizationId: qaOrganizationId,
  sourceRef: `configuration:${configurations[index % configurations.length].id}`,
  targetRef: `configuration:${configurations[(index * 7 + 13) % configurations.length].id}`,
  relationType: ["depends-on", "backed-up-to", "protected-by", "connected-to"][index % 4],
  label: ["Dépend de", "Sauvegardé vers", "Protégé par", "Connecté à"][index % 4],
  reverseLabel: ["Est requis par", "Reçoit les sauvegardes de", "Protège", "Connecté à"][index % 4],
  notes: "Relation fictive utilisée pour valider la cartographie à grande échelle.",
  archived: index % 23 === 0,
  createdAt: generatedAt,
  createdBy: "Générateur QA local",
  updatedAt: generatedAt,
}));

const relationshipEvents = relations.map((relation, index) => ({
  id: `rev-rel-qa-${String(index + 1).padStart(4, "0")}`,
  relationId: relation.id,
  at: generatedAt,
  actor: "Générateur QA local",
  action: relation.archived ? "Relation archivée" : "Relation ajoutée",
  sourceRef: relation.sourceRef,
  targetRef: relation.targetRef,
  relationType: relation.relationType,
  label: relation.label,
}));

const moduleIds = [
  "configurations", "checklists", "contacts", "documents", "domain-tracker", "locations", "ssl-tracker",
  "service-applications", "service-active-directory", "service-backup", "service-email", "service-lan", "service-printing", "service-wireless",
  "custom-ordinateur", "custom-portable", "custom-server", "custom-switch", "custom-firewall", "custom-nas",
];
const moduleRecords = Array.from({ length: 720 }, (_, index) => {
  const expiresOffset = index % 9 === 0 ? -(index % 20) : 10 + (index % 400);
  return {
    id: `rec-qa-${String(index + 1).padStart(5, "0")}`,
    moduleId: moduleIds[index % moduleIds.length],
    organizationId: qaOrganizationId,
    siteId: sites[index % sites.length].id,
    title: `[TEST] Fiche ${String(index + 1).padStart(5, "0")}`,
    owner: index % 11 === 0 ? "" : `Technicien QA ${(index % 12) + 1}`,
    status: index % 17 === 0 ? "archived" : index % 5 === 0 ? "review" : "active",
    expiresOn: isoDate(expiresOffset),
    reference: `QA-REF-${String(index + 1).padStart(5, "0")}`,
    tags: ["test", "charge", `lot-${(index % 8) + 1}`],
    summary: "Fiche fictive pour vérifier le filtrage, la recherche et la pagination.",
    notes: "Contenu QA sans information sensible.",
    updatedAt: isoDate(-(index % 240)),
    checklist: [
      { done: true, label: "Jeu de données généré" },
      { done: index % 3 === 0, label: "Contrôle visuel terminé" },
      { done: false, label: "Scénario à revoir" },
    ],
  };
});

const templates = Array.from({ length: 36 }, (_, index) => ({
  id: `tpl-qa-${String(index + 1).padStart(3, "0")}`,
  name: `[TEST] Modèle QA ${String(index + 1).padStart(3, "0")}`,
  moduleId: moduleIds[index % moduleIds.length],
  defaultTags: ["test", "modele"],
  defaultSummary: "Modèle fictif utilisé pour valider une bibliothèque volumineuse.",
  defaultNotes: "Champ A :\nChamp B :\nValidation :",
}));

const activities = Array.from({ length: 90 }, (_, index) => ({
  id: `act-qa-${String(index + 1).padStart(4, "0")}`,
  at: new Date(Date.now() - index * 3600000).toISOString(),
  actor: "Générateur QA local",
  action: ["Fiche créée", "Configuration validée", "Relation contrôlée", "Procédure révisée"][index % 4],
  target: `Élément fictif ${String(index + 1).padStart(4, "0")}`,
  kind: "qa",
}));

workspace.organizations.push({
  id: qaOrganizationId,
  name: "[TEST] Compagnie Échelle Atlas",
  code: "QATEST",
  industry: "Validation logicielle",
  owner: "Équipe QA locale",
  status: "active",
  notes: "Organisation fictive générée uniquement pour les tests de charge locaux.",
});
workspace.sites.push(...sites);
workspace.configurations.push(...configurations);
workspace.procedures.push(...procedures);
workspace.relations.push(...relations);
workspace.relationshipEvents.push(...relationshipEvents);
workspace.moduleRecords.push(...moduleRecords);
workspace.templates.push(...templates);
workspace.activities.unshift(...activities);
workspace.schemaVersion = Math.max(Number(workspace.schemaVersion) || 1, 5);
workspace.settings = workspace.settings || {};
workspace.settings.qaDataset = {
  id: "atlas-scale-v1",
  organizationId: qaOrganizationId,
  generatedAt,
  counts: { sites: sites.length, configurations: configurations.length, procedures: procedures.length, relations: relations.length, moduleRecords: moduleRecords.length, templates: templates.length, activities: activities.length },
};
workspace.updatedAt = generatedAt;

const candidateDocument = { revision: document.revision + 1, data: workspace };
const encodedBytes = Buffer.byteLength(JSON.stringify(candidateDocument), "utf8");
if (encodedBytes > 96 * 1024 * 1024) {
  store.close();
  throw new Error(`Le jeu QA dépasserait la limite de sécurité (${encodedBytes} octets); aucune donnée n’a été modifiée.`);
}

const backupDirectory = path.join(dataRoot, "qa-backups");
await mkdir(backupDirectory, { recursive: true });
const backupPath = path.join(backupDirectory, `workspace-before-scale-${stamp()}.json`);
await writeFile(backupPath, `${JSON.stringify(document, null, 2)}\n`, { encoding: "utf8", flag: "wx" });

const nextDocument = store.commitDocument(document.revision, workspace, "Générateur QA local", "qa-scale-seeded");
await writeJsonAtomic(historyPath, { schemaVersion: 2, entries: store.historyDocuments(200) });
await writeJsonAtomic(workspacePath, nextDocument);
store.close();

console.log(JSON.stringify({
  organization: qaOrganizationId,
  revision: nextDocument.revision,
  bytes: encodedBytes,
  backupPath,
  created: workspace.settings.qaDataset.counts,
}));
