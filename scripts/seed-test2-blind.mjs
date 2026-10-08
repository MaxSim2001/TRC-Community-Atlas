import { createCipheriv, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AtlasStore } from "../lib/atlas-store.mjs";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataArgument = process.argv.indexOf("--data");
const dataRoot = dataArgument >= 0 && process.argv[dataArgument + 1] ? path.resolve(process.argv[dataArgument + 1]) : path.join(projectRoot, "data");
const workspacePath = path.join(dataRoot, "workspace.json");
const historyPath = path.join(dataRoot, "workspace-history.json");
const vaultPath = path.join(dataRoot, "vault.json");
const vaultKeyPath = path.join(dataRoot, "vault.key");
const organizationId = "org-test2-aubepine";
const generatedAt = new Date().toISOString();
const today = generatedAt.slice(0, 10);

function stamp() {
  return generatedAt.replace(/T/, "_").replace(/:/g, "-").replace(/\..+/, "");
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

async function getVaultKey() {
  try {
    const key = Buffer.from((await readFile(vaultKeyPath, "utf8")).trim(), "base64");
    if (key.length !== 32) throw new Error("Clé du coffre Atlas invalide.");
    return key;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    const key = randomBytes(32);
    await writeFile(vaultKeyPath, `${key.toString("base64")}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    return key;
  }
}

function encryptPayload(value, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return { algorithm: "aes-256-gcm", iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: encrypted.toString("base64") };
}

function record(id, moduleId, title, values = {}) {
  return {
    id, moduleId, organizationId, siteId: values.siteId || "", title, owner: values.owner || "Équipe TI TEST2", status: values.status || "active",
    expiresOn: values.expiresOn || "", reference: values.reference || "", tags: ["test2", ...(values.tags || [])], summary: values.summary || "Donnée fictive du scénario TEST2.",
    notes: values.notes || "Donnée entièrement fictive; ne pas utiliser en production.", updatedAt: today, details: values.details || {}, checklist: values.checklist || [],
  };
}

function relation(id, sourceRef, targetRef, relationType, label, reverseLabel, notes = "") {
  return { id, organizationId, sourceRef, targetRef, relationType, label, reverseLabel, notes, archived: false, createdAt: generatedAt, createdBy: "Scénario aveugle TEST2", updatedAt: generatedAt };
}

const sites = [
  { id: "site-test2-mtl-hq", organizationId, name: "Siège social Montréal", address: "2100 boulevard Exemple, Montréal (Québec) H0H 0H0", timezone: "America/Toronto", status: "active", details: { siteType: "Bureau principal et salle de serveurs", openingHours: "06:30-19:00", accessInstructions: "Réception, badge visiteur obligatoire", primarySubnet: "10.77.0.0/24", vlans: "10 Gestion\n20 Serveurs\n30 Utilisateurs\n40 Voix\n50 Invités", onsiteContact: "Élodie Caron — 514-555-0101 — elodie.caron@example.test" } },
  { id: "site-test2-lav-wh", organizationId, name: "Entrepôt Laval", address: "88 rue Démonstration, Laval (Québec) H0H 0H0", timezone: "America/Toronto", status: "active", details: { siteType: "Entrepôt, terminaux RF et expédition", openingHours: "05:00-23:00", accessInstructions: "Quai 3, appeler le superviseur avant déplacement", primarySubnet: "10.77.10.0/24", vlans: "10 Gestion\n30 Opérations\n40 Voix\n60 Scanners\n70 Caméras", onsiteContact: "Karim Haddad — 450-555-0102 — karim.haddad@example.test" } },
  { id: "site-test2-qc-br", organizationId, name: "Bureau Québec", address: "450 avenue Fictive, Québec (Québec) H0H 0H0", timezone: "America/Toronto", status: "active", details: { siteType: "Bureau satellite", openingHours: "08:00-17:00", accessInstructions: "Stationnement visiteurs à l’arrière", primarySubnet: "10.77.20.0/24", vlans: "10 Gestion\n30 Utilisateurs\n40 Voix\n50 Invités", onsiteContact: "Maude Roy — 418-555-0103 — maude.roy@example.test" } },
];

const configurationSeed = [
  ["cfg-test2-mtl-dc01", "site-test2-mtl-hq", "T2-MTL-DC01", "Serveur", "Windows Server 2022 Standard", "10.77.20.10", "critical", "2028-04-30", { technicalRole: "Contrôleur de domaine principal, DNS, DHCP", manufacturer: "Dell", model: "PowerEdge R550 fictif", serialNumber: "TEST2-R550-0001" }],
  ["cfg-test2-mtl-dc02", "site-test2-mtl-hq", "T2-MTL-DC02", "Machine virtuelle", "Windows Server 2022 Standard", "10.77.20.11", "critical", "", { technicalRole: "AD secondaire, DNS", parentAsset: "T2-MTL-HV01", cpu: "4 vCPU", memory: "12 Go", storage: "120 Go" }],
  ["cfg-test2-mtl-hv01", "site-test2-mtl-hq", "T2-MTL-HV01", "Hyperviseur", "Proxmox VE 8.2", "10.77.10.21", "critical", "2029-02-28", { technicalRole: "Hôte de virtualisation", manufacturer: "Dell", model: "PowerEdge R750 fictif", serialNumber: "TEST2-R750-0001", platform: "Proxmox VE 8.2", memory: "256 Go", storage: "7,6 To RAID10" }],
  ["cfg-test2-mtl-hv02", "site-test2-mtl-hq", "T2-MTL-HV02", "Hyperviseur", "Proxmox VE 8.2", "10.77.10.22", "critical", "2029-02-28", { technicalRole: "Hôte de virtualisation", manufacturer: "Dell", model: "PowerEdge R750 fictif", serialNumber: "TEST2-R750-0002", platform: "Proxmox VE 8.2", memory: "256 Go", storage: "7,6 To RAID10" }],
  ["cfg-test2-mtl-fs01", "site-test2-mtl-hq", "T2-MTL-FS01", "Machine virtuelle", "Windows Server 2022", "10.77.20.20", "high", "", { technicalRole: "Fichiers et impression", parentAsset: "T2-MTL-HV01", cpu: "8 vCPU", memory: "32 Go", storage: "3,2 To" }],
  ["cfg-test2-mtl-sql01", "site-test2-mtl-hq", "T2-MTL-SQL01", "Machine virtuelle", "Windows Server 2022 / SQL Server 2022 Standard", "10.77.20.30", "critical", "", { technicalRole: "SQL ERP", parentAsset: "T2-MTL-HV02", cpu: "12 vCPU", memory: "64 Go", storage: "1,5 To" }],
  ["cfg-test2-mtl-erp01", "site-test2-mtl-hq", "T2-MTL-ERP01", "Machine virtuelle", "Windows Server 2022", "10.77.20.31", "critical", "", { technicalRole: "Application ERP Aubépine", parentAsset: "T2-MTL-HV02", cpu: "8 vCPU", memory: "32 Go", storage: "300 Go" }],
  ["cfg-test2-mtl-bkp01", "site-test2-mtl-hq", "T2-MTL-BKP01", "Serveur", "Windows Server 2022", "10.77.20.40", "critical", "", { technicalRole: "Veeam Backup & Replication 12", storage: "Dépôt 24 To", platform: "Fenêtre 20:00-05:00; rétention 30 jours + 12 mensuelles" }],
  ["cfg-test2-mtl-nas01", "site-test2-mtl-hq", "T2-MTL-NAS01", "Stockage", "Synology DSM fictif", "10.77.20.41", "high", "2027-11-30", { technicalRole: "Dépôt de sauvegarde", manufacturer: "Synology", model: "RS3621RPxs fictif", storage: "32 To utiles, RAID6" }],
  ["cfg-test2-mtl-fw01", "site-test2-mtl-hq", "T2-MTL-FW01", "Pare-feu", "FortiOS 7.4.x fictif", "10.77.10.1", "critical", "2027-06-30", { technicalRole: "Pare-feu principal HA", manufacturer: "Fortinet", model: "FortiGate 100F fictif", platform: "HA primaire; WAN 192.0.2.18/30" }],
  ["cfg-test2-lav-fw01", "site-test2-lav-wh", "T2-LAV-FW01", "Pare-feu", "FortiOS fictif", "10.77.10.1", "high", "2027-06-30", { technicalRole: "Pare-feu d’entrepôt", manufacturer: "Fortinet", model: "FortiGate 80F fictif", parentAsset: "VPN vers T2-MTL-FW01", platform: "WAN 198.51.100.42/30" }],
  ["cfg-test2-qc-fw01", "site-test2-qc-br", "T2-QC-FW01", "Pare-feu", "FortiOS fictif", "10.77.20.1", "high", "", { technicalRole: "Pare-feu du bureau Québec", manufacturer: "Fortinet", model: "FortiGate 60F fictif", parentAsset: "VPN vers T2-MTL-FW01", platform: "WAN 203.0.113.55/30", lifecycleDate: "2027-01-31" }],
  ["cfg-test2-mtl-sw01", "site-test2-mtl-hq", "T2-MTL-SW01", "Commutateur", "ArubaOS-CX fictif", "10.77.10.11", "high", "2028-09-30", { technicalRole: "Commutateur cœur", manufacturer: "Aruba", model: "6200F fictif", parentAsset: "Pile avec T2-MTL-SW02", platform: "48 ports, PoE" }],
  ["cfg-test2-mtl-sw02", "site-test2-mtl-hq", "T2-MTL-SW02", "Commutateur", "ArubaOS-CX fictif", "10.77.10.12", "high", "2028-09-30", { technicalRole: "Commutateur cœur", manufacturer: "Aruba", model: "6200F fictif", parentAsset: "Pile avec T2-MTL-SW01", platform: "48 ports, PoE" }],
  ["cfg-test2-lav-sw01", "site-test2-lav-wh", "T2-LAV-SW01", "Commutateur", "ArubaOS-CX fictif", "10.77.10.11", "high", "", { technicalRole: "Commutateur entrepôt", manufacturer: "Aruba", model: "6100 fictif", platform: "48 ports, PoE" }],
  ["cfg-test2-mtl-ap01", "site-test2-mtl-hq", "T2-MTL-AP01", "Point d’accès", "Aruba Central fictif", "10.77.10.51", "normal", "", { technicalRole: "Wi-Fi réception", manufacturer: "Aruba", model: "AP-515 fictif", parentAsset: "Aruba Central fictif", platform: "SSID AUB-STAFF et AUB-GUEST" }],
  ["cfg-test2-lav-ap01", "site-test2-lav-wh", "T2-LAV-AP01", "Point d’accès", "Aruba Central fictif", "10.77.10.51", "high", "", { technicalRole: "Wi-Fi allée A", manufacturer: "Aruba", model: "AP-515 fictif", platform: "SSID AUB-WH et AUB-GUEST" }],
  ["cfg-test2-mtl-ups01", "site-test2-mtl-hq", "T2-MTL-UPS01", "UPS", "Carte réseau APC fictive", "10.77.10.61", "high", "", { technicalRole: "Alimentation salle serveurs", manufacturer: "APC", model: "Smart-UPS SRT fictif", platform: "6000 VA", lifecycleDate: "2027-08-15" }],
  ["cfg-test2-lap001", "site-test2-mtl-hq", "T2-LAP-001", "Portable", "Windows 11 Pro", "", "normal", "2028-03-31", { technicalRole: "Poste d’Élodie Caron", manufacturer: "Lenovo", model: "T14 fictif", serialNumber: "TEST2-T14-0001", encryption: "BitLocker", securityAgent: "SentinelOne fictif" }],
  ["cfg-test2-lap002", "site-test2-mtl-hq", "T2-LAP-002", "Portable", "Windows 11 Pro", "", "normal", "2028-03-31", { technicalRole: "Poste de Nicolas Tremblay", manufacturer: "Dell", model: "Latitude fictif", serialNumber: "TEST2-LAT-0002", encryption: "BitLocker", securityAgent: "SentinelOne fictif" }],
];

const configurationParents = new Map([
  ["cfg-test2-mtl-dc02", "cfg-test2-mtl-hv01"],
  ["cfg-test2-mtl-fs01", "cfg-test2-mtl-hv01"],
  ["cfg-test2-mtl-sql01", "cfg-test2-mtl-hv02"],
  ["cfg-test2-mtl-erp01", "cfg-test2-mtl-hv02"],
]);

const configurations = configurationSeed.map(([id, siteId, name, type, os, ip, criticality, warranty, details]) => ({
  id, organizationId, siteId, name, type, os, ip, owner: "Équipe Infrastructure TEST2", location: sites.find((site) => site.id === siteId)?.name || "", warranty, criticality,
  status: "documented", lastReviewed: today, rmmId: "", summary: `${details.technicalRole || type}. Donnée fictive TEST2.`, notes: "Aucune connexion externe; inventaire de démonstration seulement.", procedureIds: [], relationIds: [],
  details: {
    hostname: name, fqdn: `${name.toLowerCase()}.aubepine-distribution.test`, assetTag: `TEST2-${id.replace("cfg-test2-", "").toUpperCase()}`,
    vlan: ip ? ip.split(".")[2] : "", networkInterfaces: ip ? `Gestion | ${ip}/24 | ${ip.split(".").slice(0, 3).join(".")}.1 | ${ip.split(".")[2]} | Administration` : "DHCP | Adresse attribuée dynamiquement | Utilisateur",
    managementPorts: ["Hyperviseur", "Pare-feu", "Commutateur", "Point d’accès", "Stockage", "UPS"].includes(type) ? "HTTPS 443" : "RDP 3389 / WinRM HTTPS 5986",
    managementNetwork: "Accès limité au VLAN de gestion TEST2", installedDate: "2024-01-15", monitoring: "Supervision Atlas QA fictive — disponibilité et capacité",
    backupPolicy: ["Serveur", "Machine virtuelle"].includes(type) ? "Sauvegarde quotidienne selon POL-BKP-001" : "Configuration exportée après chaque changement",
    patchPolicy: os.includes("Windows") ? "Correctifs mensuels — groupe TEST2-Production" : "Révision trimestrielle du micrologiciel",
    maintenanceWindow: "Dimanche 02:00-05:00 America/Toronto", operationalDependencies: "Alimentation, réseau de gestion, DNS et supervision TEST2",
    customAttributes: "Source = scénario aveugle TEST2\nDonnées = entièrement fictives\nValidation = requise avant usage réel",
    ...details,
    parentConfigurationId: configurationParents.get(id) || "",
  },
}));

const moduleRecords = [
  record("rec-test2-contact-elodie", "contacts", "Élodie Caron", { siteId: "site-test2-mtl-hq", reference: "elodie.caron@example.test", owner: "Camille Gagnon", details: { phone: "514-555-0101", role: "Directrice des opérations", company: "Aubépine Distribution", preferredChannel: "Téléphone", decisionMaker: "Oui", emergencyContact: "Oui" } }),
  record("rec-test2-contact-nicolas", "contacts", "Nicolas Tremblay", { siteId: "site-test2-mtl-hq", reference: "nicolas.tremblay@example.test", details: { phone: "514-555-0104", role: "Contrôleur financier", company: "Aubépine Distribution", preferredChannel: "Courriel", decisionMaker: "Oui", emergencyContact: "Non", dataSensitivity: "Finances" } }),
  record("rec-test2-contact-karim", "contacts", "Karim Haddad", { siteId: "site-test2-lav-wh", reference: "karim.haddad@example.test", details: { phone: "450-555-0102", role: "Superviseur entrepôt", decisionMaker: "Non", emergencyContact: "Oui" } }),
  record("rec-test2-contact-maude", "contacts", "Maude Roy", { siteId: "site-test2-qc-br", reference: "maude.roy@example.test", details: { phone: "418-555-0103", role: "Responsable bureau Québec", decisionMaker: "Non", emergencyContact: "Oui" } }),
  record("rec-test2-contact-sonia", "contacts", "Sonia Beaulieu", { siteId: "site-test2-mtl-hq", reference: "sonia.beaulieu@example.test", details: { phone: "514-555-0105", role: "Ressources humaines", decisionMaker: "Non", emergencyContact: "Non", dataSensitivity: "Données RH sensibles" } }),
  record("rec-test2-ad", "service-active-directory", "ad.aubepine-distribution.test", { siteId: "site-test2-mtl-hq", reference: "ad.aubepine-distribution.test", details: { functionalLevel: "Windows Server 2016", upnSuffix: "aubepine-distribution.test", domainControllers: "T2-MTL-DC01\nT2-MTL-DC02", directorySync: "Microsoft Entra Connect fictif", syncServer: "T2-MTL-DC02", organizationalUnits: "Utilisateurs\nPostes\nServeurs\nGroupes\nComptes-Service", criticalGroups: "GG-ERP-Users\nGG-Finance\nGG-Warehouse-RF\nGG-VPN-Users" } }),
  record("rec-test2-m365", "custom-microsoft-365", "aubepinedistribution.onmicrosoft.test", { reference: "aubepinedistribution.onmicrosoft.test", details: { acceptedDomains: "aubepine-distribution.test", licenses: "92 Business Premium\n25 F3\n5 Visio Plan 2", globalAdmins: "2", mfaPolicy: "Obligatoire pour tous", conditionalAccess: "Blocage authentification héritée\nMFA hors emplacement fiable", services: "Exchange Online\nSharePoint /sites/Operations, /sites/Finance, /sites/RH\nTeams Direction, Opérations, Entrepôt, Projets" } }),
  ...[
    ["rec-test2-wan-mtl", "WAN-MTL-PRIMARY", "site-test2-mtl-hq", "Fibres Exemple inc.", "TEST2-FIBRE-MTL-001", "1 Gbit/s symétrique", "192.0.2.18/30", "192.0.2.17", "192.0.2.53", "4 h", "1-800-555-0200"],
    ["rec-test2-wan-lav", "WAN-LAV-PRIMARY", "site-test2-lav-wh", "Réseau Démo inc.", "TEST2-FIBRE-LAV-001", "500/500 Mbit/s", "198.51.100.42/30", "198.51.100.41", "", "", ""],
    ["rec-test2-wan-qc", "WAN-QC-PRIMARY", "site-test2-qc-br", "Télécom Exemple", "TEST2-QC-0042", "400/100 Mbit/s", "203.0.113.55/30", "203.0.113.54", "", "", ""],
  ].map(([id, title, siteId, provider, reference, bandwidth, wanIp, gateway, dnsServers, sla, outagePhone]) => record(id, "service-internet-wan", title, { siteId, reference, details: { provider, bandwidth, wanIp, gateway, dnsServers, sla, outagePhone } })),
  record("rec-test2-vpn-lav", "custom-vpn", "VPN-MTL-LAV", { reference: "T2-MTL-FW01 ↔ T2-LAV-FW01", details: { vpnType: "IPsec IKEv2", endpointA: "T2-MTL-FW01", endpointB: "T2-LAV-FW01", localNetworks: "10.77.0.0/16", remoteNetworks: "10.77.10.0/24", encryption: "AES-256-GCM", dhGroup: "Groupe 19", monitoring: "Oui" } }),
  record("rec-test2-vpn-qc", "custom-vpn", "VPN-MTL-QC", { reference: "T2-MTL-FW01 ↔ T2-QC-FW01", details: { vpnType: "IPsec IKEv2", endpointA: "T2-MTL-FW01", endpointB: "T2-QC-FW01", localNetworks: "10.77.0.0/16", remoteNetworks: "10.77.20.0/24", encryption: "AES-256-GCM", dhGroup: "Groupe 19", monitoring: "Oui" } }),
  record("rec-test2-wifi-mtl", "service-wireless", "Wi-Fi Montréal", { siteId: "site-test2-mtl-hq", reference: "Aruba Central fictif", details: { ssids: "AUB-STAFF\nAUB-GUEST", controller: "Aruba Central fictif", security: "WPA3-Enterprise / invité isolé", guestAccess: "Isolé", coverage: "Siège social Montréal" } }),
  record("rec-test2-wifi-lav", "service-wireless", "Wi-Fi Entrepôt Laval", { siteId: "site-test2-lav-wh", reference: "Aruba Central fictif", details: { ssids: "AUB-WH\nAUB-GUEST", controller: "Aruba Central fictif", security: "WPA2-Enterprise / invité isolé", guestAccess: "Isolé", coverage: "Entrepôt et quai" } }),
  record("rec-test2-virtualization", "service-virtualization", "Cluster Proxmox TEST2", { siteId: "site-test2-mtl-hq", reference: "https://10.77.10.21:8006", details: { platform: "Proxmox VE", version: "8.2 fictive", cluster: "AUB-PVE", highAvailability: "Oui", hosts: "T2-MTL-HV01\nT2-MTL-HV02", storage: "7,6 To RAID10 par hôte" } }),
  record("rec-test2-ups", "custom-ups", "T2-MTL-UPS01", { siteId: "site-test2-mtl-hq", reference: "https://10.77.10.61", details: { manufacturer: "APC", model: "Smart-UPS SRT fictif", capacity: "6000 VA", ipAddress: "10.77.10.61", lastBatteryTest: "2026-08-15", batteryReplacement: "2027-08-15" } }),
  ...[
    ["rec-test2-backup-vm", "POL-BKP-001 — Serveurs virtuels", "Cluster Proxmox", "T2-MTL-BKP01 puis copie immuable fictive", "Quotidien 20:00", "30 quotidiens, 12 mensuels", "24 h", "8 h", "2026-09-12", "Réussi"],
    ["rec-test2-backup-m365", "POL-BKP-002 — Microsoft 365", "Exchange, OneDrive, SharePoint, Teams", "SaaS Backup fictif", "4 fois par jour", "7 ans", "6 h", "12 h", "2026-08-22", "Réussi"],
    ["rec-test2-backup-sql", "POL-BKP-003 — SQL ERP", "T2-MTL-SQL01", "T2-MTL-BKP01", "Complet 22:00, différentiel 6 h, journaux 15 min", "30 jours", "15 min", "4 h", "2026-09-12", "Réussi"],
  ].map(([id, title, source, target, schedule, retention, rpo, rto, lastRestoreTest, lastResult]) => record(id, "service-backup", title, { siteId: "site-test2-mtl-hq", reference: "Politique TEST2", details: { source, target, schedule, retention, rpo, rto, lastRestoreTest, lastResult, encryption: "Activé", immutability: "Oui" } })),
  ...[
    ["rec-test2-share-common", "Commun", "S:\\", "\\\\T2-MTL-FS01\\Commun", "D:\\Shares\\Commun", "Interne", "Tous les employés en modification; stagiaires en lecture"],
    ["rec-test2-share-finance", "Finance", "F:\\", "\\\\T2-MTL-FS01\\Finance", "D:\\Shares\\Finance", "Restreinte", "GG-Finance seulement"],
    ["rec-test2-share-warehouse", "Entrepôt", "W:\\", "\\\\T2-MTL-FS01\\Warehouse", "D:\\Shares\\Warehouse", "Interne", "GG-Warehouse-RF et superviseurs"],
  ].map(([id, title, mappedDrive, sharePath, diskPath, dataClassification, securityPermissions]) => record(id, "service-file-sharing", title, { siteId: "site-test2-mtl-hq", summary: `Partage ${title} servi par T2-MTL-FS01.`, details: { mappedDrive, sharePath, diskPath, dataClassification, offlineAccess: "À confirmer", securityPermissions, serverConfigurationIds: ["cfg-test2-mtl-fs01"] } })),
  ...[
    ["rec-test2-print-mtl", "Réception Montréal", "site-test2-mtl-hq", "T2-MTL-PRN01", "GPO", "Oui", "Universal PCL6 fictif", "10.77.30.51", ["cfg-test2-mtl-fs01"]],
    ["rec-test2-print-lav", "Étiquettes expédition", "site-test2-lav-wh", "T2-LAV-PRN01", "Script", "Non", "Zebra fictif", "10.77.10.71", ["cfg-test2-mtl-fs01"]],
    ["rec-test2-print-qc", "Multifonction Québec", "site-test2-qc-br", "T2-QC-PRN01", "Manuel", "Non", "Canon fictif", "10.77.20.51", []],
  ].map(([id, title, siteId, printerNames, deployment, publishedToAd, driverPath, hostAddress, printServerConfigurationIds]) => record(id, "service-printing", title, { siteId, reference: hostAddress, details: { printerNames, deployment, publishedToAd, driverPath, hostAddress, printServerConfigurationIds, printerConfigurationIds: [], supportInformation: "Fournisseur fictif; contrat de démonstration.", notesDocument: "Aucun équipement réel." } })),
  ...[
    ["rec-test2-lic-m365", "Microsoft 365", "Microsoft", "122", "2027-09-01"], ["rec-test2-lic-veeam", "Veeam fictif", "Veeam fictif", "12", "2027-03-15"],
    ["rec-test2-lic-s1", "SentinelOne fictif", "SentinelOne fictif", "145", "2027-05-31"], ["rec-test2-lic-forti", "Fortinet fictif", "Fortinet fictif", "3", "2027-06-30"],
    ["rec-test2-lic-erp", "ERP Aubépine fictif", "Logiciels Démo", "85", "2027-01-01"],
  ].map(([id, title, vendor, seats, expiresOn]) => record(id, "service-licensing", title, { reference: vendor, expiresOn, details: { vendor, seats, renewalType: "Annuel", costCenter: "TI-TEST2" } })),
  record("rec-test2-vendor-isp", "service-vendors", "Fibres Exemple inc.", { reference: "Internet Montréal", details: { contact: "Centre de panne", phone: "1-800-555-0200", supportPortal: "https://portal.example.test" } }),
  record("rec-test2-vendor-print", "service-vendors", "Impression Exemple", { reference: "Imprimantes", details: { contact: "Soutien fictif", email: "support@example.test", phone: "1-800-555-0202" } }),
  record("rec-test2-vendor-erp", "service-vendors", "Logiciels Démo", { reference: "ERP", details: { contact: "Urgence ERP", phone: "1-800-555-0203" } }),
  record("rec-test2-app-erp", "service-applications", "ERP Aubépine", { reference: "https://erp.aubepine-distribution.test", owner: "Opérations", details: { vendor: "Logiciels Démo", hosting: "T2-MTL-ERP01 et T2-MTL-SQL01", authentication: "Active Directory", dataClassification: "Confidentielle", dependencies: "T2-MTL-ERP01\nT2-MTL-SQL01", supportContact: "1-800-555-0203", serviceLevel: "Critique" } }),
  record("rec-test2-app-wms", "service-applications", "Gestion d’entrepôt fictive", { reference: "https://wms.aubepine-distribution.test", owner: "Entrepôt", details: { vendor: "SaaS Démo", hosting: "SaaS fictif", authentication: "Microsoft Entra ID", dataClassification: "Interne", serviceLevel: "Critique" } }),
  record("rec-test2-app-pay", "service-applications", "Paie fictive", { reference: "https://paie.example.test", owner: "RH", details: { vendor: "SaaS Démo", hosting: "SaaS fictif", authentication: "Microsoft Entra ID", dataClassification: "Restreinte", serviceLevel: "Élevé" } }),
  record("rec-test2-domain-main", "domain-tracker", "aubepine-distribution.test", { reference: "Registraire Exemple", expiresOn: "2027-08-01", details: { dnsProvider: "DNS Exemple", autoRenew: "Oui", registrant: "Aubépine Distribution fictive", authCodeLocation: "Mot de passe lié; aucun secret ici", nameservers: "ns1.example.test\nns2.example.test" } }),
  record("rec-test2-domain-logistics", "domain-tracker", "aubepine-logistique.test", { reference: "Registraire Exemple", expiresOn: "2027-08-01", details: { dnsProvider: "DNS Exemple", autoRenew: "Oui", registrant: "Aubépine Distribution fictive", nameservers: "Redirection vers aubepine-distribution.test" } }),
  record("rec-test2-ssl-wildcard", "ssl-tracker", "*.aubepine-distribution.test", { reference: "Autorité Exemple", expiresOn: "2027-05-20", details: { hosts: "*.aubepine-distribution.test\nerp.aubepine-distribution.test", serialNumber: "TEST2-SSL-001", renewalMethod: "Manuel", autoRenew: "Non", validationMethod: "DNS-01" } }),
  record("rec-test2-ssl-wms", "ssl-tracker", "wms.aubepine-distribution.test", { reference: "Autorité Exemple", expiresOn: "2027-07-14", details: { hosts: "wms.aubepine-distribution.test", serialNumber: "TEST2-SSL-002", renewalMethod: "Automatique", autoRenew: "Oui", validationMethod: "DNS-01" } }),
  record("rec-test2-doc-overview", "documents", "Vue d’ensemble technique Aubépine", { owner: "Camille Gagnon", expiresOn: "2027-01-15", details: { documentType: "Architecture", version: "1.0", classification: "Interne", content: "# Vue d’ensemble technique Aubépine\n\nArchitecture multisite fictive, contacts, criticités et chemins d’escalade.\n\n## Sites\n\n- Montréal : siège et salle de serveurs\n- Laval : entrepôt\n- Québec : bureau satellite" } }),
  record("rec-test2-doc-restore", "documents", "Procédure de restauration ERP", { owner: "Camille Gagnon", details: { documentType: "Procédure", version: "1.0", classification: "Restreint", content: "# Restauration ERP\n\n1. Valider l’incident et aviser Élodie Caron.\n2. Confirmer T2-MTL-SQL01 et T2-MTL-ERP01.\n3. Identifier le dernier point Veeam valide sur T2-MTL-BKP01.\n4. Restaurer en réseau isolé et valider DBCC.\n5. Faire valider par Opérations.\n6. Documenter RPO et RTO." } }),
  record("rec-test2-doc-wan", "documents", "Procédure panne Internet Montréal", { details: { documentType: "Procédure", version: "1.0", classification: "Interne", content: "# Panne Internet Montréal\n\n1. Vérifier alimentation et état WAN.\n2. Tester la passerelle.\n3. Appeler le fournisseur fictif.\n4. Communiquer l’état et valider le retour en service." } }),
  record("rec-test2-doc-onboarding", "documents", "Onboarding employé", { details: { documentType: "Procédure", version: "1.0", classification: "Interne", content: "# Onboarding\n\nApprobation RH, compte AD, licence M365, groupes, poste, MFA et validation du gestionnaire." } }),
  record("rec-test2-doc-offboarding", "documents", "Départ d’un employé", { details: { documentType: "Procédure", version: "1.0", classification: "Restreint", content: "# Départ d’un employé\n\nDésactivation, révocation des sessions, transfert des données, retrait VPN, récupération du matériel et validation RH." } }),
  record("rec-test2-doc-bcp", "documents", "Plan de continuité entrepôt", { details: { documentType: "Politique", version: "1.0", classification: "Interne", content: "# Continuité entrepôt\n\nScénarios : panne WAN, WMS, Wi-Fi ou impression d’étiquettes. Mode dégradé fictif sur formulaires papier." } }),
  record("rec-test2-check-backup", "checklists", "Revue mensuelle des sauvegardes", { checklist: [{ done: false, label: "Vérifier tous les jobs" }, { done: false, label: "Vérifier la copie immuable" }, { done: false, label: "Tester une restauration" }, { done: false, label: "Mettre à jour le rapport" }] }),
  record("rec-test2-check-admin", "checklists", "Revue trimestrielle des comptes administrateurs", { checklist: ["AD", "M365", "Pare-feu", "Hyperviseurs", "Sauvegardes"].map((label) => ({ done: false, label })) }),
  record("rec-test2-check-fw", "checklists", "Remplacement T2-QC-FW01", { owner: "Camille Gagnon", expiresOn: "2027-01-31", checklist: ["Soumission", "Configuration exportée", "Nouveau matériel préparé", "Fenêtre approuvée", "Migration", "Tests VPN", "Ancien matériel effacé"].map((label) => ({ done: false, label })) }),
];

const passwordSeed = [
  ["vault-test2-001", "T2-MTL-FW01 — admin local", "Réseau", "test2-fw-admin", "TEST2-FW!Az9-NotReal-2026", "https://10.77.10.1", "Rotation prévue 2027-01-06."],
  ["vault-test2-002", "T2-LAV-FW01 — admin local", "Réseau", "test2-fw-admin", "TEST2-LAV!Qx7-Fake-2026", "https://10.77.10.1", "Rotation prévue 2027-01-06."],
  ["vault-test2-003", "T2-QC-FW01 — admin local", "Réseau", "test2-fw-admin", "TEST2-QC!Lm8-Demo-2026", "https://10.77.20.1", "Rotation prévue 2027-01-06."],
  ["vault-test2-004", "Domaine AD — compte bris de glace", "Active Directory", "TEST2\\adm-breakglass", "TEST2-AD!BreakGlass-Factice#47", "", "Enveloppe physique fictive BG-01."],
  ["vault-test2-005", "T2-MTL-HV01 — root", "Virtualisation", "root", "TEST2-PVE!Hv01-Factice#88", "https://10.77.10.21:8006", "Secret fictif."],
  ["vault-test2-006", "T2-MTL-HV02 — root", "Virtualisation", "root", "TEST2-PVE!Hv02-Factice#89", "https://10.77.10.22:8006", "Secret fictif."],
  ["vault-test2-007", "T2-MTL-NAS01 — sauvegarde", "Sauvegarde", "test2-veeam-repo", "TEST2-NAS!Repo-Factice#26", "https://10.77.20.41:5001", "Secret fictif."],
  ["vault-test2-008", "WAN Montréal — portail fournisseur", "Fournisseur", "t2-aub-mtl@example.test", "TEST2-ISP!Portal-Factice#15", "https://portal.example.test", "Secret fictif."],
  ["vault-test2-009", "Imprimantes — compte SMTP scan", "Impression", "scan@example.test", "TEST2-SMTP!Scan-Factice#32", "", "Secret fictif."],
  ["vault-test2-010", "UPS Montréal — admin", "Infrastructure", "apc-admin", "TEST2-UPS!Apc-Factice#71", "https://10.77.10.61", "Secret fictif."],
  ["vault-test2-011", "Wi-Fi invité", "Sans-fil", "AUB-GUEST", "TEST2-Guest!WiFi-Factice#10", "", "Rotation mensuelle."],
  ["vault-test2-012", "API ERP de démonstration", "Application", "svc_atlas_demo", "TEST2-ERP!Api-Factice#64", "https://erp.aubepine-distribution.test/api", "Ne représente pas une vraie clé API."],
];

const relations = [
  relation("rel-test2-erp-app", "module:rec-test2-app-erp", "configuration:cfg-test2-mtl-erp01", "depends-on", "Dépend de", "Est requis par"),
  relation("rel-test2-erp-sql", "module:rec-test2-app-erp", "configuration:cfg-test2-mtl-sql01", "depends-on", "Dépend de", "Est requis par"),
  relation("rel-test2-erp-hv", "configuration:cfg-test2-mtl-erp01", "configuration:cfg-test2-mtl-hv02", "hosted-on", "Hébergé sur", "Héberge"),
  relation("rel-test2-sql-hv", "configuration:cfg-test2-mtl-sql01", "configuration:cfg-test2-mtl-hv02", "hosted-on", "Hébergé sur", "Héberge"),
  relation("rel-test2-dc02-hv", "configuration:cfg-test2-mtl-dc02", "configuration:cfg-test2-mtl-hv01", "hosted-on", "Hébergé sur", "Héberge"),
  relation("rel-test2-fs01-hv", "configuration:cfg-test2-mtl-fs01", "configuration:cfg-test2-mtl-hv01", "hosted-on", "Hébergé sur", "Héberge"),
  relation("rel-test2-bkp-sql", "module:rec-test2-backup-sql", "configuration:cfg-test2-mtl-sql01", "protected-by", "Protège", "Protégé par"),
  relation("rel-test2-bkp-server", "module:rec-test2-backup-sql", "configuration:cfg-test2-mtl-bkp01", "depends-on", "Dépend de", "Est requis par"),
  relation("rel-test2-bkp-nas", "configuration:cfg-test2-mtl-bkp01", "configuration:cfg-test2-mtl-nas01", "backed-up-to", "Sauvegardé vers", "Reçoit les sauvegardes de"),
  ...["common", "finance", "warehouse"].map((name) => relation(`rel-test2-share-${name}`, `module:rec-test2-share-${name}`, "configuration:cfg-test2-mtl-fs01", "hosted-on", "Hébergé sur", "Héberge")),
  relation("rel-test2-print-mtl", "module:rec-test2-print-mtl", "configuration:cfg-test2-mtl-fs01", "managed-with", "Administré avec", "Administre"),
  relation("rel-test2-print-lav", "module:rec-test2-print-lav", "configuration:cfg-test2-mtl-fs01", "managed-with", "Administré avec", "Administre"),
  relation("rel-test2-vpn-lav-mtl", "module:rec-test2-vpn-lav", "configuration:cfg-test2-mtl-fw01", "connected-to", "Connecté à", "Connecté à"),
  relation("rel-test2-vpn-lav-fw", "module:rec-test2-vpn-lav", "configuration:cfg-test2-lav-fw01", "connected-to", "Connecté à", "Connecté à"),
  relation("rel-test2-vpn-qc-mtl", "module:rec-test2-vpn-qc", "configuration:cfg-test2-mtl-fw01", "connected-to", "Connecté à", "Connecté à"),
  relation("rel-test2-vpn-qc-fw", "module:rec-test2-vpn-qc", "configuration:cfg-test2-qc-fw01", "connected-to", "Connecté à", "Connecté à"),
  relation("rel-test2-doc-restore-app", "module:rec-test2-doc-restore", "module:rec-test2-app-erp", "procedure-associated", "Procédure associée", "S’applique à"),
  relation("rel-test2-doc-restore-bkp", "module:rec-test2-doc-restore", "module:rec-test2-backup-sql", "procedure-associated", "Procédure associée", "S’applique à"),
  relation("rel-test2-doc-wan-circuit", "module:rec-test2-doc-wan", "module:rec-test2-wan-mtl", "procedure-associated", "Procédure associée", "S’applique à"),
  relation("rel-test2-doc-wan-fw", "module:rec-test2-doc-wan", "configuration:cfg-test2-mtl-fw01", "procedure-associated", "Procédure associée", "S’applique à"),
  relation("rel-test2-ssl-app", "module:rec-test2-ssl-wildcard", "module:rec-test2-app-erp", "protected-by", "Protège", "Protégé par"),
  relation("rel-test2-lic-m365", "module:rec-test2-lic-m365", "module:rec-test2-m365", "licensed-by", "Licence", "Licencié par"),
  relation("rel-test2-contact-elodie-site", "module:rec-test2-contact-elodie", "site:site-test2-mtl-hq", "related-to", "Associé à", "Associé à"),
  relation("rel-test2-contact-karim-site", "module:rec-test2-contact-karim", "site:site-test2-lav-wh", "related-to", "Associé à", "Associé à"),
  relation("rel-test2-contact-maude-site", "module:rec-test2-contact-maude", "site:site-test2-qc-br", "related-to", "Associé à", "Associé à"),
  ...[
    ["001", "configuration:cfg-test2-mtl-fw01"], ["002", "configuration:cfg-test2-lav-fw01"], ["003", "configuration:cfg-test2-qc-fw01"], ["004", "module:rec-test2-ad"],
    ["005", "configuration:cfg-test2-mtl-hv01"], ["006", "configuration:cfg-test2-mtl-hv02"], ["007", "configuration:cfg-test2-mtl-nas01"], ["008", "module:rec-test2-wan-mtl"],
    ["009", "module:rec-test2-print-mtl"], ["010", "configuration:cfg-test2-mtl-ups01"], ["011", "module:rec-test2-wifi-mtl"], ["012", "module:rec-test2-app-erp"],
  ].map(([suffix, targetRef]) => relation(`rel-test2-vault-${suffix}`, `vault:vault-test2-${suffix}`, targetRef, "managed-with", "Administré avec", "Administre")),
];

const relationshipEvents = relations.map((item, index) => ({ id: `rev-${item.id}-${String(index + 1).padStart(2, "0")}`, organizationId, relationId: item.id, at: generatedAt, actor: "Scénario aveugle TEST2", action: "Relation ajoutée", sourceRef: item.sourceRef, targetRef: item.targetRef, relationType: item.relationType, label: item.label }));

const store = await AtlasStore.open({ dataRoot, workspacePath, historyPath });
const document = store.readDocument();
if (!document?.data || !Number.isInteger(document.revision)) {
  store.close();
  throw new Error("Espace de travail Atlas absent ou invalide.");
}
if (document.data.organizations?.some((organization) => organization.id === organizationId)) {
  store.close();
  throw new Error("L’organisation TEST2 existe déjà; aucune donnée n’a été modifiée.");
}

const workspace = structuredClone(document.data);
for (const key of ["organizations", "sites", "configurations", "procedures", "relations", "relationshipEvents", "activities", "moduleRecords", "templates"]) {
  if (!Array.isArray(workspace[key])) workspace[key] = [];
}
workspace.organizations.push({
  id: organizationId, name: "[TEST2] Groupe Aubépine Distribution inc.", code: "T2-AUB", industry: "Distribution alimentaire spécialisée", owner: "Camille Gagnon (fictif)", status: "active",
  notes: "Migration M365 fictive terminée en septembre 2026. Remplacement du pare-feu de Québec prévu pour janvier 2027. Aucune donnée de ce dossier n’est réelle.",
  details: { displayName: "Aubépine Distribution", customerCriticality: "Élevée", employeeCount: "128", itUserCount: "117", timezone: "America/Toronto", serviceLanguage: "Français", accountManager: "Louis Fortin (fictif)", supportHours: "lun-ven 07:00-18:00, urgence 24/7" },
});
workspace.sites.push(...sites);
workspace.configurations.push(...configurations);
workspace.moduleRecords.push(...moduleRecords);
workspace.relations.push(...relations);
workspace.relationshipEvents.push(...relationshipEvents);
workspace.activities.unshift({ id: `act-test2-${Date.now()}`, organizationId, at: generatedAt, actor: "Scénario aveugle TEST2", action: "Jeu d’essai réaliste créé", target: "[TEST2] Groupe Aubépine Distribution inc.", kind: "qa" });
workspace.schemaVersion = Math.max(Number(workspace.schemaVersion) || 1, 5);
workspace.updatedAt = generatedAt;
workspace.settings = workspace.settings || {};
workspace.settings.test2BlindDataset = { id: "test2-blind-v1", organizationId, generatedAt, source: "docs/QA_TEST2_INVENTAIRE_AVEUGLE_2026-10-06.txt", counts: { sites: sites.length, configurations: configurations.length, moduleRecords: moduleRecords.length, passwords: passwordSeed.length, relations: relations.length } };

const currentVault = await readJson(vaultPath, { schemaVersion: 1, items: [] });
currentVault.items = Array.isArray(currentVault.items) ? currentVault.items : [];
if (currentVault.items.some((item) => item.organizationId === organizationId || item.id.startsWith("vault-test2-"))) {
  store.close();
  throw new Error("Des mots de passe TEST2 existent déjà; aucune donnée n’a été modifiée.");
}
const key = await getVaultKey();
const nextVault = structuredClone(currentVault);
for (const [id, title, category, username, password, url, notes] of passwordSeed) {
  nextVault.items.push({ id, organizationId, title, category, archived: false, createdAt: generatedAt, updatedAt: generatedAt, encrypted: encryptPayload({ username, password, url, notes: `DONNÉE FICTIVE TEST2. ${notes}`, otpSecret: "" }, key) });
}

const candidateDocument = { revision: document.revision + 1, data: workspace };
const encodedBytes = Buffer.byteLength(JSON.stringify(candidateDocument), "utf8");
if (encodedBytes > 96 * 1024 * 1024) {
  store.close();
  throw new Error(`Le jeu TEST2 dépasserait la limite de sécurité (${encodedBytes} octets); aucune donnée n’a été modifiée.`);
}

const backupDirectory = path.join(dataRoot, "qa-backups");
await mkdir(backupDirectory, { recursive: true });
const backupBase = `before-test2-blind-${stamp()}`;
const workspaceBackupPath = path.join(backupDirectory, `${backupBase}-workspace.json`);
const vaultBackupPath = path.join(backupDirectory, `${backupBase}-vault.json`);
await writeFile(workspaceBackupPath, `${JSON.stringify(document, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
await writeFile(vaultBackupPath, `${JSON.stringify(currentVault, null, 2)}\n`, { encoding: "utf8", flag: "wx" });

let nextDocument;
try {
  await writeJsonAtomic(vaultPath, nextVault);
  nextDocument = store.commitDocument(document.revision, workspace, "Scénario aveugle TEST2", "test2-blind-seeded");
  await writeJsonAtomic(historyPath, { schemaVersion: 2, entries: store.historyDocuments(200) });
  await writeJsonAtomic(workspacePath, nextDocument);
} catch (error) {
  await writeJsonAtomic(vaultPath, currentVault).catch(() => {});
  store.close();
  throw error;
}
store.close();

console.log(JSON.stringify({
  organization: organizationId,
  revision: nextDocument.revision,
  bytes: encodedBytes,
  backups: { workspace: workspaceBackupPath, vault: vaultBackupPath },
  created: workspace.settings.test2BlindDataset.counts,
}));
