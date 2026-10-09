(() => {
  "use strict";

  const app = document.getElementById("app");
  const pwaInstallRoot = document.getElementById("pwa-install-root");
  const overlayRoot = document.getElementById("overlay-root");
  const ATLAS_VERSION = "0.15.0";
  const helpCatalog = window.ATLAS_HELP_CATALOG || { categories: [], articles: [] };
  const storageKeys = {
    theme: "trc-atlas-theme",
    locale: "trc-atlas-locale",
    modules: "trc-atlas-modules",
    dashboardTests: "trc-atlas-dashboard-tests",
    pwaInstallDismissedUntil: "trc-atlas-pwa-install-dismissed-until",
  };

  const translations = {
    fr: {
      dashboard: "Vue d’ensemble",
      organizations: "Organisations",
      sites: "Sites",
      configurations: "Configurations",
      procedures: "Procédures",
      relations: "Relations",
      activity: "Activité",
      settings: "Paramètres",
      documentation: "Documentation",
      structure: "Structure",
      workspace: "Espace de travail",
      instance: "Instance locale",
      search: "Rechercher organisations, configurations, procédures…",
      create: "Créer",
      save: "Enregistrer",
      cancel: "Annuler",
      close: "Fermer",
      edit: "Modifier",
      view: "Ouvrir",
      all: "Tous",
      status: "État",
      owner: "Responsable",
      location: "Emplacement",
      organization: "Organisation",
      site: "Site",
      type: "Type",
      criticality: "Criticité",
      lastReview: "Dernière révision",
      warranty: "Garantie",
      overview: "Aperçu",
      signOut: "Déconnexion",
      localOnly: "100 % local · aucune télémétrie",
      notConfigured: "Non configuré",
      connected: "Configuré",
      addOrganization: "Nouvelle organisation",
      addSite: "Nouveau site",
      addConfiguration: "Nouvelle configuration",
      addProcedure: "Nouvelle procédure",
      empty: "Aucun élément ne correspond à cette vue.",
      saved: "Modifications enregistrées localement.",
      rmmOpen: "Ouvrir dans le RMM",
      noRmm: "Le raccordement RMM n’est pas configuré dans cette instance.",
      language: "Langue",
      appearance: "Apparence",
      integrations: "Intégrations",
      general: "Général",
      security: "Sécurité locale",
    },
    en: {
      dashboard: "Overview",
      organizations: "Organizations",
      sites: "Sites",
      configurations: "Configurations",
      procedures: "Procedures",
      relations: "Relations",
      activity: "Activity",
      settings: "Settings",
      documentation: "Documentation",
      structure: "Structure",
      workspace: "Workspace",
      instance: "Local instance",
      search: "Search organizations, configurations, procedures…",
      create: "Create",
      save: "Save",
      cancel: "Cancel",
      close: "Close",
      edit: "Edit",
      view: "Open",
      all: "All",
      status: "Status",
      owner: "Owner",
      location: "Location",
      organization: "Organization",
      site: "Site",
      type: "Type",
      criticality: "Criticality",
      lastReview: "Last review",
      warranty: "Warranty",
      overview: "Overview",
      signOut: "Sign out",
      localOnly: "100% local · no telemetry",
      notConfigured: "Not configured",
      connected: "Configured",
      addOrganization: "New organization",
      addSite: "New site",
      addConfiguration: "New configuration",
      addProcedure: "New procedure",
      empty: "No item matches this view.",
      saved: "Changes saved locally.",
      rmmOpen: "Open in RMM",
      noRmm: "RMM is not configured for this instance.",
      language: "Language",
      appearance: "Appearance",
      integrations: "Integrations",
      general: "General",
      security: "Local security",
    },
  };

  const state = {
    phase: "loading",
    status: null,
    user: null,
    csrf: "",
    sessionExpiresAt: 0,
    vaultUnlockedUntil: 0,
    authNotice: "",
    workspace: null,
    revision: 0,
    locale: localStorage.getItem(storageKeys.locale) === "en" ? "en" : "fr",
    theme: localStorage.getItem(storageKeys.theme) === "dark" ? "dark" : "light",
    page: "dashboard",
    detailId: null,
    recordId: null,
    filter: "all",
    search: "",
    searchScope: "global",
    searchScopeOpen: false,
    searchScopeQuery: "",
    organizationSearch: "",
    mobileNavigation: false,
    saving: false,
    pendingMfaToken: "",
    mfaSecret: "",
    mfaUri: "",
    recoveryCodes: [],
    users: [],
    sessions: [],
    auditEntries: [],
    pendingPrivilegedAction: null,
    visibleModuleIds: new Set(),
    collapsedNavGroups: new Set(["custom", "tools"]),
    moduleSearch: "",
    sidebarModuleSearch: "",
    sidebarScrollTop: 0,
    preserveSidebarScroll: false,
    listSearch: "",
    listStatus: "all",
    listPage: 1,
    vaultItems: [],
    attachments: [],
    attachmentEvents: [],
    workspaceHistory: [],
    assetRevisions: {},
    revealedVaultItem: null,
    visibleVaultFields: new Set(),
    pendingVaultReveal: "",
    activeTemplate: null,
    relationOrganization: "all",
    relationImpactRef: "",
    relationPresetRef: "",
    relationQuickAddRef: "",
    relationQuickQuery: "",
    relationQuickType: "related-to",
    relationQuickFiltersOpen: false,
    dashboardIncludeTests: localStorage.getItem(storageKeys.dashboardTests) === "true",
    helpMenuOpen: false,
    helpSearch: "",
    helpCategory: "all",
    deploymentHealth: null,
    deploymentProbe: null,
    deploymentPortProbe: null,
    deploymentHealthLoading: false,
    backupStatus: null,
    backupLoading: false,
    updateStatus: null,
    updateLoading: false,
    localApiStatus: null,
    localApiLoading: false,
    createdApiToken: "",
    createdWebhookSecret: "",
    importPreview: null,
  };

  let sessionExpiryTimer = null;
  let deferredInstallPrompt = null;
  let pwaInstalledThisVisit = false;

  const relationshipTypes = [
    { id: "depends-on", label: "Dépend de", reverseLabel: "Est requis par", directional: true },
    { id: "managed-with", label: "Administré avec", reverseLabel: "Administre", directional: true },
    { id: "protected-by", label: "Protégé par", reverseLabel: "Protège", directional: true },
    { id: "backed-up-to", label: "Sauvegardé vers", reverseLabel: "Reçoit les sauvegardes de", directional: true },
    { id: "procedure-associated", label: "Procédure associée", reverseLabel: "S'applique à", directional: false },
    { id: "hosted-on", label: "Hébergé sur", reverseLabel: "Héberge", directional: true },
    { id: "connected-to", label: "Connecté à", reverseLabel: "Connecté à", directional: false },
    { id: "supplied-by", label: "Fourni par", reverseLabel: "Fournit", directional: true },
    { id: "licensed-by", label: "Licencié par", reverseLabel: "Licence", directional: true },
    { id: "mentions", label: "Mentionne", reverseLabel: "Est mentionné par", directional: true },
    { id: "related-to", label: "Associé à", reverseLabel: "Associé à", directional: false },
    { id: "custom", label: "Relation personnalisée", reverseLabel: "Relation personnalisée", directional: false },
  ];

  const FILE_SHARING_MODULE_ID = "service-file-sharing";
  const PRINTING_MODULE_ID = "service-printing";

  const navItems = [
    ["workspace", "dashboard", "grid", "dashboard"],
    ["structure", "organizations", "building", "organizations"],
    ["structure", "sites", "pin", "sites"],
    ["documentation", "configurations", "server", "configurations"],
    ["documentation", "procedures", "book", "procedures"],
    ["documentation", "relations", "link", "relations"],
    ["workspace", "activity", "activity", "activity"],
    ["workspace", "settings", "settings", "settings"],
  ];

  const coreModules = [
    { id: "configurations", label: "Configurations", icon: "server", route: "configurations", description: "Appareils, services et actifs techniques documentés." },
    { id: "checklists", label: "Checklists", icon: "check", description: "Listes de contrôle réutilisables et suivies." },
    { id: "contacts", label: "Contacts", icon: "users", description: "Contacts techniques, administratifs et fournisseurs." },
    { id: "documents", label: "Documents", icon: "book", description: "Documents, guides, politiques et notes structurées." },
    { id: "technical-account-load", label: "Charge de compte technique", icon: "users", description: "Responsabilités et charge des comptes techniques." },
    { id: "domain-tracker", label: "Domain Tracker", icon: "globe", description: "Domaines, registraires et dates de renouvellement." },
    { id: "locations", label: "Locations", icon: "pin", route: "sites", description: "Emplacements physiques ou logiques des organisations." },
    { id: "passwords", label: "Passwords", icon: "key", description: "Références de coffre; aucun secret n’est conservé en clair." },
    { id: "ssl-tracker", label: "SSL Tracker", icon: "lock", description: "Certificats TLS, hôtes et échéances." },
  ].map((module) => ({ ...module, group: "core" }));

  const appServiceModules = [
    ["Accès conditionnels (M365)", "shield"], ["Active Directory", "network"], ["Antivirus", "shield"],
    ["Antivirus géré par 2BUP - Bitdefender ou SentinelOne", "shield"], ["Applications", "grid"], ["Backup", "refresh"],
    ["Email", "mail"], ["File Sharing", "file"], ["LAN", "network"], ["Licensing", "key"], ["Internet/WAN", "globe"],
    ["Printing", "printer"], ["Remote Access", "external"], ["Résumé du client", "book"], ["Security", "lock"],
    ["Sharepoint/Teams", "users"], ["Surveillance 2BUP", "activity"], ["Site Summary", "pin"], ["Vendors", "building"],
    ["Virtualization", "server"], ["Voice/PBX", "phone"], ["Wireless", "wifi"],
  ].map(([label, iconName]) => ({ id: `service-${slug(label)}`, label, icon: iconName, group: "services", description: `Documentation structurée pour ${label}.` }));

  const customModuleLabels = [
    "!Info de base", "ATA", "AWS Instance", "Access Point", "Account Management", "Alarme", "Antenne", "AntiSpam", "Antivirus", "Automate", "Autotask Default",
    "Azure - Virtual network gateway", "Azure Instance Serveur", "Azure Virtual Desktop", "Backup", "CNC", "CW SC Partner Server", "Camera", "Change Control Request", "Changelogs", "Cloud", "Cloud Key",
    "Composant réseau", "Connexion Internet", "Console de Gestion", "Container", "Controle de ventilation", "Controleur d'accès", "Datto Appliance", "Datto Asset", "Digital Signage",
    "Digital Video Recorder (DVR)", "Documents", "Email", "Exchange", "Exchange Server", "FAI (Fournisseur d'Accès Internet)", "Field-Effect Appliance", "Firewall", "FortiAP", "FortiAuthenticator",
    "Fortimail", "Hypervisor", "Hébergement", "ILO", "Imprimante", "Information de sécurité", "KVM", "Laptop", "Laptop - Apple", "Laptop - Windows", "License", "Logiciel",
    "Machine Distributrice", "Machine Outil", "Magasin Korvette", "Managed Server", "Managed Workstation", "Messagerie", "Microsoft 365", "NAS", "Network Audio Media", "Network Camera",
    "Network Device (Other)", "Networks", "Non AD Item", "Ordinateur", "Ordinateur virtuel", "Ordinateurs", "Other", "Outil de contrôle à distance", "PBX IP", "PDU", "Paid Terminal",
    "Pare-feu et Routeur", "Peripheral", "Phone System", "Point-to-Point AP", "Portable", "Poste Usine", "Printer", "Probe ARS", "Probe Virtuel", "Proxmox", "Punch Clock", "QNAP", "RDS",
    "Renewal", "Router", "Router / Firewall", "SAN", "SAN/NAS", "SQL", "SQL Server", "Sales/Finance", "Salle de serveur", "Sauvegarde 2BBACK", "Scanner", "Server", "Servers - ESXi",
    "Servers - Generic", "Servers - Management Interface", "Servers - Proxmox", "Servers - Windows", "Serveur GMF", "Serveur Linux 2BBACK", "Serveur Veeam 2BBACK", "Serveur physique",
    "Serveur virtuel", "Serveurs", "Site Internet", "Site to site tunnel (Phase1)", "Site to site tunnel (Phase2)", "Smartphone", "Ssl", "Storage", "Switch", "Switch Stack", "Switch réseau",
    "Switch/Router", "TV Signage", "Tablet", "Technicien attribué", "Techniciens Secondaires", "Telephone", "Thin", "Time Punch Clocks", "UPS", "UPS (uninterruptible power supply)",
    "Unité de stockage", "User Groups", "VOIP Phone", "VPN", "Video Conference", "Virtualisation", "Virtualization - VDI", "Vm", "WatchGuard Firebox", "Web Cam", "Website", "Wifi",
    "Wifi Booster", "Windows Server", "Wireless Controler", "Wireless Router", "Workstation", "Workstations - Windows", "msBackup",
  ];

  const customModules = customModuleLabels.map((label) => ({ id: `custom-${slug(label)}`, label, icon: moduleIcon(label), group: "custom", description: `Type de documentation personnalisé : ${label}.` }));
  const builtInModuleDefinitions = [...coreModules, ...appServiceModules, ...customModules];
  let moduleDefinitions = [...builtInModuleDefinitions];
  const moduleMap = new Map(moduleDefinitions.map((module) => [module.id, module]));
  const defaultVisibleModuleIds = coreModules.map((module) => module.id);

  const moduleProfileCatalog = {
    generic: {
      listLabel: "Fiche", titleLabel: "Nom de la fiche", referenceLabel: "URL ou référence", ownerLabel: "Responsable", expiryLabel: "Échéance",
      fields: [
        { key: "category", label: "Catégorie", placeholder: "Type ou catégorie" },
        { key: "environment", label: "Environnement", type: "select", options: ["", "Production", "Préproduction", "Test", "Développement", "Interne"] },
        { key: "vendor", label: "Fabricant ou fournisseur" },
        { key: "model", label: "Modèle ou référence" },
        { key: "assetIdentifier", label: "Identifiant interne" },
        { key: "operationalRole", label: "Rôle opérationnel", span: 2 },
        { key: "supportInformation", label: "Soutien et maintenance", type: "textarea", rows: 3, span: 2 },
        { key: "lifecycle", label: "Cycle de vie", type: "select", options: ["", "Planifié", "En service", "En maintenance", "En retrait", "Retiré"] },
      ],
    },
    contacts: {
      listLabel: "Contact", titleLabel: "Nom complet", referenceLabel: "Courriel principal", ownerLabel: "Responsable interne", expiryLabel: "Prochaine révision",
      fields: [
        { key: "phone", label: "Téléphone", type: "tel", placeholder: "+1 514…" },
        { key: "role", label: "Fonction", placeholder: "Responsable TI, facturation…" },
        { key: "company", label: "Entreprise ou service" },
        { key: "preferredChannel", label: "Canal privilégié", type: "select", options: ["", "Courriel", "Téléphone", "Teams", "Portail"] },
        { key: "decisionMaker", label: "Décisionnaire", type: "select", options: ["", "Oui", "Non"] },
        { key: "emergencyContact", label: "Contact d’urgence", type: "select", options: ["", "Oui", "Non"] },
        { key: "dataSensitivity", label: "Responsabilité ou données sensibles", placeholder: "RH, finances, santé…", span: 2 },
      ],
    },
    documents: {
      listLabel: "Document", titleLabel: "Titre du document", referenceLabel: "URL ou emplacement", ownerLabel: "Propriétaire", expiryLabel: "Révision prévue",
      fields: [
        { key: "documentType", label: "Type de document", type: "select", options: ["Procédure", "Guide", "Politique", "Architecture", "Contrat", "Note", "Autre"] },
        { key: "version", label: "Version", placeholder: "1.0" },
        { key: "classification", label: "Classification", type: "select", options: ["Interne", "Confidentiel", "Public", "Restreint"] },
        { key: "content", label: "Contenu du document", type: "document", rows: 20, span: 2, section: true, placeholder: "Structurez le document avec les titres, listes, tableaux, liens, blocs de code et mentions Atlas…" },
      ],
    },
    workload: {
      listLabel: "Affectation", titleLabel: "Technicien ou équipe", referenceLabel: "Rôle principal", ownerLabel: "Gestionnaire", expiryLabel: "Prochaine revue de charge",
      fields: [
        { key: "weeklyHours", label: "Charge hebdomadaire prévue", type: "number", min: "0", max: "168", placeholder: "Heures" },
        { key: "primaryScope", label: "Portée principale", placeholder: "Infrastructure, M365, sécurité…" },
        { key: "backupTechnician", label: "Relève désignée" },
        { key: "escalation", label: "Chemin d’escalade" },
      ],
    },
    domain: {
      listLabel: "Domaine", titleLabel: "Nom de domaine", referenceLabel: "Registraire", ownerLabel: "Responsable", expiryLabel: "Date d’expiration", renewal: true, referenceRequired: true, expiryRequired: true,
      fields: [
        { key: "dnsProvider", label: "Fournisseur DNS", placeholder: "Cloudflare, Route 53…" },
        { key: "autoRenew", label: "Renouvellement automatique", type: "select", options: ["", "Oui", "Non", "À confirmer"] },
        { key: "registrant", label: "Titulaire du domaine" },
        { key: "authCodeLocation", label: "Emplacement du code d’autorisation", placeholder: "Référence seulement — aucun secret" },
        { key: "nameservers", label: "Serveurs de noms", type: "textarea", rows: 4, span: 2, placeholder: "Un serveur de noms par ligne" },
      ],
    },
    certificate: {
      listLabel: "Certificat", titleLabel: "Nom commun ou certificat", referenceLabel: "Émetteur", ownerLabel: "Responsable", expiryLabel: "Date d’expiration", renewal: true, referenceRequired: true, expiryRequired: true,
      fields: [
        { key: "hosts", label: "Hôtes couverts", type: "textarea", rows: 4, span: 2, placeholder: "Un hôte ou SAN par ligne" },
        { key: "serialNumber", label: "Numéro de série" },
        { key: "renewalMethod", label: "Méthode de renouvellement", placeholder: "ACME, manuel, fournisseur…" },
        { key: "autoRenew", label: "Renouvellement automatique", type: "select", options: ["", "Oui", "Non", "À confirmer"] },
        { key: "validationMethod", label: "Validation", type: "select", options: ["", "DNS-01", "HTTP-01", "TLS-ALPN-01", "Manuelle"] },
      ],
    },
    backup: {
      listLabel: "Sauvegarde", titleLabel: "Tâche ou politique", referenceLabel: "Plateforme", ownerLabel: "Responsable", expiryLabel: "Prochain test de restauration",
      fields: [
        { key: "source", label: "Source sauvegardée" },
        { key: "target", label: "Destination" },
        { key: "schedule", label: "Horaire", placeholder: "Chaque jour à 22 h" },
        { key: "retention", label: "Rétention", placeholder: "30 jours + 12 mois" },
        { key: "lastRestoreTest", label: "Dernier test de restauration", type: "date" },
        { key: "encryption", label: "Chiffrement", type: "select", options: ["", "Activé", "Non", "À confirmer"] },
        { key: "rpo", label: "Objectif RPO", placeholder: "15 min, 24 h…" },
        { key: "rto", label: "Objectif RTO", placeholder: "4 h, 8 h…" },
        { key: "immutability", label: "Copie immuable", type: "select", options: ["", "Oui", "Non", "À confirmer"] },
        { key: "lastResult", label: "Résultat du dernier contrôle", placeholder: "Réussi, avertissement…" },
      ],
    },
    activeDirectory: {
      listLabel: "Annuaire", titleLabel: "Domaine Active Directory", referenceLabel: "Nom DNS du domaine", ownerLabel: "Responsable annuaire", expiryLabel: "Prochaine révision",
      fields: [
        { key: "functionalLevel", label: "Niveau fonctionnel" },
        { key: "upnSuffix", label: "Suffixe UPN principal" },
        { key: "domainControllers", label: "Contrôleurs de domaine", type: "textarea", rows: 3, span: 2, placeholder: "Un contrôleur par ligne" },
        { key: "directorySync", label: "Synchronisation infonuagique", placeholder: "Entra Connect, Cloud Sync…" },
        { key: "syncServer", label: "Serveur de synchronisation" },
        { key: "organizationalUnits", label: "Unités d’organisation principales", type: "textarea", rows: 4, span: 2, placeholder: "Une OU par ligne" },
        { key: "criticalGroups", label: "Groupes critiques", type: "textarea", rows: 4, span: 2, placeholder: "Un groupe par ligne" },
      ],
    },
    microsoft365: {
      listLabel: "Tenant", titleLabel: "Nom du tenant Microsoft 365", referenceLabel: "Domaine onmicrosoft", ownerLabel: "Responsable M365", expiryLabel: "Prochaine révision",
      fields: [
        { key: "acceptedDomains", label: "Domaines acceptés", type: "textarea", rows: 3, span: 2, placeholder: "Un domaine par ligne" },
        { key: "licenses", label: "Licences attribuées", type: "textarea", rows: 4, span: 2, placeholder: "Produit, quantité et usage" },
        { key: "globalAdmins", label: "Administrateurs globaux", type: "number", min: "0" },
        { key: "mfaPolicy", label: "Politique MFA", type: "select", options: ["", "Obligatoire pour tous", "Obligatoire pour les administrateurs", "Partielle", "Non", "À confirmer"] },
        { key: "conditionalAccess", label: "Accès conditionnel", type: "textarea", rows: 4, span: 2, placeholder: "Politiques principales et exclusions approuvées" },
        { key: "services", label: "Services documentés", type: "textarea", rows: 4, span: 2, placeholder: "Exchange, SharePoint, Teams, OneDrive…" },
      ],
    },
    wan: {
      listLabel: "Circuit Internet", titleLabel: "Nom du circuit", referenceLabel: "Numéro de circuit ou compte", ownerLabel: "Responsable", expiryLabel: "Renouvellement / révision",
      fields: [
        { key: "provider", label: "Fournisseur" },
        { key: "bandwidth", label: "Débit", placeholder: "1 Gbit/s symétrique" },
        { key: "wanIp", label: "Adresse ou bloc WAN" },
        { key: "gateway", label: "Passerelle" },
        { key: "dnsServers", label: "Serveurs DNS", type: "textarea", rows: 3, span: 2, placeholder: "Un serveur par ligne" },
        { key: "sla", label: "SLA / délai d’intervention" },
        { key: "outagePhone", label: "Téléphone de panne", type: "tel" },
      ],
    },
    vpn: {
      listLabel: "Tunnel VPN", titleLabel: "Nom du tunnel", referenceLabel: "Identifiant ou pair distant", ownerLabel: "Responsable réseau", expiryLabel: "Prochaine révision",
      fields: [
        { key: "vpnType", label: "Type", type: "select", options: ["", "IPsec IKEv2", "IPsec IKEv1", "SSL VPN", "WireGuard", "Autre"] },
        { key: "endpointA", label: "Extrémité A" },
        { key: "endpointB", label: "Extrémité B" },
        { key: "localNetworks", label: "Réseaux locaux", type: "textarea", rows: 3, span: 2 },
        { key: "remoteNetworks", label: "Réseaux distants", type: "textarea", rows: 3, span: 2 },
        { key: "encryption", label: "Chiffrement" },
        { key: "dhGroup", label: "Groupe DH / PFS" },
        { key: "monitoring", label: "Supervision", type: "select", options: ["", "Oui", "Non", "À confirmer"] },
      ],
    },
    wireless: {
      listLabel: "Réseau sans-fil", titleLabel: "Nom du réseau ou contrôleur", referenceLabel: "Portail ou adresse de gestion", ownerLabel: "Responsable réseau", expiryLabel: "Prochaine révision",
      fields: [
        { key: "ssids", label: "SSID", type: "textarea", rows: 3, span: 2, placeholder: "Un SSID par ligne; ne saisissez pas les mots de passe ici" },
        { key: "controller", label: "Contrôleur / plateforme" },
        { key: "security", label: "Sécurité", placeholder: "WPA3-Enterprise, WPA2…" },
        { key: "guestAccess", label: "Accès invité", type: "select", options: ["", "Isolé", "Captif", "Non offert", "À confirmer"] },
        { key: "coverage", label: "Zone couverte", span: 2 },
      ],
    },
    virtualization: {
      listLabel: "Plateforme", titleLabel: "Nom de la plateforme ou du cluster", referenceLabel: "Adresse de gestion", ownerLabel: "Responsable", expiryLabel: "Prochaine révision",
      fields: [
        { key: "platform", label: "Plateforme", placeholder: "Proxmox VE, Hyper-V, VMware…" },
        { key: "version", label: "Version" },
        { key: "cluster", label: "Cluster" },
        { key: "highAvailability", label: "Haute disponibilité", type: "select", options: ["", "Oui", "Non", "À confirmer"] },
        { key: "hosts", label: "Hôtes", type: "textarea", rows: 3, span: 2, placeholder: "Un hôte par ligne" },
        { key: "storage", label: "Stockage partagé ou local", type: "textarea", rows: 3, span: 2 },
      ],
    },
    application: {
      listLabel: "Application", titleLabel: "Nom de l’application", referenceLabel: "URL ou identifiant", ownerLabel: "Propriétaire métier", expiryLabel: "Prochaine révision",
      fields: [
        { key: "vendor", label: "Éditeur / fournisseur" },
        { key: "hosting", label: "Hébergement", placeholder: "SaaS, local, hybride…" },
        { key: "authentication", label: "Authentification", placeholder: "Active Directory, Entra ID, locale…" },
        { key: "dataClassification", label: "Classification des données", type: "select", options: ["", "Publique", "Interne", "Confidentielle", "Restreinte"] },
        { key: "dependencies", label: "Dépendances techniques", type: "textarea", rows: 4, span: 2, placeholder: "Utilisez aussi les relations Atlas pour rendre les liens navigables" },
        { key: "supportContact", label: "Contact de soutien" },
        { key: "serviceLevel", label: "SLA / priorité" },
      ],
    },
    ups: {
      listLabel: "UPS", titleLabel: "Nom de l’UPS", referenceLabel: "Adresse de gestion", ownerLabel: "Responsable", expiryLabel: "Prochain entretien",
      fields: [
        { key: "manufacturer", label: "Fabricant" },
        { key: "model", label: "Modèle" },
        { key: "serialNumber", label: "Numéro de série" },
        { key: "capacity", label: "Capacité", placeholder: "6000 VA" },
        { key: "ipAddress", label: "Adresse IP" },
        { key: "lastBatteryTest", label: "Dernier test des batteries", type: "date" },
        { key: "batteryReplacement", label: "Remplacement prévu", type: "date" },
      ],
    },
    licensing: {
      listLabel: "Licence", titleLabel: "Produit ou abonnement", referenceLabel: "Fournisseur / contrat", ownerLabel: "Responsable", expiryLabel: "Renouvellement", renewal: true,
      fields: [
        { key: "vendor", label: "Fournisseur" },
        { key: "seats", label: "Quantité de licences", type: "number", min: "0" },
        { key: "renewalType", label: "Cycle", type: "select", options: ["", "Mensuel", "Annuel", "Pluriannuel", "Perpétuel"] },
        { key: "costCenter", label: "Centre de coûts" },
      ],
    },
    network: {
      listLabel: "Équipement ou réseau", titleLabel: "Nom technique", referenceLabel: "Adresse de gestion", ownerLabel: "Responsable", expiryLabel: "Prochaine révision",
      fields: [
        { key: "manufacturer", label: "Fabricant" },
        { key: "model", label: "Modèle" },
        { key: "serialNumber", label: "Numéro de série" },
        { key: "ipAddress", label: "Adresse IP" },
        { key: "vlan", label: "VLAN / segment" },
        { key: "firmware", label: "Micrologiciel" },
      ],
    },
    server: {
      listLabel: "Serveur", titleLabel: "Nom d’hôte", referenceLabel: "Adresse de gestion", ownerLabel: "Responsable infrastructure", expiryLabel: "Prochaine révision",
      fields: [
        { key: "manufacturer", label: "Fabricant" },
        { key: "model", label: "Modèle" },
        { key: "serialNumber", label: "Numéro de série" },
        { key: "operatingSystem", label: "Système d’exploitation" },
        { key: "ipAddress", label: "Adresse IP" },
        { key: "managementInterface", label: "Interface de gestion", placeholder: "iLO, iDRAC, IPMI…" },
        { key: "processor", label: "Processeur(s)" },
        { key: "memory", label: "Mémoire" },
        { key: "storageLayout", label: "Stockage et RAID", type: "textarea", rows: 3, span: 2 },
        { key: "roles", label: "Rôles et services", type: "textarea", rows: 3, span: 2 },
        { key: "patchPolicy", label: "Politique de mises à jour" },
        { key: "backupPolicy", label: "Politique de sauvegarde" },
      ],
    },
    workstation: {
      listLabel: "Poste", titleLabel: "Nom du poste", referenceLabel: "Numéro d’actif ou adresse", ownerLabel: "Utilisateur ou responsable", expiryLabel: "Renouvellement prévu",
      fields: [
        { key: "manufacturer", label: "Fabricant" },
        { key: "model", label: "Modèle" },
        { key: "serialNumber", label: "Numéro de série" },
        { key: "assetTag", label: "Numéro d’actif" },
        { key: "assignedUser", label: "Utilisateur attribué" },
        { key: "operatingSystem", label: "Système d’exploitation" },
        { key: "ipAddress", label: "Adresse IP" },
        { key: "macAddress", label: "Adresse MAC" },
        { key: "encryption", label: "Chiffrement", type: "select", options: ["", "Activé", "Non", "À confirmer"] },
        { key: "endpointProtection", label: "Protection EDR / antivirus" },
        { key: "warrantyEnd", label: "Fin de garantie", type: "date" },
        { key: "management", label: "Gestion", placeholder: "Intune, RMM, MDM…" },
      ],
    },
    storage: {
      listLabel: "Stockage", titleLabel: "Nom du stockage", referenceLabel: "Adresse de gestion", ownerLabel: "Responsable stockage", expiryLabel: "Prochaine révision",
      fields: [
        { key: "manufacturer", label: "Fabricant" },
        { key: "model", label: "Modèle" },
        { key: "serialNumber", label: "Numéro de série" },
        { key: "ipAddress", label: "Adresse IP" },
        { key: "protocols", label: "Protocoles", placeholder: "SMB, NFS, iSCSI, FC…" },
        { key: "usableCapacity", label: "Capacité utilisable" },
        { key: "raidLayout", label: "RAID / pools", type: "textarea", rows: 3, span: 2 },
        { key: "firmware", label: "Micrologiciel" },
        { key: "replication", label: "Réplication" },
        { key: "snapshotPolicy", label: "Politique de snapshots", span: 2 },
      ],
    },
    database: {
      listLabel: "Base de données", titleLabel: "Instance ou service", referenceLabel: "Hôte et port", ownerLabel: "Responsable des données", expiryLabel: "Prochaine révision",
      fields: [
        { key: "engine", label: "Moteur", placeholder: "SQL Server, PostgreSQL, MySQL…" },
        { key: "version", label: "Version" },
        { key: "host", label: "Hôte" },
        { key: "port", label: "Port", type: "number", min: "1", max: "65535" },
        { key: "instances", label: "Bases ou instances", type: "textarea", rows: 3, span: 2 },
        { key: "highAvailability", label: "Haute disponibilité" },
        { key: "backupPolicy", label: "Sauvegarde" },
        { key: "maintenancePlan", label: "Plan d’entretien", span: 2 },
        { key: "dataClassification", label: "Classification des données", type: "select", options: ["", "Publique", "Interne", "Confidentielle", "Restreinte"] },
      ],
    },
    securityAppliance: {
      listLabel: "Équipement de sécurité", titleLabel: "Nom de l’équipement", referenceLabel: "Adresse de gestion", ownerLabel: "Responsable sécurité", expiryLabel: "Renouvellement du soutien",
      fields: [
        { key: "manufacturer", label: "Fabricant" },
        { key: "model", label: "Modèle" },
        { key: "serialNumber", label: "Numéro de série" },
        { key: "ipAddress", label: "Adresse de gestion" },
        { key: "firmware", label: "Version / micrologiciel" },
        { key: "haRole", label: "Rôle haute disponibilité" },
        { key: "subscription", label: "Abonnement de sécurité" },
        { key: "managementPlatform", label: "Plateforme de gestion" },
        { key: "protectedScope", label: "Portée protégée", type: "textarea", rows: 3, span: 2 },
        { key: "loggingTarget", label: "Journalisation / SIEM" },
      ],
    },
    securityPlatform: {
      listLabel: "Contrôle de sécurité", titleLabel: "Nom du contrôle ou de la plateforme", referenceLabel: "Portail ou identifiant", ownerLabel: "Responsable sécurité", expiryLabel: "Prochaine révision",
      fields: [
        { key: "vendor", label: "Fournisseur" },
        { key: "product", label: "Produit / offre" },
        { key: "protectedScope", label: "Portée protégée", type: "textarea", rows: 3, span: 2 },
        { key: "policyMode", label: "Mode de politique", placeholder: "Prévention, audit, blocage…" },
        { key: "alertRouting", label: "Acheminement des alertes" },
        { key: "logging", label: "Journalisation et rétention" },
        { key: "exceptions", label: "Exceptions approuvées", type: "textarea", rows: 3, span: 2 },
        { key: "reviewCadence", label: "Fréquence de révision" },
      ],
    },
    telephony: {
      listLabel: "Téléphonie", titleLabel: "Système ou appareil", referenceLabel: "Numéro, extension ou portail", ownerLabel: "Responsable téléphonie", expiryLabel: "Prochaine révision",
      fields: [
        { key: "vendor", label: "Fournisseur" },
        { key: "platform", label: "Plateforme" },
        { key: "mainNumber", label: "Numéro principal", type: "tel" },
        { key: "sipProvider", label: "Fournisseur SIP" },
        { key: "extensions", label: "Plage d’extensions" },
        { key: "emergencyRouting", label: "Acheminement d’urgence", span: 2 },
        { key: "firmware", label: "Version / micrologiciel" },
        { key: "supportContact", label: "Contact de soutien" },
      ],
    },
    physicalSecurity: {
      listLabel: "Sécurité physique", titleLabel: "Nom de l’équipement", referenceLabel: "Adresse ou identifiant", ownerLabel: "Responsable sécurité", expiryLabel: "Prochain entretien",
      fields: [
        { key: "deviceType", label: "Type d’équipement" },
        { key: "manufacturer", label: "Fabricant" },
        { key: "model", label: "Modèle" },
        { key: "serialNumber", label: "Numéro de série" },
        { key: "ipAddress", label: "Adresse IP" },
        { key: "physicalLocation", label: "Emplacement physique" },
        { key: "controller", label: "Contrôleur ou enregistreur" },
        { key: "coverage", label: "Zone couverte", span: 2 },
        { key: "retention", label: "Rétention des enregistrements" },
        { key: "maintenance", label: "Contrat / entretien" },
      ],
    },
    operationalTechnology: {
      listLabel: "Équipement spécialisé", titleLabel: "Nom de l’équipement", referenceLabel: "Identifiant ou adresse", ownerLabel: "Responsable opérationnel", expiryLabel: "Prochain entretien",
      fields: [
        { key: "equipmentType", label: "Type d’équipement" },
        { key: "manufacturer", label: "Fabricant" },
        { key: "model", label: "Modèle" },
        { key: "serialNumber", label: "Numéro de série" },
        { key: "controller", label: "Contrôleur / interface" },
        { key: "networkConnection", label: "Connexion réseau" },
        { key: "productionRole", label: "Rôle de production", span: 2 },
        { key: "maintenanceVendor", label: "Fournisseur d’entretien" },
        { key: "safetyConstraints", label: "Contraintes de sécurité", type: "textarea", rows: 3, span: 2 },
      ],
    },
    facilities: {
      listLabel: "Infrastructure physique", titleLabel: "Nom ou emplacement", referenceLabel: "Référence", ownerLabel: "Responsable des installations", expiryLabel: "Prochain entretien",
      fields: [
        { key: "facilityType", label: "Type d’installation" },
        { key: "physicalLocation", label: "Emplacement précis" },
        { key: "powerSource", label: "Alimentation" },
        { key: "capacity", label: "Capacité" },
        { key: "environmentalControl", label: "Contrôle environnemental" },
        { key: "monitoring", label: "Supervision" },
        { key: "maintenanceVendor", label: "Fournisseur d’entretien" },
        { key: "accessProcedure", label: "Procédure d’accès", type: "textarea", rows: 3, span: 2 },
      ],
    },
    cloud: {
      listLabel: "Ressource infonuagique", titleLabel: "Nom de la ressource", referenceLabel: "Identifiant ou portail", ownerLabel: "Responsable infonuagique", expiryLabel: "Prochaine révision",
      fields: [
        { key: "provider", label: "Fournisseur", placeholder: "Azure, AWS, autre…" },
        { key: "accountReference", label: "Compte ou abonnement", placeholder: "Référence seulement; aucune clé secrète" },
        { key: "region", label: "Région" },
        { key: "resourceType", label: "Type de ressource" },
        { key: "resourceIdentifier", label: "Identifiant de ressource" },
        { key: "environment", label: "Environnement", type: "select", options: ["", "Production", "Préproduction", "Test", "Développement"] },
        { key: "networking", label: "Réseau et exposition", type: "textarea", rows: 3, span: 2 },
        { key: "resilience", label: "Disponibilité et reprise", type: "textarea", rows: 3, span: 2 },
        { key: "costCenter", label: "Centre de coûts" },
        { key: "tags", label: "Étiquettes fournisseur" },
      ],
    },
    change: {
      listLabel: "Changement", titleLabel: "Titre du changement", referenceLabel: "Numéro de demande", ownerLabel: "Responsable du changement", expiryLabel: "Date planifiée",
      fields: [
        { key: "requester", label: "Demandeur" },
        { key: "changeType", label: "Type", type: "select", options: ["", "Standard", "Normal", "Urgent", "Correctif"] },
        { key: "risk", label: "Risque", type: "select", options: ["", "Faible", "Moyen", "Élevé", "Critique"] },
        { key: "approval", label: "Approbation" },
        { key: "plannedWindow", label: "Fenêtre planifiée" },
        { key: "affectedServices", label: "Services touchés", type: "textarea", rows: 3, span: 2 },
        { key: "implementationPlan", label: "Plan d’implantation", type: "textarea", rows: 4, span: 2 },
        { key: "rollbackPlan", label: "Plan de retour arrière", type: "textarea", rows: 4, span: 2 },
        { key: "outcome", label: "Résultat et validation", type: "textarea", rows: 3, span: 2 },
      ],
    },
    monitoring: {
      listLabel: "Supervision", titleLabel: "Sonde ou politique", referenceLabel: "Portail ou identifiant", ownerLabel: "Responsable supervision", expiryLabel: "Prochaine révision",
      fields: [
        { key: "platform", label: "Plateforme" },
        { key: "probe", label: "Sonde ou agent" },
        { key: "monitoredScope", label: "Portée supervisée", type: "textarea", rows: 3, span: 2 },
        { key: "checks", label: "Contrôles actifs", type: "textarea", rows: 3, span: 2 },
        { key: "alertRouting", label: "Acheminement des alertes" },
        { key: "escalation", label: "Escalade" },
        { key: "pollingInterval", label: "Intervalle de collecte" },
        { key: "retention", label: "Rétention" },
      ],
    },
    remoteAccess: {
      listLabel: "Accès distant", titleLabel: "Nom de l’accès", referenceLabel: "Portail ou point d’entrée", ownerLabel: "Responsable des accès", expiryLabel: "Prochaine révision",
      fields: [
        { key: "solution", label: "Solution" },
        { key: "endpoint", label: "Point d’entrée" },
        { key: "authentication", label: "Méthode d’authentification" },
        { key: "mfa", label: "MFA", type: "select", options: ["", "Obligatoire", "Partiel", "Non", "À confirmer"] },
        { key: "allowedGroups", label: "Groupes autorisés", type: "textarea", rows: 3, span: 2 },
        { key: "accessScope", label: "Portée d’accès", type: "textarea", rows: 3, span: 2 },
        { key: "logging", label: "Journalisation" },
        { key: "supportContact", label: "Contact de soutien" },
      ],
    },
    identity: {
      listLabel: "Identité ou groupe", titleLabel: "Nom de l’identité", referenceLabel: "Identifiant non secret", ownerLabel: "Propriétaire", expiryLabel: "Prochaine attestation",
      fields: [
        { key: "identityType", label: "Type", type: "select", options: ["", "Compte de service", "Compte partagé", "Groupe", "Rôle", "Technicien", "Autre"] },
        { key: "purpose", label: "Fonction", span: 2 },
        { key: "directory", label: "Annuaire ou plateforme" },
        { key: "membership", label: "Membres ou attribution", type: "textarea", rows: 3, span: 2 },
        { key: "permissions", label: "Droits accordés", type: "textarea", rows: 3, span: 2 },
        { key: "reviewCadence", label: "Fréquence d’attestation" },
        { key: "mfa", label: "MFA", type: "select", options: ["", "Obligatoire", "Non applicable", "Non", "À confirmer"] },
        { key: "vaultReference", label: "Référence au coffre", placeholder: "Liez la fiche Password; ne saisissez aucun secret" },
      ],
    },
    web: {
      listLabel: "Service Web", titleLabel: "Nom du site", referenceLabel: "URL", ownerLabel: "Propriétaire", expiryLabel: "Prochaine révision",
      fields: [
        { key: "url", label: "URL publique", type: "url" },
        { key: "hostingProvider", label: "Hébergeur" },
        { key: "platform", label: "Plateforme / technologie" },
        { key: "dnsZone", label: "Zone DNS" },
        { key: "certificate", label: "Certificat associé" },
        { key: "registrar", label: "Registraire" },
        { key: "deployment", label: "Déploiement" },
        { key: "monitoring", label: "Supervision" },
        { key: "dependencies", label: "Dépendances", type: "textarea", rows: 3, span: 2 },
      ],
    },
    printer: {
      listLabel: "Imprimante", titleLabel: "Nom de l’imprimante", referenceLabel: "Adresse IP ou file", ownerLabel: "Responsable", expiryLabel: "Prochain entretien",
      fields: [
        { key: "manufacturer", label: "Fabricant" },
        { key: "model", label: "Modèle" },
        { key: "serialNumber", label: "Numéro de série" },
        { key: "ipAddress", label: "Adresse IP" },
        { key: "queueName", label: "Nom de la file" },
        { key: "printServer", label: "Serveur d’impression" },
        { key: "driver", label: "Pilote" },
        { key: "deployment", label: "Déploiement", placeholder: "GPO, Intune, manuel…" },
        { key: "supplies", label: "Consommables" },
        { key: "supportContract", label: "Contrat de soutien" },
      ],
    },
    messaging: {
      listLabel: "Messagerie", titleLabel: "Service ou domaine", referenceLabel: "Portail ou identifiant", ownerLabel: "Responsable messagerie", expiryLabel: "Prochaine révision",
      fields: [
        { key: "platform", label: "Plateforme" },
        { key: "domains", label: "Domaines", type: "textarea", rows: 3, span: 2 },
        { key: "mailFlow", label: "Flux de courrier", type: "textarea", rows: 3, span: 2 },
        { key: "securityGateway", label: "Passerelle de sécurité" },
        { key: "retention", label: "Rétention" },
        { key: "authentication", label: "Authentification" },
        { key: "supportContact", label: "Contact de soutien" },
      ],
    },
    service: {
      listLabel: "Service", titleLabel: "Nom du service", referenceLabel: "URL ou portail", ownerLabel: "Responsable", expiryLabel: "Prochaine révision",
      fields: [
        { key: "vendor", label: "Fournisseur" },
        { key: "environment", label: "Environnement", type: "select", options: ["", "Production", "Préproduction", "Test", "Développement", "Interne"] },
        { key: "supportContact", label: "Contact de soutien" },
        { key: "serviceLevel", label: "Niveau de service / SLA" },
      ],
    },
    vendor: {
      listLabel: "Fournisseur", titleLabel: "Nom du fournisseur", referenceLabel: "Site ou contrat", ownerLabel: "Responsable interne", expiryLabel: "Fin ou renouvellement du contrat",
      fields: [
        { key: "contact", label: "Contact principal" },
        { key: "email", label: "Courriel", type: "email" },
        { key: "phone", label: "Téléphone", type: "tel" },
        { key: "supportPortal", label: "Portail de soutien", type: "url" },
      ],
    },
    fileSharing: {
      listLabel: "Partage", titleLabel: "Nom du partage", referenceLabel: "Référence ou URL", ownerLabel: "Responsable", expiryLabel: "Prochaine révision",
      fields: [
        { key: "mappedDrive", label: "Lecteur mappé", placeholder: "Ex. S:\\" },
        { key: "sharePath", label: "Chemin du partage", placeholder: "Ex. \\\\SERVEUR\\Partage" },
        { key: "diskPath", label: "Chemin sur le disque", placeholder: "Ex. D:\\Partage" },
        { key: "dataClassification", label: "Classification des données", type: "select", options: ["", "Interne", "Confidentielle", "Restreinte"] },
        { key: "offlineAccess", label: "Accès hors connexion", type: "select", options: ["", "Autorisé", "Interdit", "À confirmer"] },
        { key: "securityPermissions", label: "Groupes ou utilisateurs autorisés sur le partage", type: "textarea", rows: 4, span: 2, section: true, placeholder: "Un groupe ou utilisateur par ligne; ce champ documente les permissions sans modifier les ACL." },
      ],
    },
    printing: {
      listLabel: "Site", titleLabel: "Site", referenceLabel: "Adresse IP / hôte", ownerLabel: "Responsable", expiryLabel: "Prochaine révision",
      fields: [
        { key: "printerNames", label: "Imprimante(s)", type: "textarea", rows: 3, span: 2, placeholder: "Une file ou imprimante par ligne" },
        { key: "deployment", label: "Déploiement", type: "select", options: ["", "Manuel", "GPO", "Intune", "Serveur d’impression", "Script", "Autre"] },
        { key: "publishedToAd", label: "Publié dans Active Directory" },
        { key: "driverPath", label: "Chemin des pilotes", placeholder: "Ex. \\\\fileshare\\support\\drivers\\hp" },
        { key: "hostAddress", label: "Adresse IP / nom d’hôte" },
        { key: "supportInformation", label: "Informations de soutien", type: "document", rows: 10, span: 2, section: true, placeholder: "Coordonnées du fournisseur, garantie, procédure de soutien et pièces de remplacement…" },
        { key: "notesDocument", label: "Notes", type: "document", rows: 10, span: 2, section: true, placeholder: "Configuration, restrictions, dépannage et informations supplémentaires…" },
      ],
    },
  };

  function t(key) {
    return translations[state.locale][key] || key;
  }

  function scopedPermission(organizationId) {
    return Array.isArray(state.user?.organizationPermissions) ? state.user.organizationPermissions.find((permission) => permission.organizationId === organizationId) || null : null;
  }

  function canWrite(organizationId = activeOrganizationId()) {
    if (isAdministrator()) return true;
    if (organizationId) {
      const permission = scopedPermission(organizationId);
      if (permission) return permission.role === "editor";
    }
    if (Array.isArray(state.user?.organizationPermissions) && state.user.organizationPermissions.length) return state.user.organizationPermissions.some((permission) => permission.role === "editor");
    return state.user?.role === "editor";
  }

  function isAdministrator() {
    return state.user?.role === "administrator";
  }

  function canAccessVault(organizationId = activeOrganizationId()) {
    if (isAdministrator()) return true;
    if (organizationId) {
      const permission = scopedPermission(organizationId);
      if (permission) return permission.vaultAccess === true;
    }
    if (Array.isArray(state.user?.organizationPermissions) && state.user.organizationPermissions.length) return state.user.organizationPermissions.some((permission) => permission.vaultAccess === true);
    return state.user?.vaultAccess !== false;
  }

  function writeButton(markup) {
    return canWrite() ? markup : "";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function icon(name, size = 18) {
    const paths = {
      grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
      home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/>',
      filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
      building: '<path d="M4 21V5a2 2 0 0 1 2-2h8v18M14 9h4a2 2 0 0 1 2 2v10M8 7h2M8 11h2M8 15h2M8 19h2M17 13h1M17 17h1M2 21h20"/>',
      pin: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
      server: '<rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01M11 7h6M11 17h6"/>',
      book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13Z"/><path d="M8 7h8M8 11h6"/>',
      link: '<path d="M10 13a5 5 0 0 0 7.54.54l2-2a5 5 0 0 0-7.07-7.07l-1.15 1.15M14 11a5 5 0 0 0-7.54-.54l-2 2a5 5 0 0 0 7.07 7.07l1.15-1.15"/>',
      activity: '<path d="M3 12h4l2-7 4 14 2-7h6"/>',
      settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.36.3.57.73.6 1.2v.4c-.03.47-.24.9-.6 1.2Z"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>',
      sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/>',
      menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
      more: '<circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/>',
      close: '<path d="m6 6 12 12M18 6 6 18"/>',
      chevron: '<path d="m9 18 6-6-6-6"/>',
      arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      alert: '<path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      external: '<path d="M14 3h7v7M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
      shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
      logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
      users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
      edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
      globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
      key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M15 8l3 3M17 6l2 2"/>',
      lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
      network: '<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M6 16v-4h12v4"/>',
      refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 8a7 7 0 0 1 11.3-2L20 8M4 16l2.6 2a7 7 0 0 0 11.3-2"/>',
      mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
      message: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 9h8M8 13h5"/>',
      file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
      printer: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7"/>',
      phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z"/>',
      wifi: '<path d="M5 12.6a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M2 9a15 15 0 0 1 20 0"/><circle cx="12" cy="20" r="1"/>',
      history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
      download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
      upload: '<path d="M12 16V4M7 9l5-5 5 5M5 21h14"/>',
      eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
      "eye-off": '<path d="m3 3 18 18"/><path d="M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.2A10.9 10.9 0 0 1 12 4c6.5 0 10 8 10 8a18.5 18.5 0 0 1-2.2 3.4M6.6 6.6C3.5 8.6 2 12 2 12s3.5 8 10 8a10.8 10.8 0 0 0 4.1-.8"/>',
      paperclip: '<path d="m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l9.6-9.6a4 4 0 0 1 5.7 5.7l-9.6 9.6a2 2 0 0 1-2.8-2.8l8.9-8.9"/>',
      trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v5M14 11v5"/>',
      copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
      help: '<circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.5 2.5 0 1 1 3.9 2.1c-1 .7-1.6 1.2-1.6 2.4M12 17h.01"/>',
      info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
      compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5Z"/>',
      layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
    };
    return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
  }

  function moduleIcon(label) {
    const value = String(label).toLowerCase();
    if (/wifi|wireless|antenne|access point|fortiap/.test(value)) return "wifi";
    if (/firewall|sécurité|security|antivirus|antispam|watchguard/.test(value)) return "shield";
    if (/printer|imprimante|scanner/.test(value)) return "printer";
    if (/phone|telephone|voip|pbx|voice/.test(value)) return "phone";
    if (/mail|exchange|messagerie/.test(value)) return "mail";
    if (/server|serveur|nas|san|storage|stockage|hypervisor|vm|virtual/.test(value)) return "server";
    if (/router|switch|network|réseau|internet|lan|vpn|tunnel/.test(value)) return "network";
    if (/license|account|compte|user|technicien/.test(value)) return "users";
    if (/backup|sauvegarde/.test(value)) return "refresh";
    if (/document|changelog|info|summary|résumé/.test(value)) return "file";
    if (/site|location|salle/.test(value)) return "pin";
    return "grid";
  }

  const moduleProfileLabels = {
    generic: "Fiche polyvalente", contacts: "Contact", documents: "Document", workload: "Charge technique", domain: "Domaine", certificate: "Certificat TLS",
    backup: "Sauvegarde", activeDirectory: "Active Directory", microsoft365: "Microsoft 365", wan: "Internet / WAN", vpn: "VPN", wireless: "Sans-fil",
    virtualization: "Virtualisation", application: "Application", ups: "UPS", licensing: "Licence", network: "Réseau", server: "Serveur", workstation: "Poste de travail",
    storage: "Stockage", database: "Base de données", securityAppliance: "Équipement de sécurité", securityPlatform: "Plateforme de sécurité", telephony: "Téléphonie",
    physicalSecurity: "Sécurité physique", operationalTechnology: "Équipement spécialisé", facilities: "Installations", cloud: "Infonuagique", change: "Gestion du changement",
    monitoring: "Supervision", remoteAccess: "Accès distant", identity: "Identité et accès", web: "Service Web", printer: "Imprimante", messaging: "Messagerie",
    service: "Service", vendor: "Fournisseur", fileSharing: "Partage de fichiers", printing: "Impression structurée",
  };

  function moduleProfileKey(module) {
    if (!module) return "generic";
    const exact = {
      contacts: "contacts",
      documents: "documents",
      "technical-account-load": "workload",
      "domain-tracker": "domain",
      "ssl-tracker": "certificate",
      "service-active-directory": "activeDirectory",
      "custom-microsoft-365": "microsoft365",
      "service-internet-wan": "wan",
      "custom-connexion-internet": "wan",
      "custom-fai-fournisseur-d-acces-internet": "wan",
      "custom-vpn": "vpn",
      "service-wireless": "wireless",
      "custom-wifi": "wireless",
      "custom-wireless-controler": "wireless",
      "custom-wireless-router": "wireless",
      "service-virtualization": "virtualization",
      "custom-virtualisation": "virtualization",
      "custom-proxmox": "virtualization",
      "custom-hypervisor": "virtualization",
      "service-applications": "application",
      "custom-logiciel": "application",
      "custom-ups": "ups",
      "custom-ups-uninterruptible-power-supply": "ups",
      [FILE_SHARING_MODULE_ID]: "fileSharing",
      [PRINTING_MODULE_ID]: "printing",
    }[module.id];
    if (exact) return exact;
    const label = String(module.label || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (/^documents?$/.test(label)) return "documents";
    if (/^ssl$|certificate/.test(label)) return "certificate";
    if (/change control|changelog/.test(label)) return "change";
    if (/backup|sauvegarde|msbackup|veeam|datto asset|datto appliance/.test(label)) return "backup";
    if (/licen[cs]|renewal|abonnement/.test(label)) return "licensing";
    if (/vendor|fournisseur/.test(label)) return "vendor";
    if (/microsoft 365|acces conditionnel|sharepoint|teams/.test(label)) return "microsoft365";
    if (/active directory/.test(label)) return "activeDirectory";
    if (/internet\/wan|connexion internet|fai /.test(label)) return "wan";
    if (/vpn|tunnel|virtual network gateway/.test(label)) return "vpn";
    if (/wifi|wireless|access point|antenne|fortiap|point-to-point ap/.test(label)) return "wireless";
    if (/probe|surveillance|monitor/.test(label)) return "monitoring";
    if (/virtual|hypervisor|proxmox|esxi| vdi|\bvm\b|container/.test(label)) return "virtualization";
    if (/sql|database/.test(label)) return "database";
    if (/\bnas\b|\bsan\b|storage|stockage|qnap/.test(label)) return "storage";
    if (/email|exchange|messagerie/.test(label)) return "messaging";
    if (/server|serveur|windows server|exchange server|managed server|ilo/.test(label)) return "server";
    if (/workstation|ordinateur|laptop|portable|poste usine|thin|tablet|smartphone/.test(label)) return "workstation";
    if (/printer|imprimante|scanner/.test(label)) return "printer";
    if (/firewall|pare-feu|watchguard|fortiauthenticator|fortimail/.test(label)) return "securityAppliance";
    if (/antivirus|antispam|information de securite|\bsecurity\b/.test(label)) return "securityPlatform";
    if (/camera|dvr|alarme|controleur d'acces|web cam/.test(label)) return "physicalSecurity";
    if (/pbx|voip|phone|telephone|\bata\b|voice|video conference/.test(label)) return "telephony";
    if (/remote access|outil de controle a distance|\brds\b|console de gestion|\bkvm\b/.test(label)) return "remoteAccess";
    if (/account management|user groups|technicien|non ad item/.test(label)) return "identity";
    if (/website|site internet|hebergement/.test(label)) return "web";
    if (/aws|azure instance|cloud(?! key)/.test(label)) return "cloud";
    if (/application|logiciel|autotask/.test(label)) return "application";
    if (/\bups\b|uninterruptible/.test(label)) return "ups";
    if (/cnc|automate|machine|digital signage|tv signage|punch clock|time punch|paid terminal|network audio|field-effect|peripheral/.test(label)) return "operationalTechnology";
    if (/salle de serveur|ventilation|\bpdu\b/.test(label)) return "facilities";
    if (/lan|wan|network|reseau|router|routeur|switch|composant reseau|cloud key/.test(label)) return "network";
    if (/resume du client|site summary|documents|info de base|sales\/finance|magasin korvette|other/.test(label)) return "generic";
    if (/email|service/.test(label)) return "service";
    return "generic";
  }

  function moduleProfile(module) {
    if (module?.userDefined) {
      return {
        ...moduleProfileCatalog.generic,
        listLabel: "Fiche",
        titleLabel: module.titleLabel || "Nom de la fiche",
        fields: module.fields || [],
      };
    }
    return moduleProfileCatalog[moduleProfileKey(module)] || moduleProfileCatalog.generic;
  }

  function moduleEditorAuditEntry(module) {
    if (module?.userDefined) {
      return { ...module, profileKey: "customDefinition", profileLabel: "Schéma personnalisé", fieldCount: module.fields?.length || 0, fields: module.fields || [], editorKind: "shared" };
    }
    const dedicated = {
      configurations: { profileKey: "configuration", profileLabel: "Configuration avancée", fieldCount: 39, editorKind: "dedicated", fields: [] },
      locations: { profileKey: "location", profileLabel: "Site et emplacement", fieldCount: 8, editorKind: "dedicated", fields: [] },
      passwords: { profileKey: "vault", profileLabel: "Coffre chiffré", fieldCount: 7, editorKind: "dedicated", fields: [] },
    }[module.id];
    if (dedicated) return { ...module, ...dedicated };
    const profileKey = moduleProfileKey(module);
    const profile = moduleProfileCatalog[profileKey];
    return { ...module, profileKey, profileLabel: moduleProfileLabels[profileKey] || profileKey, fieldCount: profile?.fields?.length || 0, fields: (profile?.fields || []).map(({ key, label, type = "text", options = [] }) => ({ key, label, type, options })), editorKind: module.id === FILE_SHARING_MODULE_ID || module.id === PRINTING_MODULE_ID ? "specialized" : "shared" };
  }

  function moduleCatalogAudit() {
    const allowedTypes = new Set([undefined, "text", "tel", "email", "url", "number", "date", "select", "textarea", "document"]);
    const ids = new Set();
    const issues = [];
    const modules = moduleDefinitions.map(moduleEditorAuditEntry);
    for (const module of modules) {
      if (!module.id || !module.label || !module.group || !module.icon) issues.push(`${module.id || "module-sans-id"}: métadonnées incomplètes`);
      if (ids.has(module.id)) issues.push(`${module.id}: identifiant dupliqué`);
      ids.add(module.id);
      if (module.fieldCount < 4) issues.push(`${module.id}: moins de quatre champs métier`);
      if (module.editorKind === "dedicated") continue;
      const profile = module.userDefined ? { fields: module.fields || [] } : moduleProfileCatalog[module.profileKey];
      if (!profile) { issues.push(`${module.id}: profil ${module.profileKey} absent`); continue; }
      const fieldKeys = new Set();
      for (const field of profile.fields) {
        if (!field.key || !field.label) issues.push(`${module.id}: champ sans clé ou libellé`);
        if (fieldKeys.has(field.key)) issues.push(`${module.id}: champ ${field.key} dupliqué`);
        fieldKeys.add(field.key);
        if (!allowedTypes.has(field.type)) issues.push(`${module.id}: type ${field.type} non pris en charge`);
        if (field.type === "select" && (!Array.isArray(field.options) || !field.options.length)) issues.push(`${module.id}: options manquantes pour ${field.key}`);
        if (/(password|secret|token|api.?key|credential)/i.test(field.key)) issues.push(`${module.id}: un secret doit être conservé dans Passwords, pas dans ${field.key}`);
      }
    }
    return {
      total: modules.length,
      groups: Object.fromEntries(["core", "services", "custom"].map((group) => [group, modules.filter((module) => module.group === group).length])),
      profileCount: new Set(modules.map((module) => module.profileKey)).size,
      genericCount: modules.filter((module) => module.profileKey === "generic").length,
      issues,
      modules,
    };
  }

  window.__ATLAS_MODULE_QA__ = {
    report: () => JSON.parse(JSON.stringify(moduleCatalogAudit())),
    pwaInstallDecision: (context) => shouldShowPwaInstallBanner(context),
    passwordHealthSnapshot: (items) => passwordHealthSnapshot(items),
    fieldsMarkup: (moduleId) => {
      const module = moduleMap.get(moduleId);
      return module ? moduleProfileFieldsMarkup(module, null) : "";
    },
    organizationContextSnapshot: ({ workspace, vaultItems = [], organizationId = "", page = "configurations" }) => {
      const previous = { workspace: state.workspace, vaultItems: state.vaultItems, searchScope: state.searchScope, filter: state.filter, page: state.page, detailId: state.detailId, recordId: state.recordId };
      try {
        state.workspace = workspace;
        state.vaultItems = vaultItems;
        state.searchScope = organizationId || "global";
        state.filter = organizationId || "all";
        state.page = page;
        state.detailId = null;
        state.recordId = null;
        return {
          organizationId: activeOrganizationId(),
          scopedNavigation: Boolean(activeOrganizationId()),
          configurationCount: moduleCount(moduleMap.get("configurations")),
          locationCount: moduleCount(moduleMap.get("locations")),
          passwordCount: moduleCount(moduleMap.get("passwords")),
          breadcrumb: pageHeader("Configurations", ""),
        };
      } finally {
        Object.assign(state, previous);
      }
    },
    organizationHierarchySnapshot: ({ workspace, organizationId }) => {
      const previous = state.workspace;
      try {
        state.workspace = workspace;
        return {
          path: organizationPath(organizationId).map((organization) => organization.id),
          depth: organizationDepth(organizationId),
          descendants: organizationDescendantIds(organizationId),
          breadcrumb: organizationBreadcrumbMarkup(organizationId),
        };
      } finally {
        state.workspace = previous;
      }
    },
  };

  function activeOrganizationId() {
    const organizations = state.workspace?.organizations || [];
    const valid = (id) => organizations.some((organization) => organization.id === id);
    if (state.page === "organization" && valid(state.detailId)) return state.detailId;
    if (state.page === "asset" && state.detailId) {
      const organizationId = assetByRef(state.detailId)?.organizationId;
      if (valid(organizationId)) return organizationId;
    }
    if (state.page === "configuration" && state.detailId) {
      const organizationId = state.workspace?.configurations?.find((item) => item.id === state.detailId)?.organizationId;
      if (valid(organizationId)) return organizationId;
    }
    if (state.page === "record" && state.recordId) {
      const collections = state.detailId === "configurations" ? [state.workspace?.configurations]
        : state.detailId === "locations" ? [state.workspace?.sites]
          : state.detailId === "passwords" ? [state.vaultItems]
            : [state.workspace?.moduleRecords];
      const organizationId = collections.flatMap((items) => items || []).find((item) => item.id === state.recordId)?.organizationId;
      if (valid(organizationId)) return organizationId;
    }
    if (state.searchScope !== "global" && valid(state.searchScope)) return state.searchScope;
    if (valid(state.filter)) return state.filter;
    if (state.page === "relations" && valid(state.relationOrganization)) return state.relationOrganization;
    return "";
  }

  function organizationById(id) {
    return state.workspace?.organizations?.find((organization) => organization.id === id) || null;
  }

  function organizationAncestors(id) {
    const ancestors = [];
    const visited = new Set([id]);
    let current = organizationById(id);
    while (current?.parentOrganizationId && ancestors.length < 2) {
      const parent = organizationById(current.parentOrganizationId);
      if (!parent || visited.has(parent.id)) break;
      visited.add(parent.id);
      ancestors.unshift(parent);
      current = parent;
    }
    return ancestors;
  }

  function organizationPath(id) {
    const organization = organizationById(id);
    return organization ? [...organizationAncestors(id), organization] : [];
  }

  function organizationDepth(id) {
    return organizationPath(id).length || 1;
  }

  function organizationChildren(id) {
    return (state.workspace?.organizations || []).filter((organization) => organization.parentOrganizationId === id);
  }

  function organizationDescendantIds(id) {
    const descendants = [];
    const pending = [...organizationChildren(id)];
    const visited = new Set([id]);
    while (pending.length) {
      const organization = pending.shift();
      if (!organization || visited.has(organization.id)) continue;
      visited.add(organization.id);
      descendants.push(organization.id);
      pending.push(...organizationChildren(organization.id));
    }
    return descendants;
  }

  function organizationSubtreeHeight(id, visited = new Set()) {
    if (visited.has(id)) return 0;
    const nextVisited = new Set(visited).add(id);
    const children = organizationChildren(id).filter((child) => !nextVisited.has(child.id));
    return children.length ? 1 + Math.max(...children.map((child) => organizationSubtreeHeight(child.id, nextVisited))) : 1;
  }

  function organizationBreadcrumbMarkup(id) {
    return organizationPath(id).map((organization) => `<button type="button" data-route="organization/${escapeHtml(organization.id)}">${escapeHtml(organization.name)}</button>`).join(icon("chevron", 13));
  }

  function organizationPathLabel(id) {
    return organizationPath(id).map((organization) => organization.name).join(" › ");
  }

  function validOrganizationParents(item = null) {
    const blocked = new Set(item ? [item.id, ...organizationDescendantIds(item.id)] : []);
    const subtreeHeight = item ? organizationSubtreeHeight(item.id) : 1;
    return (state.workspace?.organizations || [])
      .filter((candidate) => !blocked.has(candidate.id) && organizationDepth(candidate.id) + subtreeHeight <= 3)
      .sort((a, b) => organizationPathLabel(a.id).localeCompare(organizationPathLabel(b.id), state.locale));
  }

  function activateOrganizationContext(organizationId) {
    const valid = state.workspace?.organizations?.some((organization) => organization.id === organizationId);
    if (!valid) return false;
    state.searchScope = organizationId;
    state.filter = organizationId;
    state.relationOrganization = organizationId;
    return true;
  }

  function requiresOrganizationContext(page = state.page) {
    return ["sites", "configurations", "procedures", "relations", "module", "record", "asset", "configuration"].includes(page);
  }

  function creationOrganizationId(actionLabel = "créer cette fiche") {
    const organizationId = activeOrganizationId();
    if (organizationId) return organizationId;
    toast(`Choisissez d’abord une organisation dans la portée ou le filtre pour ${actionLabel}.`, "error");
    return "";
  }

  function organizationContextField(organizationId) {
    return `<input type="hidden" name="organizationId" value="${escapeHtml(organizationId)}" required /><div class="form-organization-context span-2">${icon("building", 17)}<span><small>ORGANISATION</small><strong>${escapeHtml(orgName(organizationId))}</strong></span><em>Déterminée par la page active</em></div>`;
  }

  function safeDocumentHref(value) {
    const href = String(value || "").trim();
    if (/^#[a-z0-9_-]+$/i.test(href)) return href;
    if (/^(https?:|mailto:)/i.test(href)) return href;
    return "";
  }

  function renderDocumentInline(value) {
    const tokens = [];
    const token = (markup) => `TRCINLINETOKEN${tokens.push(markup) - 1}END`;
    let source = String(value || "");
    source = source.replace(/\[\[@([^|\]]+)\|([a-z]+:[a-z0-9-]+)\]\]/gi, (_, label, ref) => token(`<button class="inline-mention" type="button" data-action="open-asset" data-asset-ref="${escapeHtml(ref)}">@${escapeHtml(label)}</button>`));
    source = source.replace(/`([^`\n]+)`/g, (_, code) => token(`<code>${escapeHtml(code)}</code>`));
    source = source.replace(/\[([^\]\n]+)\]\(([^)\n]+)\)/g, (_, label, rawHref) => {
      const href = safeDocumentHref(rawHref);
      return href ? token(`<a href="${escapeHtml(href)}" ${/^https?:/i.test(href) ? 'target="_blank" rel="noreferrer"' : ""}>${escapeHtml(label)}</a>`) : label;
    });
    let output = escapeHtml(source)
      .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
      .replace(/~~([^~\n]+)~~/g, "<del>$1</del>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    output = output.replace(/TRCINLINETOKEN(\d+)END/g, (_, index) => tokens[Number(index)] || "");
    return output;
  }

  function documentTableCells(line) {
    return String(line || "").trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
  }

  function isDocumentTableDivider(line) {
    const cells = documentTableCells(line);
    return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
  }

  function documentLineStartsBlock(lines, index) {
    const line = lines[index] || "";
    const next = lines[index + 1] || "";
    return /^\s*```/.test(line) || /^\s*#{1,3}\s+/.test(line) || /^\s*>\s?/.test(line) || /^\s*(?:[-*_]\s*){3,}$/.test(line)
      || /^\s*[-*+]\s+(?:\[[ xX]\]\s+)?/.test(line) || /^\s*\d+[.)]\s+/.test(line)
      || (line.includes("|") && isDocumentTableDivider(next));
  }

  function renderDocumentMarkdown(value) {
    const lines = String(value || "").replace(/\r\n?/g, "\n").split("\n");
    const blocks = [];
    for (let index = 0; index < lines.length;) {
      const line = lines[index];
      if (!line.trim()) { index += 1; continue; }
      const fence = line.match(/^\s*```\s*([a-z0-9_-]*)\s*$/i);
      if (fence) {
        const code = [];
        index += 1;
        while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) { code.push(lines[index]); index += 1; }
        if (index < lines.length) index += 1;
        blocks.push(`<pre class="document-code"><span>${escapeHtml(fence[1] || "code")}</span><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        continue;
      }
      if (line.includes("|") && isDocumentTableDivider(lines[index + 1] || "")) {
        const headers = documentTableCells(line);
        index += 2;
        const rows = [];
        while (index < lines.length && lines[index].includes("|") && lines[index].trim()) { rows.push(documentTableCells(lines[index])); index += 1; }
        blocks.push(`<div class="document-table-scroll"><table><thead><tr>${headers.map((cell) => `<th>${renderDocumentInline(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((_, cellIndex) => `<td>${renderDocumentInline(row[cellIndex] || "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
        continue;
      }
      const heading = line.match(/^\s*(#{1,3})\s+(.+)$/);
      if (heading) {
        const level = Math.min(4, heading[1].length + 1);
        blocks.push(`<h${level}>${renderDocumentInline(heading[2])}</h${level}>`);
        index += 1;
        continue;
      }
      if (/^\s*(?:[-*_]\s*){3,}$/.test(line)) { blocks.push("<hr />"); index += 1; continue; }
      if (/^\s*>\s?/.test(line)) {
        const quote = [];
        while (index < lines.length && /^\s*>\s?/.test(lines[index])) { quote.push(lines[index].replace(/^\s*>\s?/, "")); index += 1; }
        blocks.push(`<blockquote>${quote.map(renderDocumentInline).join("<br />")}</blockquote>`);
        continue;
      }
      const task = line.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.+)$/);
      if (task) {
        const items = [];
        while (index < lines.length) {
          const match = lines[index].match(/^\s*[-*+]\s+\[([ xX])\]\s+(.+)$/);
          if (!match) break;
          items.push(`<li class="${match[1].toLowerCase() === "x" ? "done" : ""}"><span aria-hidden="true">${match[1].toLowerCase() === "x" ? "✓" : "○"}</span>${renderDocumentInline(match[2])}</li>`);
          index += 1;
        }
        blocks.push(`<ul class="document-task-list">${items.join("")}</ul>`);
        continue;
      }
      if (/^\s*[-*+]\s+/.test(line)) {
        const items = [];
        while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index]) && !/^\s*[-*+]\s+\[[ xX]\]\s+/.test(lines[index])) { items.push(`<li>${renderDocumentInline(lines[index].replace(/^\s*[-*+]\s+/, ""))}</li>`); index += 1; }
        blocks.push(`<ul>${items.join("")}</ul>`);
        continue;
      }
      if (/^\s*\d+[.)]\s+/.test(line)) {
        const items = [];
        while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index])) { items.push(`<li>${renderDocumentInline(lines[index].replace(/^\s*\d+[.)]\s+/, ""))}</li>`); index += 1; }
        blocks.push(`<ol>${items.join("")}</ol>`);
        continue;
      }
      const paragraph = [line];
      index += 1;
      while (index < lines.length && lines[index].trim() && !documentLineStartsBlock(lines, index)) { paragraph.push(lines[index]); index += 1; }
      blocks.push(`<p>${paragraph.map(renderDocumentInline).join("<br />")}</p>`);
    }
    return blocks.join("") || `<div class="document-preview-empty">${icon("book", 24)}<strong>L’aperçu apparaîtra ici</strong><span>Commencez à écrire ou utilisez la barre d’outils.</span></div>`;
  }

  function documentTextStats(value) {
    const text = String(value || "");
    return { words: text.trim() ? text.trim().split(/\s+/).length : 0, characters: text.length };
  }

  function documentEditorMarkup(field, value) {
    const stats = documentTextStats(value);
    const fieldKey = field.key || "content";
    const editorId = `document-${slug(fieldKey)}-editor`;
    const command = (id, label, title, extra = "") => `<button type="button" data-action="document-command" data-document-command="${id}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}" ${extra}>${label}</button>`;
    return `<section class="document-editor span-2 mode-split" data-document-editor>
      <header class="document-editor-heading"><div><span>${escapeHtml(field.label)}</span><small>Markdown local · aperçu sécurisé · @relations</small></div><div class="document-editor-heading-actions"><div class="document-editor-modes" role="group" aria-label="Mode d’affichage"><button type="button" data-action="document-mode" data-document-mode="write" aria-pressed="false">Écrire</button><button type="button" data-action="document-mode" data-document-mode="split" aria-pressed="true">Partagé</button><button type="button" data-action="document-mode" data-document-mode="preview" aria-pressed="false">Aperçu</button></div><button class="icon-button" type="button" data-action="toggle-document-fullscreen" aria-label="Basculer l’éditeur plein écran" title="Plein écran">${icon("external", 16)}</button></div></header>
      <div class="document-editor-toolbar" role="toolbar" aria-label="Mise en forme du document">
        <div>${command("heading2", "H2", "Titre de section")}${command("heading3", "H3", "Sous-titre")}</div>
        <div>${command("bold", "<strong>B</strong>", "Gras · Ctrl+B")}${command("italic", "<em>I</em>", "Italique · Ctrl+I")}${command("strike", "<s>S</s>", "Barré")}${command("inline-code", "<code>&lt;/&gt;</code>", "Code en ligne")}</div>
        <div>${command("bullet", "• Liste", "Liste à puces")}${command("numbered", "1. Liste", "Liste numérotée")}${command("checklist", "☐ Tâche", "Liste de tâches")}${command("quote", "❯ Citation", "Citation")}</div>
        <div>${command("link", `${icon("link", 14)} Lien`, "Lien · Ctrl+K")}${command("table", "▦ Tableau", "Insérer un tableau")}${command("code-block", "{ } Bloc", "Bloc de code")}${command("divider", "—", "Séparateur")}${command("mention", "@ Fiche", "Mentionner une fiche Atlas")}</div>
      </div>
      <div class="document-editor-canvas">
        <div class="document-write-pane"><label class="sr-only" for="${escapeHtml(editorId)}">${escapeHtml(field.label)}</label><span class="mention-field"><textarea id="${escapeHtml(editorId)}" name="detail_${escapeHtml(fieldKey)}" data-document-source data-relate-input maxlength="30000" rows="${field.rows || 20}" placeholder="${escapeHtml(field.placeholder || "")}">${escapeHtml(value)}</textarea><div class="mention-picker" data-mention-picker hidden></div></span></div>
        <article class="document-preview-pane document-rendered" data-document-preview aria-label="Aperçu du document">${renderDocumentMarkdown(value)}</article>
      </div>
      <footer class="document-editor-footer"><span>Markdown · sauvegardé dans Atlas seulement</span><span><strong data-document-word-count>${stats.words}</strong> mots · <strong data-document-character-count>${stats.characters}</strong> caractères / 30 000</span></footer>
    </section>`;
  }

  function updateDocumentEditor(editor) {
    const textarea = editor?.querySelector("[data-document-source]");
    if (!textarea) return;
    const preview = editor.querySelector("[data-document-preview]");
    const stats = documentTextStats(textarea.value);
    if (preview) preview.innerHTML = renderDocumentMarkdown(textarea.value);
    const wordCount = editor.querySelector("[data-document-word-count]");
    const characterCount = editor.querySelector("[data-document-character-count]");
    if (wordCount) wordCount.textContent = String(stats.words);
    if (characterCount) characterCount.textContent = String(stats.characters);
  }

  function setDocumentEditorMode(editor, mode) {
    if (!editor || !["write", "split", "preview"].includes(mode)) return;
    editor.classList.remove("mode-write", "mode-split", "mode-preview");
    editor.classList.add(`mode-${mode}`);
    editor.querySelectorAll("[data-document-mode]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.documentMode === mode)));
    if (mode !== "preview") requestAnimationFrame(() => editor.querySelector("[data-document-source]")?.focus());
  }

  function applyDocumentCommand(textarea, command) {
    const value = textarea.value;
    const start = textarea.selectionStart ?? value.length;
    const end = textarea.selectionEnd ?? start;
    const selected = value.slice(start, end);
    const replace = (replacement, selectionStart = null, selectionEnd = null) => {
      textarea.setRangeText(replacement, start, end, "end");
      if (selectionStart !== null) textarea.setSelectionRange(start + selectionStart, start + (selectionEnd ?? selectionStart));
    };
    const wrap = (before, after, fallback) => {
      const content = selected || fallback;
      replace(`${before}${content}${after}`, before.length, before.length + content.length);
    };
    const prefixLines = (prefix) => {
      const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
      const lineEndIndex = value.indexOf("\n", end);
      const lineEnd = lineEndIndex < 0 ? value.length : lineEndIndex;
      const source = value.slice(lineStart, lineEnd);
      const replacement = source.split("\n").map((line, index) => typeof prefix === "function" ? `${prefix(index)}${line}` : `${prefix}${line}`).join("\n");
      textarea.setRangeText(replacement, lineStart, lineEnd, "select");
    };
    if (command === "heading2") prefixLines("## ");
    else if (command === "heading3") prefixLines("### ");
    else if (command === "bold") wrap("**", "**", "texte important");
    else if (command === "italic") wrap("*", "*", "texte en italique");
    else if (command === "strike") wrap("~~", "~~", "texte barré");
    else if (command === "inline-code") wrap("`", "`", "commande");
    else if (command === "bullet") prefixLines("- ");
    else if (command === "numbered") prefixLines((index) => `${index + 1}. `);
    else if (command === "checklist") prefixLines("- [ ] ");
    else if (command === "quote") prefixLines("> ");
    else if (command === "link") {
      const label = selected || "texte du lien";
      replace(`[${label}](https://)`, label.length + 3, label.length + 11);
    } else if (command === "code-block") {
      const content = selected || "commande ou configuration";
      wrap("```\n", "\n```", content);
    } else if (command === "table") {
      replace(`| Colonne 1 | Colonne 2 | Colonne 3 |\n| --- | --- | --- |\n| Valeur | Valeur | Valeur |`);
    } else if (command === "divider") replace(`${start > 0 && !value.slice(0, start).endsWith("\n") ? "\n" : ""}\n---\n\n`);
    else if (command === "mention") replace("@");
    textarea.focus();
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    if (command === "mention") updateMentionPicker(textarea);
  }

  function moduleProfileFieldMarkup(field, item) {
    const value = String(item?.details?.[field.key] || "");
    const name = `detail_${field.key}`;
    const className = field.span === 2 ? " class=\"span-2\"" : "";
    const placeholder = field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : "";
    const required = field.required ? " required" : "";
    if (field.type === "select") {
      return `<label${className}>${escapeHtml(field.label)}<select name="${name}"${required}>${field.options.map((option) => `<option value="${escapeHtml(option)}" ${option === value ? "selected" : ""}>${escapeHtml(option || "Non précisé")}</option>`).join("")}</select></label>`;
    }
    if (field.type === "textarea") {
      return `<label${className}>${escapeHtml(field.label)}<textarea name="${name}" maxlength="8000" rows="${field.rows || 4}"${placeholder}${required}>${escapeHtml(value)}</textarea></label>`;
    }
    if (field.type === "document") return documentEditorMarkup(field, value);
    const bounds = `${field.min !== undefined ? ` min="${field.min}"` : ""}${field.max !== undefined ? ` max="${field.max}"` : ""}`;
    return `<label${className}>${escapeHtml(field.label)}<input name="${name}" type="${field.type || "text"}" value="${escapeHtml(value)}" maxlength="500"${bounds}${placeholder}${required} /></label>`;
  }

  function moduleProfileFieldsMarkup(module, item) {
    return moduleProfile(module).fields.map((field) => moduleProfileFieldMarkup(field, item)).join("");
  }

  function moduleProfileDetails(item, module) {
    const profile = moduleProfile(module);
    const facts = profile.fields.filter((field) => !field.section && item.details?.[field.key]).map((field) => `<div><dt>${escapeHtml(field.label)}</dt><dd>${escapeHtml(item.details[field.key])}</dd></div>`).join("");
    const sections = profile.fields.filter((field) => field.section && item.details?.[field.key]).map((field) => field.type === "document" ? `<div class="document-record-content document-rendered">${renderDocumentMarkdown(item.details[field.key])}</div>` : `<h3>${escapeHtml(field.label)}</h3><p>${renderMentionText(item.details[field.key])}</p>`).join("");
    return { facts, sections };
  }

  function expiryPresentation(record) {
    if (!record.expiresOn || record.status === "archived") return { label: recordStatusLabel(record.status), tone: record.status === "archived" ? "muted" : record.status === "review" ? "warning" : "success" };
    const days = Math.ceil((new Date(`${record.expiresOn}T23:59:59`).getTime() - Date.now()) / 86400000);
    if (days < 0) return { label: "Expiré", tone: "danger" };
    if (days <= 30) return { label: `Expire dans ${days} j`, tone: "warning" };
    return { label: recordStatusLabel(record.status), tone: record.status === "review" ? "warning" : "success" };
  }

  function moduleRenewalMetrics(records, profile) {
    if (!profile.renewal) return "";
    const now = Date.now();
    const expired = records.filter((record) => record.expiresOn && new Date(`${record.expiresOn}T23:59:59`).getTime() < now && record.status !== "archived").length;
    const soon = records.filter((record) => { const expiry = record.expiresOn ? new Date(`${record.expiresOn}T23:59:59`).getTime() : 0; const days = (expiry - now) / 86400000; return days >= 0 && days <= 30 && record.status !== "archived"; }).length;
    const automatic = records.filter((record) => record.details?.autoRenew === "Oui" && record.status !== "archived").length;
    return `<section class="metrics-grid module-renewal-metrics">${metricCard("globe", records.filter((record) => record.status !== "archived").length, "Actifs", "dans la portée", "blue")}${metricCard("alert", expired, "Expirés", "action requise", "violet")}${metricCard("clock", soon, "Dans 30 jours", "renouvellements", "cyan")}${metricCard("refresh", automatic, "Automatiques", "renouvellement confirmé", "mint")}</section>`;
  }

  async function api(path, options = {}) {
    const headers = { ...(options.body ? { "content-type": "application/json" } : {}), ...(options.headers || {}) };
    if (state.csrf && options.method && options.method !== "GET") headers["x-atlas-csrf"] = state.csrf;
    const response = await fetch(path, { credentials: "same-origin", ...options, headers });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && payload.error === "authentication_required" && state.user) {
        resetClientSession("Votre session a expiré après 8 heures. Reconnectez-vous pour continuer.");
      }
      const error = new Error(payload.message || "Une erreur locale est survenue.");
      error.code = payload.error;
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function clearSessionExpiryTimer() {
    if (sessionExpiryTimer) window.clearTimeout(sessionExpiryTimer);
    sessionExpiryTimer = null;
  }

  function resetClientSession(notice = "") {
    clearSessionExpiryTimer();
    state.user = null;
    state.csrf = "";
    state.sessionExpiresAt = 0;
    state.vaultUnlockedUntil = 0;
    state.authNotice = notice;
    state.workspace = null;
    state.revision = 0;
    state.users = [];
    state.vaultItems = [];
    state.attachments = [];
    state.attachmentEvents = [];
    state.workspaceHistory = [];
    state.revealedVaultItem = null;
    state.visibleVaultFields.clear();
    state.pendingVaultReveal = "";
    state.activeTemplate = null;
    state.pendingMfaToken = "";
    state.mfaSecret = "";
    state.mfaUri = "";
    state.recoveryCodes = [];
    state.sessions = [];
    state.auditEntries = [];
    state.pendingPrivilegedAction = null;
    state.localApiStatus = null;
    state.createdApiToken = "";
    state.createdWebhookSecret = "";
    state.search = "";
    resetQuickRelationPicker();
    state.page = "dashboard";
    state.detailId = null;
    state.phase = "login";
    overlayRoot.replaceChildren();
    history.replaceState(null, "", `${location.pathname}${location.search}`);
    render();
  }

  function scheduleSessionExpiry(value) {
    clearSessionExpiryTimer();
    const expiresAt = Date.parse(value || "");
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      resetClientSession("Votre session a expiré après 8 heures. Reconnectez-vous pour continuer.");
      return;
    }
    state.sessionExpiresAt = expiresAt;
    state.authNotice = "";
    sessionExpiryTimer = window.setTimeout(() => {
      resetClientSession("Votre session a expiré après 8 heures. Reconnectez-vous pour continuer.");
    }, expiresAt - Date.now());
  }

  function applyVaultUnlock(value) {
    const unlockedUntil = Date.parse(value || "");
    state.vaultUnlockedUntil = Number.isFinite(unlockedUntil) ? Math.min(unlockedUntil, state.sessionExpiresAt || unlockedUntil) : 0;
  }

  function vaultSessionUnlocked() {
    return state.vaultUnlockedUntil > Date.now();
  }

  function applyPreferences() {
    document.documentElement.dataset.trcTheme = state.theme;
    document.documentElement.lang = state.locale;
  }

  function shouldShowPwaInstallBanner({ mobile, standalone, dismissed, installed }) {
    return Boolean(mobile && !standalone && !dismissed && !installed);
  }

  function isStandaloneApp() {
    return Boolean(window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true);
  }

  function isMobileInstallSurface() {
    return Boolean(window.matchMedia?.("(max-width: 680px)")?.matches || /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent || ""));
  }

  function pwaInstallDismissed() {
    const dismissedUntil = Number(localStorage.getItem(storageKeys.pwaInstallDismissedUntil) || 0);
    return Number.isFinite(dismissedUntil) && dismissedUntil > Date.now();
  }

  function renderPwaInstallBanner() {
    if (!pwaInstallRoot) return;
    const show = shouldShowPwaInstallBanner({
      mobile: isMobileInstallSurface(),
      standalone: isStandaloneApp(),
      dismissed: pwaInstallDismissed(),
      installed: pwaInstalledThisVisit,
    });
    document.documentElement.toggleAttribute("data-pwa-install-banner", show);
    if (!show) {
      pwaInstallRoot.replaceChildren();
      return;
    }

    const french = state.locale !== "en";
    const nativePromptReady = Boolean(deferredInstallPrompt);
    const ios = /iPhone|iPad|iPod/i.test(window.navigator.userAgent || "") && !window.MSStream;
    const actionLabel = nativePromptReady ? (french ? "Installer" : "Install") : ios ? (french ? "Voir comment" : "See how") : (french ? "Instructions" : "Instructions");
    pwaInstallRoot.innerHTML = `<aside class="pwa-install-banner" role="region" aria-label="${french ? "Installer TRC Atlas" : "Install TRC Atlas"}">
      <img class="pwa-install-logo" src="/assets/trc-atlas-layers-logo.svg" alt="" />
      <div class="pwa-install-copy">
        <p class="eyebrow">${french ? "ATLAS MOBILE" : "ATLAS MOBILE"}</p>
        <strong>${french ? "Installer TRC Atlas" : "Install TRC Atlas"}</strong>
        <span>${french ? "Ajoutez Atlas à l’écran d’accueil pour l’ouvrir comme une application." : "Add Atlas to your home screen and open it like an app."}</span>
      </div>
      <button class="pwa-install-close" type="button" data-action="dismiss-pwa-install" aria-label="${french ? "Masquer la proposition d’installation" : "Hide the install suggestion"}">${icon("close", 17)}</button>
      <div class="pwa-install-actions">
        <button class="primary" type="button" data-action="install-pwa">${icon("download", 16)} ${actionLabel}</button>
        <small>${french ? "Même instance, mêmes comptes, aucune copie externe." : "Same instance and accounts, with no external copy."}</small>
      </div>
    </aside>`;
  }

  function showPwaInstallInstructions() {
    const french = state.locale !== "en";
    const ios = /iPhone|iPad|iPod/i.test(window.navigator.userAgent || "") && !window.MSStream;
    const steps = ios
      ? (french ? ["Touchez le bouton Partager du navigateur.", "Choisissez « Sur l’écran d’accueil ».", "Touchez Ajouter pour confirmer."] : ["Tap the browser Share button.", "Choose Add to Home Screen.", "Tap Add to confirm."])
      : (french ? ["Ouvrez le menu du navigateur.", "Choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».", "Confirmez l’installation de TRC Atlas."] : ["Open the browser menu.", "Choose Install app or Add to Home Screen.", "Confirm the TRC Atlas installation."]);
    overlayRoot.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><section class="modal pwa-install-dialog" role="dialog" aria-modal="true" aria-labelledby="pwa-install-title" data-modal-stop>
      <div class="modal-heading"><div><p class="eyebrow">${french ? "APPLICATION MOBILE" : "MOBILE APP"}</p><h2 id="pwa-install-title">${french ? "Installer TRC Atlas" : "Install TRC Atlas"}</h2><p>${french ? "Votre navigateur peut placer cette instance Atlas sur l’écran d’accueil." : "Your browser can place this Atlas instance on the home screen."}</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="${french ? "Fermer" : "Close"}">${icon("close", 18)}</button></div>
      <div class="pwa-install-dialog-body"><img src="/assets/trc-atlas-layers-logo.svg" alt="" /><ol>${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol><div class="notice">${icon("shield", 17)} ${french ? "L’application installée utilise ce même serveur Atlas. Elle ne duplique ni ne transmet vos données." : "The installed app uses this same Atlas server. It does not duplicate or transmit your data."}</div></div>
      <div class="modal-actions"><button class="primary" type="button" data-action="close-modal">${french ? "Compris" : "Got it"}</button></div>
    </section></div>`;
  }

  function showPasswordHealthHelp() {
    const french = state.locale !== "en";
    const criteria = french
      ? ["12 caractères ou plus", "16 caractères ou plus", "Majuscules et minuscules", "Au moins un chiffre et un symbole"]
      : ["12 characters or more", "16 characters or more", "Uppercase and lowercase letters", "At least one number and one symbol"];
    overlayRoot.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><section class="modal password-health-modal" role="dialog" aria-modal="true" aria-labelledby="password-health-help-title" data-modal-stop>
      <div class="modal-heading"><div><p class="eyebrow">${french ? "ÉVALUATION LOCALE" : "LOCAL EVALUATION"}</p><h2 id="password-health-help-title">${french ? "Comment la force est-elle calculée?" : "How is strength calculated?"}</h2><p>${french ? "Les anciens secrets sont évalués une fois; la note est ensuite recalculée à chaque création ou modification et conservée avec la fiche." : "Existing secrets are evaluated once; the score is then recalculated on every creation or edit and stored with the record."}</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="${french ? "Fermer" : "Close"}">${icon("close", 18)}</button></div>
      <div class="password-health-help-body"><div class="password-health-help-score"><span>${icon("shield", 23)}</span><div><strong>0–4</strong><small>${french ? "Un point par critère satisfait" : "One point per satisfied criterion"}</small></div></div><ol>${criteria.map((criterion) => `<li>${escapeHtml(criterion)}</li>`).join("")}</ol><div class="notice">${icon("lock", 17)} <span><strong>${french ? "Aucun secret n’est affiché ou transmis." : "No secret is displayed or transmitted."}</strong> ${french ? "Cette indication mesure seulement la structure du mot de passe; elle ne vérifie pas les fuites connues ni les dictionnaires d’attaque." : "This indicator measures password structure only; it does not check known breaches or attack dictionaries."}</span></div></div>
      <div class="modal-actions"><button class="primary" type="button" data-action="close-modal">${french ? "Compris" : "Got it"}</button></div>
    </section></div>`;
  }

  function showPasswordHealthBreakdown() {
    const french = state.locale !== "en";
    const organizations = state.workspace.organizations
      .filter((organization) => (state.dashboardIncludeTests || !isTestOrganization(organization)) && canAccessVault(organization.id))
      .map((organization) => ({ organization, snapshot: passwordHealthSnapshot(state.vaultItems.filter((item) => item.organizationId === organization.id)) }))
      .sort((a, b) => b.snapshot.attention - a.snapshot.attention || b.snapshot.total - a.snapshot.total || a.organization.name.localeCompare(b.organization.name, state.locale));
    overlayRoot.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><section class="modal password-health-modal password-health-breakdown-modal" role="dialog" aria-modal="true" aria-labelledby="password-health-breakdown-title" data-modal-stop>
      <div class="modal-heading"><div><p class="eyebrow">${french ? "VUE GLOBALE" : "GLOBAL VIEW"}</p><h2 id="password-health-breakdown-title">${french ? "Santé par compagnie" : "Health by company"}</h2><p>${french ? "Classement factuel des mots de passe actifs auxquels ce compte a accès." : "Factual breakdown of active passwords accessible to this account."}</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="${french ? "Fermer" : "Close"}">${icon("close", 18)}</button></div>
      <div class="password-health-org-list">${organizations.length ? organizations.map(({ organization, snapshot }) => `<button type="button" data-action="open-password-health-organization" data-id="${escapeHtml(organization.id)}"><span class="org-mark">${escapeHtml(organization.code || initials(organization.name))}</span><span><strong>${escapeHtml(organization.name)}</strong><small>${snapshot.total} ${french ? `mot${snapshot.total === 1 ? "" : "s"} de passe` : `password${snapshot.total === 1 ? "" : "s"}`}</small></span><span class="password-health-org-stat ${snapshot.attention ? "warning" : "success"}"><b>${snapshot.attention}</b><small>${french ? "à renforcer" : "to improve"}</small></span><span class="password-health-org-stat neutral"><b>${snapshot.counts.notEvaluated}</b><small>${french ? "non évalué" : "not evaluated"}</small></span>${icon("chevron", 15)}</button>`).join("") : emptyState(french ? "Aucune compagnie accessible." : "No accessible company.")}</div>
      <div class="modal-actions"><button class="secondary" type="button" data-action="close-modal">${french ? "Fermer" : "Close"}</button></div>
    </section></div>`;
  }

  async function requestPwaInstall() {
    if (isStandaloneApp()) {
      renderPwaInstallBanner();
      return;
    }
    if (!deferredInstallPrompt) {
      showPwaInstallInstructions();
      return;
    }
    const prompt = deferredInstallPrompt;
    deferredInstallPrompt = null;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice?.outcome === "accepted") {
      pwaInstalledThisVisit = true;
      localStorage.removeItem(storageKeys.pwaInstallDismissedUntil);
      toast(state.locale === "en" ? "TRC Atlas installation started." : "Installation de TRC Atlas lancée.");
    }
    renderPwaInstallBanner();
  }

  function registerPwaSupport() {
    const localHost = ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
    const browserNavigator = window.navigator;
    if (!browserNavigator?.serviceWorker || (location.protocol !== "https:" && !localHost)) return;
    browserNavigator.serviceWorker.register("/service-worker.js", { scope: "/" }).catch(() => {});
  }

  function initializePwaInstall() {
    registerPwaSupport();
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      renderPwaInstallBanner();
    });
    window.addEventListener("appinstalled", () => {
      deferredInstallPrompt = null;
      pwaInstalledThisVisit = true;
      localStorage.removeItem(storageKeys.pwaInstallDismissedUntil);
      renderPwaInstallBanner();
    });
    window.addEventListener("resize", renderPwaInstallBanner, { passive: true });
    const standaloneQuery = window.matchMedia?.("(display-mode: standalone)");
    standaloneQuery?.addEventListener?.("change", renderPwaInstallBanner);
  }

  function parseRoute() {
    const parts = (location.hash.replace(/^#\/?/, "") || "dashboard").split("/").filter(Boolean);
    state.page = parts[0] || "dashboard";
    const rawDetail = ["configuration", "module", "organization", "asset", "record", "help", "settings"].includes(parts[0]) ? parts[1] || null : null;
    try { state.detailId = rawDetail ? decodeURIComponent(rawDetail) : null; } catch { state.detailId = rawDetail; }
    const rawRecordId = state.page === "record" ? parts[2] || null : null;
    try { state.recordId = rawRecordId ? decodeURIComponent(rawRecordId) : null; } catch { state.recordId = rawRecordId; }
    if (state.page === "organization" && state.detailId) state.searchScope = state.detailId;
    if (!(state.page === "settings" && state.detailId === "integrations")) {
      state.createdApiToken = "";
      state.createdWebhookSecret = "";
    }
  }

  async function boot() {
    applyPreferences();
    parseRoute();
    try {
      state.status = await api("/api/status");
      if (!state.status.initialized) {
        state.phase = "setup";
      } else {
        try {
          const session = await api("/api/me");
          state.user = session.user;
          state.csrf = session.csrf;
          scheduleSessionExpiry(session.sessionExpiresAt);
          applyVaultUnlock(session.vaultUnlockedUntil);
          loadModulePreferences();
          await loadWorkspace();
          await Promise.all([loadVault(), loadAttachments(), loadWorkspaceHistory(), loadSessions(), loadAudit()]);
          if (state.page === "asset" && state.detailId) await loadAssetHistory(state.detailId);
          await loadUsers();
          if (state.page === "settings" && state.user?.role === "administrator") await loadDeploymentHealth({ renderAfter: false });
          state.phase = "app";
          if (state.page === "asset" && state.detailId?.startsWith("vault:") && vaultSessionUnlocked()) {
            await revealVaultItem(state.detailId.slice(6), { promptOnLocked: false });
          }
        } catch {
          state.phase = "login";
        }
      }
    } catch (error) {
      state.phase = "error";
      state.error = error.message;
    }
    render();
  }

  async function loadWorkspace() {
    const document = await api("/api/workspace");
    state.workspace = document.data;
    normalizeWorkspace();
    state.revision = document.revision;
    loadModulePreferences();
  }

  async function loadDeploymentHealth({ renderAfter = true } = {}) {
    if (!isAdministrator() || state.deploymentHealthLoading) return;
    state.deploymentHealthLoading = true;
    if (renderAfter) render();
    try {
      state.deploymentHealth = await api("/api/settings/deployment/health");
    } catch (error) {
      state.deploymentHealth = { error: error.message, checks: [], summary: { ok: 0, warning: 1, neutral: 0, total: 1 } };
    } finally {
      state.deploymentHealthLoading = false;
      if (renderAfter) render();
    }
  }

  async function loadBackupStatus({ renderAfter = true } = {}) {
    if (!isAdministrator() || state.backupLoading) return;
    state.backupLoading = true;
    if (renderAfter) render();
    try { state.backupStatus = await api("/api/settings/backups"); }
    catch (error) { state.backupStatus = { error: error.message, files: [], settings: null }; }
    finally { state.backupLoading = false; if (renderAfter) render(); }
  }

  async function loadUpdateStatus({ renderAfter = true } = {}) {
    if (!isAdministrator() || state.updateLoading) return;
    state.updateLoading = true;
    if (renderAfter) render();
    try { state.updateStatus = await api("/api/settings/updates"); }
    catch (error) { state.updateStatus = { error: error.message, currentVersion: ATLAS_VERSION, lastCheck: null }; }
    finally { state.updateLoading = false; if (renderAfter) render(); }
  }

  async function loadLocalApiStatus({ renderAfter = true } = {}) {
    if (!isAdministrator() || state.localApiLoading) return;
    state.localApiLoading = true;
    if (renderAfter) render();
    try { state.localApiStatus = await api("/api/settings/local-api"); }
    catch (error) { state.localApiStatus = { error: error.message, enabled: false, tokens: [] }; }
    finally { state.localApiLoading = false; if (renderAfter) render(); }
  }

  function refreshModuleDefinitions() {
    const allowedIcons = new Set(["grid", "server", "book", "users", "globe", "pin", "key", "lock", "network", "refresh", "mail", "file", "printer", "phone", "wifi", "shield", "activity"]);
    const localModules = (state.workspace?.customModuleDefinitions || []).map((definition) => ({
      id: definition.id,
      label: definition.label,
      icon: allowedIcons.has(definition.icon) ? definition.icon : "grid",
      group: "custom",
      description: definition.description || `Module personnalisé : ${definition.label}.`,
      titleLabel: definition.titleLabel || "Nom de la fiche",
      fields: definition.fields || [],
      userDefined: true,
      archived: definition.archived === true,
    })).filter((module) => !module.archived && !builtInModuleDefinitions.some((builtIn) => builtIn.id === module.id));
    moduleDefinitions = [...builtInModuleDefinitions, ...localModules];
    moduleMap.clear();
    moduleDefinitions.forEach((module) => moduleMap.set(module.id, module));
  }

  function normalizeWorkspace() {
    if (!Array.isArray(state.workspace.moduleRecords)) state.workspace.moduleRecords = [];
    if (!Array.isArray(state.workspace.customModuleDefinitions)) state.workspace.customModuleDefinitions = [];
    if (!Array.isArray(state.workspace.relations)) state.workspace.relations = [];
    if (!Array.isArray(state.workspace.relationshipEvents)) state.workspace.relationshipEvents = [];
    if (!Array.isArray(state.workspace.templates)) state.workspace.templates = [
      { id: "tpl-contact-technique", name: "Contact technique", moduleId: "contacts", defaultTags: ["technique"], defaultSummary: "Contact technique principal.", defaultNotes: "Téléphone :\nDisponibilités :\nEscalade :" },
      { id: "tpl-renouvellement-domaine", name: "Renouvellement de domaine", moduleId: "domain-tracker", defaultTags: ["renouvellement"], defaultSummary: "Suivi du domaine et de son registraire.", defaultNotes: "Registraire :\nRenouvellement automatique :\nDNS autoritaires :" },
      { id: "tpl-certificat-tls", name: "Certificat TLS", moduleId: "ssl-tracker", defaultTags: ["tls", "échéance"], defaultSummary: "Certificat et service protégé.", defaultNotes: "Émetteur :\nNom alternatif :\nProcédure de renouvellement :" },
      { id: "tpl-fiche-application", name: "Application métier", moduleId: "service-applications", defaultTags: ["application"], defaultSummary: "Application, propriétaire et dépendances.", defaultNotes: "Éditeur :\nSupport :\nAuthentification :\nDépendances :" },
    ];
    if (!state.workspace.settings.workflows) state.workspace.settings.workflows = { expiryDays: 30, staleDays: 90, requireOwner: true };
    if (!state.workspace.settings.security) state.workspace.settings.security = { privilegedMfaEnabled: true, passwordRotationEnabled: false, passwordRotationDays: 90, passwordRotationReminderDays: 14 };
    state.workspace.settings.security = {
      privilegedMfaEnabled: state.workspace.settings.security.privilegedMfaEnabled !== false,
      passwordRotationEnabled: state.workspace.settings.security.passwordRotationEnabled === true,
      passwordRotationDays: Number(state.workspace.settings.security.passwordRotationDays) || 90,
      passwordRotationReminderDays: Number(state.workspace.settings.security.passwordRotationReminderDays) || 14,
    };
    const deployment = state.workspace.settings.deployment || {};
    state.workspace.settings.deployment = {
      instanceCode: String(deployment.instanceCode || "ATLAS").trim().toUpperCase(),
      primaryDomain: String(deployment.primaryDomain || "").trim().toLowerCase(),
      domainAliases: Array.isArray(deployment.domainAliases) ? deployment.domainAliases.map((domain) => String(domain).trim().toLowerCase()).filter(Boolean) : [],
      accessMode: deployment.accessMode === "reverse-proxy" ? "reverse-proxy" : "local",
      reverseProxy: ["nginx", "iis", "caddy", "other"].includes(deployment.reverseProxy) ? deployment.reverseProxy : "nginx",
      certificateManagement: "reverse-proxy",
    };
    for (const organization of state.workspace.organizations) {
      organization.parentOrganizationId = String(organization.parentOrganizationId || "");
      organization.quickNotes = String(organization.quickNotes || "");
    }
    const firstOrganizationId = state.workspace.organizations[0]?.id || "";
    for (const procedure of state.workspace.procedures) {
      if (!procedure.organizationId) {
        procedure.organizationId = state.workspace.configurations.find((configuration) => (configuration.procedureIds || []).includes(procedure.id))?.organizationId || firstOrganizationId;
      }
    }
    state.workspace.relations = state.workspace.relations.map((relation) => {
      if (relation.sourceRef && relation.targetRef) {
        const relationType = relation.relationType || relationshipTypeIdFromLabel(relation.label || relation.type);
        const type = relationshipTypeById(relationType);
        return {
          archived: false,
          notes: "",
          createdAt: state.workspace.updatedAt || new Date().toISOString(),
          createdBy: "Migration Atlas",
          updatedAt: state.workspace.updatedAt || new Date().toISOString(),
          ...relation,
          relationType,
          label: relation.label || relation.type || type.label || "Associé à",
          reverseLabel: relation.reverseLabel || type.reverseLabel || relation.label || relation.type || "Associé à",
        };
      }
      const source = state.workspace.configurations.find((configuration) => configuration.id === relation.fromId);
      const target = state.workspace.configurations.find((configuration) => configuration.id === relation.toId);
      const relationType = relationshipTypeIdFromLabel(relation.type);
      const type = relationshipTypeById(relationType);
      return {
        id: relation.id,
        organizationId: source?.organizationId || target?.organizationId || firstOrganizationId,
        sourceRef: `configuration:${relation.fromId}`,
        targetRef: `configuration:${relation.toId}`,
        relationType,
        label: relation.type || type.label,
        reverseLabel: type.reverseLabel,
        notes: relation.description || "",
        archived: false,
        createdAt: state.workspace.updatedAt || new Date().toISOString(),
        createdBy: "Migration Atlas",
        updatedAt: state.workspace.updatedAt || new Date().toISOString(),
      };
    });
    for (const configuration of state.workspace.configurations) {
      for (const procedureId of configuration.procedureIds || []) {
        const sourceRef = `configuration:${configuration.id}`;
        const targetRef = `procedure:${procedureId}`;
        if (state.workspace.relations.some((relation) => [relation.sourceRef, relation.targetRef].includes(sourceRef) && [relation.sourceRef, relation.targetRef].includes(targetRef))) continue;
        const type = relationshipTypeById("procedure-associated");
        state.workspace.relations.push({
          id: uniqueId("rel", `${configuration.id}-${procedureId}`, state.workspace.relations), organizationId: configuration.organizationId,
          sourceRef, targetRef, relationType: type.id, label: type.label, reverseLabel: type.reverseLabel,
          notes: "Relation migrée depuis la procédure associée à la configuration.", archived: false,
          createdAt: state.workspace.updatedAt || new Date().toISOString(), createdBy: "Migration Atlas", updatedAt: state.workspace.updatedAt || new Date().toISOString(),
        });
      }
    }
    state.workspace.schemaVersion = Math.max(Number(state.workspace.schemaVersion) || 1, 5);
    refreshModuleDefinitions();
  }

  function modulePreferenceKey() {
    return `${storageKeys.modules}:${state.user?.id || "anonymous"}`;
  }

  function loadModulePreferences() {
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(modulePreferenceKey())); } catch { stored = null; }
    const accountPreference = state.user?.preferences?.visibleModules;
    const source = Array.isArray(accountPreference) ? accountPreference : stored;
    const valid = Array.isArray(source) ? source.filter((id) => moduleMap.has(id)) : defaultVisibleModuleIds;
    state.visibleModuleIds = new Set(valid);
  }

  async function loadUsers() {
    if (state.user?.role !== "administrator") { state.users = []; return; }
    try {
      const payload = await api("/api/users");
      state.users = payload.users;
    } catch {
      state.users = [];
    }
  }

  async function loadSessions() {
    try { state.sessions = (await api("/api/me/sessions")).sessions || []; }
    catch { state.sessions = []; }
  }

  async function loadAudit() {
    if (!isAdministrator()) { state.auditEntries = []; return; }
    try { state.auditEntries = (await api("/api/audit?limit=500")).entries || []; }
    catch { state.auditEntries = []; }
  }

  async function loadVault() {
    if (!canAccessVault()) { state.vaultItems = []; state.vaultUnlockedUntil = 0; return; }
    try {
      const payload = await api("/api/vault");
      state.vaultItems = payload.items || [];
    } catch {
      state.vaultItems = [];
    }
  }

  async function revealVaultItem(id, { promptOnLocked = true } = {}) {
    if (!id) return false;
    try {
      const payload = await api(`/api/vault/${encodeURIComponent(id)}/reveal`, { method: "POST", body: "{}" });
      state.revealedVaultItem = payload.item;
      state.visibleVaultFields.clear();
      applyVaultUnlock(payload.unlockedUntil || new Date(state.sessionExpiresAt).toISOString());
      if (state.page === "asset" && state.detailId === `vault:${payload.item.id}`) render();
      else navigate(`asset/${encodeURIComponent(`vault:${payload.item.id}`)}`);
      return true;
    } catch (error) {
      if (error.code === "vault_locked") {
        state.vaultUnlockedUntil = 0;
        if (promptOnLocked) {
          state.pendingVaultReveal = id;
          showModal("vault-unlock");
        }
      } else {
        toast(error.message, "error");
      }
      return false;
    }
  }

  async function loadAttachments() {
    try {
      const payload = await api("/api/attachments");
      state.attachments = payload.items || [];
      state.attachmentEvents = payload.events || [];
    } catch {
      state.attachments = [];
      state.attachmentEvents = [];
    }
  }

  async function loadWorkspaceHistory() {
    try {
      const payload = await api("/api/workspace/history");
      state.workspaceHistory = payload.entries || [];
    } catch {
      state.workspaceHistory = [];
    }
  }

  async function loadAssetHistory(ref) {
    if (!ref) return;
    state.assetRevisions[ref] = null;
    try {
      const payload = await api(`/api/assets/${encodeURIComponent(ref)}/history`);
      state.assetRevisions[ref] = payload.entries || [];
    } catch {
      state.assetRevisions[ref] = [];
    }
  }

  function render() {
    applyPreferences();
    renderPwaInstallBanner();
    if (state.phase === "loading") return renderLoading();
    if (state.phase === "setup") return renderSetup();
    if (state.phase === "login") return renderLogin();
      if (state.phase === "password-change") return renderRequiredPasswordChange();
      if (state.phase === "mfa-setup") return renderMfaSetup();
      if (state.phase === "mfa-verify") return renderMfaVerify();
      if (state.phase === "recovery-codes") return renderRecoveryCodes();
    if (state.phase === "error") return renderError();
    renderShell();
  }

  function authFrame(content) {
    return `<main class="auth-screen">
      <section class="auth-brand-panel">
        <img class="atlas-logo auth-logo" src="/assets/trc-atlas-layers-logo.svg" alt="" />
        <div class="auth-brand-copy">
          <p class="eyebrow">TRC COMMUNITY</p>
          <h1><strong>TRC</strong> Community Atlas</h1>
          <p>Documentez votre environnement. Reliez les informations. Gardez le contrôle de vos données.</p>
        </div>
        <div class="auth-local-note">${icon("shield", 17)} Self-hosted · aucune dépendance externe</div>
      </section>
      <section class="auth-form-panel">${content}</section>
    </main>`;
  }

  function renderLoading() {
    app.innerHTML = authFrame(`<div class="auth-card"><div class="spinner"></div><p>Chargement de l’instance locale…</p></div>`);
  }

  function renderSetup() {
    app.innerHTML = authFrame(`<form class="auth-card" data-form="setup">
      <div class="auth-heading"><span class="step-pill">Première ouverture</span><h2>Créer l’administrateur local</h2><p>Ce compte appartient uniquement à cette instance Atlas.</p></div>
      <label>Nom affiché<input name="displayName" autocomplete="name" required maxlength="96" placeholder="Votre nom" /></label>
      <label>Nom d’utilisateur<input name="username" autocomplete="username" required minlength="3" maxlength="64" placeholder="admin" /></label>
      <label>Mot de passe<input name="password" type="password" autocomplete="new-password" required minlength="10" maxlength="256" placeholder="10 caractères minimum" /></label>
      <label>Confirmer le mot de passe<input name="confirmPassword" type="password" autocomplete="new-password" required minlength="10" maxlength="256" /></label>
      <div class="form-error" role="alert"></div>
      <button class="primary full" type="submit">Initialiser mon Atlas ${icon("arrow")}</button>
      <p class="auth-footnote">Les identifiants sont dérivés localement avec scrypt. Aucun mot de passe n’est transmis hors de cette VM.</p>
    </form>`);
  }

  function renderLogin() {
    app.innerHTML = authFrame(`<form class="auth-card" data-form="login">
      <div class="auth-heading"><span class="step-pill">Instance locale</span><h2>Bienvenue dans Atlas</h2><p>Connectez-vous avec votre compte local.</p></div>
      ${state.authNotice ? `<div class="auth-notice" role="status">${icon("clock", 17)}<span>${escapeHtml(state.authNotice)}</span></div>` : ""}
      <label>Nom d’utilisateur<input name="username" autocomplete="username" required autofocus /></label>
      <label>Mot de passe<input name="password" type="password" autocomplete="current-password" required /></label>
      <div class="form-error" role="alert"></div>
      <button class="primary full" type="submit">Se connecter ${icon("arrow")}</button>
      <div class="auth-security">${icon("shield", 16)} Session locale · expiration automatique après 8 heures</div>
    </form>`);
  }

  function renderRequiredPasswordChange() {
    app.innerHTML = authFrame(`<form class="auth-card" data-form="password-change-required">
      <div class="auth-heading"><span class="step-pill">Mot de passe temporaire</span><h2>Choisir votre mot de passe</h2><p>Un administrateur a créé ou réinitialisé ce compte. Remplacez le mot de passe temporaire avant l’activation MFA.</p></div>
      <label>Nouveau mot de passe<input name="password" type="password" autocomplete="new-password" required minlength="10" maxlength="256" autofocus /></label>
      <label>Confirmer le mot de passe<input name="confirmPassword" type="password" autocomplete="new-password" required minlength="10" maxlength="256" /></label>
      <div class="form-error" role="alert"></div>
      <button class="primary full" type="submit">Enregistrer et continuer ${icon("arrow")}</button>
      <button class="text-button" type="button" data-action="back-login">Retour à la connexion</button>
    </form>`);
  }

  function enterAuthenticationChallenge(session) {
    if (session.passwordChangeRequired) {
      state.pendingMfaToken = session.pendingToken;
      state.phase = "password-change";
      render();
      return true;
    }
    if (session.mfaSetupRequired) {
      state.pendingMfaToken = session.pendingToken;
      state.mfaSecret = session.secret;
      state.mfaUri = session.otpauthUri;
      state.phase = "mfa-setup";
      render();
      return true;
    }
    if (session.mfaRequired) {
      state.pendingMfaToken = session.pendingToken;
      state.phase = "mfa-verify";
      render();
      return true;
    }
    return false;
  }

  function renderMfaSetup() {
    app.innerHTML = authFrame(`<form class="auth-card" data-form="mfa-setup">
      <div class="auth-heading"><span class="step-pill">MFA local obligatoire</span><h2>Protéger ce compte</h2><p>Ajoutez cette instance dans votre application d’authentification, puis entrez le code à 6 chiffres.</p></div>
      <div class="mfa-secret"><span>Clé de configuration</span><code>${escapeHtml(state.mfaSecret)}</code><small>Type : TOTP · 6 chiffres · 30 secondes</small></div>
      <label>Code de vérification<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required autofocus placeholder="000000" /></label>
      <div class="form-error" role="alert"></div>
      <button class="primary full" type="submit">Activer le MFA ${icon("shield", 17)}</button>
      <p class="auth-footnote">Le secret MFA reste dans le fichier d’authentification local de cette instance.</p>
    </form>`);
  }

  function renderMfaVerify() {
    app.innerHTML = authFrame(`<form class="auth-card" data-form="mfa-verify">
      <div class="auth-heading"><span class="step-pill">Deuxième facteur</span><h2>Vérifier votre identité</h2><p>Entrez le code de votre application d’authentification ou un code de récupération.</p></div>
      <label>Code MFA ou récupération<input name="code" autocomplete="one-time-code" required autofocus maxlength="32" placeholder="000000" /></label>
      <div class="form-error" role="alert"></div>
      <button class="primary full" type="submit">Continuer ${icon("arrow")}</button>
      <button class="text-button" type="button" data-action="back-login">Retour à la connexion</button>
    </form>`);
  }

  function renderRecoveryCodes() {
    app.innerHTML = authFrame(`<div class="auth-card recovery-card">
      <div class="auth-heading"><span class="step-pill">À conserver maintenant</span><h2>Codes de récupération</h2><p>Chaque code fonctionne une seule fois si votre application MFA n’est pas disponible. Ils ne seront plus affichés.</p></div>
      <div class="recovery-codes">${state.recoveryCodes.map((code) => `<code>${escapeHtml(code)}</code>`).join("")}</div>
      <button class="primary full" type="button" data-action="continue-after-recovery">J’ai conservé mes codes ${icon("check")}</button>
      <p class="auth-footnote">Conservez-les dans un endroit sûr distinct de cette instance.</p>
    </div>`);
  }

  function renderError() {
    app.innerHTML = authFrame(`<div class="auth-card"><div class="error-symbol">!</div><h2>Atlas n’a pas pu démarrer</h2><p>${escapeHtml(state.error)}</p><button class="secondary" data-action="reload">Réessayer</button></div>`);
  }

  function searchScopeOptionsMarkup() {
    const query = normalizeSearch(state.searchScopeQuery);
    const counts = new Map(state.workspace.organizations.map((organization) => [organization.id, 0]));
    const count = (item) => counts.set(item.organizationId, (counts.get(item.organizationId) || 0) + 1);
    state.workspace.sites.forEach(count);
    state.workspace.configurations.forEach(count);
    state.workspace.procedures.forEach(count);
    state.workspace.moduleRecords.filter((item) => item.status !== "archived").forEach(count);
    state.vaultItems.filter((item) => !item.archived).forEach(count);
    const organizations = state.workspace.organizations
      .filter((organization) => !query || normalizeSearch([organizationPathLabel(organization.id), organization.code, organization.industry, organization.owner].join(" ")).includes(query))
      .sort((a, b) => organizationPathLabel(a.id).localeCompare(organizationPathLabel(b.id), state.locale));
    const globalLabel = state.locale === "fr" ? "Toutes les organisations" : "All organizations";
    const globalNote = state.locale === "fr" ? `${state.workspace.organizations.length} organisations disponibles` : `${state.workspace.organizations.length} organizations available`;
    return `<button class="search-scope-option global ${state.searchScope === "global" ? "active" : ""}" type="button" role="option" aria-selected="${state.searchScope === "global"}" data-action="select-search-scope" data-scope-id="global"><span class="search-scope-option-icon">${icon("grid", 16)}</span><span><strong>${globalLabel}</strong><small>${globalNote}</small></span>${state.searchScope === "global" ? icon("check", 16) : ""}</button>
      <div class="search-scope-section-heading"><span>${state.locale === "fr" ? "ORGANISATIONS" : "ORGANIZATIONS"}</span><strong>${organizations.length}</strong></div>
      ${organizations.length ? organizations.map((organization) => { const parentPath = organizationAncestors(organization.id).map((ancestor) => ancestor.name).join(" › "); return `<button class="search-scope-option ${state.searchScope === organization.id ? "active" : ""}" type="button" role="option" aria-selected="${state.searchScope === organization.id}" data-action="select-search-scope" data-scope-id="${escapeHtml(organization.id)}"><span class="org-mark search-scope-mark">${escapeHtml(organization.code)}</span><span><strong>${escapeHtml(organization.name)}</strong><small>${parentPath ? `${escapeHtml(parentPath)} · ` : ""}${escapeHtml(organization.industry || organization.owner || "Organisation Atlas")} · ${counts.get(organization.id) || 0} éléments</small></span>${state.searchScope === organization.id ? icon("check", 16) : ""}</button>`; }).join("") : `<div class="search-scope-empty">${icon("search", 18)}<strong>Aucune organisation trouvée</strong><span>Essayez un nom, un code ou un responsable.</span></div>`}`;
  }

  function searchScopeMenuMarkup() {
    if (!state.searchScopeOpen) return "";
    return `<div class="search-scope-popover" role="listbox" aria-label="${state.locale === "fr" ? "Choisir la portée de recherche" : "Choose search scope"}"><label class="search-scope-filter">${icon("search", 15)}<span class="sr-only">Filtrer les organisations</span><input type="search" data-search-scope-query value="${escapeHtml(state.searchScopeQuery)}" placeholder="Filtrer les organisations…" autocomplete="off" /></label><div class="search-scope-options" data-search-scope-options>${searchScopeOptionsMarkup()}</div></div>`;
  }

  function activeSearchScopeName() {
    if (state.searchScope === "global") return state.locale === "fr" ? "Toutes les organisations" : "All organizations";
    return orgName(state.searchScope);
  }

  function searchPlaceholder() {
    if (state.searchScope === "global") return state.locale === "fr" ? "Rechercher dans toutes les organisations…" : "Search all organizations…";
    return state.locale === "fr" ? `Rechercher dans ${activeSearchScopeName()}…` : `Search in ${activeSearchScopeName()}…`;
  }

  function helpText(value) {
    if (typeof value === "string") return value;
    return value?.[state.locale] || value?.fr || value?.en || "";
  }

  function helpMenuMarkup() {
    if (!state.helpMenuOpen) return "";
    const link = (route, iconName, fr, en, noteFr = "", noteEn = "") => `<button type="button" role="menuitem" data-route="${route}">${icon(iconName, 17)}<span><strong>${state.locale === "fr" ? fr : en}</strong>${noteFr || noteEn ? `<small>${state.locale === "fr" ? noteFr : noteEn}</small>` : ""}</span>${icon("chevron", 14)}</button>`;
    return `<div class="help-menu-popover" role="menu" aria-label="${state.locale === "fr" ? "Aide Atlas" : "Atlas help"}">
      <header><span>${state.locale === "fr" ? "AIDE ATLAS" : "ATLAS HELP"}</span><strong>${state.locale === "fr" ? "Documentation locale" : "Local documentation"}</strong></header>
      <div class="help-menu-links">
        ${link("help", "book", "Centre d’aide", "Help center", "Guides et recherche", "Guides and search")}
        ${link("help/welcome", "layers", "Découvrir Atlas", "Discover Atlas", "Concepts essentiels", "Essential concepts")}
        ${link("help/accounts-permissions", "shield", "Sécurité et accès", "Security and access", "MFA, rôles et coffre", "MFA, roles and vault")}
        ${link("help/backups", "download", "Sauvegardes", "Backups", "Protection de l’instance", "Instance protection")}
        ${link("help/release-notes", "history", "Notes de version", "Release notes", "Nouveautés récentes", "Recent changes")}
        ${link("help/github-installation", "external", "GitHub et installation", "GitHub and installation", "Code source disponible", "Source code available")}
      </div>
      <footer><span><i></i> TRC Community Atlas <strong>v${ATLAS_VERSION}</strong></span><button type="button" data-route="help/release-notes">${state.locale === "fr" ? "Nouveautés" : "What’s new"}</button></footer>
    </div>`;
  }

  function renderShell() {
    const currentSidebarNavigation = document.querySelector("#atlas-navigation > nav");
    if (currentSidebarNavigation && !state.preserveSidebarScroll) state.sidebarScrollTop = currentSidebarNavigation.scrollTop;
    const routeOrganizationId = activeOrganizationId();
    if (routeOrganizationId && state.searchScope === "global" && requiresOrganizationContext()) activateOrganizationContext(routeOrganizationId);
    if (!activeOrganizationId() && requiresOrganizationContext()) {
      state.page = "dashboard";
      state.detailId = null;
      state.recordId = null;
      state.filter = "all";
      if (location.hash !== "#/dashboard") window.history.replaceState(null, "", "#/dashboard");
    }
    const instanceName = state.workspace.settings.instanceName || t("instance");
    const deployment = state.workspace.settings.deployment;
    const deploymentNeedsAttention = deployment.accessMode === "reverse-proxy" && !deployment.primaryDomain;
    app.innerHTML = `<a class="skip-link" href="#main-content">Aller au contenu</a>
      <div class="console-layout ${state.mobileNavigation ? "nav-open" : ""}">
        <aside class="sidebar" id="atlas-navigation">
          <div class="sidebar-brand">
            <div class="brand"><img class="atlas-logo sidebar-logo" src="/assets/trc-atlas-layers-logo.svg" alt="" /><span><span class="brand-name"><strong>TRC</strong><span>Atlas</span></span><span class="brand-community">Community</span></span></div>
            <button class="icon-button mobile-only" data-action="close-nav" aria-label="${t("close")}">${icon("close")}</button>
          </div>
          <div class="instance-card"><span class="instance-initial">${escapeHtml(deployment.instanceCode.slice(0, 3))}</span><div><strong>${escapeHtml(instanceName)}</strong><span>${deployment.primaryDomain ? escapeHtml(deployment.primaryDomain) : t("instance")}</span></div><span class="status-dot ${deploymentNeedsAttention ? "warning" : "good"}" title="${deploymentNeedsAttention ? "Configuration à compléter" : "Disponible"}"></span></div>
          <nav aria-label="Navigation principale">
            ${navLink(["workspace", "dashboard", "grid", "dashboard"])}
            ${navLink(["structure", "organizations", "building", "organizations"])}
             ${renderOrganizationNavigation()}
          </nav>
          <div class="sidebar-bottom">
            ${isAdministrator() ? `<button class="sidebar-system-link ${state.page === "settings" || state.page === "accounts" ? "active" : ""}" type="button" data-route="settings">${icon("settings", 16)}<span><strong>Paramètres</strong><small>Administration Atlas</small></span>${state.deploymentHealth?.summary?.warning ? `<b>${state.deploymentHealth.summary.warning}</b>` : icon("chevron", 14)}</button>` : ""}
            <div class="local-note">${icon("shield", 15)} <span>${t("localOnly")}</span></div>
            <div class="sidebar-user"><span class="avatar">${initials(state.user.displayName)}</span><div><strong>${escapeHtml(state.user.displayName)}</strong><span>${escapeHtml(roleLabel(state.user.role))}</span></div><button class="icon-button" data-action="logout" title="${t("signOut")}" aria-label="${t("signOut")}">${icon("logout", 17)}</button></div>
          </div>
        </aside>
        <button class="navigation-scrim" data-action="close-nav" aria-label="${t("close")}"></button>
        <div class="content-shell">
          <header class="topbar">
            <button class="icon-button mobile-only" data-action="open-nav" aria-label="Menu">${icon("menu")}</button>
            <div class="global-search" role="search">
              <div class="global-search-scope-root" data-search-scope-root>
                <button id="global-search-scope" class="global-search-scope ${state.searchScopeOpen ? "open" : ""}" type="button" data-action="toggle-search-scope" data-search-scope aria-haspopup="listbox" aria-expanded="${state.searchScopeOpen}" aria-label="${state.locale === "fr" ? "Portée de la recherche" : "Search scope"}">${icon(state.searchScope === "global" ? "grid" : "building", 15)}<span>${escapeHtml(activeSearchScopeName())}</span>${icon("chevron", 13)}</button>
                ${searchScopeMenuMarkup()}
              </div>
              <div class="global-search-field">
                ${icon("search", 17)}
                <input id="global-search" type="search" autocomplete="off" value="${escapeHtml(state.search)}" placeholder="${escapeHtml(searchPlaceholder())}" aria-label="${t("search")}" />
                <kbd>Ctrl K</kbd>
              </div>
              <div id="search-results"></div>
            </div>
            <div class="topbar-actions">
              <button class="icon-button" data-action="toggle-theme" title="${t("appearance")}" aria-label="${t("appearance")}">${icon(state.theme === "dark" ? "sun" : "moon")}</button>
              <button class="language-button" data-action="toggle-locale" aria-label="${t("language")}">${state.locale.toUpperCase()}</button>
              <div class="help-menu-root" data-help-menu-root>
                <button class="icon-button help-menu-trigger ${state.helpMenuOpen ? "active" : ""}" type="button" data-action="toggle-help-menu" title="${state.locale === "fr" ? "Aide" : "Help"}" aria-label="${state.locale === "fr" ? "Ouvrir l’aide Atlas" : "Open Atlas help"}" aria-haspopup="menu" aria-expanded="${state.helpMenuOpen}">${icon("help", 21)}<span class="help-update-dot" aria-hidden="true"></span></button>
                ${helpMenuMarkup()}
              </div>
              <button class="profile-button" data-route="my-account"><span class="avatar small">${initials(state.user.displayName)}</span><span class="desktop-only">${escapeHtml(state.user.displayName.split(" ")[0])}</span></button>
            </div>
          </header>
          <main id="main-content" tabindex="-1">${renderPage()}</main>
        </div>
      </div>`;
    restoreSidebarNavigation();
    if (state.search && !state.searchScopeOpen) renderSearchResults();
  }

  function renderOrganizationNavigation() {
    if (!activeOrganizationId()) return "";
    return `<label class="sidebar-module-search">${icon("search", 14)}<input type="search" data-sidebar-module-search value="${escapeHtml(state.sidebarModuleSearch)}" placeholder="Filtrer les modules…" aria-label="Filtrer les modules visibles" /></label>
      ${renderSidebarModuleGroup("core", "Actifs de base")}
      ${renderSidebarModuleGroup("services", "Apps & Services")}
      ${renderSidebarModuleGroup("custom", "Types personnalisés")}
      ${renderAtlasToolsNavigation()}`;
  }

  function renderAtlasToolsNavigation() {
    const collapsed = state.collapsedNavGroups.has("tools");
    return `<section class="nav-module-group nav-tools-group ${collapsed ? "collapsed" : ""}">
      <button class="nav-group nav-group-toggle" data-action="toggle-nav-group" data-group="tools" aria-expanded="${!collapsed}"><span>Outils Atlas</span>${icon("chevron", 14)}</button>
      <div class="nav-group-items nav-tool-items">
        ${navLink(["documentation", "procedures", "book", "procedures"])}
        ${navLink(["documentation", "relations", "link", "relations"])}
        ${navLink(["workspace", "activity", "activity", "activity"])}
        <button class="nav-item ${state.page === "templates" ? "active" : ""}" data-route="templates">${icon("file")}<span>Modèles</span>${state.page === "templates" ? '<span class="nav-dot"></span>' : ""}</button>
        <button class="nav-item ${state.page === "workflows" ? "active" : ""}" data-route="workflows">${icon("refresh")}<span>Workflows</span>${state.page === "workflows" ? '<span class="nav-dot"></span>' : ""}</button>
        <button class="nav-item ${state.page === "versions" ? "active" : ""}" data-route="versions">${icon("history")}<span>Versions</span>${state.page === "versions" ? '<span class="nav-dot"></span>' : ""}</button>
        <button class="nav-item ${state.page === "data-tools" ? "active" : ""}" data-route="data-tools">${icon("download")}<span>Import / Export</span>${state.page === "data-tools" ? '<span class="nav-dot"></span>' : ""}</button>
        <button class="nav-item ${state.page === "manage-modules" ? "active" : ""}" data-route="manage-modules">${icon("settings")}<span>Gérer les modules</span>${state.page === "manage-modules" ? '<span class="nav-dot"></span>' : ""}</button>
      </div>
    </section>`;
  }

  function applySidebarModuleFilter() {
    const query = state.sidebarModuleSearch.trim().toLocaleLowerCase(state.locale);
    document.querySelectorAll(".nav-module-group").forEach((group) => {
      const links = [...group.querySelectorAll(".module-link")];
      links.forEach((link) => { link.hidden = Boolean(query) && !link.dataset.moduleNavLabel.includes(query); });
      const hasVisible = links.some((link) => !link.hidden);
      group.hidden = Boolean(query) && !hasVisible;
      group.classList.toggle("searching", Boolean(query) && hasVisible);
    });
  }

  function restoreSidebarNavigation() {
    const navigation = document.querySelector("#atlas-navigation > nav");
    if (!navigation) return;
    const scrollTop = Math.max(0, Number(state.sidebarScrollTop) || 0);
    navigation.scrollTop = scrollTop;
    applySidebarModuleFilter();
    requestAnimationFrame(() => {
      if (navigation.isConnected) navigation.scrollTop = scrollTop;
      state.preserveSidebarScroll = false;
    });
  }

  function renderSidebarModuleGroup(group, label) {
    const modules = moduleDefinitions.filter((module) => module.group === group && state.visibleModuleIds.has(module.id) && (module.id !== "passwords" || canAccessVault()));
    if (!modules.length && group !== "core") return "";
    const collapsed = state.collapsedNavGroups.has(group);
    return `<section class="nav-module-group ${collapsed ? "collapsed" : ""}">
      <button class="nav-group nav-group-toggle" data-action="toggle-nav-group" data-group="${group}" aria-expanded="${!collapsed}"><span>${escapeHtml(label)}</span>${icon("chevron", 14)}</button>
      <div class="nav-group-items">${modules.map(sidebarModuleLink).join("")}</div>
    </section>`;
  }

  function sidebarModuleLink(module) {
    const route = module.route || `module/${module.id}`;
    const asset = state.page === "asset" ? assetByRef(state.detailId) : null;
    const assetModuleId = asset?.type === "configuration" ? "configurations" : asset?.type === "site" ? "locations" : asset?.type === "vault" ? "passwords" : asset?.type === "module" ? asset.moduleId : "";
    const active = (module.route && (state.page === module.route || (module.id === "configurations" && state.page === "configuration"))) || (["module", "record"].includes(state.page) && state.detailId === module.id) || assetModuleId === module.id;
    return `<button class="nav-item module-link ${active ? "active" : ""}" data-module-nav-label="${escapeHtml(module.label.toLowerCase())}" data-route="${route}" ${active ? 'aria-current="page"' : ""}>${icon(module.icon, 17)}<span title="${escapeHtml(module.label)}">${escapeHtml(module.label)}</span><strong class="nav-count">${moduleCount(module)}</strong>${active ? '<span class="nav-dot"></span>' : ""}</button>`;
  }

  function moduleCount(module) {
    if (!state.workspace) return 0;
    const organizationId = activeOrganizationId();
    if (!organizationId) return 0;
    if (module.id === "configurations") return state.workspace.configurations.filter((item) => item.organizationId === organizationId).length;
    if (module.id === "locations") return state.workspace.sites.filter((item) => item.organizationId === organizationId).length;
    if (module.id === "passwords") return state.vaultItems.filter((item) => item.organizationId === organizationId && !item.archived).length;
    if (module.id === "documents") return state.workspace.moduleRecords.filter((record) => record.organizationId === organizationId && record.moduleId === "documents").length + state.workspace.procedures.filter((item) => item.organizationId === organizationId).length;
    return state.workspace.moduleRecords.filter((record) => record.organizationId === organizationId && record.moduleId === module.id && record.status !== "archived").length;
  }

  function navLink(item) {
    const [, page, iconName, labelKey] = item;
    const asset = state.page === "asset" ? assetByRef(state.detailId) : null;
    const active = state.page === page || (state.page === "configuration" && page === "configurations") || (state.page === "organization" && page === "organizations") || (asset?.type === "procedure" && page === "procedures");
    return `<button class="nav-item ${active ? "active" : ""}" data-route="${page}" ${active ? 'aria-current="page"' : ""}>${icon(iconName)}<span>${t(labelKey)}</span>${active ? '<span class="nav-dot"></span>' : ""}</button>`;
  }

  function helpCategoryById(id) {
    return helpCatalog.categories.find((category) => category.id === id) || null;
  }

  function helpArticleById(id) {
    return helpCatalog.articles.find((article) => article.id === id) || null;
  }

  function helpArticleSearchText(article) {
    const sectionText = (article.sections || []).flatMap((sectionItem) => [
      helpText(sectionItem.heading),
      ...(sectionItem.paragraphs || []).map(helpText),
      ...(sectionItem.bullets || []).map(helpText),
      ...(sectionItem.steps || []).map(helpText),
      helpText(sectionItem.callout?.title),
      helpText(sectionItem.callout?.text),
    ]);
    return normalizeSearch([helpText(article.title), helpText(article.summary), ...(article.keywords || []), ...sectionText].join(" "));
  }

  function filteredHelpArticles() {
    const query = normalizeSearch(state.helpSearch);
    return helpCatalog.articles.filter((article) => (state.helpCategory === "all" || article.category === state.helpCategory) && (!query || helpArticleSearchText(article).includes(query)));
  }

  function helpArticleCardMarkup(article) {
    const category = helpCategoryById(article.category);
    return `<button class="help-article-card" type="button" data-route="help/${escapeHtml(article.id)}">
      <span class="help-article-icon">${icon(article.icon || category?.icon || "book", 20)}</span>
      <span><small>${escapeHtml(helpText(category?.label))}</small><strong>${escapeHtml(helpText(article.title))}</strong><em>${escapeHtml(helpText(article.summary))}</em></span>
      ${icon("chevron", 16)}
    </button>`;
  }

  function helpCategoryNavigationMarkup(activeCategory = state.helpCategory) {
    return `<nav class="help-category-nav" aria-label="${state.locale === "fr" ? "Catégories d’aide" : "Help categories"}">
      <button type="button" data-action="select-help-category" data-help-category="all" class="${activeCategory === "all" ? "active" : ""}">${icon("home", 16)}<span>${state.locale === "fr" ? "Accueil de l’aide" : "Help home"}</span><strong>${helpCatalog.articles.length}</strong></button>
      ${helpCatalog.categories.map((category) => `<button type="button" data-action="select-help-category" data-help-category="${escapeHtml(category.id)}" class="${activeCategory === category.id ? "active" : ""}">${icon(category.icon || "book", 16)}<span>${escapeHtml(helpText(category.label))}</span><strong>${helpCatalog.articles.filter((article) => article.category === category.id).length}</strong></button>`).join("")}
    </nav>`;
  }

  function helpCenterResultsMarkup() {
    const articles = filteredHelpArticles();
    const query = state.helpSearch.trim();
    if (query || state.helpCategory !== "all") {
      const category = helpCategoryById(state.helpCategory);
      return `<div class="help-results-heading"><div><p class="eyebrow">${query ? (state.locale === "fr" ? "RÉSULTATS" : "RESULTS") : escapeHtml(helpText(category?.label).toUpperCase())}</p><h2>${query ? `${articles.length} ${state.locale === "fr" ? "article" : "article"}${articles.length === 1 ? "" : "s"}` : escapeHtml(helpText(category?.label))}</h2><p>${query ? `${state.locale === "fr" ? "Pour" : "For"} « ${escapeHtml(query)} »` : escapeHtml(helpText(category?.description))}</p></div>${query || state.helpCategory !== "all" ? `<button class="text-button" type="button" data-action="clear-help-search">${state.locale === "fr" ? "Voir toute l’aide" : "View all help"}</button>` : ""}</div>
        ${articles.length ? `<div class="help-article-grid">${articles.map(helpArticleCardMarkup).join("")}</div>` : `<div class="help-empty">${icon("search", 26)}<strong>${state.locale === "fr" ? "Aucun article trouvé" : "No article found"}</strong><span>${state.locale === "fr" ? "Essayez un autre terme ou consultez toutes les catégories." : "Try another term or browse all categories."}</span><button class="secondary" type="button" data-action="clear-help-search">${state.locale === "fr" ? "Réinitialiser" : "Reset"}</button></div>`}`;
    }
    const featured = helpCatalog.articles.filter((article) => article.featured);
    return `<section class="help-welcome-card"><span>${icon("layers", 24)}</span><div><p class="eyebrow">TRC COMMUNITY ATLAS</p><h2>${state.locale === "fr" ? "Bienvenue dans le centre d’aide" : "Welcome to the help center"}</h2><p>${state.locale === "fr" ? "Apprenez les concepts clés, sécurisez votre instance et transformez vos fiches en documentation réellement navigable." : "Learn the key concepts, secure your instance and turn records into truly navigable documentation."}</p></div><button class="secondary" type="button" data-route="help/welcome">${state.locale === "fr" ? "Commencer" : "Get started"} ${icon("arrow", 15)}</button></section>
      <section class="help-content-section"><div class="help-section-heading"><div><p class="eyebrow">${state.locale === "fr" ? "ARTICLES PRINCIPAUX" : "FEATURED ARTICLES"}</p><h2>${state.locale === "fr" ? "Les guides les plus utiles" : "The most useful guides"}</h2></div><span>${featured.length} ${state.locale === "fr" ? "guides" : "guides"}</span></div><div class="help-article-grid featured">${featured.map(helpArticleCardMarkup).join("")}</div></section>
      ${helpCatalog.categories.map((category) => { const categoryArticles = helpCatalog.articles.filter((article) => article.category === category.id); return `<section class="help-content-section" id="help-category-${escapeHtml(category.id)}"><div class="help-section-heading"><div><p class="eyebrow">${escapeHtml(helpText(category.label).toUpperCase())}</p><h2>${escapeHtml(helpText(category.label))}</h2><p>${escapeHtml(helpText(category.description))}</p></div><button class="text-button" type="button" data-action="select-help-category" data-help-category="${escapeHtml(category.id)}">${state.locale === "fr" ? "Tout voir" : "View all"} ${icon("arrow", 14)}</button></div><div class="help-article-grid">${categoryArticles.map(helpArticleCardMarkup).join("")}</div></section>`; }).join("")}`;
  }

  function renderHelpCenter() {
    return `<div class="page help-page">
      <section class="help-hero">
        <div><p class="eyebrow">${state.locale === "fr" ? "DOCUMENTATION ATLAS" : "ATLAS DOCUMENTATION"}</p><h1>${state.locale === "fr" ? "Comment pouvons-nous vous aider?" : "How can we help?"}</h1><p>${state.locale === "fr" ? "Guides locaux pour utiliser, administrer et sécuriser TRC Community Atlas." : "Local guides for using, administering and securing TRC Community Atlas."}</p></div>
        <label class="help-search">${icon("search", 20)}<span class="sr-only">${state.locale === "fr" ? "Rechercher dans l’aide" : "Search help"}</span><input type="search" data-help-search value="${escapeHtml(state.helpSearch)}" placeholder="${state.locale === "fr" ? "Rechercher un sujet, une fonction ou une action…" : "Search a topic, feature or action…"}" autocomplete="off" /><kbd>/</kbd></label>
      </section>
      <div class="help-layout"><aside class="help-sidebar"><div><p class="eyebrow">${state.locale === "fr" ? "PARCOURIR" : "BROWSE"}</p><h2>${state.locale === "fr" ? "Centre d’aide" : "Help center"}</h2><p>${state.locale === "fr" ? "Documentation incluse dans cette version d’Atlas." : "Documentation included with this Atlas release."}</p></div>${helpCategoryNavigationMarkup()}<div class="help-sidebar-version">${icon("info", 15)}<span><strong>Atlas v${ATLAS_VERSION}</strong><small>${state.locale === "fr" ? "Aucun appel externe" : "No external request"}</small></span></div></aside><main class="help-center-results" data-help-center-results>${helpCenterResultsMarkup()}</main></div>
    </div>`;
  }

  function helpSectionMarkup(sectionItem, index) {
    const paragraphs = (sectionItem.paragraphs || []).map((paragraph) => `<p>${escapeHtml(helpText(paragraph))}</p>`).join("");
    const bullets = sectionItem.bullets?.length ? `<ul>${sectionItem.bullets.map((bullet) => `<li>${escapeHtml(helpText(bullet))}</li>`).join("")}</ul>` : "";
    const steps = sectionItem.steps?.length ? `<ol class="help-steps">${sectionItem.steps.map((step, stepIndex) => `<li><span>${stepIndex + 1}</span><p>${escapeHtml(helpText(step))}</p></li>`).join("")}</ol>` : "";
    const callout = sectionItem.callout ? `<div class="help-callout ${escapeHtml(sectionItem.callout.tone || "info")}">${icon(sectionItem.callout.tone === "warning" ? "alert" : "info", 19)}<div><strong>${escapeHtml(helpText(sectionItem.callout.title))}</strong><p>${escapeHtml(helpText(sectionItem.callout.text))}</p></div></div>` : "";
    return `<section class="help-article-section" id="help-section-${index + 1}"><h2>${escapeHtml(helpText(sectionItem.heading))}</h2>${paragraphs}${bullets}${steps}${callout}</section>`;
  }

  function renderHelpArticle(articleId) {
    const article = helpArticleById(articleId);
    if (!article) return `<div class="page help-page">${pageHeader(state.locale === "fr" ? "Article introuvable" : "Article not found", state.locale === "fr" ? "Ce guide n’existe pas dans cette version d’Atlas." : "This guide does not exist in this Atlas release.", `<button class="secondary" type="button" data-route="help">${state.locale === "fr" ? "Retour au centre d’aide" : "Back to help center"}</button>`)}</div>`;
    const category = helpCategoryById(article.category);
    const related = helpCatalog.articles.filter((candidate) => candidate.category === article.category && candidate.id !== article.id).slice(0, 4);
    return `<div class="page help-page help-article-page">
      <nav class="help-breadcrumbs" aria-label="${state.locale === "fr" ? "Fil d’Ariane" : "Breadcrumb"}"><button type="button" data-route="help">${state.locale === "fr" ? "Centre d’aide" : "Help center"}</button>${icon("chevron", 13)}<button type="button" data-action="select-help-category" data-help-category="${escapeHtml(article.category)}">${escapeHtml(helpText(category?.label))}</button>${icon("chevron", 13)}<span>${escapeHtml(helpText(article.title))}</span></nav>
      <div class="help-layout article-layout"><aside class="help-sidebar"><div><p class="eyebrow">${state.locale === "fr" ? "DOCUMENTATION" : "DOCUMENTATION"}</p><h2>${escapeHtml(helpText(category?.label))}</h2><p>${escapeHtml(helpText(category?.description))}</p></div>${helpCategoryNavigationMarkup(article.category)}<button class="help-back-home" type="button" data-route="help">${icon("arrow", 14)} ${state.locale === "fr" ? "Accueil de l’aide" : "Help home"}</button></aside>
        <main class="help-article"><header><span class="help-article-hero-icon">${icon(article.icon || category?.icon || "book", 25)}</span><div><p class="eyebrow">${escapeHtml(helpText(category?.label).toUpperCase())}</p><h1>${escapeHtml(helpText(article.title))}</h1><p>${escapeHtml(helpText(article.summary))}</p></div></header><div class="help-article-body">${(article.sections || []).map(helpSectionMarkup).join("")}</div>${related.length ? `<section class="help-related"><div class="help-section-heading"><div><p class="eyebrow">${state.locale === "fr" ? "À CONSULTER AUSSI" : "RELATED"}</p><h2>${state.locale === "fr" ? "Articles associés" : "Related articles"}</h2></div></div><div class="help-article-grid">${related.map(helpArticleCardMarkup).join("")}</div></section>` : ""}</main>
      </div>
    </div>`;
  }

  function renderPage() {
    if (state.page === "record" && state.detailId) return renderModuleRecordEditorPage(state.detailId, state.recordId);
    if (state.page === "asset" && state.detailId) return renderAssetPage(state.detailId);
    if (state.page === "organization" && state.detailId) return renderOrganizationDetail(state.detailId);
    if (state.page === "configuration" && state.detailId) return renderConfigurationDetail(state.detailId);
    if (state.page === "module" && state.detailId === "passwords") return canAccessVault() ? renderVaultPage() : renderVaultAccessDenied();
    if (state.page === "module" && state.detailId) return renderModulePage(state.detailId);
    if (state.page === "help" && state.detailId) return renderHelpArticle(state.detailId);
    const pages = {
      dashboard: renderDashboard,
      organizations: renderOrganizations,
      sites: renderSites,
      configurations: renderConfigurations,
      procedures: renderProcedures,
      relations: renderRelations,
      activity: renderActivity,
      templates: renderTemplates,
      workflows: renderWorkflows,
      versions: renderVersions,
      "data-tools": renderDataTools,
      "manage-modules": renderModulesManager,
      accounts: renderAccounts,
      "my-account": renderMyAccount,
      settings: renderSettings,
      help: renderHelpCenter,
    };
    return (pages[state.page] || pages.dashboard)();
  }

  function pageHeader(title, description, action = "") {
    const organizationId = activeOrganizationId();
    const breadcrumbs = organizationId
      ? `${organizationBreadcrumbMarkup(organizationId)}${icon("chevron", 13)}<span>${escapeHtml(title)}</span>`
      : `<span>${escapeHtml(title)}</span>`;
    return `<div class="page-header"><div><div class="breadcrumbs">${breadcrumbs}</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div>${action}</div>`;
  }

  function isTestOrganization(organization) {
    return /^\s*\[test\]/i.test(organization?.name || "") || String(organization?.code || "").toUpperCase() === "QATEST" || /^org-qa(?:-|$)/i.test(organization?.id || "");
  }

  function dashboardPriorities() {
    const w = state.workspace;
    const expiryDays = w.settings.workflows?.expiryDays || 30;
    const organizations = w.organizations.filter((organization) => state.dashboardIncludeTests || !isTestOrganization(organization));
    const organizationIds = new Set(organizations.map((organization) => organization.id));
    const assets = assetRegistry().filter((asset) => organizationIds.has(asset.organizationId));
    const assetsByRef = new Map(assets.map((asset) => [asset.ref, asset]));
    const itemFromAsset = (asset, reason) => ({ ref: asset.ref, label: asset.label, subtitle: `${orgName(asset.organizationId)} · ${asset.kind}`, icon: asset.icon, reason });

    const missingOwner = assets.filter((asset) => ["configuration", "procedure", "module"].includes(asset.type) && !asset.archived && !String(asset.raw.owner || "").trim()).map((asset) => itemFromAsset(asset, state.locale === "fr" ? "Champ responsable vide" : "Owner field is empty"));
    const neverReviewed = assets.filter((asset) => asset.type === "configuration" && !asset.archived && !asset.raw.lastReviewed).map((asset) => itemFromAsset(asset, state.locale === "fr" ? "Aucune date de révision" : "No review date"));
    const deadlines = assets.filter((asset) => {
      if (asset.type !== "module" || asset.archived || !asset.raw.expiresOn) return false;
      return (new Date(`${asset.raw.expiresOn}T12:00:00`) - Date.now()) / 86400000 <= expiryDays;
    }).map((asset) => itemFromAsset(asset, state.locale === "fr" ? `Échéance dépassée ou dans ${expiryDays} jours` : `Overdue or due within ${expiryDays} days`));
    const fragileRelations = w.relations.filter((relation) => {
      if (!organizationIds.has(relation.organizationId)) return false;
      const source = assetsByRef.get(relation.sourceRef);
      const target = assetsByRef.get(relation.targetRef);
      return relation.archived || !source || !target || source.archived || target.archived;
    }).map((relation) => {
      const source = assetsByRef.get(relation.sourceRef);
      const target = assetsByRef.get(relation.targetRef);
      const reason = relation.archived ? (state.locale === "fr" ? "Lien archivé" : "Archived link") : !source || !target ? (state.locale === "fr" ? "Objet lié introuvable" : "Linked item not found") : (state.locale === "fr" ? "Objet lié archivé" : "Linked item archived");
      return { ref: target?.ref || source?.ref || "", label: `${source?.label || (state.locale === "fr" ? "Source absente" : "Missing source")} ↔ ${target?.label || (state.locale === "fr" ? "Cible absente" : "Missing target")}`, subtitle: orgName(relation.organizationId), icon: "link", reason };
    });
    const reviewState = assets.filter((asset) => !asset.archived && ((asset.type === "configuration" && ["draft", "review"].includes(asset.raw.status)) || (asset.type === "procedure" && asset.raw.status === "review") || (asset.type === "module" && asset.raw.status === "review"))).map((asset) => itemFromAsset(asset, state.locale === "fr" ? "Statut explicitement à traiter" : "Explicit status requiring attention"));
    const categories = [
      { id: "owners", icon: "users", tone: "cyan", label: state.locale === "fr" ? "Sans responsable" : "Missing owner", description: state.locale === "fr" ? "Champ responsable vide" : "Owner field is empty", items: missingOwner },
      { id: "reviews", icon: "history", tone: "blue", label: state.locale === "fr" ? "Jamais révisées" : "Never reviewed", description: state.locale === "fr" ? "Aucune date enregistrée" : "No date recorded", items: neverReviewed },
      { id: "deadlines", icon: "clock", tone: "warning", label: state.locale === "fr" ? "Échéances" : "Deadlines", description: state.locale === "fr" ? `Échues ou à ${expiryDays} jours` : `Overdue or within ${expiryDays} days`, items: deadlines },
      { id: "relations", icon: "link", tone: "violet", label: state.locale === "fr" ? "Liens à vérifier" : "Links to verify", description: state.locale === "fr" ? "Archivé, absent ou cible archivée" : "Archived, missing or archived target", items: fragileRelations },
      { id: "status", icon: "file", tone: "mint", label: state.locale === "fr" ? "À revoir / brouillons" : "Review / drafts", description: state.locale === "fr" ? "Statut choisi par l’équipe" : "Status selected by the team", items: reviewState },
    ];
    return {
      organizations,
      organizationIds,
      sites: w.sites.filter((item) => organizationIds.has(item.organizationId)),
      configurations: w.configurations.filter((item) => organizationIds.has(item.organizationId)),
      procedures: w.procedures.filter((item) => organizationIds.has(item.organizationId)),
      moduleRecords: w.moduleRecords.filter((item) => organizationIds.has(item.organizationId)),
      categories,
      total: categories.reduce((sum, category) => sum + category.items.length, 0),
      expiryDays,
    };
  }

  function renderDashboard() {
    const w = state.workspace;
    const priorities = dashboardPriorities();
    const reviewItems = priorities.categories.find((category) => category.id === "status").items;
    const critical = priorities.configurations.filter((item) => item.criticality === "critical");
    const expiringSoon = priorities.categories.find((category) => category.id === "deadlines").items;
    const scopeLabel = state.dashboardIncludeTests
      ? (state.locale === "fr" ? "Organisations normales et de test incluses" : "Regular and test organizations included")
      : (state.locale === "fr" ? "Organisations [TEST] masquées" : "[TEST] organizations hidden");
    return `<div class="page dashboard-page">
      ${pageHeader(t("dashboard"), state.locale === "fr" ? "Des faits vérifiables pour savoir quoi traiter maintenant." : "Verifiable facts showing what needs attention now.", writeButton(activeOrganizationId() ? `<button class="primary" data-action="new-configuration">${icon("plus")} ${t("addConfiguration")}</button>` : `<button class="primary" data-action="new-organization">${icon("plus")} ${t("addOrganization")}</button>`))}
      <section class="priority-hero">
        <div class="priority-hero-heading"><div><p class="eyebrow">${state.locale === "fr" ? "PRIORITÉS DOCUMENTAIRES" : "DOCUMENTATION PRIORITIES"}</p><div class="priority-title-line"><strong>${priorities.total}</strong><div><h2>${state.locale === "fr" ? "signaux à traiter" : "signals to address"}</h2><p>${state.locale === "fr" ? "Aucune note arbitraire : chaque signal correspond à un critère visible." : "No arbitrary score: every signal maps to a visible criterion."}</p></div></div></div><button class="priority-main-action" type="button" data-action="open-priorities" data-priority="all">${state.locale === "fr" ? "Voir les priorités" : "View priorities"} ${icon("arrow", 16)}</button></div>
        <div class="priority-grid">${priorities.categories.map((category) => `<button class="priority-card ${category.tone}" type="button" data-action="open-priorities" data-priority="${category.id}" aria-label="${escapeHtml(category.label)} : ${category.items.length}. ${escapeHtml(category.description)}"><span class="priority-card-icon">${icon(category.icon, 18)}</span><span><strong>${escapeHtml(category.label)}</strong><small>${escapeHtml(category.description)}</small></span><b>${category.items.length}</b></button>`).join("")}</div>
        <div class="priority-scope">${icon("shield", 15)}<span>${escapeHtml(scopeLabel)}</span><button type="button" data-action="toggle-dashboard-tests">${state.dashboardIncludeTests ? (state.locale === "fr" ? "Masquer les tests" : "Hide tests") : (state.locale === "fr" ? "Inclure les tests" : "Include tests")}</button></div>
      </section>
      <section class="metrics-grid dashboard-stats-grid">
        ${metricCard("building", priorities.organizations.length, t("organizations"), "répertoriées localement", "cyan")}
        ${metricCard("pin", priorities.sites.length, t("sites"), `${priorities.organizations.length} organisations`, "blue")}
        ${metricCard("server", priorities.configurations.length, t("configurations"), `${critical.length} critiques`, "violet")}
        ${metricCard("grid", priorities.moduleRecords.length, "Fiches de modules", `${state.visibleModuleIds.size} modules visibles`, "mint")}
        ${metricCard("book", priorities.procedures.length, t("procedures"), `${priorities.procedures.filter((item) => item.status === "review").length} en révision`, "blue")}
        ${metricCard("clock", expiringSoon.length, `Échéances à ${priorities.expiryDays} jours`, expiringSoon.length ? "Attention requise" : "Aucune échéance proche", expiringSoon.length ? "violet" : "cyan")}
      </section>
      ${passwordHealthCardMarkup(state.vaultItems.filter((item) => priorities.organizationIds.has(item.organizationId)), { global: true, scopeLabel })}
      <div class="dashboard-grid">
        <section class="panel attention-panel"><div class="panel-heading"><div><p class="eyebrow">À SUIVRE</p><h2>Éléments avec un statut à traiter</h2></div><span class="count-pill warning">${reviewItems.length}</span></div>
          <div class="attention-list">${reviewItems.length ? reviewItems.slice(0, 4).map((item) => `<button class="attention-row" data-action="open-asset" data-asset-ref="${escapeHtml(item.ref)}"><span class="type-icon">${icon(item.icon, 17)}</span><span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.subtitle)} · ${escapeHtml(item.reason)}</small></span>${icon("chevron", 16)}</button>`).join("") : emptyState("Aucun statut Brouillon ou À réviser dans cette portée.")}</div>
        </section>
        <section class="panel activity-panel"><div class="panel-heading"><div><p class="eyebrow">JOURNAL</p><h2>Activité récente</h2></div><button class="text-button" data-route="activity">Tout voir ${icon("arrow", 15)}</button></div>
          <div class="timeline">${w.activities.slice(0, 5).map(activityRow).join("")}</div>
        </section>
      </div>
      <section class="panel organization-overview"><div class="panel-heading"><div><p class="eyebrow">STRUCTURE</p><h2>Organisations</h2></div><div class="panel-heading-actions"><button class="text-button" data-route="organizations">Voir les organisations</button>${writeButton(`<button class="secondary compact" data-action="new-organization">${icon("plus", 15)} ${t("addOrganization")}</button>`)}</div></div>
        <div class="organization-strip">${priorities.organizations.slice(0, 6).map((org) => organizationMiniCard(org)).join("")}</div>
      </section>
    </div>`;
  }

  function metricCard(iconName, value, label, note, accent) {
    return `<article class="metric-card"><span class="metric-icon ${accent}">${icon(iconName, 19)}</span><div><strong>${value}</strong><span>${escapeHtml(label)}</span><small>${escapeHtml(note)}</small></div></article>`;
  }

  function passwordHealthSnapshot(items = []) {
    const active = items.filter((item) => !item.archived);
    const counts = { veryWeak: 0, weak: 0, fair: 0, strong: 0, veryStrong: 0, notEvaluated: 0 };
    const strengthKey = ["veryWeak", "weak", "fair", "strong", "veryStrong"];
    for (const item of active) {
      const key = Number.isInteger(item.strength) && item.strength >= 0 && item.strength <= 4 ? strengthKey[item.strength] : "notEvaluated";
      counts[key] += 1;
    }
    return {
      total: active.length,
      evaluated: active.length - counts.notEvaluated,
      attention: counts.veryWeak + counts.weak + counts.fair,
      strong: counts.strong + counts.veryStrong,
      counts,
    };
  }

  function passwordHealthCardMarkup(items, { organizationId = "", global = false, scopeLabel = "" } = {}) {
    const allowed = canAccessVault(organizationId || "");
    const french = state.locale !== "en";
    const title = french ? "Santé des mots de passe" : "Password health";
    if (!allowed) {
      return `<section class="panel password-health-card password-health-locked"><div class="password-health-locked-icon">${icon("lock", 20)}</div><div><p class="eyebrow">${french ? "COFFRE" : "VAULT"}</p><h2>${title}</h2><p>${french ? "Les indicateurs du coffre sont masqués pour ce compte." : "Vault indicators are hidden for this account."}</p></div></section>`;
    }

    const snapshot = passwordHealthSnapshot(items);
    const levels = [
      { key: "veryWeak", label: french ? "Très faible" : "Very weak", tone: "danger", icon: "alert" },
      { key: "weak", label: french ? "Faible" : "Weak", tone: "danger-soft", icon: "alert" },
      { key: "fair", label: french ? "Correct" : "Fair", tone: "warning", icon: "alert" },
      { key: "strong", label: french ? "Fort" : "Strong", tone: "success", icon: "check" },
      { key: "veryStrong", label: french ? "Très fort" : "Very strong", tone: "success-strong", icon: "shield" },
      { key: "notEvaluated", label: french ? "Non évalué" : "Not evaluated", tone: "neutral", icon: "more" },
    ];
    let offset = 0;
    const meterSegments = snapshot.total ? levels.map((level) => {
      const width = (snapshot.counts[level.key] / snapshot.total) * 100;
      const rectangle = width > 0 ? `<rect class="${level.tone}" x="${offset.toFixed(4)}" y="0" width="${width.toFixed(4)}" height="6" rx="1" />` : "";
      offset += width;
      return rectangle;
    }).join("") : "";
    const scope = global
      ? (french ? "Toutes les compagnies accessibles" : "All accessible companies")
      : scopeLabel;
    const action = global
      ? `<button class="secondary compact" type="button" data-action="open-password-health-breakdown">${french ? "Voir par compagnie" : "View by company"} ${icon("arrow", 14)}</button>`
      : `<button class="secondary compact" type="button" data-route="module/passwords" data-filter-org="${escapeHtml(organizationId)}">${french ? "Voir le coffre" : "View vault"} ${icon("arrow", 14)}</button>`;
    const ariaSummary = levels.map((level) => `${level.label}: ${snapshot.counts[level.key]}`).join(", ");
    return `<section class="panel password-health-card" data-password-health-scope="${global ? "global" : "organization"}">
      <header class="password-health-heading"><div class="password-health-title"><span>${icon("shield", 20)}</span><div><p class="eyebrow">${french ? "SÉCURITÉ DU COFFRE" : "VAULT SECURITY"}</p><h2>${title}</h2></div></div><button class="text-button" type="button" data-action="password-health-help">${french ? "Comment est-ce évalué?" : "How is this evaluated?"}</button></header>
      <div class="password-health-summary"><span><strong>${snapshot.total}</strong> ${french ? `mot${snapshot.total === 1 ? "" : "s"} de passe actif${snapshot.total === 1 ? "" : "s"}` : `active password${snapshot.total === 1 ? "" : "s"}`}</span><small>${escapeHtml(scope || (french ? "Portée actuelle" : "Current scope"))}</small></div>
      <svg class="password-health-meter" viewBox="0 0 100 6" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(ariaSummary)}"><rect class="track" x="0" y="0" width="100" height="6" rx="2" />${meterSegments}</svg>
      <div class="password-health-levels">${levels.map((level) => `<div class="password-health-level ${level.tone}"><span>${escapeHtml(level.label)}</span><strong>${icon(level.icon, 16)} ${snapshot.counts[level.key]}</strong></div>`).join("")}</div>
      <footer class="password-health-footer">${action}<span>${snapshot.evaluated ? `${snapshot.evaluated}/${snapshot.total} ${french ? "évalués localement" : "evaluated locally"}` : (french ? "Aucun secret encore évalué" : "No secret evaluated yet")}</span></footer>
    </section>`;
  }

  function organizationMiniCard(org) {
    const configs = state.workspace.configurations.filter((item) => item.organizationId === org.id);
    const sites = state.workspace.sites.filter((item) => item.organizationId === org.id);
    return `<button class="organization-mini" data-route="organization/${org.id}"><span class="org-mark">${escapeHtml(org.code)}</span><span><strong>${escapeHtml(org.name)}</strong><small>${sites.length} sites · ${configs.length} configurations</small></span>${icon("chevron", 16)}</button>`;
  }

  function renderOrganizations() {
    const query = state.listSearch.trim().toLocaleLowerCase(state.locale);
    const filtered = state.workspace.organizations.filter((org) => !query || [org.name, org.code, org.industry, org.owner, org.notes, org.quickNotes, organizationPathLabel(org.id), ...Object.values(org.details || {})].join(" ").toLocaleLowerCase(state.locale).includes(query)).sort((a, b) => organizationPathLabel(a.id).localeCompare(organizationPathLabel(b.id), state.locale));
    const page = paginate(filtered, 25);
    return `<div class="page">${pageHeader(t("organizations"), "Clients, équipes ou entités qui structurent votre documentation.", writeButton(`<button class="primary" data-action="new-organization">${icon("plus")} ${t("addOrganization")}</button>`))}
      <div class="toolbar compact-list-toolbar"><label class="list-search">${icon("search", 16)}<input type="search" data-list-search placeholder="Rechercher une organisation…" value="${escapeHtml(state.listSearch)}" /></label><div class="toolbar-summary"><strong>${filtered.length}</strong> sur ${state.workspace.organizations.length}</div><div class="view-chip">${icon("shield", 15)} Isolation locale</div></div>
      <section class="table-card organizations-table"><div class="table-scroll"><table><thead><tr><th>Organisation</th><th>Secteur</th><th>Responsable</th><th>${t("sites")}</th><th>${t("configurations")}</th><th>${t("status")}</th><th></th></tr></thead><tbody>${page.items.map((org) => {
        const sites = state.workspace.sites.filter((item) => item.organizationId === org.id);
        const configs = state.workspace.configurations.filter((item) => item.organizationId === org.id);
        const parent = organizationById(org.parentOrganizationId);
        const children = organizationChildren(org.id);
        const structure = parent ? `Sous-compagnie de ${parent.name}` : "Organisation racine";
        const childrenLabel = children.length ? ` · ${children.length} sous-compagnie${children.length === 1 ? "" : "s"}` : "";
        return `<tr><td><button class="table-link organization-table-link hierarchy-level-${Math.min(organizationDepth(org.id), 3)}" data-route="organization/${org.id}"><span class="org-mark">${escapeHtml(org.code)}</span><span><strong>${escapeHtml(org.name)}</strong><small>${escapeHtml(structure + childrenLabel)}</small></span></button></td><td>${escapeHtml(org.industry || "—")}</td><td>${escapeHtml(org.owner || "Non assigné")}</td><td><strong>${sites.length}</strong></td><td><strong>${configs.length}</strong></td><td><span class="status-badge ${org.status === "archived" ? "muted" : "success"}">${org.status === "archived" ? "Archivée" : "Active"}</span></td><td><div class="row-actions">${writeButton(`<button class="icon-button" data-action="edit-organization" data-id="${org.id}" aria-label="Modifier">${icon("edit", 15)}</button>`)}${isAdministrator() ? `<button class="icon-button danger" data-action="delete-organization" data-id="${org.id}" aria-label="Supprimer ${escapeHtml(org.name)}">${icon("trash", 15)}</button>` : ""}<button class="icon-button" data-route="organization/${org.id}" aria-label="Ouvrir">${icon("chevron", 16)}</button></div></td></tr>`;
      }).join("")}</tbody></table></div>${filtered.length ? paginationMarkup(page) : emptyState(t("empty"))}</section>
    </div>`;
  }

  function renderOrganizationDetail(id) {
    const organization = state.workspace.organizations.find((entry) => entry.id === id);
    if (!organization) return `<div class="page">${pageHeader("Organisation introuvable", "Cette organisation n’existe plus ou a été archivée.")}<button class="secondary" data-route="organizations">Retour aux organisations</button></div>`;
    const details = organization.details || {};
    const parentOrganization = organizationById(organization.parentOrganizationId);
    const childOrganizations = organizationChildren(id).sort((a, b) => a.name.localeCompare(b.name, state.locale));
    const sites = state.workspace.sites.filter((item) => item.organizationId === id);
    const configurations = state.workspace.configurations.filter((item) => item.organizationId === id);
    const procedures = state.workspace.procedures.filter((item) => item.organizationId === id);
    const records = state.workspace.moduleRecords.filter((item) => item.organizationId === id);
    const passwords = state.vaultItems.filter((item) => item.organizationId === id && !item.archived);
    const documents = records.filter((item) => item.moduleId === "documents" && item.status !== "archived");
    const contacts = records.filter((item) => item.moduleId === "contacts" && item.status !== "archived");
    const relations = state.workspace.relations.filter((item) => item.organizationId === id && !item.archived);
    const organizationAssets = assetRegistry(id).filter((asset) => !asset.archived);
    const reviewAssets = organizationAssets.filter((asset) => ["draft", "review"].includes(asset.status));
    const recentAssets = organizationAssets.sort((a, b) => {
      const dateOf = (asset) => asset.raw.updatedAt || asset.raw.lastReviewed || asset.raw.createdAt || "";
      return String(dateOf(b)).localeCompare(String(dateOf(a))) || a.label.localeCompare(b.label, state.locale);
    }).slice(0, 6);
    const profileFields = [
      ["Criticité client", details.customerCriticality],
      ["Employés / utilisateurs TI", [details.employeeCount, details.itUserCount].filter(Boolean).join(" / ")],
      ["Fuseau principal", details.timezone],
      ["Langue de service", details.serviceLanguage],
      ["Gestionnaire de compte", details.accountManager],
      ["Heures de soutien", details.supportHours],
    ].filter(([, value]) => String(value || "").trim());
    const quickLinks = [
      { label: "Configurations", note: "Actifs et services", count: configurations.length, icon: "server", route: "configurations", tone: "violet" },
      { label: "Sites", note: "Emplacements documentés", count: sites.length, icon: "pin", route: "sites", tone: "blue" },
      { label: "Documents", note: `${procedures.length} procédure${procedures.length === 1 ? "" : "s"}`, count: documents.length, icon: "file", route: "module/documents", tone: "cyan" },
      { label: "Contacts", note: "Personnes et fournisseurs", count: contacts.length, icon: "users", route: "module/contacts", tone: "blue" },
      { label: "Mots de passe", note: "Métadonnées du coffre", count: passwords.length, icon: "key", route: "module/passwords", tone: "mint" },
      { label: "Relations", note: "Dépendances actives", count: relations.length, icon: "link", route: "relations", tone: "cyan" },
    ].filter((link) => link.route !== "module/passwords" || canAccessVault());
    const query = state.organizationSearch.trim();
    const results = query ? searchEntries(query, id) : [];
    return `<div class="page organization-detail-page organization-workspace-page">
      <div class="organization-workspace-topline"><div class="organization-hierarchy-breadcrumb"><button class="text-button" data-route="organizations">Toutes les organisations</button>${icon("chevron", 13)}${organizationBreadcrumbMarkup(id)}</div><span>${icon("building", 14)} Niveau ${organizationDepth(id)} sur 3</span></div>
      <section class="organization-workspace-hero panel">
        <div class="organization-workspace-hero-top">
          <div class="organization-workspace-identity"><span class="org-mark large">${escapeHtml(organization.code)}</span><div><p class="eyebrow">ESPACE ORGANISATION</p><h1>${escapeHtml(organization.name)}</h1><div class="organization-workspace-meta"><span>${icon("grid", 13)} ${escapeHtml(details.displayName || organization.industry || "Secteur non renseigné")}</span><span>${icon("users", 13)} ${escapeHtml(organization.owner || "Responsable non assigné")}</span>${parentOrganization ? `<button type="button" class="organization-parent-link" data-route="organization/${escapeHtml(parentOrganization.id)}">${icon("building", 13)} Fait partie de ${escapeHtml(parentOrganization.name)}</button>` : ""}<span class="status-badge ${organization.status === "archived" ? "muted" : "success"}">${organization.status === "archived" ? "Archivée" : "Active"}</span></div></div></div>
          <div class="organization-workspace-actions">${writeButton(`<button class="secondary" data-action="edit-organization" data-id="${organization.id}">${icon("edit", 15)} Modifier</button>`)}${isAdministrator() ? `<button class="secondary danger" data-action="delete-organization" data-id="${organization.id}">${icon("trash", 15)} Supprimer</button>` : ""}</div>
        </div>
        <label class="organization-workspace-search"><span class="sr-only">Rechercher dans ${escapeHtml(organization.name)}</span>${icon("search", 19)}<input type="search" data-organization-search autocomplete="off" value="${escapeHtml(state.organizationSearch)}" placeholder="Rechercher un actif, une adresse IP, un contact, un document…" /><kbd>${escapeHtml(organization.code)}</kbd></label>
        <div class="organization-workspace-search-foot"><span>Recherche limitée à cette organisation</span>${query ? `<strong>${results.length} résultat${results.length === 1 ? "" : "s"} pour « ${escapeHtml(query)} »</strong>` : `<strong>${organizationAssets.length} éléments indexés</strong>`}</div>
      </section>
      ${query ? `<section class="panel organization-search-results-panel"><div class="organization-section-heading"><div><p class="eyebrow">RÉSULTATS</p><h2>Recherche dans ${escapeHtml(organization.name)}</h2></div><span class="scope-badge">${icon("building", 14)} ${escapeHtml(organization.code)}</span></div><div class="organization-search-results">${results.length ? searchResultsMarkup(results, 60, false) : emptyState("Aucun élément correspondant dans cette organisation.")}</div></section>` : ""}
      <section class="panel organization-quick-notes-panel">
        <div class="organization-section-heading"><div><p class="eyebrow">REPÈRES D’ÉQUIPE</p><h2>${icon("message", 17)} Quick Notes</h2><p>Notes rapides visibles par les comptes ayant accès à cette compagnie.</p></div>${writeButton(`<button class="icon-button" type="button" data-action="edit-quick-notes" data-id="${escapeHtml(organization.id)}" aria-label="Modifier les Quick Notes" title="Modifier les Quick Notes">${icon("edit", 16)}</button>`)}</div>
        ${organization.quickNotes.trim() ? `<article class="organization-quick-notes-content document-rendered">${renderDocumentMarkdown(organization.quickNotes)}</article>` : `<div class="organization-quick-notes-empty">${icon("message", 21)}<span><strong>Aucune Quick Note</strong><small>Ajoutez ici les consignes et repères que l’équipe doit voir en ouvrant cette compagnie.</small></span>${writeButton(`<button class="secondary compact" type="button" data-action="edit-quick-notes" data-id="${escapeHtml(organization.id)}">${icon("plus", 14)} Ajouter une note</button>`)}</div>`}
      </section>
      <section class="organization-kpi-grid" aria-label="Résumé de l’organisation">
        <button class="organization-kpi" data-route="configurations" data-filter-org="${id}"><span class="metric-icon violet">${icon("server", 19)}</span><span><strong>${configurations.length}</strong><small>Configurations</small></span>${icon("chevron", 15)}</button>
        <button class="organization-kpi" data-route="sites" data-filter-org="${id}"><span class="metric-icon blue">${icon("pin", 19)}</span><span><strong>${sites.length}</strong><small>Sites</small></span>${icon("chevron", 15)}</button>
        <button class="organization-kpi" data-route="module/documents" data-filter-org="${id}"><span class="metric-icon cyan">${icon("file", 19)}</span><span><strong>${documents.length}</strong><small>Documents</small></span>${icon("chevron", 15)}</button>
        ${canAccessVault() ? `<button class="organization-kpi" data-route="module/passwords" data-filter-org="${id}"><span class="metric-icon mint">${icon("key", 19)}</span><span><strong>${passwords.length}</strong><small>Mots de passe</small></span>${icon("chevron", 15)}</button>` : `<div class="organization-kpi restricted"><span class="metric-icon mint">${icon("lock", 19)}</span><span><strong>Masqué</strong><small>Coffre non autorisé</small></span></div>`}
      </section>
      ${childOrganizations.length ? `<section class="panel organization-children-panel"><div class="organization-section-heading"><div><p class="eyebrow">STRUCTURE</p><h2>Compagnies rattachées</h2><p>${childOrganizations.length} sous-compagnie${childOrganizations.length === 1 ? "" : "s"} directement rattachée${childOrganizations.length === 1 ? "" : "s"}. Chaque espace conserve ses propres accès, mots de passe, sites et fiches.</p></div><span class="count-pill">${childOrganizations.length}</span></div><div class="organization-children-grid">${childOrganizations.map((child) => {
        const childSites = state.workspace.sites.filter((item) => item.organizationId === child.id).length;
        const childConfigurations = state.workspace.configurations.filter((item) => item.organizationId === child.id).length;
        const childRecords = state.workspace.moduleRecords.filter((item) => item.organizationId === child.id).length;
        const grandChildren = organizationChildren(child.id).length;
        return `<button type="button" data-route="organization/${escapeHtml(child.id)}"><span class="org-mark">${escapeHtml(child.code || initials(child.name))}</span><span><strong>${escapeHtml(child.name)}</strong><small>${childSites} site${childSites === 1 ? "" : "s"} · ${childConfigurations} configuration${childConfigurations === 1 ? "" : "s"} · ${childRecords} fiche${childRecords === 1 ? "" : "s"}${grandChildren ? ` · ${grandChildren} sous-compagnie${grandChildren === 1 ? "" : "s"}` : ""}</small></span>${icon("chevron", 15)}</button>`;
      }).join("")}</div><div class="organization-isolation-note">${icon("shield", 16)}<span><strong>Structure seulement</strong> Aucun mot de passe, permission ou contenu n’est hérité entre ces compagnies.</span></div></section>` : ""}
      <div class="organization-workspace-layout">
        <div class="organization-workspace-main">
          ${passwordHealthCardMarkup(passwords, { organizationId: id, scopeLabel: organization.name })}
          <section class="panel organization-library-panel"><div class="organization-section-heading"><div><p class="eyebrow">DOCUMENTATION</p><h2>Accès rapides</h2><p>${records.length} fiches de modules et ${organizationAssets.length} éléments actifs dans cette organisation.</p></div></div><div class="organization-module-grid">${quickLinks.map((link) => `<button data-route="${link.route}" data-filter-org="${id}"><span class="metric-icon ${link.tone}">${icon(link.icon, 18)}</span><span><strong>${escapeHtml(link.label)}</strong><small>${escapeHtml(link.note)}</small></span><b>${link.count}</b>${icon("chevron", 14)}</button>`).join("")}</div></section>
          <section class="panel organization-recent-panel"><div class="organization-section-heading"><div><p class="eyebrow">RÉCEMMENT CONSULTABLE</p><h2>Documentation récente</h2></div><span class="count-pill">${recentAssets.length}</span></div><div class="organization-recent-list">${recentAssets.length ? recentAssets.map((asset) => `<button type="button" data-action="open-asset" data-asset-ref="${escapeHtml(asset.ref)}"><span class="type-icon">${icon(asset.icon, 16)}</span><span><strong>${escapeHtml(asset.label)}</strong><small>${escapeHtml(asset.kind)} · ${escapeHtml(asset.subtitle || "Fiche Atlas")}</small></span><span class="status-badge ${["draft", "review"].includes(asset.status) ? "warning" : "success"}">${["draft", "review"].includes(asset.status) ? "À revoir" : "Active"}</span>${icon("chevron", 14)}</button>`).join("") : emptyState("Aucune fiche active dans cette organisation.")}</div></section>
        </div>
        <aside class="organization-workspace-aside">
          <section class="panel organization-service-card"><div class="organization-section-heading"><div><p class="eyebrow">PROFIL DE SERVICE</p><h2>Contexte client</h2></div>${writeButton(`<button class="icon-button" data-action="edit-organization" data-id="${organization.id}" aria-label="Modifier le profil">${icon("edit", 15)}</button>`)}</div><dl>${profileFields.length ? profileFields.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("") : `<div class="organization-profile-empty"><dt>Profil à compléter</dt><dd>Ajoutez les informations de service utiles à l’équipe.</dd></div>`}</dl></section>
          <section class="panel organization-attention-card"><div class="organization-attention-icon">${icon(reviewAssets.length ? "alert" : "check", 19)}</div><div><p class="eyebrow">SUIVI</p><h2>${reviewAssets.length ? `${reviewAssets.length} fiche${reviewAssets.length === 1 ? "" : "s"} à revoir` : "Documentation à jour"}</h2><p>${reviewAssets.length ? "Des fiches sont encore en brouillon ou en révision dans cette organisation." : "Aucune fiche active n’est marquée Brouillon ou À réviser."}</p></div>${reviewAssets.length ? `<button class="secondary compact" data-route="configurations" data-filter-org="${id}">Voir les fiches</button>` : ""}</section>
          ${organization.notes ? `<section class="panel organization-notes-card"><p class="eyebrow">NOTE ORGANISATION</p><p>${escapeHtml(organization.notes)}</p></section>` : ""}
        </aside>
      </div>
    </div>`;
  }

  function renderSites() {
    const query = state.listSearch.trim().toLocaleLowerCase(state.locale);
    const allItems = filteredByOrganization(state.workspace.sites);
    const items = allItems.filter((site) => !query || [site.name, site.address, site.timezone, ...Object.values(site.details || {}), orgName(site.organizationId)].join(" ").toLocaleLowerCase(state.locale).includes(query)).sort((a, b) => a.name.localeCompare(b.name, state.locale));
    const page = paginate(items, 25);
    return `<div class="page">${pageHeader(t("sites"), "Emplacements physiques ou logiques rattachés à chaque organisation.", writeButton(`<button class="primary" data-action="new-site">${icon("plus")} ${t("addSite")}</button>`))}
      <div class="toolbar compact-list-toolbar"><label class="list-search">${icon("search", 16)}<input type="search" data-list-search placeholder="Rechercher un site…" value="${escapeHtml(state.listSearch)}" /></label>${organizationFilter(true)}<div class="toolbar-summary"><strong>${items.length}</strong> sur ${state.workspace.sites.length}</div></div>
      <section class="table-card"><div class="table-scroll"><table><thead><tr><th>Site</th><th>${t("organization")}</th><th>Adresse</th><th>Fuseau horaire</th><th>${t("configurations")}</th><th>${t("status")}</th><th></th></tr></thead><tbody>${page.items.map((site) => `<tr><td><button class="table-link" data-action="open-asset" data-asset-ref="site:${site.id}">${icon("pin", 16)}<span><strong>${escapeHtml(site.name)}</strong><small>${escapeHtml(site.id)}</small></span></button></td><td>${escapeHtml(orgName(site.organizationId))}</td><td>${escapeHtml(site.address || "—")}</td><td><code>${escapeHtml(site.timezone)}</code></td><td>${state.workspace.configurations.filter((item) => item.siteId === site.id).length}</td><td><span class="status-badge ${site.status === "archived" ? "muted" : "success"}">${site.status === "archived" ? "Archivé" : "Actif"}</span></td><td><div class="row-actions"><button class="icon-button" data-action="open-asset" data-asset-ref="site:${site.id}" aria-label="Aperçu">${icon("eye", 15)}</button>${writeButton(`<button class="icon-button" data-action="edit-site" data-id="${site.id}" aria-label="Modifier">${icon("edit", 15)}</button>`)}</div></td></tr>`).join("")}</tbody></table></div>${items.length ? paginationMarkup(page) : emptyState(t("empty"))}</section>
    </div>`;
  }

  function renderConfigurations() {
    const query = state.listSearch.trim().toLocaleLowerCase(state.locale);
    const items = filteredConfigurations().filter((item) => !query || [item.name, item.type, item.os, item.ip, item.owner, item.location, item.summary, item.notes, ...Object.values(item.details || {}), orgName(item.organizationId), siteName(item.siteId)].join(" ").toLocaleLowerCase(state.locale).includes(query)).sort((a, b) => a.name.localeCompare(b.name, state.locale));
    const page = paginate(items, 25);
    return `<div class="page">${pageHeader(t("configurations"), "Appareils, services et actifs documentés indépendamment de tout agent RMM.", writeButton(`<button class="primary" data-action="new-configuration">${icon("plus")} ${t("addConfiguration")}</button>`))}
      <div class="toolbar filters scalable-toolbar"><label class="list-search">${icon("search", 16)}<input type="search" data-list-search placeholder="Rechercher une configuration…" value="${escapeHtml(state.listSearch)}" /></label><label>${t("organization")}<select data-filter="organization"><option value="all">${t("all")}</option>${state.workspace.organizations.map((org) => `<option value="${org.id}" ${state.filter === org.id ? "selected" : ""}>${escapeHtml(organizationPathLabel(org.id))}</option>`).join("")}</select></label><div class="filter-pills"><button class="${state.filter === "all" || state.workspace.organizations.some((org) => org.id === state.filter) ? "active" : ""}" data-set-filter="all">${t("all")}</button><button class="${state.filter === "critical" ? "active" : ""}" data-set-filter="critical">Critiques</button><button class="${state.filter === "review" ? "active" : ""}" data-set-filter="review">À réviser</button></div><span class="result-count">${items.length} résultat${items.length === 1 ? "" : "s"}</span></div>
      <section class="table-card configurations-table"><div class="table-scroll"><table><thead><tr><th>Configuration</th><th>${t("organization")} / ${t("site")}</th><th>${t("type")}</th><th>${t("owner")}</th><th>${t("criticality")}</th><th>${t("lastReview")}</th><th></th></tr></thead><tbody>${page.items.map(configurationRow).join("")}</tbody></table></div>${items.length ? paginationMarkup(page) : emptyState(t("empty"))}</section>
    </div>`;
  }

  function configurationRow(item) {
    return `<tr><td><button class="table-link" data-action="open-asset" data-asset-ref="configuration:${item.id}"><span class="type-icon">${icon("server", 16)}</span><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.os || "Système non renseigné")}</small></span></button></td><td><strong>${escapeHtml(orgName(item.organizationId))}</strong><small class="table-subline">${escapeHtml(siteName(item.siteId))}</small></td><td>${escapeHtml(item.type)}</td><td>${escapeHtml(item.owner || "—")}</td><td><span class="priority ${item.criticality}">${criticalityLabel(item.criticality)}</span></td><td>${formatDate(item.lastReviewed)}</td><td><button class="icon-button" data-action="open-asset" data-asset-ref="configuration:${item.id}" aria-label="${t("view")}">${icon("chevron", 16)}</button></td></tr>`;
  }

  function renderConfigurationDetail(id) {
    const item = state.workspace.configurations.find((entry) => entry.id === id);
    if (!item) return `<div class="page">${pageHeader("Configuration introuvable", "Cette fiche n’existe plus ou son identifiant a changé.", `<button class="secondary" data-route="configurations">Retour</button>`)}</div>`;
    return renderAssetPage(`configuration:${item.id}`);
  }

  function renderProcedures() {
    const query = state.listSearch.trim().toLocaleLowerCase(state.locale);
    const allProcedures = filteredByOrganization(state.workspace.procedures);
    const items = allProcedures.filter((procedure) => !query || [procedure.title, procedure.category, procedure.owner, procedure.summary, ...(procedure.steps || [])].join(" ").toLocaleLowerCase(state.locale).includes(query)).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)) || a.title.localeCompare(b.title, state.locale));
    const page = paginate(items, 18);
    return `<div class="page">${pageHeader(t("procedures"), "Des méthodes claires, rattachées aux actifs et prêtes au moment utile.", writeButton(`<button class="primary" data-action="new-procedure">${icon("plus")} ${t("addProcedure")}</button>`))}
      <div class="toolbar compact-list-toolbar"><label class="list-search">${icon("search", 16)}<input type="search" data-list-search placeholder="Rechercher une procédure…" value="${escapeHtml(state.listSearch)}" /></label>${organizationFilter(true)}<div class="toolbar-summary"><strong>${items.length}</strong> sur ${state.workspace.procedures.length}</div></div>
      <section class="procedure-grid">${page.items.map((procedure) => { const relationCount = relationsForAsset(`procedure:${procedure.id}`).length; return `<article class="procedure-card"><div class="procedure-top"><span class="type-icon large">${icon("book", 21)}</span><span class="procedure-actions"><span class="status-badge ${procedure.status === "published" ? "success" : procedure.status === "archived" ? "muted" : "warning"}">${procedure.status === "published" ? "Publiée" : procedure.status === "archived" ? "Archivée" : "En révision"}</span>${writeButton(`<button class="icon-button" data-action="edit-procedure" data-id="${procedure.id}" aria-label="Modifier">${icon("edit", 15)}</button>`)}</span></div><p class="eyebrow">${escapeHtml(procedure.category)} · ${escapeHtml(orgName(procedure.organizationId))}</p><button class="procedure-title-button" type="button" data-action="open-asset" data-asset-ref="procedure:${procedure.id}"><h2>${escapeHtml(procedure.title)}</h2></button><p>${escapeHtml(procedure.summary)}</p><div class="procedure-meta"><span>${icon("users", 14)} ${escapeHtml(procedure.owner)}</span><span>${icon("clock", 14)} ${formatDate(procedure.updatedAt)}</span></div><ol>${(procedure.steps || []).slice(0, 3).map((step) => `<li>${escapeHtml(step.replace(/\[\[@([^|\]]+)\|[^\]]+\]\]/g, "@$1"))}</li>`).join("")}</ol><div class="linked-count">${relationCount} élément(s) lié(s)</div><button class="secondary full" type="button" data-action="open-asset" data-asset-ref="procedure:${procedure.id}">${icon("eye", 15)} Ouvrir la fiche</button></article>`; }).join("")}</section>${items.length ? paginationMarkup(page) : emptyState(t("empty"))}
    </div>`;
  }

  function renderRelations() {
    const query = normalizeSearch(state.listSearch);
    const items = state.workspace.relations.filter((relation) => {
      const source = assetByRef(relation.sourceRef); const target = assetByRef(relation.targetRef);
      if (state.relationOrganization !== "all" && relation.organizationId !== state.relationOrganization) return false;
      return !query || normalizeSearch([relation.label, relation.reverseLabel, relation.notes, source?.label, target?.label, orgName(relation.organizationId)].join(" ")).includes(query);
    }).sort((a, b) => Number(a.archived) - Number(b.archived) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
    const page = paginate(items, 15);
    const impactAssets = state.relationOrganization === "all" ? [] : assetRegistry(state.relationOrganization);
    const selectedImpact = impactAssets.some((asset) => asset.ref === state.relationImpactRef) ? state.relationImpactRef : "";
    const impact = selectedImpact ? impactForAsset(selectedImpact) : null;
    const impactAsset = selectedImpact ? assetByRef(selectedImpact) : null;
    return `<div class="page relations-page">${pageHeader(t("relations"), "Reliez n’importe quelle fiche à une autre dans la même organisation, avec un lien inverse automatique.", writeButton(`<button class="primary" data-action="new-relation">${icon("plus")} Nouvelle relation</button>`))}
      <div class="toolbar compact-list-toolbar relation-toolbar"><label class="list-search">${icon("search", 16)}<input type="search" data-list-search placeholder="Rechercher une relation…" value="${escapeHtml(state.listSearch)}" /></label><label>Organisation<select data-relation-filter><option value="all">Toutes</option>${state.workspace.organizations.map((org) => `<option value="${org.id}" ${state.relationOrganization === org.id ? "selected" : ""}>${escapeHtml(organizationPathLabel(org.id))}</option>`).join("")}</select></label><div class="toolbar-summary"><strong>${items.length}</strong> sur ${state.workspace.relations.length}</div></div>
      <section class="panel impact-explorer"><div><p class="eyebrow">VUE D’IMPACT</p><h2>Ce qui dépend d’un objet</h2><p>Sélectionnez d’abord une organisation, puis une fiche pour parcourir ses dépendants et ses dépendances sur plusieurs niveaux.</p></div><label>Fiche<select data-impact-ref ${state.relationOrganization === "all" ? "disabled" : ""}><option value="">${state.relationOrganization === "all" ? "Choisissez une organisation…" : "Choisir une fiche…"}</option>${impactAssets.map((asset) => `<option value="${escapeHtml(asset.ref)}" ${selectedImpact === asset.ref ? "selected" : ""}>${escapeHtml(asset.kind)} — ${escapeHtml(asset.label)}</option>`).join("")}</select></label>${impact && impactAsset ? `<div class="impact-explorer-result"><div class="impact-explorer-title"><span class="type-icon large">${icon(impactAsset.icon, 20)}</span><div><strong>${escapeHtml(impactAsset.label)}</strong><small>${escapeHtml(orgName(impactAsset.organizationId))}</small></div><button class="secondary compact" data-action="open-asset" data-asset-ref="${escapeHtml(impactAsset.ref)}" data-asset-tab="impact">Ouvrir l’impact</button></div><div class="impact-summary"><div><strong>${impact.dependents.length}</strong><span>dépendant(s)</span></div><div><strong>${impact.dependencies.length}</strong><span>dépendance(s)</span></div></div></div>` : ""}</section>
      <section class="relationship-canvas panel"><div class="relationship-intro"><div><p class="eyebrow">REGISTRE UNIVERSEL</p><h2>Dépendances documentées</h2></div><div class="legend"><span><i class="legend-dot source"></i> Source</span><span><i class="legend-line"></i> Relation bidirectionnelle</span><span><i class="legend-dot target"></i> Cible</span></div></div>
      ${items.length ? `<div class="relation-cards">${page.items.map((relation) => { const source = assetByRef(relation.sourceRef); const target = assetByRef(relation.targetRef); return `<article class="relation-card ${relation.archived ? "archived" : ""}"><button type="button" data-action="open-asset" data-asset-ref="${escapeHtml(source?.ref || "")}" ${source ? "" : "disabled"}><span class="node-mark">${icon(source?.icon || "alert", 20)}</span><span><strong>${escapeHtml(source?.label || "Source introuvable")}</strong><small>${escapeHtml(source?.kind || "Objet supprimé")} · ${escapeHtml(orgName(relation.organizationId))}</small></span></button><div class="relation-connector"><span>${escapeHtml(relation.label)}</span><i></i>${icon("arrow", 16)}<small>${escapeHtml(relation.reverseLabel)}</small></div><button type="button" data-action="open-asset" data-asset-ref="${escapeHtml(target?.ref || "")}" ${target ? "" : "disabled"}><span class="node-mark target">${icon(target?.icon || "alert", 20)}</span><span><strong>${escapeHtml(target?.label || "Cible introuvable")}</strong><small>${escapeHtml(target?.kind || "Objet supprimé")}${target?.archived ? " · Archivé" : ""}</small></span></button><div class="relation-card-footer"><p>${escapeHtml(relation.notes || "Aucune note.")}</p><div>${relation.archived ? '<span class="status-badge muted">Lien archivé</span>' : '<span class="status-badge success">Actif</span>'}${writeButton(`<button class="secondary compact" data-action="edit-relation" data-id="${relation.id}">${icon("edit", 14)} Modifier</button>`)}</div></div></article>`; }).join("")}</div>${paginationMarkup(page)}` : emptyState("Aucune relation documentée dans cette portée.")}</section>
    </div>`;
  }

  function renderActivity() {
    const query = state.listSearch.trim().toLocaleLowerCase(state.locale);
    const source = isAdministrator() && state.auditEntries.length
      ? state.auditEntries.map((entry) => ({ at: entry.at, actor: entry.actor, action: entry.action, target: entry.details?.title || entry.details?.label || entry.details?.username || entry.assetRef || "Instance Atlas", kind: entry.organizationId ? orgName(entry.organizationId) : "Sécurité / système" }))
      : state.workspace.activities;
    const items = source.filter((entry) => !query || [entry.actor, entry.action, entry.target, entry.kind].join(" ").toLocaleLowerCase(state.locale).includes(query)).sort((a, b) => String(b.at).localeCompare(String(a.at)));
    const page = paginate(items, 25);
    return `<div class="page">${pageHeader(t("activity"), isAdministrator() ? "Journal local complet : documentation, comptes, sessions, MFA et accès au coffre." : "Historique local des changements documentaires accessibles à ce compte.")}
      <div class="toolbar compact-list-toolbar"><label class="list-search">${icon("search", 16)}<input type="search" data-list-search placeholder="Rechercher dans l’activité…" value="${escapeHtml(state.listSearch)}" /></label><div class="toolbar-summary"><strong>${items.length}</strong> sur ${source.length}</div></div>
      <section class="table-card"><div class="table-scroll"><table><thead><tr><th>Date</th><th>Acteur</th><th>Action</th><th>Cible</th><th>Type</th></tr></thead><tbody>${page.items.map((entry) => `<tr><td>${formatDateTime(entry.at)}</td><td>${escapeHtml(entry.actor)}</td><td><strong>${escapeHtml(entry.action)}</strong></td><td>${escapeHtml(entry.target)}</td><td><span class="kind-pill">${escapeHtml(entry.kind)}</span></td></tr>`).join("")}</tbody></table></div>${items.length ? paginationMarkup(page) : emptyState(t("empty"))}</section>
    </div>`;
  }

  function fileSharingServerIds(item) {
    const value = item?.details?.serverConfigurationIds;
    if (Array.isArray(value)) return [...new Set(value.map(String).filter(Boolean))];
    return [...new Set(String(value || "").split(",").map((id) => id.trim()).filter(Boolean))];
  }

  function fileSharingSelectedServersMarkup(organizationId, selectedIds) {
    const selected = selectedIds.map((id) => state.workspace.configurations.find((configuration) => configuration.id === id && configuration.organizationId === organizationId)).filter(Boolean);
    return selected.length ? selected.map((configuration) => `<span class="file-sharing-server-chip">${icon("server", 15)}<span><strong>${escapeHtml(configuration.name)}</strong><small>${escapeHtml(configuration.type || "Configuration")}${configuration.ip ? ` · ${escapeHtml(configuration.ip)}` : ""}</small></span><button type="button" data-action="remove-file-sharing-server" data-id="${escapeHtml(configuration.id)}" aria-label="Retirer ${escapeHtml(configuration.name)}">${icon("close", 13)}</button></span>`).join("") : `<p class="file-sharing-server-empty">Aucun serveur lié. Recherchez une configuration de ${escapeHtml(orgName(organizationId))}.</p>`;
  }

  function fileSharingServerPickerMarkup(organizationId, selectedIds) {
    const validIds = selectedIds.filter((id) => state.workspace.configurations.some((configuration) => configuration.id === id && configuration.organizationId === organizationId));
    const available = state.workspace.configurations.filter((configuration) => configuration.organizationId === organizationId).length;
    return `<div class="file-sharing-server-picker span-2" data-file-sharing-server-picker data-organization-id="${escapeHtml(organizationId)}">
      <label for="file-sharing-server-search">Serveurs</label>
      <div class="file-sharing-server-search">${icon("search", 17)}<input id="file-sharing-server-search" type="search" data-file-sharing-server-search autocomplete="off" placeholder="Rechercher une configuration dans ${escapeHtml(orgName(organizationId))}…" aria-autocomplete="list" aria-controls="file-sharing-server-results" aria-expanded="false" /></div>
      <small>Associez les configurations qui hébergent ce partage. Atlas créera automatiquement les liens inverses.</small>
      <div class="file-sharing-server-results" id="file-sharing-server-results" data-file-sharing-server-results role="listbox" hidden></div>
      <div class="file-sharing-selected-servers" data-file-sharing-selected>${fileSharingSelectedServersMarkup(organizationId, validIds)}</div>
      <div data-file-sharing-server-values>${validIds.map((id) => `<input type="hidden" name="serverConfigurationIds" value="${escapeHtml(id)}" />`).join("")}</div>
      <p class="file-sharing-server-count">${available} configuration${available === 1 ? "" : "s"} disponible${available === 1 ? "" : "s"} dans cette organisation.</p>
    </div>`;
  }

  function refreshFileSharingServerPicker(root, open = true) {
    if (!root) return;
    const organizationId = root.dataset.organizationId || "";
    const input = root.querySelector("[data-file-sharing-server-search]");
    const results = root.querySelector("[data-file-sharing-server-results]");
    const selectedContainer = root.querySelector("[data-file-sharing-selected]");
    const valuesContainer = root.querySelector("[data-file-sharing-server-values]");
    if (!input || !results || !selectedContainer || !valuesContainer) return;
    const selectedIds = [...valuesContainer.querySelectorAll('input[name="serverConfigurationIds"]')].map((field) => field.value);
    const query = normalizeSearch(input.value);
    const matches = state.workspace.configurations
      .filter((configuration) => configuration.organizationId === organizationId && !selectedIds.includes(configuration.id))
      .filter((configuration) => !query || normalizeSearch([configuration.name, configuration.type, configuration.os, configuration.ip, configuration.location].join(" ")).includes(query))
      .sort((a, b) => a.name.localeCompare(b.name, state.locale))
      .slice(0, 10);
    selectedContainer.innerHTML = fileSharingSelectedServersMarkup(organizationId, selectedIds);
    results.innerHTML = matches.length ? matches.map((configuration) => `<button type="button" role="option" data-action="select-file-sharing-server" data-id="${escapeHtml(configuration.id)}"><span class="type-icon">${icon("server", 15)}</span><span><strong>${escapeHtml(configuration.name)}</strong><small>${escapeHtml(configuration.type || "Configuration")}${configuration.ip ? ` · ${escapeHtml(configuration.ip)}` : ""}</small></span>${icon("plus", 14)}</button>`).join("") : `<p>${query ? "Aucune configuration ne correspond à cette recherche." : "Toutes les configurations disponibles sont déjà liées."}</p>`;
    results.hidden = !open;
    input.setAttribute("aria-expanded", String(open));
  }

  function addFileSharingServer(root, configurationId) {
    const valuesContainer = root?.querySelector("[data-file-sharing-server-values]");
    if (!root || !valuesContainer || !configurationId) return;
    const organizationId = root.dataset.organizationId || "";
    const configuration = state.workspace.configurations.find((item) => item.id === configurationId && item.organizationId === organizationId);
    if (!configuration || [...valuesContainer.querySelectorAll('input[name="serverConfigurationIds"]')].some((input) => input.value === configurationId)) return;
    const field = document.createElement("input");
    field.type = "hidden";
    field.name = "serverConfigurationIds";
    field.value = configurationId;
    valuesContainer.append(field);
    const input = root.querySelector("[data-file-sharing-server-search]");
    if (input) input.value = "";
    refreshFileSharingServerPicker(root, true);
    input?.focus();
  }

  function removeFileSharingServer(root, configurationId) {
    const valuesContainer = root?.querySelector("[data-file-sharing-server-values]");
    const field = valuesContainer ? [...valuesContainer.querySelectorAll('input[name="serverConfigurationIds"]')].find((input) => input.value === configurationId) : null;
    field?.remove();
    refreshFileSharingServerPicker(root, false);
    root?.querySelector("[data-file-sharing-server-search]")?.focus();
  }

  function printingConfigurationIds(item, key) {
    const value = item?.details?.[key];
    if (Array.isArray(value)) return [...new Set(value.map(String).filter(Boolean))];
    return [...new Set(String(value || "").split(",").map((id) => id.trim()).filter(Boolean))];
  }

  function printingSelectedConfigurationsMarkup(organizationId, selectedIds, role) {
    const selected = selectedIds.map((id) => state.workspace.configurations.find((configuration) => configuration.id === id && configuration.organizationId === organizationId)).filter(Boolean);
    const emptyLabel = role === "print-server" ? "Aucun serveur d’impression lié." : "Aucune configuration d’imprimante liée.";
    return selected.length ? selected.map((configuration) => `<span class="file-sharing-server-chip printing-configuration-chip">${icon(role === "print-server" ? "server" : "printer", 15)}<span><strong>${escapeHtml(configuration.name)}</strong><small>${escapeHtml(configuration.type || "Configuration")}${configuration.ip ? ` · ${escapeHtml(configuration.ip)}` : ""}</small></span><button type="button" data-action="remove-printing-configuration" data-id="${escapeHtml(configuration.id)}" aria-label="Retirer ${escapeHtml(configuration.name)}">${icon("close", 13)}</button></span>`).join("") : `<p class="file-sharing-server-empty">${emptyLabel} Recherchez une configuration de ${escapeHtml(orgName(organizationId))}.</p>`;
  }

  function printingConfigurationPickerMarkup(organizationId, selectedIds, role) {
    const inputName = role === "print-server" ? "printServerConfigurationIds" : "printerConfigurationIds";
    const label = role === "print-server" ? "Serveur(s) d’impression" : "Configuration(s) d’imprimante";
    const help = role === "print-server" ? "Associez les serveurs responsables du partage et du déploiement des imprimantes." : "Associez les configurations représentant les imprimantes physiques ou virtuelles.";
    const pickerId = `printing-${role}-search`;
    const resultsId = `printing-${role}-results`;
    const validIds = selectedIds.filter((id) => state.workspace.configurations.some((configuration) => configuration.id === id && configuration.organizationId === organizationId));
    const available = state.workspace.configurations.filter((configuration) => configuration.organizationId === organizationId).length;
    return `<div class="file-sharing-server-picker printing-configuration-picker span-2" data-printing-configuration-picker data-configuration-role="${role}" data-input-name="${inputName}" data-organization-id="${escapeHtml(organizationId)}">
      <label for="${pickerId}">${label}</label>
      <div class="file-sharing-server-search">${icon("search", 17)}<input id="${pickerId}" type="search" data-printing-configuration-search autocomplete="off" placeholder="Rechercher une configuration dans ${escapeHtml(orgName(organizationId))}…" aria-autocomplete="list" aria-controls="${resultsId}" aria-expanded="false" /></div>
      <small>${help} Atlas crée automatiquement le lien inverse.</small>
      <div class="file-sharing-server-results" id="${resultsId}" data-printing-configuration-results role="listbox" hidden></div>
      <div class="file-sharing-selected-servers" data-printing-selected>${printingSelectedConfigurationsMarkup(organizationId, validIds, role)}</div>
      <div data-printing-configuration-values>${validIds.map((id) => `<input type="hidden" name="${inputName}" value="${escapeHtml(id)}" />`).join("")}</div>
      <p class="file-sharing-server-count">${available} configuration${available === 1 ? "" : "s"} disponible${available === 1 ? "" : "s"} dans cette organisation.</p>
    </div>`;
  }

  function refreshPrintingConfigurationPicker(root, open = true) {
    if (!root) return;
    const organizationId = root.dataset.organizationId || "";
    const role = root.dataset.configurationRole || "printer";
    const inputName = root.dataset.inputName || "printerConfigurationIds";
    const input = root.querySelector("[data-printing-configuration-search]");
    const results = root.querySelector("[data-printing-configuration-results]");
    const selectedContainer = root.querySelector("[data-printing-selected]");
    const valuesContainer = root.querySelector("[data-printing-configuration-values]");
    if (!input || !results || !selectedContainer || !valuesContainer) return;
    const selectedIds = [...valuesContainer.querySelectorAll(`input[name="${inputName}"]`)].map((field) => field.value);
    const query = normalizeSearch(input.value);
    const preferred = role === "print-server" ? /server|serveur|print server/ : /printer|imprimante|print|copieur|multifonction/;
    const matches = state.workspace.configurations
      .filter((configuration) => configuration.organizationId === organizationId && !selectedIds.includes(configuration.id))
      .filter((configuration) => !query || normalizeSearch([configuration.name, configuration.type, configuration.os, configuration.ip, configuration.location].join(" ")).includes(query))
      .sort((a, b) => Number(preferred.test(normalizeSearch([b.name, b.type].join(" ")))) - Number(preferred.test(normalizeSearch([a.name, a.type].join(" ")))) || a.name.localeCompare(b.name, state.locale))
      .slice(0, 10);
    selectedContainer.innerHTML = printingSelectedConfigurationsMarkup(organizationId, selectedIds, role);
    results.innerHTML = matches.length ? matches.map((configuration) => `<button type="button" role="option" data-action="select-printing-configuration" data-id="${escapeHtml(configuration.id)}"><span class="type-icon">${icon(role === "print-server" ? "server" : "printer", 15)}</span><span><strong>${escapeHtml(configuration.name)}</strong><small>${escapeHtml(configuration.type || "Configuration")}${configuration.ip ? ` · ${escapeHtml(configuration.ip)}` : ""}</small></span>${icon("plus", 14)}</button>`).join("") : `<p>${query ? "Aucune configuration ne correspond à cette recherche." : "Toutes les configurations disponibles sont déjà liées."}</p>`;
    results.hidden = !open;
    input.setAttribute("aria-expanded", String(open));
  }

  function addPrintingConfiguration(root, configurationId) {
    const valuesContainer = root?.querySelector("[data-printing-configuration-values]");
    if (!root || !valuesContainer || !configurationId) return;
    const organizationId = root.dataset.organizationId || "";
    const inputName = root.dataset.inputName || "printerConfigurationIds";
    const configuration = state.workspace.configurations.find((item) => item.id === configurationId && item.organizationId === organizationId);
    if (!configuration || [...valuesContainer.querySelectorAll(`input[name="${inputName}"]`)].some((input) => input.value === configurationId)) return;
    const field = document.createElement("input");
    field.type = "hidden";
    field.name = inputName;
    field.value = configurationId;
    valuesContainer.append(field);
    const input = root.querySelector("[data-printing-configuration-search]");
    if (input) input.value = "";
    refreshPrintingConfigurationPicker(root, true);
    input?.focus();
  }

  function removePrintingConfiguration(root, configurationId) {
    const valuesContainer = root?.querySelector("[data-printing-configuration-values]");
    const inputName = root?.dataset.inputName || "printerConfigurationIds";
    const field = valuesContainer ? [...valuesContainer.querySelectorAll(`input[name="${inputName}"]`)].find((input) => input.value === configurationId) : null;
    field?.remove();
    refreshPrintingConfigurationPicker(root, false);
    root?.querySelector("[data-printing-configuration-search]")?.focus();
  }

  function recordEditorFrame({ module, item, organizationId, title, description, sections, formKind, submitLabel, recordId = "" }) {
    return `<div class="page record-editor-page generic-record-editor-page">
      <div class="record-editor-breadcrumbs">${organizationBreadcrumbMarkup(organizationId)}${icon("chevron", 13)}<button type="button" data-route="${escapeHtml(module.route || `module/${module.id}`)}">${escapeHtml(module.label)}</button>${icon("chevron", 13)}<span>${item ? escapeHtml(item.name || item.title) : "Nouvelle fiche"}</span></div>
      <form class="record-editor-shell" data-form="${escapeHtml(formKind)}" data-id="${escapeHtml(recordId)}"${formKind === "module-record" ? ` data-module-id="${escapeHtml(module.id)}"` : ""}>
        <input type="hidden" name="organizationId" value="${escapeHtml(organizationId)}" required />
        <header class="record-editor-heading"><div><p class="eyebrow">${escapeHtml(module.label.toUpperCase())}</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div><button class="icon-button" type="button" data-action="cancel-record-editor" data-module-id="${escapeHtml(module.id)}" aria-label="Fermer">${icon("close", 18)}</button></header>
        <div class="record-editor-body">${sections}</div>
        <footer class="record-editor-actions"><div class="form-error" role="alert"></div><button class="secondary" type="button" data-action="cancel-record-editor" data-module-id="${escapeHtml(module.id)}">Annuler</button><button class="primary" type="submit">${escapeHtml(submitLabel)}</button></footer>
      </form>
    </div>`;
  }

  function renderSiteRecordEditor(module, recordId = null) {
    const item = recordId ? state.workspace.sites.find((site) => site.id === recordId) : null;
    if (recordId && !item) return `<div class="page">${pageHeader("Site introuvable", "Ce site n’existe plus.", `<button class="secondary" data-route="sites">Retour aux sites</button>`)}</div>`;
    const organizationId = item?.organizationId || activeOrganizationId();
    if (!organizationId) return `<div class="page">${pageHeader("Organisation requise", "Choisissez d’abord une organisation dans le filtre Sites.", `<button class="secondary" data-route="sites">Retour aux sites</button>`)}</div>`;
    const details = item?.details || {};
    const sections = `<section class="record-editor-section"><header><span class="record-editor-section-icon">${icon("pin", 19)}</span><div><h2>Emplacement</h2><p>Identifiez clairement le site physique ou logique dans l’organisation active.</p></div></header><div class="record-editor-fields"><label class="span-2"><span class="field-label">Nom du site <strong aria-hidden="true">*</strong></span><input name="name" value="${escapeHtml(item?.name || "")}" required maxlength="120" placeholder="Ex. Bureau Montréal" /></label><label class="span-2">Adresse ou description<input name="address" value="${escapeHtml(item?.address || "")}" maxlength="200" placeholder="Adresse civique, centre de données ou contexte logique" /></label><label>Type de site<input name="siteType" value="${escapeHtml(details.siteType || "")}" maxlength="120" placeholder="Bureau, entrepôt, centre de données…" /></label><label>Fuseau horaire<input name="timezone" value="${escapeHtml(item?.timezone || "America/Toronto")}" required maxlength="80" /></label><label class="span-2">Heures d’ouverture<input name="openingHours" value="${escapeHtml(details.openingHours || "")}" maxlength="200" placeholder="Lun–ven 08:00–17:00" /></label><label class="span-2">Instructions d’accès<textarea name="accessInstructions" maxlength="1000" rows="3" placeholder="Accueil, badge, quai, personne à appeler…">${escapeHtml(details.accessInstructions || "")}</textarea></label></div></section><section class="record-editor-section"><header><span class="record-editor-section-icon">${icon("network", 19)}</span><div><h2>Contexte réseau</h2><p>Documentez les segments du site sans y placer de secret.</p></div></header><div class="record-editor-fields"><label>Sous-réseau principal<input name="primarySubnet" value="${escapeHtml(details.primarySubnet || "")}" maxlength="120" placeholder="10.20.0.0/24" /></label><label>Contact sur place<input name="onsiteContact" value="${escapeHtml(details.onsiteContact || "")}" maxlength="300" /></label><label class="span-2">VLAN / segments<textarea name="vlans" maxlength="2000" rows="4" placeholder="10 Gestion&#10;20 Serveurs&#10;30 Utilisateurs">${escapeHtml(details.vlans || "")}</textarea></label></div></section><section class="record-editor-section"><header><span class="record-editor-section-icon">${icon("shield", 19)}</span><div><h2>Sécurité et portée</h2><p>Le site reste limité aux comptes autorisés pour cette organisation.</p></div></header><div class="record-editor-fields"><div class="file-sharing-access-summary span-2">${icon("lock", 18)}<span><strong>${escapeHtml(orgName(organizationId))}</strong><small>Organisation déterminée par la page active; aucun sélecteur global n’est affiché.</small></span></div></div></section>`;
    return recordEditorFrame({ module, item, organizationId, title: item ? `Modifier ${item.name}` : "Créer un site", description: "Ajoutez un emplacement sans quitter la navigation Atlas.", sections, formKind: "site", submitLabel: item ? "Enregistrer les modifications" : "Créer le site", recordId: item?.id || "" });
  }

  function renderConfigurationRecordEditorLegacy(module, recordId = null) {
    const item = recordId ? configById(recordId) : null;
    if (recordId && !item) return `<div class="page">${pageHeader("Configuration introuvable", "Cette configuration n’existe plus.", `<button class="secondary" data-route="configurations">Retour aux configurations</button>`)}</div>`;
    const organizationId = item?.organizationId || activeOrganizationId();
    if (!organizationId) return `<div class="page">${pageHeader("Organisation requise", "Choisissez d’abord une organisation dans le filtre Configurations.", `<button class="secondary" data-route="configurations">Retour aux configurations</button>`)}</div>`;
    const details = item?.details || {};
    const sections = `<section class="record-editor-section"><header><span class="record-editor-section-icon">${icon("server", 19)}</span><div><h2>Identité de la configuration</h2><p>Nom, type, site et état documentaire.</p></div></header><div class="record-editor-fields"><label class="span-2"><span class="field-label">Nom <strong aria-hidden="true">*</strong></span><input name="name" value="${escapeHtml(item?.name || "")}" required maxlength="120" /></label><label>Site<select name="siteId" required><option value="">Choisir un site</option>${siteOptions(item?.siteId, organizationId)}</select></label><label>Type<select name="type">${["Serveur", "Poste", "Stockage", "Réseau", "Service", "Autre"].map((value) => `<option ${item?.type === value ? "selected" : ""}>${value}</option>`).join("")}</select></label><label>État<select name="status"><option value="draft" ${item?.status === "draft" || !item ? "selected" : ""}>Brouillon</option><option value="review" ${item?.status === "review" ? "selected" : ""}>À réviser</option><option value="documented" ${item?.status === "documented" ? "selected" : ""}>Documentée</option></select></label><label>Criticité<select name="criticality"><option value="normal">Normale</option><option value="low" ${item?.criticality === "low" ? "selected" : ""}>Faible</option><option value="high" ${item?.criticality === "high" ? "selected" : ""}>Élevée</option><option value="critical" ${item?.criticality === "critical" ? "selected" : ""}>Critique</option></select></label></div></section><section class="record-editor-section"><header><span class="record-editor-section-icon">${icon("network", 19)}</span><div><h2>Détails techniques</h2><p>Système, adresse, emplacement et cycle matériel.</p></div></header><div class="record-editor-fields"><label>Système<input name="os" value="${escapeHtml(item?.os || "")}" maxlength="120" /></label><label>Adresse IP<input name="ip" value="${escapeHtml(item?.ip || "")}" maxlength="80" /></label><label>Responsable<input name="owner" value="${escapeHtml(item?.owner || "")}" maxlength="96" /></label><label>Emplacement<input name="location" value="${escapeHtml(item?.location || "")}" maxlength="160" /></label><label class="span-2">Garantie<input name="warranty" type="date" value="${escapeHtml(item?.warranty || "")}" /></label></div></section><section class="record-editor-section"><header><span class="record-editor-section-icon">${icon("book", 19)}</span><div><h2>Documentation</h2><p>Contexte opérationnel visible dans la recherche et la fiche.</p></div></header><div class="record-editor-fields"><label class="span-2">Résumé<textarea name="summary" maxlength="1000" rows="3">${escapeHtml(item?.summary || "")}</textarea></label><label class="span-2">Notes opérationnelles<textarea name="notes" maxlength="2000" rows="5">${escapeHtml(item?.notes || "")}</textarea></label></div></section>`;
    const enhancedSections = `<section class="record-editor-section"><header><span class="record-editor-section-icon">${icon("server", 19)}</span><div><h2>Identité de la configuration</h2><p>Nom, type, site et état documentaire.</p></div></header><div class="record-editor-fields"><label class="span-2"><span class="field-label">Nom <strong aria-hidden="true">*</strong></span><input name="name" value="${escapeHtml(item?.name || "")}" required maxlength="120" /></label><label>Site<select name="siteId" required><option value="">Choisir un site</option>${siteOptions(item?.siteId, organizationId)}</select></label><label>Type<select name="type">${["Serveur", "Machine virtuelle", "Hyperviseur", "Poste", "Portable", "Stockage", "Réseau", "Pare-feu", "Commutateur", "Point d’accès", "Imprimante", "UPS", "Service", "Autre"].map((value) => `<option ${item?.type === value ? "selected" : ""}>${value}</option>`).join("")}</select></label><label>État<select name="status"><option value="draft" ${item?.status === "draft" || !item ? "selected" : ""}>Brouillon</option><option value="review" ${item?.status === "review" ? "selected" : ""}>À réviser</option><option value="documented" ${item?.status === "documented" ? "selected" : ""}>Documentée</option></select></label><label>Criticité<select name="criticality"><option value="normal">Normale</option><option value="low" ${item?.criticality === "low" ? "selected" : ""}>Faible</option><option value="high" ${item?.criticality === "high" ? "selected" : ""}>Élevée</option><option value="critical" ${item?.criticality === "critical" ? "selected" : ""}>Critique</option></select></label><label>Rôle technique<input name="technicalRole" value="${escapeHtml(details.technicalRole || "")}" maxlength="300" placeholder="AD, DNS, ERP, commutation cœur…" /></label><label>Hôte / parent<input name="parentAsset" value="${escapeHtml(details.parentAsset || "")}" maxlength="160" placeholder="Nom de l’hôte, du cluster ou de la pile" /></label></div></section><section class="record-editor-section"><header><span class="record-editor-section-icon">${icon("network", 19)}</span><div><h2>Détails techniques</h2><p>Matériel, système, réseau, capacité et cycle de vie.</p></div></header><div class="record-editor-fields"><label>Fabricant<input name="manufacturer" value="${escapeHtml(details.manufacturer || "")}" maxlength="120" /></label><label>Modèle<input name="model" value="${escapeHtml(details.model || "")}" maxlength="160" /></label><label>Numéro de série<input name="serialNumber" value="${escapeHtml(details.serialNumber || "")}" maxlength="200" /></label><label>Plateforme / version<input name="platform" value="${escapeHtml(details.platform || "")}" maxlength="160" /></label><label>Système<input name="os" value="${escapeHtml(item?.os || "")}" maxlength="120" /></label><label>Adresse IP<input name="ip" value="${escapeHtml(item?.ip || "")}" maxlength="80" /></label><label>CPU / vCPU<input name="cpu" value="${escapeHtml(details.cpu || "")}" maxlength="120" /></label><label>Mémoire<input name="memory" value="${escapeHtml(details.memory || "")}" maxlength="120" /></label><label>Stockage / capacité<input name="storage" value="${escapeHtml(details.storage || "")}" maxlength="200" /></label><label>Micrologiciel<input name="firmware" value="${escapeHtml(details.firmware || "")}" maxlength="120" /></label><label>Responsable<input name="owner" value="${escapeHtml(item?.owner || "")}" maxlength="96" /></label><label>Emplacement<input name="location" value="${escapeHtml(item?.location || "")}" maxlength="160" /></label><label>Garantie<input name="warranty" type="date" value="${escapeHtml(item?.warranty || "")}" /></label><label>Fin de vie prévue<input name="lifecycleDate" type="date" value="${escapeHtml(details.lifecycleDate || "")}" /></label><label>Chiffrement<input name="encryption" value="${escapeHtml(details.encryption || "")}" maxlength="120" placeholder="BitLocker, appareil chiffré…" /></label><label>Protection / EDR<input name="securityAgent" value="${escapeHtml(details.securityAgent || "")}" maxlength="160" /></label></div></section><section class="record-editor-section"><header><span class="record-editor-section-icon">${icon("book", 19)}</span><div><h2>Documentation</h2><p>Contexte opérationnel visible dans la recherche et la fiche.</p></div></header><div class="record-editor-fields"><label class="span-2">Résumé<textarea name="summary" maxlength="1000" rows="3">${escapeHtml(item?.summary || "")}</textarea></label><label class="span-2">Notes opérationnelles<span class="mention-field"><textarea name="notes" data-relate-input maxlength="4000" rows="6" placeholder="Tapez @ puis le nom d’une fiche pour la relier">${escapeHtml(item?.notes || "")}</textarea><div class="mention-picker" data-mention-picker hidden></div></span><small>Tapez @nom-de-fiche pour créer une relation bidirectionnelle à l’enregistrement.</small></label></div></section>`;
    return recordEditorFrame({ module, item, organizationId, title: item ? `Modifier ${item.name}` : "Créer une configuration", description: "Documentez l’actif technique dans l’organisation active.", sections: enhancedSections, formKind: "configuration", submitLabel: item ? "Enregistrer les modifications" : "Créer la configuration", recordId: item?.id || "" });
  }

  function configurationOptionsForOrganization(organizationId, selectedId = "", excludedId = "") {
    return state.workspace.configurations
      .filter((configuration) => configuration.organizationId === organizationId && configuration.id !== excludedId)
      .sort((a, b) => a.name.localeCompare(b.name, state.locale))
      .map((configuration) => `<option value="${escapeHtml(configuration.id)}" ${selectedId === configuration.id ? "selected" : ""}>${escapeHtml(configuration.name)} · ${escapeHtml(configuration.type)}</option>`)
      .join("");
  }

  function renderConfigurationRecordEditor(module, recordId = null) {
    const item = recordId ? configById(recordId) : null;
    if (recordId && !item) return `<div class="page">${pageHeader("Configuration introuvable", "Cette configuration n’existe plus.", `<button class="secondary" data-route="configurations">Retour aux configurations</button>`)}</div>`;
    const organizationId = item?.organizationId || activeOrganizationId();
    if (!organizationId) return `<div class="page">${pageHeader("Organisation requise", "Choisissez d’abord une organisation dans le filtre Configurations.", `<button class="secondary" data-route="configurations">Retour aux configurations</button>`)}</div>`;
    const details = item?.details || {};
    const types = ["Serveur", "Machine virtuelle", "Hyperviseur", "Poste", "Portable", "Stockage", "Réseau", "Pare-feu", "Commutateur", "Point d’accès", "Imprimante", "UPS", "Service", "Autre"];
    const sections = `
      <section class="record-editor-section">
        <header><span class="record-editor-section-icon">${icon("server", 19)}</span><div><h2>Identité et rôle</h2><p>Classez l’actif, son usage et sa place dans l’architecture.</p></div></header>
        <div class="record-editor-fields">
          <label class="span-2"><span class="field-label">Nom <strong aria-hidden="true">*</strong></span><input name="name" value="${escapeHtml(item?.name || "")}" required maxlength="120" placeholder="Ex. MTL-SQL01" /></label>
          <label>Site<select name="siteId" required><option value="">Choisir un site</option>${siteOptions(item?.siteId, organizationId)}</select></label>
          <label>Type<select name="type">${types.map((value) => `<option value="${escapeHtml(value)}" ${item?.type === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>
          <label>État documentaire<select name="status"><option value="draft" ${item?.status === "draft" || !item ? "selected" : ""}>Brouillon</option><option value="review" ${item?.status === "review" ? "selected" : ""}>À réviser</option><option value="documented" ${item?.status === "documented" ? "selected" : ""}>Documentée</option></select></label>
          <label>Criticité<select name="criticality"><option value="normal">Normale</option><option value="low" ${item?.criticality === "low" ? "selected" : ""}>Faible</option><option value="high" ${item?.criticality === "high" ? "selected" : ""}>Élevée</option><option value="critical" ${item?.criticality === "critical" ? "selected" : ""}>Critique</option></select></label>
          <label class="span-2">Rôle technique<input name="technicalRole" value="${escapeHtml(details.technicalRole || "")}" maxlength="300" placeholder="Contrôleur de domaine, SQL ERP, commutation cœur…" /></label>
          <label>Nom d’hôte<input name="hostname" value="${escapeHtml(details.hostname || item?.name || "")}" maxlength="160" /></label>
          <label>FQDN<input name="fqdn" value="${escapeHtml(details.fqdn || "")}" maxlength="255" placeholder="serveur.domaine.test" /></label>
          <label>Étiquette d’actif<input name="assetTag" value="${escapeHtml(details.assetTag || "")}" maxlength="120" /></label>
          <label>Hôte / configuration parente<select name="parentConfigurationId"><option value="">Aucune relation parente</option>${configurationOptionsForOrganization(organizationId, details.parentConfigurationId || "", item?.id || "")}</select><small>Crée automatiquement un lien « Hébergé sur » bidirectionnel.</small></label>
          <label class="span-2">Parent externe ou précision<input name="parentAsset" value="${escapeHtml(details.parentAsset || "")}" maxlength="200" placeholder="À utiliser seulement si le parent n’existe pas encore dans Atlas" /></label>
        </div>
      </section>
      <section class="record-editor-section">
        <header><span class="record-editor-section-icon">${icon("grid", 19)}</span><div><h2>Matériel et plateforme</h2><p>Décrivez les caractéristiques physiques ou virtuelles essentielles.</p></div></header>
        <div class="record-editor-fields">
          <label>Fabricant<input name="manufacturer" value="${escapeHtml(details.manufacturer || "")}" maxlength="120" /></label>
          <label>Modèle<input name="model" value="${escapeHtml(details.model || "")}" maxlength="160" /></label>
          <label>Numéro de série<input name="serialNumber" value="${escapeHtml(details.serialNumber || "")}" maxlength="200" /></label>
          <label>Plateforme / hyperviseur<input name="platform" value="${escapeHtml(details.platform || "")}" maxlength="160" /></label>
          <label>Système / OS<input name="os" value="${escapeHtml(item?.os || "")}" maxlength="160" /></label>
          <label>Micrologiciel / BIOS<input name="firmware" value="${escapeHtml(details.firmware || "")}" maxlength="160" /></label>
          <label>CPU / vCPU<input name="cpu" value="${escapeHtml(details.cpu || "")}" maxlength="120" /></label>
          <label>Mémoire<input name="memory" value="${escapeHtml(details.memory || "")}" maxlength="120" /></label>
          <label class="span-2">Stockage / volumes<textarea name="storage" maxlength="1200" rows="3" placeholder="Volumes, RAID, capacité utile et espace libre">${escapeHtml(details.storage || "")}</textarea></label>
          <label>Alimentation<input name="powerSupply" value="${escapeHtml(details.powerSupply || "")}" maxlength="160" placeholder="Double PSU, PoE, UPS…" /></label>
          <label>Position de baie<input name="rackPosition" value="${escapeHtml(details.rackPosition || "")}" maxlength="120" placeholder="Baie A · U18-U20" /></label>
        </div>
      </section>
      <section class="record-editor-section">
        <header><span class="record-editor-section-icon">${icon("network", 19)}</span><div><h2>Réseau et adressage</h2><p>La première IP reste visible dans les listes; les interfaces détaillées permettent les cas complexes.</p></div></header>
        <div class="record-editor-fields">
          <label>Adresse IP principale<input name="ip" value="${escapeHtml(item?.ip || "")}" maxlength="80" /></label>
          <label>VLAN principal<input name="vlan" value="${escapeHtml(details.vlan || "")}" maxlength="120" /></label>
          <label class="span-2">Interfaces réseau<textarea name="networkInterfaces" maxlength="3000" rows="5" placeholder="Nom | IP/CIDR | passerelle | VLAN | usage&#10;LAN1 | 10.77.20.30/24 | 10.77.20.1 | 20 | Production">${escapeHtml(details.networkInterfaces || "")}</textarea></label>
          <label class="span-2">Adresses MAC<textarea name="macAddresses" maxlength="1000" rows="3" placeholder="Une adresse par ligne, avec le nom de l’interface si utile">${escapeHtml(details.macAddresses || "")}</textarea></label>
          <label class="span-2">Noms DNS et alias<textarea name="dnsNames" maxlength="1500" rows="3" placeholder="Un FQDN ou alias par ligne">${escapeHtml(details.dnsNames || "")}</textarea></label>
          <label>Ports de gestion<input name="managementPorts" value="${escapeHtml(details.managementPorts || "")}" maxlength="300" placeholder="443, 8006, 22…" /></label>
          <label>Réseau de gestion<input name="managementNetwork" value="${escapeHtml(details.managementNetwork || "")}" maxlength="200" /></label>
        </div>
      </section>
      <section class="record-editor-section">
        <header><span class="record-editor-section-icon">${icon("activity", 19)}</span><div><h2>Exploitation et cycle de vie</h2><p>Propriété, emplacement, protection et dates de renouvellement.</p></div></header>
        <div class="record-editor-fields">
          <label>Responsable<input name="owner" value="${escapeHtml(item?.owner || "")}" maxlength="96" /></label>
          <label>Emplacement précis<input name="location" value="${escapeHtml(item?.location || "")}" maxlength="160" /></label>
          <label>Date d’achat<input name="purchaseDate" type="date" value="${escapeHtml(details.purchaseDate || "")}" /></label>
          <label>Date de mise en service<input name="installedDate" type="date" value="${escapeHtml(details.installedDate || "")}" /></label>
          <label>Garantie<input name="warranty" type="date" value="${escapeHtml(item?.warranty || "")}" /></label>
          <label>Fin de vie prévue<input name="lifecycleDate" type="date" value="${escapeHtml(details.lifecycleDate || "")}" /></label>
          <label>Chiffrement<input name="encryption" value="${escapeHtml(details.encryption || "")}" maxlength="160" placeholder="BitLocker, chiffrement natif…" /></label>
          <label>Protection / EDR<input name="securityAgent" value="${escapeHtml(details.securityAgent || "")}" maxlength="160" /></label>
          <label>Supervision<input name="monitoring" value="${escapeHtml(details.monitoring || "")}" maxlength="200" placeholder="Outil, sonde ou état de supervision" /></label>
          <label>Politique de sauvegarde<input name="backupPolicy" value="${escapeHtml(details.backupPolicy || "")}" maxlength="200" /></label>
          <label>Politique de mises à jour<input name="patchPolicy" value="${escapeHtml(details.patchPolicy || "")}" maxlength="200" /></label>
          <label>Fenêtre de maintenance<input name="maintenanceWindow" value="${escapeHtml(details.maintenanceWindow || "")}" maxlength="200" /></label>
        </div>
      </section>
      <section class="record-editor-section">
        <header><span class="record-editor-section-icon">${icon("book", 19)}</span><div><h2>Documentation et attributs avancés</h2><p>Conservez les dépendances, particularités et valeurs propres au fabricant sans perdre leur structure.</p></div></header>
        <div class="record-editor-fields">
          <label class="span-2">Résumé<textarea name="summary" maxlength="1200" rows="3">${escapeHtml(item?.summary || "")}</textarea></label>
          <label class="span-2">Dépendances opérationnelles<textarea name="operationalDependencies" maxlength="3000" rows="4" placeholder="Services, équipements, licences ou fournisseurs requis">${escapeHtml(details.operationalDependencies || "")}</textarea></label>
          <label class="span-2">Attributs avancés<textarea name="customAttributes" maxlength="5000" rows="6" placeholder="Une ligne par valeur : clé = valeur&#10;Contrat = TEST2-001&#10;Mode HA = primaire">${escapeHtml(details.customAttributes || "")}</textarea><small>Pour les valeurs rares ou propres à un constructeur; elles restent indexées dans la recherche.</small></label>
          <label class="span-2">Notes opérationnelles<span class="mention-field"><textarea name="notes" data-relate-input maxlength="6000" rows="7" placeholder="Tapez @ puis le nom d’une fiche pour la relier">${escapeHtml(item?.notes || "")}</textarea><div class="mention-picker" data-mention-picker hidden></div></span><small>Les mentions @ créent des relations bidirectionnelles dans cette organisation.</small></label>
        </div>
      </section>`;
    return recordEditorFrame({ module, item, organizationId, title: item ? `Modifier ${item.name}` : "Créer une configuration", description: "Documentez un actif simple ou une configuration d’infrastructure complexe dans l’organisation active.", sections, formKind: "configuration", submitLabel: item ? "Enregistrer les modifications" : "Créer la configuration", recordId: item?.id || "" });
  }

  function renderVaultRecordEditor(module) {
    const organizationId = activeOrganizationId();
    if (!organizationId) return `<div class="page">${pageHeader("Organisation requise", "Choisissez d’abord une organisation dans le filtre Passwords.", `<button class="secondary" data-route="module/passwords">Retour aux mots de passe</button>`)}</div>`;
    const sections = `<section class="record-editor-section"><header><span class="record-editor-section-icon">${icon("key", 19)}</span><div><h2>Identité du mot de passe</h2><p>Les métadonnées facilitent la recherche sans exposer le secret.</p></div></header><div class="record-editor-fields"><label class="span-2"><span class="field-label">Titre <strong aria-hidden="true">*</strong></span><input name="title" required maxlength="160" /></label><label>Catégorie<input name="category" value="Général" maxlength="80" /></label><label>Nom d’utilisateur<input name="username" maxlength="300" autocomplete="off" /></label><label class="span-2">URL<input name="url" type="url" maxlength="1000" /></label></div></section><section class="record-editor-section"><header><span class="record-editor-section-icon">${icon("clock", 19)}</span><div><h2>Cycle de vie</h2><p>${state.workspace.settings.security.passwordRotationEnabled ? "Les rappels de rotation sont actifs pour cette instance." : "Les dates sont conservées; les rappels sont désactivés dans Paramètres."}</p></div></header><div class="record-editor-fields"><label>Dernière rotation<input name="passwordChangedAt" type="date" value="${new Date().toISOString().slice(0, 10)}" /></label><label>Date d’expiration<input name="expiresAt" type="date" /></label><label>Responsable de rotation<input name="rotationOwner" maxlength="120" /></label><label>Fréquence propre (jours)<input name="rotationIntervalDays" type="number" min="0" max="730" placeholder="Politique par défaut" /></label></div></section><section class="record-editor-section vault-secret-section"><header><span class="record-editor-section-icon">${icon("lock", 19)}</span><div><h2>Secrets chiffrés</h2><p>Le mot de passe et le secret OTP sont chiffrés côté serveur avant écriture.</p></div></header><div class="record-editor-fields"><label class="span-2">Mot de passe<input name="password" type="password" maxlength="4096" autocomplete="new-password" /></label><label class="span-2">Secret OTP Base32 (facultatif)<input name="otpSecret" maxlength="256" autocomplete="off" /></label><label class="span-2">Notes confidentielles<textarea name="notes" maxlength="5000" rows="5"></textarea></label><div class="file-sharing-access-summary span-2">${icon("shield", 18)}<span><strong>Coffre local AES-256-GCM</strong><small>Le secret n’est jamais ajouté à l’espace documentaire, à la recherche ou aux relations.</small></span></div></div></section>`;
    return recordEditorFrame({ module, item: null, organizationId, title: "Créer un mot de passe", description: "Ajoutez une entrée au coffre autonome Atlas dans l’organisation active.", sections, formKind: "vault-item", submitLabel: "Créer le mot de passe" });
  }

  function renderGenericModuleRecordEditor(module, item, template, organizationId) {
    const profile = moduleProfile(module);
    const title = item ? `Modifier ${item.title}` : `Créer · ${module.label}`;
    const moduleFields = moduleProfileFieldsMarkup(module, item);
    const hasDocumentEditor = profile.fields.some((field) => field.type === "document");
    return `<div class="page record-editor-page generic-record-editor-page ${hasDocumentEditor ? "document-record-editor-page" : ""}">
      <div class="record-editor-breadcrumbs">${organizationBreadcrumbMarkup(organizationId)}${icon("chevron", 13)}<button type="button" data-route="module/${module.id}">${escapeHtml(module.label)}</button>${icon("chevron", 13)}<span>${item ? escapeHtml(item.title) : "Nouvelle fiche"}</span></div>
      <form class="record-editor-shell" data-form="module-record" data-id="${escapeHtml(item?.id || "")}" data-module-id="${module.id}">
        <input type="hidden" name="organizationId" value="${escapeHtml(organizationId)}" required />
        <header class="record-editor-heading"><div><p class="eyebrow">${escapeHtml(module.label.toUpperCase())}</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(module.description)} L’organisation est déterminée par la page active.</p></div><button class="icon-button" type="button" data-action="cancel-record-editor" data-module-id="${module.id}" aria-label="Fermer">${icon("close", 18)}</button></header>
        <div class="record-editor-body">
          <section class="record-editor-section">
            <header><span class="record-editor-section-icon">${icon(module.icon || "file", 19)}</span><div><h2>Informations principales</h2><p>Identité, responsable, emplacement et cycle de vie de cette fiche.</p></div></header>
            <div class="record-editor-fields">
              <label class="span-2"><span class="field-label">${escapeHtml(profile.titleLabel)} <strong aria-hidden="true">*</strong></span><input name="title" value="${escapeHtml(item?.title || "")}" required maxlength="160" /></label>
              <label>Site<select name="siteId"><option value="">Aucun site précis</option>${siteOptions(item?.siteId, organizationId)}</select></label>
              <label>${escapeHtml(profile.ownerLabel)}<input name="owner" value="${escapeHtml(item?.owner || "")}" maxlength="96" /></label>
              <label>État<select name="status"><option value="active" ${item?.status === "active" || !item ? "selected" : ""}>Active</option><option value="review" ${item?.status === "review" ? "selected" : ""}>À réviser</option><option value="archived" ${item?.status === "archived" ? "selected" : ""}>Archivée</option></select></label>
              <label>${escapeHtml(profile.expiryLabel)}<input name="expiresOn" type="date" value="${escapeHtml(item?.expiresOn || "")}" ${profile.expiryRequired ? "required" : ""}/></label>
              <label class="span-2">${escapeHtml(profile.referenceLabel)}${profile.referenceRequired ? " *" : ""}<input name="reference" value="${escapeHtml(item?.reference || "")}" maxlength="500" ${profile.referenceRequired ? "required" : ""}/></label>
            </div>
          </section>
          ${moduleFields ? `<section class="record-editor-section record-editor-module-fields"><header><span class="record-editor-section-icon">${icon("grid", 19)}</span><div><h2>Détails · ${escapeHtml(module.label)}</h2><p>Champs adaptés à ce type de documentation.</p></div></header><div class="record-editor-fields">${moduleFields}</div></section>` : ""}
          <section class="record-editor-section">
            <header><span class="record-editor-section-icon">${icon("book", 19)}</span><div><h2>Documentation et suivi</h2><p>Ajoutez le contexte opérationnel et les relations utiles à cette organisation.</p></div></header>
            <div class="record-editor-fields">
              <label class="span-2">Étiquettes<input name="tags" value="${escapeHtml((item?.tags || template?.defaultTags || []).join(", "))}" maxlength="300" placeholder="production, critique, renouvellement" /></label>
              <label class="span-2">Résumé<textarea name="summary" maxlength="1000" rows="3">${escapeHtml(item?.summary || template?.defaultSummary || "")}</textarea></label>
              <label class="span-2">Notes opérationnelles<span class="mention-field"><textarea name="notes" data-relate-input maxlength="4000" rows="6" placeholder="Tapez @ puis le nom d’une fiche pour la relier">${escapeHtml(item?.notes || template?.defaultNotes || "")}</textarea><div class="mention-picker" data-mention-picker hidden></div></span><small>Tapez @nom-de-fiche pour créer une relation bidirectionnelle à l’enregistrement.</small></label>
              ${module.id === "checklists" ? `<label class="span-2">Étapes de la checklist<textarea name="checklistSteps" maxlength="5000" rows="8" placeholder="[ ] Étape à faire&#10;[x] Étape terminée">${escapeHtml((item?.checklist || []).map((step) => `[${step.done ? "x" : " "}] ${step.label}`).join("\n"))}</textarea><small>Utilisez [x] pour une étape terminée et [ ] pour une étape à faire.</small></label>` : ""}
            </div>
          </section>
          <section class="record-editor-section record-review-section">
            <header><span class="record-editor-section-icon">${icon("check", 19)}</span><div><h2>Cycle de révision</h2><p>Attribuez la vérification, une échéance et un état d’approbation distinct de l’état opérationnel.</p></div></header>
            <div class="record-editor-fields">
              <label>État de révision<select name="reviewState"><option value="draft" ${item?.reviewState === "draft" || !item ? "selected" : ""}>Brouillon</option><option value="in-review" ${item?.reviewState === "in-review" ? "selected" : ""}>En révision</option><option value="approved" ${item?.reviewState === "approved" ? "selected" : ""}>Approuvée</option><option value="stale" ${item?.reviewState === "stale" ? "selected" : ""}>À revoir</option></select></label>
              <label>Responsable de révision<input name="reviewOwner" value="${escapeHtml(item?.reviewOwner || item?.owner || "")}" maxlength="120" /></label>
              <label>Révision prévue<input name="reviewDueAt" type="date" value="${escapeHtml(item?.reviewDueAt || "")}" /></label>
              <label>Cadence (jours)<input name="reviewIntervalDays" type="number" min="0" max="730" value="${Number(item?.reviewIntervalDays) || ""}" placeholder="Ex. 90" /></label>
              ${item?.approvedAt ? `<div class="file-sharing-access-summary span-2">${icon("shield", 17)}<span><strong>Approuvée par ${escapeHtml(item.approvedBy || "un administrateur")}</strong><small>${formatDateTime(item.approvedAt)}</small></span></div>` : ""}
            </div>
          </section>
          <section class="record-editor-section record-editor-security-section"><header><span class="record-editor-section-icon">${icon("shield", 19)}</span><div><h2>Sécurité et portée</h2><p>Cette fiche reste dans Atlas et suit les permissions de l’organisation active.</p></div></header><div class="record-editor-fields"><div class="file-sharing-access-summary span-2">${icon("lock", 18)}<span><strong>Accessible aux comptes Atlas autorisés pour ${escapeHtml(orgName(organizationId))}.</strong><small>Aucune donnée n’est envoyée à TRC Account, au RMM ou à un service externe.</small></span></div></div></section>
        </div>
        <footer class="record-editor-actions"><div class="form-error" role="alert"></div><button class="secondary" type="button" data-action="cancel-record-editor" data-module-id="${module.id}">Annuler</button><button class="primary" type="submit">${item ? "Enregistrer les modifications" : "Créer la fiche"}</button></footer>
      </form>
    </div>`;
  }

  function renderPrintingRecordEditor(module, item, template, organizationId, recordId = null) {
    const details = item?.details || {};
    const profile = moduleProfileCatalog.printing;
    const supportField = profile.fields.find((field) => field.key === "supportInformation");
    const notesField = profile.fields.find((field) => field.key === "notesDocument");
    const printServerIds = printingConfigurationIds(item, "printServerConfigurationIds");
    const printerIds = printingConfigurationIds(item, "printerConfigurationIds");
    const title = item ? "Modifier la documentation d’impression" : "Créer une documentation d’impression";
    return `<div class="page record-editor-page printing-editor-page">
      <div class="record-editor-breadcrumbs">${organizationBreadcrumbMarkup(organizationId)}${icon("chevron", 13)}<button type="button" data-route="module/${module.id}">Printing</button>${icon("chevron", 13)}<span>${item ? escapeHtml(item.title) : "Nouvelle fiche"}</span></div>
      <form class="record-editor-shell" data-form="module-record" data-id="${escapeHtml(recordId || "")}" data-module-id="${module.id}">
        <input type="hidden" name="organizationId" value="${escapeHtml(organizationId)}" required />
        <input type="hidden" name="notes" value="${escapeHtml(item?.notes || template?.defaultNotes || "")}" />
        <header class="record-editor-heading"><div><p class="eyebrow">PRINTING</p><h1>${escapeHtml(title)}</h1><p>Documentez le site, les serveurs d’impression, les files, les pilotes et le mode de déploiement dans l’organisation active.</p></div><button class="icon-button" type="button" data-action="cancel-record-editor" data-module-id="${module.id}" aria-label="Fermer">${icon("close", 18)}</button></header>
        <div class="record-editor-body">
          <section class="record-editor-section printing-identity-section">
            <header><span class="record-editor-section-icon">${icon("printer", 19)}</span><div><h2>Site et impression</h2><p>Les sélecteurs créent des relations Atlas; ils ne se connectent à aucun serveur ni à aucune imprimante.</p></div></header>
            <div class="record-editor-fields">
              <label class="span-2"><span class="field-label">Site <strong aria-hidden="true">*</strong></span><input name="title" value="${escapeHtml(item?.title || "")}" required maxlength="160" placeholder="Ex. Bureau Montréal — Impression" /><small>Nom du site ou du groupe d’impression affiché dans la liste.</small></label>
              <label class="span-2">Description<textarea name="summary" maxlength="1000" rows="3" placeholder="Périmètre, services ou utilisateurs desservis…">${escapeHtml(item?.summary || template?.defaultSummary || "")}</textarea></label>
              ${printingConfigurationPickerMarkup(organizationId, printServerIds, "print-server")}
              <label class="span-2">Imprimante(s)<textarea name="detail_printerNames" maxlength="4000" rows="4" placeholder="Ex. PT-p950nw&#10;SHARP MX-3070V">${escapeHtml(details.printerNames || "")}</textarea><small>Une file ou imprimante par ligne.</small></label>
              ${printingConfigurationPickerMarkup(organizationId, printerIds, "printer")}
              <label>Déploiement<select name="detail_deployment"><option value="">Choisir un mode</option>${["Manuel", "GPO", "Intune", "Serveur d’impression", "Script", "Autre"].map((value) => `<option value="${escapeHtml(value)}" ${details.deployment === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select><small>Comment les imprimantes sont rendues disponibles aux utilisateurs.</small></label>
              <label>Adresse IP / nom d’hôte<input name="detail_hostAddress" value="${escapeHtml(details.hostAddress || item?.reference || "")}" maxlength="500" placeholder="Ex. 10.20.30.40 ou print01.domaine.local" /></label>
              <label class="span-2 printing-checkbox"><span class="checkbox-label"><input name="detail_publishedToAd" type="checkbox" ${details.publishedToAd === "Oui" || details.publishedToAd === "on" ? "checked" : ""} /> Publié dans Active Directory</span><small>Indique seulement l’état documenté; Atlas ne publie rien dans AD.</small></label>
              <label class="span-2">Chemin des pilotes<input name="detail_driverPath" value="${escapeHtml(details.driverPath || "")}" maxlength="500" placeholder="Ex. \\\\fileshare\\support\\drivers\\hp\\thisprinter" /><small>Chemin UNC ou emplacement documenté des pilotes.</small></label>
            </div>
          </section>
          <section class="record-editor-section printing-documentation-section">
            <header><span class="record-editor-section-icon">${icon("phone", 19)}</span><div><h2>Informations de soutien</h2><p>Conservez les coordonnées, garanties, procédures et références du fournisseur.</p></div></header>
            <div class="record-editor-fields">${documentEditorMarkup(supportField, details.supportInformation || "")}</div>
          </section>
          <section class="record-editor-section printing-documentation-section">
            <header><span class="record-editor-section-icon">${icon("book", 19)}</span><div><h2>Notes</h2><p>Ajoutez les détails techniques, restrictions, solutions connues et mentions vers d’autres fiches.</p></div></header>
            <div class="record-editor-fields">${documentEditorMarkup(notesField, details.notesDocument || "")}</div>
          </section>
          <section class="record-editor-section">
            <header><span class="record-editor-section-icon">${icon("activity", 19)}</span><div><h2>Suivi Atlas</h2><p>Reliez la fiche au site Atlas et gardez son cycle documentaire à jour.</p></div></header>
            <div class="record-editor-fields">
              <label>Emplacement Atlas<select name="siteId"><option value="">Aucun site précis</option>${siteOptions(item?.siteId, organizationId)}</select></label>
              <label>Responsable<input name="owner" value="${escapeHtml(item?.owner || "")}" maxlength="96" placeholder="Équipe ou personne responsable" /></label>
              <label>État<select name="status"><option value="active" ${item?.status === "active" || !item ? "selected" : ""}>Active</option><option value="review" ${item?.status === "review" ? "selected" : ""}>À réviser</option><option value="archived" ${item?.status === "archived" ? "selected" : ""}>Archivée</option></select></label>
              <label>Prochaine révision<input name="expiresOn" type="date" value="${escapeHtml(item?.expiresOn || "")}" /></label>
              <label class="span-2">Étiquettes<input name="tags" value="${escapeHtml((item?.tags || template?.defaultTags || []).join(", "))}" maxlength="300" placeholder="impression, bureau, production" /></label>
            </div>
          </section>
        </div>
        <footer class="record-editor-actions"><div class="form-error" role="alert"></div><button class="secondary" type="button" data-action="cancel-record-editor" data-module-id="${module.id}">Annuler</button><button class="primary" type="submit">${item ? "Enregistrer les modifications" : "Créer la fiche Printing"}</button></footer>
      </form>
    </div>`;
  }

  function renderModuleRecordEditorPage(moduleId, recordId = null) {
    const module = moduleMap.get(moduleId);
    if (!module) return `<div class="page">${pageHeader("Module introuvable", "Cette fiche ne peut pas être créée.", `<button class="secondary" data-route="manage-modules">Retour aux modules</button>`)}</div>`;
    if (module.id === "passwords" && !canAccessVault()) return renderVaultAccessDenied();
    if (module.id === "locations") return renderSiteRecordEditor(module, recordId);
    if (module.id === "configurations") return renderConfigurationRecordEditor(module, recordId);
    if (module.id === "passwords" && !recordId) return renderVaultRecordEditor(module);
    const item = recordId ? state.workspace.moduleRecords.find((record) => record.id === recordId && record.moduleId === module.id) : null;
    if (recordId && !item) return `<div class="page">${pageHeader("Fiche introuvable", "Cette fiche n’existe plus dans cette organisation.", `<button class="secondary" data-route="module/${module.id}">Retour au module</button>`)}</div>`;
    const template = !item && state.activeTemplate?.moduleId === module.id ? state.activeTemplate : null;
    const organizationId = item?.organizationId || activeOrganizationId();
    if (!organizationId) return `<div class="page">${pageHeader("Organisation requise", `Choisissez d’abord une organisation dans le filtre ${module.label}.`, `<button class="secondary" data-route="module/${module.id}">Retour au module</button>`)}</div>`;
    if (module.id === PRINTING_MODULE_ID) return renderPrintingRecordEditor(module, item, template, organizationId, recordId);
    if (module.id !== FILE_SHARING_MODULE_ID) return renderGenericModuleRecordEditor(module, item, template, organizationId);
    const details = item?.details || {};
    const title = item ? "Modifier le partage de fichiers" : "Créer un partage de fichiers";
    const selectedServerIds = fileSharingServerIds(item);
    return `<div class="page record-editor-page file-sharing-editor-page">
      <div class="record-editor-breadcrumbs">${organizationBreadcrumbMarkup(organizationId)}${icon("chevron", 13)}<button type="button" data-route="module/${module.id}">File Sharing</button>${icon("chevron", 13)}<span>${item ? escapeHtml(item.title) : "Nouveau partage"}</span></div>
      <form class="record-editor-shell" data-form="module-record" data-id="${escapeHtml(recordId || "")}" data-module-id="${module.id}">
        <input type="hidden" name="organizationId" value="${escapeHtml(organizationId)}" required />
        <header class="record-editor-heading"><div><p class="eyebrow">FILE SHARING</p><h1>${title}</h1><p>Documentez le partage, les serveurs qui l’hébergent et ses accès sans quitter l’organisation active.</p></div><button class="icon-button" type="button" data-action="cancel-record-editor" data-module-id="${module.id}" aria-label="Fermer">${icon("close", 18)}</button></header>
        <div class="record-editor-body">
          <section class="record-editor-section">
            <header><span class="record-editor-section-icon">${icon("file", 19)}</span><div><h2>Serveur de fichiers / partage</h2><p>Les chemins et lecteurs restent de la documentation; Atlas ne se connecte pas au serveur.</p></div></header>
            <div class="record-editor-fields">
              <label class="span-2"><span class="field-label">Nom du partage <strong aria-hidden="true">*</strong></span><input name="title" value="${escapeHtml(item?.title || "")}" required maxlength="160" placeholder="Ex. Ventes" /><small>Nom court et reconnaissable dans la recherche Atlas.</small></label>
              <label class="span-2">Description du partage<textarea name="summary" maxlength="1000" rows="3" placeholder="Ex. Documents et informations de l’équipe des ventes">${escapeHtml(item?.summary || template?.defaultSummary || "")}</textarea></label>
              ${fileSharingServerPickerMarkup(organizationId, selectedServerIds)}
              <label>Lecteur mappé<input name="detail_mappedDrive" value="${escapeHtml(details.mappedDrive || "")}" maxlength="500" placeholder="Ex. S:\\" /><small>Lettre utilisée sur les postes, si applicable.</small></label>
              <label>Chemin du partage<input name="detail_sharePath" value="${escapeHtml(details.sharePath || "")}" maxlength="500" placeholder="Ex. \\\\SERVEUR\\Partage" /><small>Chemin UNC, SMB ou NFS présenté aux utilisateurs.</small></label>
              <label class="span-2">Chemin sur le disque<input name="detail_diskPath" value="${escapeHtml(details.diskPath || "")}" maxlength="500" placeholder="Ex. D:\\Partage" /><small>Emplacement local sur le serveur qui héberge les données.</small></label>
            </div>
          </section>
          <section class="record-editor-section security-documentation-section">
            <header><span class="record-editor-section-icon">${icon("shield", 19)}</span><div><h2>Sécurité</h2><p>Distinguez l’accès à la fiche Atlas des permissions réellement appliquées au partage.</p></div></header>
            <div class="record-editor-fields">
              <div class="file-sharing-access-summary span-2">${icon("lock", 18)}<span><strong>Tous les comptes Atlas autorisés pour ${escapeHtml(orgName(organizationId))} peuvent consulter cette fiche.</strong><small>Les droits Atlas n’ajoutent, ne retirent et ne testent aucune permission sur le serveur.</small></span></div>
              <label>Classification des données<select name="detail_dataClassification"><option value="">Non précisée</option>${["Interne", "Confidentielle", "Restreinte"].map((value) => `<option value="${value}" ${details.dataClassification === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
              <label>Accès hors connexion<select name="detail_offlineAccess"><option value="">Non précisé</option>${["Autorisé", "Interdit", "À confirmer"].map((value) => `<option value="${value}" ${details.offlineAccess === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
              <label class="span-2">Groupes ou utilisateurs autorisés sur le partage<textarea name="detail_securityPermissions" maxlength="8000" rows="4" placeholder="Ex. DOMAINE\\Ventes-RW&#10;DOMAINE\\Direction-RO">${escapeHtml(details.securityPermissions || "")}</textarea><small>Documentation uniquement — un groupe ou utilisateur par ligne.</small></label>
            </div>
          </section>
          <section class="record-editor-section">
            <header><span class="record-editor-section-icon">${icon("activity", 19)}</span><div><h2>Suivi Atlas</h2><p>Ajoutez le contexte utile pour les recherches, les révisions et les relations.</p></div></header>
            <div class="record-editor-fields">
              <label>Site<select name="siteId"><option value="">Aucun site précis</option>${siteOptions(item?.siteId, organizationId)}</select></label>
              <label>Responsable<input name="owner" value="${escapeHtml(item?.owner || "")}" maxlength="96" placeholder="Équipe ou personne responsable" /></label>
              <label>État<select name="status"><option value="active" ${item?.status === "active" || !item ? "selected" : ""}>Active</option><option value="review" ${item?.status === "review" ? "selected" : ""}>À réviser</option><option value="archived" ${item?.status === "archived" ? "selected" : ""}>Archivée</option></select></label>
              <label>Prochaine révision<input name="expiresOn" type="date" value="${escapeHtml(item?.expiresOn || "")}" /></label>
              <label class="span-2">Référence ou URL<input name="reference" value="${escapeHtml(item?.reference || "")}" maxlength="500" placeholder="Portail, politique ou référence interne" /></label>
              <label class="span-2">Étiquettes<input name="tags" value="${escapeHtml((item?.tags || template?.defaultTags || []).join(", "))}" maxlength="300" placeholder="fichiers, production, finance" /></label>
              <label class="span-2">Notes opérationnelles<span class="mention-field"><textarea name="notes" data-relate-input maxlength="4000" rows="6" placeholder="Procédure de connexion, quotas, sauvegarde, particularités…">${escapeHtml(item?.notes || template?.defaultNotes || "")}</textarea><div class="mention-picker" data-mention-picker hidden></div></span><small>Tapez @nom-de-fiche pour relier un document, un mot de passe ou un autre objet de cette organisation.</small></label>
            </div>
          </section>
        </div>
        <footer class="record-editor-actions"><div class="form-error" role="alert"></div><button class="secondary" type="button" data-action="cancel-record-editor" data-module-id="${module.id}">Annuler</button><button class="primary" type="submit">${item ? "Enregistrer les modifications" : "Créer le partage"}</button></footer>
      </form>
    </div>`;
  }

  function printingLinkedConfigurationNames(record, key) {
    return printingConfigurationIds(record, key)
      .map((id) => state.workspace.configurations.find((configuration) => configuration.id === id && configuration.organizationId === record.organizationId)?.name)
      .filter(Boolean);
  }

  function renderPrintingModulePage(module) {
    const query = normalizeSearch(state.listSearch);
    const includeArchived = state.listStatus === "all";
    const allRecords = state.workspace.moduleRecords.filter((record) => record.moduleId === module.id);
    const records = allRecords.filter((record) => {
      if (state.filter !== "all" && record.organizationId !== state.filter) return false;
      if (!includeArchived && record.status === "archived") return false;
      if (!query) return true;
      return normalizeSearch([record.title, record.summary, record.owner, record.reference, ...(record.tags || []), ...Object.values(record.details || {}), ...printingLinkedConfigurationNames(record, "printServerConfigurationIds"), ...printingLinkedConfigurationNames(record, "printerConfigurationIds")].join(" ")).includes(query);
    }).sort((a, b) => a.title.localeCompare(b.title, state.locale) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
    const page = paginate(records, 25);
    const rows = page.items.map((record) => {
      const servers = printingLinkedConfigurationNames(record, "printServerConfigurationIds");
      const linkedPrinters = printingLinkedConfigurationNames(record, "printerConfigurationIds");
      const typedPrinters = String(record.details?.printerNames || "").split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean);
      const printers = [...new Set([...typedPrinters, ...linkedPrinters])];
      const expiry = expiryPresentation(record);
      return `<tr>
        <td data-label="Organisation">${escapeHtml(orgName(record.organizationId))}</td>
        <td data-label="Site"><button class="table-link printing-site-link" data-action="open-asset" data-asset-ref="module:${record.id}"><span class="type-icon">${icon("printer", 16)}</span><span><strong>${escapeHtml(record.title)}</strong><small>${escapeHtml(record.summary || record.details?.hostAddress || "Documentation d’impression")}</small></span></button></td>
        <td data-label="Serveur(s)">${servers.length ? servers.map((name) => `<span class="printing-list-value">${icon("server", 13)} ${escapeHtml(name)}</span>`).join("") : "—"}</td>
        <td data-label="Imprimante(s)">${printers.length ? printers.slice(0, 4).map((name) => `<span class="printing-list-value">${escapeHtml(name)}</span>`).join("") + (printers.length > 4 ? `<small class="printing-more">+${printers.length - 4} autre${printers.length - 4 === 1 ? "" : "s"}</small>` : "") : "—"}</td>
        <td data-label="Déploiement">${escapeHtml(record.details?.deployment || "Non précisé")}${record.details?.publishedToAd === "Oui" ? '<small class="printing-ad-badge">Publié AD</small>' : ""}</td>
        <td data-label="État"><span class="status-badge ${expiry.tone}">${escapeHtml(expiry.label)}</span></td>
        <td data-label="Actions"><div class="row-actions"><button class="icon-button" data-action="open-asset" data-asset-ref="module:${record.id}" aria-label="Ouvrir ${escapeHtml(record.title)}">${icon("eye", 15)}</button>${writeButton(`<button class="icon-button" data-action="edit-module-record" data-id="${record.id}" data-module-id="${module.id}" aria-label="Modifier ${escapeHtml(record.title)}">${icon("edit", 16)}</button>`)}</div></td>
      </tr>`;
    }).join("");
    const actions = `<div class="page-header-actions"><button class="secondary" data-action="export-printing">${icon("download", 16)} Exporter CSV</button>${writeButton(`<button class="primary" data-action="new-module-record" data-module-id="${module.id}">${icon("plus")} Nouvelle fiche</button>`)}</div>`;
    return `<div class="page module-page printing-page">
      ${pageHeader("Printing", "Sites, serveurs d’impression, files, pilotes et modes de déploiement.", actions)}
      <div class="toolbar compact-list-toolbar printing-list-toolbar">
        <label class="list-search">${icon("search", 16)}<input type="search" data-list-search placeholder="Filtrer les colonnes ou rechercher…" value="${escapeHtml(state.listSearch)}" /></label>
        <label>Organisation<select data-filter="organization"><option value="all">Toutes</option>${state.workspace.organizations.map((org) => `<option value="${org.id}" ${state.filter === org.id ? "selected" : ""}>${escapeHtml(organizationPathLabel(org.id))}</option>`).join("")}</select></label>
        <label class="checkbox-label printing-archive-filter"><input type="checkbox" data-printing-include-archived ${includeArchived ? "checked" : ""} /> Inclure les archivées</label>
        <div class="toolbar-summary"><strong>${records.length}</strong> sur ${allRecords.length}</div>
      </div>
      <section class="table-card printing-table"><div class="table-scroll"><table><thead><tr><th>Organisation</th><th>Site</th><th>Serveur(s) d’impression</th><th>Imprimante(s)</th><th>Déploiement</th><th>État</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div>${records.length ? paginationMarkup(page) : emptyState("Aucune documentation d’impression ne correspond aux filtres.")}</section>
    </div>`;
  }

  function renderModulePage(moduleId) {
    const module = moduleMap.get(moduleId);
    if (!module) return `<div class="page">${pageHeader("Module introuvable", "Ce module n’existe pas dans la bibliothèque Atlas.", `<button class="secondary" data-route="manage-modules">Gérer les modules</button>`)}</div>`;
    if (module.id === PRINTING_MODULE_ID) return renderPrintingModulePage(module);
    const profile = moduleProfile(module);
    const query = state.listSearch.trim().toLocaleLowerCase(state.locale);
    const allRecords = state.workspace.moduleRecords.filter((record) => record.moduleId === module.id);
    const records = allRecords.filter((record) => (state.filter === "all" || record.organizationId === state.filter) && (state.listStatus === "all" || record.status === state.listStatus) && (!query || [record.title, record.owner, record.summary, record.reference, ...(record.tags || []), ...Object.values(record.details || {})].join(" ").toLocaleLowerCase(state.locale).includes(query))).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)) || a.title.localeCompare(b.title, state.locale));
    const page = paginate(records, 25);
    const notice = module.id === "domain-tracker" ? `<div class="notice secure-module-notice">${icon("globe", 17)} <span><strong>Suivi réel des domaines</strong> Registraire, DNS, titulaire, serveurs de noms, renouvellement automatique et expiration sont conservés dans chaque fiche.</span></div>` : module.id === "ssl-tracker" ? `<div class="notice secure-module-notice">${icon("lock", 17)} <span><strong>Suivi réel des certificats</strong> Émetteur, hôtes couverts, méthode de validation, renouvellement et expiration sont suivis sans stocker de clé privée.</span></div>` : "";
    return `<div class="page module-page">
      ${pageHeader(module.label, module.description, writeButton(`<button class="primary" data-action="new-module-record" data-module-id="${module.id}">${icon("plus")} Nouvelle fiche</button>`))}
      ${notice}
      ${moduleRenewalMetrics(records, profile)}
      <div class="toolbar compact-list-toolbar module-list-toolbar"><label class="list-search">${icon("search", 16)}<input type="search" data-list-search placeholder="Rechercher dans ${escapeHtml(module.label)}…" value="${escapeHtml(state.listSearch)}" /></label><label>Organisation<select data-filter="organization"><option value="all">Toutes</option>${state.workspace.organizations.map((org) => `<option value="${org.id}" ${state.filter === org.id ? "selected" : ""}>${escapeHtml(organizationPathLabel(org.id))}</option>`).join("")}</select></label><label>État<select data-list-status><option value="all">Tous</option><option value="active" ${state.listStatus === "active" ? "selected" : ""}>Actives</option><option value="review" ${state.listStatus === "review" ? "selected" : ""}>À réviser</option><option value="archived" ${state.listStatus === "archived" ? "selected" : ""}>Archivées</option></select></label><div class="toolbar-summary"><strong>${records.length}</strong> sur ${allRecords.length}</div></div>
      <section class="table-card module-records-table"><div class="table-scroll"><table><thead><tr><th>${escapeHtml(profile.listLabel)}</th><th>${t("organization")}</th><th>${escapeHtml(profile.referenceLabel)}</th><th>${escapeHtml(profile.ownerLabel)}</th><th>${t("status")}</th><th>${escapeHtml(profile.expiryLabel)}</th><th>Mise à jour</th><th></th></tr></thead><tbody>${page.items.map((record) => { const expiry = expiryPresentation(record); return `<tr><td><button class="table-link" data-action="open-asset" data-asset-ref="module:${record.id}"><span class="type-icon">${icon(module.icon, 16)}</span><span><strong>${escapeHtml(record.title)}</strong><small>${escapeHtml(moduleRecordSubtitle(record, module))}</small></span></button></td><td>${escapeHtml(orgName(record.organizationId))}</td><td>${escapeHtml(record.reference || "—")}</td><td>${escapeHtml(record.owner || "—")}</td><td><span class="status-badge ${expiry.tone}">${escapeHtml(expiry.label)}</span></td><td>${formatDate(record.expiresOn)}</td><td>${formatDate(record.updatedAt)}</td><td><div class="row-actions"><button class="icon-button" data-action="open-asset" data-asset-ref="module:${record.id}" aria-label="Aperçu">${icon("eye", 15)}</button>${writeButton(`<button class="icon-button" data-action="edit-module-record" data-id="${record.id}" data-module-id="${module.id}" aria-label="${t("edit")}">${icon("edit", 16)}</button>`)}</div></td></tr>`; }).join("")}</tbody></table></div>${records.length ? paginationMarkup(page) : emptyState("Aucune fiche ne correspond aux filtres.")}</section>
    </div>`;
  }

  function renderVaultAccessDenied() {
    return `<div class="page access-denied-page">${pageHeader("Accès au coffre non autorisé", "Votre compte peut utiliser Atlas, mais il n’a pas le droit de consulter les mots de passe.")}<section class="panel access-denied-card"><span class="vault-lock-icon">${icon("lock", 22)}</span><div><p class="eyebrow">AUTORISATION DISTINCTE</p><h2>Le coffre est masqué pour ce compte</h2><p>Un administrateur local peut autoriser l’accès au coffre sans modifier le niveau Lecture ou Édition de la documentation.</p></div><button class="secondary" type="button" data-route="dashboard">Retour à la vue d’ensemble</button></section></div>`;
  }

  function renderVaultPage() {
    const query = state.listSearch.trim().toLocaleLowerCase(state.locale);
    const rotationEnabled = state.workspace.settings.security.passwordRotationEnabled;
    const rotation = (item) => vaultRotationPresentation(item);
    const filtered = state.vaultItems.filter((item) => {
      if (state.filter !== "all" && item.organizationId !== state.filter) return false;
      if (state.listStatus === "active" && item.archived) return false;
      if (state.listStatus === "archived" && !item.archived) return false;
      if (state.listStatus === "rotation-due" && rotation(item).state !== "due") return false;
      if (state.listStatus === "rotation-soon" && rotation(item).state !== "soon") return false;
      return !query || [item.title, item.category, item.rotationOwner, orgName(item.organizationId)].join(" ").toLocaleLowerCase(state.locale).includes(query);
    }).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    const page = paginate(filtered, 25);
    const due = rotationEnabled ? state.vaultItems.filter((item) => !item.archived && rotation(item).state === "due").length : 0;
    const soon = rotationEnabled ? state.vaultItems.filter((item) => !item.archived && rotation(item).state === "soon").length : 0;
    const weak = state.vaultItems.filter((item) => !item.archived && Number.isInteger(item.strength) && item.strength < 3).length;
    const duplicates = state.vaultItems.filter((item) => !item.archived && item.duplicateCount > 1).length;
    return `<div class="page vault-page">
      ${pageHeader("Passwords", "Coffre local chiffré AES-256-GCM, déverrouillé par le MFA de votre session Atlas.", `${vaultSessionUnlocked() ? `<button class="secondary" data-action="lock-vault">${icon("lock", 15)} Verrouiller le coffre</button>` : ""}${writeButton(`<button class="primary" data-action="new-vault-item">${icon("plus")} Nouvelle entrée</button>`)}`)}
      <div class="notice secure-module-notice success-notice">${icon("shield", 17)} <span><strong>MFA valide pour la session</strong>Une seule validation MFA suffit jusqu’à la déconnexion ou l’expiration de la session après 8 heures. Les secrets restent chiffrés et masqués jusqu’à leur affichage explicite.</span></div>
      <section class="vault-health-grid"><article class="${due ? "danger" : ""}"><span>${icon("clock", 18)}</span><strong>${rotationEnabled ? due : "—"}</strong><small>${rotationEnabled ? "rotations échues" : "rotation désactivée"}</small></article><article class="${soon ? "warning" : ""}"><span>${icon("alert", 18)}</span><strong>${rotationEnabled ? soon : "—"}</strong><small>${rotationEnabled ? "rappels à venir" : "aucun rappel"}</small></article><article class="${weak ? "warning" : ""}"><span>${icon("shield", 18)}</span><strong>${weak}</strong><small>secrets faibles</small></article><article class="${duplicates ? "warning" : ""}"><span>${icon("copy", 18)}</span><strong>${duplicates}</strong><small>secrets réutilisés</small></article></section>
      <div class="toolbar compact-list-toolbar module-list-toolbar"><label class="list-search">${icon("search", 16)}<input type="search" data-list-search placeholder="Rechercher dans le coffre…" value="${escapeHtml(state.listSearch)}" /></label><label>Organisation<select data-filter="organization"><option value="all">Toutes</option>${state.workspace.organizations.map((org) => `<option value="${org.id}" ${state.filter === org.id ? "selected" : ""}>${escapeHtml(organizationPathLabel(org.id))}</option>`).join("")}</select></label><label>État<select data-list-status><option value="all">Tous</option><option value="active" ${state.listStatus === "active" ? "selected" : ""}>Actives</option><option value="archived" ${state.listStatus === "archived" ? "selected" : ""}>Archivées</option>${rotationEnabled ? `<option value="rotation-due" ${state.listStatus === "rotation-due" ? "selected" : ""}>Rotation échue</option><option value="rotation-soon" ${state.listStatus === "rotation-soon" ? "selected" : ""}>Rotation prochaine</option>` : ""}</select></label><div class="toolbar-summary"><strong>${filtered.length}</strong> sur ${state.vaultItems.length}</div></div>
      <section class="table-card vault-table"><div class="table-scroll"><table><thead><tr><th>Entrée</th><th>${t("organization")}</th><th>Catégorie</th><th>Sécurité</th><th>${rotationEnabled ? "Rotation" : "Mise à jour"}</th><th></th></tr></thead><tbody>${page.items.map((item) => { const lifecycle = rotation(item); const securityNotes = [Number.isInteger(item.strength) ? `Force ${item.strength}/4` : "Force non évaluée", item.duplicateCount > 1 ? `Réutilisé ${item.duplicateCount} fois` : "Unique"].join(" · "); return `<tr><td><button class="table-link" data-action="open-asset" data-asset-ref="vault:${item.id}"><span class="type-icon">${icon("key", 16)}</span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.rotationOwner || item.id)}</small></span></button></td><td>${escapeHtml(orgName(item.organizationId))}</td><td>${escapeHtml(item.category)}</td><td><span class="status-badge ${item.strength !== null && item.strength < 3 || item.duplicateCount > 1 ? "warning" : "success"}">${escapeHtml(securityNotes)}</span></td><td>${rotationEnabled ? `<span class="status-badge ${lifecycle.tone}">${escapeHtml(lifecycle.label)}</span><small class="table-cell-note">${lifecycle.date ? formatDate(lifecycle.date) : "—"}</small>` : formatDateTime(item.updatedAt)}</td><td><div class="row-actions"><button class="secondary compact" data-action="open-asset" data-asset-ref="vault:${item.id}" ${item.archived ? "disabled" : ""}>${icon("eye", 15)} Ouvrir</button></div></td></tr>`; }).join("")}</tbody></table></div>${filtered.length ? paginationMarkup(page) : emptyState("Aucune entrée ne correspond aux filtres.")}</section>
    </div>`;
  }

  function vaultRotationPresentation(item) {
    if (item.archived) return { state: "archived", tone: "muted", label: "Archivée", date: "" };
    if (!state.workspace.settings.security.passwordRotationEnabled) return { state: "disabled", tone: "muted", label: "Suivi désactivé", date: "" };
    const intervalDays = Number(item.rotationIntervalDays) || Number(state.workspace.settings.security.passwordRotationDays) || 90;
    const explicitExpiry = Date.parse(item.expiresAt || "");
    const changedAt = Date.parse(item.passwordChangedAt || item.createdAt || "");
    const dueAt = Number.isFinite(explicitExpiry) ? explicitExpiry : Number.isFinite(changedAt) ? changedAt + intervalDays * 86400000 : NaN;
    if (!Number.isFinite(dueAt)) return { state: "unknown", tone: "muted", label: "Date manquante", date: "" };
    const days = Math.ceil((dueAt - Date.now()) / 86400000);
    const date = new Date(dueAt).toISOString();
    if (days < 0) return { state: "due", tone: "danger", label: `Échue depuis ${Math.abs(days)} j`, date };
    const reminder = Number(state.workspace.settings.security.passwordRotationReminderDays) || 14;
    if (days <= reminder) return { state: "soon", tone: "warning", label: `Dans ${days} j`, date };
    return { state: "ok", tone: "success", label: `Dans ${days} j`, date };
  }

  function renderVersions() {
    return `<div class="page versions-page">${pageHeader("Versions", "Historique local automatique des 200 dernières modifications de l’espace de travail.")}
      <div class="notice secure-module-notice">${icon("history", 17)} <span><strong>Restauration contrôlée</strong>Chaque modification conserve la version précédente. Restaurer crée une nouvelle révision et conserve aussi l’état actuel dans l’historique.</span></div>
      <section class="table-card"><div class="table-scroll"><table><thead><tr><th>Révision</th><th>Sauvegardée le</th><th>Par</th><th>État documenté</th><th></th></tr></thead><tbody>${state.workspaceHistory.map((entry) => `<tr><td><strong>#${entry.revision}</strong></td><td>${formatDateTime(entry.savedAt)}</td><td>${escapeHtml(entry.savedBy || "Système")}</td><td>${formatDateTime(entry.updatedAt)}</td><td>${writeButton(`<button class="secondary compact" data-action="restore-workspace" data-revision="${entry.revision}">Restaurer</button>`)}</td></tr>`).join("")}</tbody></table></div>${state.workspaceHistory.length ? "" : emptyState("L’historique apparaîtra après la première modification.")}</section>
    </div>`;
  }

  function renderDataTools() {
    const admin = isAdministrator();
    return `<div class="page data-tools-page">${pageHeader("Import / Export", "Déplacer ou sauvegarder la documentation Atlas sans inclure les comptes locaux ni le coffre chiffré.")}
      <div class="data-tool-grid">
        <section class="panel data-tool-card"><span class="module-hero-icon">${icon("download", 22)}</span><div><p class="eyebrow">SAUVEGARDE DOCUMENTAIRE</p><h2>Exporter Atlas</h2><p>Télécharge les organisations, configurations, procédures, relations, modules et paramètres documentaires.</p></div><ul><li>Aucun mot de passe du coffre</li><li>Aucun compte, MFA ou session</li><li>Format JSON versionné</li></ul><button class="primary" data-action="export-workspace" ${admin ? "" : "disabled"}>${icon("download", 16)} Télécharger l’export</button></section>
        <section class="panel data-tool-card"><span class="module-hero-icon">${icon("upload", 22)}</span><div><p class="eyebrow">RESTAURATION</p><h2>Importer un export</h2><p>Valide le format, conserve automatiquement la version actuelle, puis remplace la documentation.</p></div><ul><li>Administrateur local requis</li><li>Confirmation obligatoire</li><li>Retour arrière par Versions</li></ul><label class="secondary file-button ${admin ? "" : "disabled"}">${icon("upload", 16)} Choisir un fichier<input type="file" data-import-workspace accept="application/json,.json" ${admin ? "" : "disabled"} /></label></section>
        <section class="panel data-tool-card guided-import-card"><span class="module-hero-icon">${icon("grid", 22)}</span><div><p class="eyebrow">IMPORT GUIDÉ</p><h2>Ajouter depuis un CSV</h2><p>Prévisualisez le fichier, associez les colonnes puis ajoutez les fiches dans une seule révision restaurable.</p></div><label>Destination<select data-guided-import-target ${admin ? "" : "disabled"}><option value="organizations">Organisations</option><option value="configurations">Configurations</option>${moduleDefinitions.filter((module) => !["passwords", "locations", "configurations"].includes(module.id)).map((module) => `<option value="module:${escapeHtml(module.id)}">${escapeHtml(module.label)}</option>`).join("")}</select></label><label class="secondary file-button ${admin ? "" : "disabled"}">${icon("upload", 16)} Choisir un CSV<input type="file" data-guided-import-file accept="text/csv,.csv" ${admin ? "" : "disabled"} /></label><ul><li>Aucun secret accepté</li><li>Aperçu avant import</li><li>Maximum 1 000 lignes</li></ul></section>
        <section class="panel data-tool-card full-backup-card"><span class="module-hero-icon">${icon("shield", 22)}</span><div><p class="eyebrow">SAUVEGARDE COMPLÈTE CHIFFRÉE</p><h2>Protéger toute l’instance</h2><p>Inclut comptes, MFA, coffre, clé locale, base SQLite et pièces jointes dans un fichier AES-256-GCM.</p></div><ul><li>Phrase secrète saisie sans historique shell</li><li>Sessions volontairement exclues</li><li>Restauration avec copie de sécurité préalable</li></ul><button class="secondary" type="button" data-action="copy-full-backup-command" ${admin ? "" : "disabled"}>${icon("copy", 15)} Copier la commande locale</button></section>
        <section class="panel data-tool-card"><span class="module-hero-icon">${icon("key", 22)}</span><div><p class="eyebrow">RÉCUPÉRATION HORS BANDE</p><h2>Compte de secours</h2><p>Un outil local réinitialise le MFA d’un administrateur, génère un mot de passe temporaire et conserve une sauvegarde datée.</p></div><ul><li>Aucun accès réseau</li><li>Confirmation RESET_MFA obligatoire</li><li>Action inscrite dans l’audit si SQLite est disponible</li></ul><code>scripts/atlas-break-glass.mjs</code></section>
      </div>
      ${admin ? "" : `<div class="notice">${icon("alert", 17)} Seul un administrateur local peut importer ou exporter l’espace de travail.</div>`}
    </div>`;
  }

  function renderTemplates() {
    const query = state.listSearch.trim().toLocaleLowerCase(state.locale);
    const items = state.workspace.templates.filter((template) => { const module = moduleMap.get(template.moduleId); return !query || [template.name, template.defaultSummary, ...(template.defaultTags || []), module?.label].join(" ").toLocaleLowerCase(state.locale).includes(query); }).sort((a, b) => a.name.localeCompare(b.name, state.locale));
    const page = paginate(items, 24);
    return `<div class="page templates-page">${pageHeader("Modèles", "Standardisez les fiches répétitives sans dupliquer manuellement leur structure.", writeButton(`<button class="primary" data-action="new-template">${icon("plus")} Nouveau modèle</button>`))}
      <div class="toolbar compact-list-toolbar"><label class="list-search">${icon("search", 16)}<input type="search" data-list-search placeholder="Rechercher un modèle…" value="${escapeHtml(state.listSearch)}" /></label><div class="toolbar-summary"><strong>${items.length}</strong> sur ${state.workspace.templates.length}</div></div>
      <section class="cards-grid template-grid">${page.items.map((template) => { const module = moduleMap.get(template.moduleId); return `<article class="entity-card template-card"><div class="entity-card-top"><span class="module-hero-icon">${icon(module?.icon || "file", 19)}</span>${writeButton(`<button class="icon-button" data-action="edit-template" data-id="${template.id}" aria-label="Modifier">${icon("edit", 15)}</button>`)}</div><p class="eyebrow">${escapeHtml(module?.label || "Tous modules")}</p><h2>${escapeHtml(template.name)}</h2><p>${escapeHtml(template.defaultSummary || "Aucun résumé par défaut.")}</p><div class="template-tags">${(template.defaultTags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("") || "—"}</div>${writeButton(`<button class="secondary full" data-action="use-template" data-id="${template.id}">Utiliser ce modèle ${icon("arrow", 14)}</button>`)}</article>`; }).join("")}</section>${items.length ? paginationMarkup(page) : emptyState(t("empty"))}
    </div>`;
  }

  function renderWorkflows() {
    const rules = state.workspace.settings.workflows;
    const now = Date.now();
    const operationalAssets = assetRegistry().filter((asset) => ["configuration", "procedure", "module"].includes(asset.type) && !asset.archived);
    const expiryAssets = operationalAssets.filter((asset) => asset.type === "module" && asset.raw.expiresOn && ((new Date(`${asset.raw.expiresOn}T12:00:00`) - now) / 86400000) <= rules.expiryDays);
    const staleAssets = operationalAssets.filter((asset) => {
      const reviewedAt = asset.type === "configuration" ? asset.raw.lastReviewed : asset.raw.updatedAt;
      return reviewedAt && ((now - new Date(`${reviewedAt}T12:00:00`)) / 86400000) >= rules.staleDays;
    });
    const missingOwnerAssets = rules.requireOwner ? operationalAssets.filter((asset) => !String(asset.raw.owner || "").trim()) : [];
    const reviewAssets = operationalAssets.filter((asset) => asset.type === "module" && ["draft", "in-review", "stale"].includes(asset.raw.reviewState || "draft"));
    const overdueReviews = operationalAssets.filter((asset) => asset.type === "module" && asset.raw.reviewDueAt && Date.parse(`${asset.raw.reviewDueAt}T23:59:59`) < now && asset.raw.status !== "archived");
    const signals = new Map();
    const addSignal = (asset, reason, date = "") => {
      const current = signals.get(asset.ref) || { asset, reasons: [], date: "" };
      current.reasons.push(reason);
      if (date) current.date = date;
      signals.set(asset.ref, current);
    };
    expiryAssets.forEach((asset) => addSignal(asset, "Échéance proche ou dépassée", asset.raw.expiresOn));
    staleAssets.forEach((asset) => addSignal(asset, "Révision en retard", asset.type === "configuration" ? asset.raw.lastReviewed : asset.raw.updatedAt));
    missingOwnerAssets.forEach((asset) => addSignal(asset, "Responsable manquant"));
    reviewAssets.forEach((asset) => addSignal(asset, asset.raw.reviewState === "in-review" ? "Approbation en attente" : asset.raw.reviewState === "stale" ? "Cycle de révision à relancer" : "Brouillon non soumis", asset.raw.reviewDueAt || ""));
    overdueReviews.forEach((asset) => addSignal(asset, "Révision planifiée en retard", asset.raw.reviewDueAt));
    const queue = [...signals.values()].sort((a, b) => Number(b.reasons.length) - Number(a.reasons.length) || String(a.date || "9999").localeCompare(String(b.date || "9999")) || a.asset.label.localeCompare(b.asset.label, state.locale));
    const queuePage = paginate(queue, 50);
    const visibleQueue = queuePage.items;
    return `<div class="page workflows-page">${pageHeader("Workflows", "Règles locales qui signalent les documents à réviser; aucune notification ne quitte cette instance.")}
      <section class="metrics-grid workflow-metrics">${metricCard("clock", expiryAssets.length, "Échéances", `Dans ${rules.expiryDays} jours`, "violet")}${metricCard("history", staleAssets.length, "Fiches anciennes", `Plus de ${rules.staleDays} jours`, "blue")}${metricCard("users", missingOwnerAssets.length, "Sans responsable", rules.requireOwner ? "Règle active" : "Règle inactive", "mint")}${metricCard("check", reviewAssets.length + overdueReviews.length, "Révisions", "brouillons, approbations et retards", "cyan")}</section>
      <section class="panel workflow-queue"><header><div><p class="eyebrow">FILE D’ACTIONS</p><h2>Fiches à traiter</h2><p>Chaque signal est calculé à partir d’un champ visible. Ouvrez la fiche pour corriger la cause.</p></div><span class="workflow-queue-count">${queue.length}</span></header>${visibleQueue.length ? `<div class="table-scroll"><table><thead><tr><th>Fiche</th><th>Organisation</th><th>Motif</th><th>Date de référence</th><th></th></tr></thead><tbody>${visibleQueue.map(({ asset, reasons, date }) => `<tr><td><button class="table-link" type="button" data-action="open-asset" data-asset-ref="${escapeHtml(asset.ref)}"><span class="type-icon">${icon(asset.icon, 16)}</span><span><strong>${escapeHtml(asset.label)}</strong><small>${escapeHtml(asset.kind)}</small></span></button></td><td>${escapeHtml(orgName(asset.organizationId))}</td><td><div class="workflow-reasons">${reasons.map((reason) => `<span>${escapeHtml(reason)}</span>`).join("")}</div></td><td>${date ? formatDate(date) : "—"}</td><td><button class="secondary compact" type="button" data-action="open-asset" data-asset-ref="${escapeHtml(asset.ref)}">Ouvrir ${icon("chevron", 13)}</button></td></tr>`).join("")}</tbody></table></div>${paginationMarkup(queuePage)}` : emptyState("Aucune fiche ne correspond aux règles actives.")}</section>
      <form class="panel workflow-form" data-form="workflows"><div><p class="eyebrow">RÈGLES LOCALES</p><h2>Seuils de suivi</h2><p>Ces règles alimentent le dashboard et les compteurs. Elles ne déclenchent ni courriel ni appel externe.</p></div><label>Échéance à signaler<input name="expiryDays" type="number" min="1" max="365" value="${rules.expiryDays}" ${canWrite() ? "" : "disabled"}/><small>Nombre de jours avant expiration.</small></label><label>Fiche considérée ancienne<input name="staleDays" type="number" min="7" max="730" value="${rules.staleDays}" ${canWrite() ? "" : "disabled"}/><small>Nombre de jours sans révision.</small></label><label class="checkbox-label"><input name="requireOwner" type="checkbox" ${rules.requireOwner ? "checked" : ""} ${canWrite() ? "" : "disabled"}/> Signaler les fiches sans responsable</label><div class="settings-save"><span>${canWrite() ? "Calcul entièrement local" : "Consultation seulement"}</span>${writeButton(`<button class="primary" type="submit">${t("save")}</button>`)}</div></form>
    </div>`;
  }

  function renderModulesManager() {
    const selectedCount = state.visibleModuleIds.size;
    const audit = moduleCatalogAudit();
    const localDefinitions = state.workspace.customModuleDefinitions || [];
    const localBuilder = isAdministrator() ? `<section class="panel local-module-builder"><header><div><p class="eyebrow">CONSTRUCTEUR LOCAL</p><h2>Modules créés sur cette instance</h2><p>Ajoutez un registre métier avec ses propres champs typés, sans code et sans champ secret.</p></div><button class="primary compact" type="button" data-action="new-custom-module">${icon("plus", 15)} Nouveau module</button></header>${localDefinitions.length ? `<div class="local-module-list">${localDefinitions.map((definition) => { const count = state.workspace.moduleRecords.filter((record) => record.moduleId === definition.id).length; return `<button type="button" data-action="edit-custom-module" data-id="${escapeHtml(definition.id)}"><span class="module-toggle-icon">${icon(definition.icon || "grid", 18)}</span><span><strong>${escapeHtml(definition.label)}</strong><small>${definition.fields.length} champs · ${count} fiche${count === 1 ? "" : "s"}</small></span>${icon("edit", 14)}</button>`; }).join("")}</div>` : `<div class="local-module-empty">${icon("grid", 20)}<span><strong>Aucun module local</strong><small>Les 179 modules fournis restent disponibles ci-dessous.</small></span></div>`}<div class="module-boundary-note"><strong>Secrets interdits :</strong> les mots de passe, jetons et clés API doivent rester dans Passwords puis être reliés à la fiche.</div></section>` : "";
    return `<div class="page modules-manager-page">
      ${pageHeader("Gérer les modules", "Choisissez précisément les sections affichées dans votre navigation. Chaque module possède maintenant un profil métier vérifié; les données restent conservées lorsqu’un module est masqué.")}
      <section class="module-audit-summary" aria-label="Couverture de la bibliothèque">
        <article><span>${icon("grid", 18)}</span><div><strong>${audit.total}</strong><small>modules catalogués</small></div></article>
        <article><span>${icon("settings", 18)}</span><div><strong>${audit.profileCount}</strong><small>profils métier</small></div></article>
        <article><span>${icon("check", 18)}</span><div><strong>${audit.total - audit.issues.length}</strong><small>modules validés</small></div></article>
        <article class="${audit.issues.length ? "has-issues" : "is-valid"}"><span>${icon(audit.issues.length ? "alert" : "shield", 18)}</span><div><strong>${audit.issues.length}</strong><small>anomalie de schéma</small></div></article>
      </section>
      ${localBuilder}
      <form data-form="module-preferences" class="modules-manager-form">
        <section class="panel module-manager-toolbar">
          <label class="module-search-field">${icon("search", 17)}<input type="search" data-module-search placeholder="Rechercher parmi ${moduleDefinitions.length} modules…" value="${escapeHtml(state.moduleSearch)}" /></label>
          <div class="module-manager-count"><strong data-selected-count>${selectedCount}</strong><span>modules visibles</span></div>
          <div class="module-bulk-actions"><button type="button" class="secondary compact" data-action="module-preset" data-preset="essential">Essentiels</button><button type="button" class="secondary compact" data-action="module-preset" data-preset="standard">Actifs + services</button><button type="button" class="secondary compact" data-action="module-preset" data-preset="all">Tout afficher</button><button type="button" class="text-button" data-action="module-preset" data-preset="none">Tout masquer</button></div>
        </section>
        ${moduleManagerGroup("core", "Actifs de base", "Les neuf registres fondamentaux de la documentation.")}
        ${moduleManagerGroup("services", "Apps & Services", "Les services structurés que vous avez listés.")}
        ${moduleManagerGroup("custom", "Types personnalisés", "Les types non assignés et spécialisés de votre environnement.")}
        <div class="settings-save module-manager-save"><span>Préférence locale liée au compte <strong>${escapeHtml(state.user.username)}</strong>.</span><button class="primary" type="submit">${t("save")}</button></div>
      </form>
    </div>`;
  }

  function moduleManagerGroup(group, title, description) {
    const modules = moduleDefinitions.filter((module) => module.group === group && (module.id !== "passwords" || canAccessVault()));
    return `<details class="panel module-manager-group" data-module-group="${group}" ${group === "custom" ? "" : "open"}><summary class="module-manager-heading"><div><p class="eyebrow">${group === "core" ? "CORE ASSETS" : group === "services" ? "APPS & SERVICES" : "BIBLIOTHÈQUE"}</p><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div><span>${modules.length} modules ${icon("chevron", 14)}</span></summary><div class="module-toggle-grid">${modules.map((module) => { const audit = moduleEditorAuditEntry(module); return `<label class="module-toggle-card" data-module-label="${escapeHtml(`${module.label} ${module.description} ${audit.profileLabel}`.toLowerCase())}"><input type="checkbox" name="visibleModules" value="${module.id}" ${state.visibleModuleIds.has(module.id) ? "checked" : ""}/><span class="module-toggle-icon">${icon(module.icon, 18)}</span><span class="module-toggle-copy"><strong>${escapeHtml(module.label)}</strong><small>${escapeHtml(module.description)}</small><span class="module-profile-badge">${escapeHtml(audit.profileLabel)} · ${audit.fieldCount} champs</span></span><span class="switch-control" aria-hidden="true"></span></label>`; }).join("")}</div></details>`;
  }

  function deploymentHealthCheckMarkup(check) {
    const status = ["ok", "warning", "error", "neutral"].includes(check.status) ? check.status : "neutral";
    const statusLabel = status === "ok" ? "Connecté" : status === "error" ? "Erreur" : status === "warning" ? "À vérifier" : "Information";
    return `<article class="deployment-health-check ${status}"><span class="deployment-health-icon">${icon(status === "ok" ? "check" : status === "neutral" ? "info" : "alert", 18)}</span><div><strong>${escapeHtml(check.label || "Vérification")}</strong><p>${escapeHtml(check.message || "")}</p></div><span class="health-state-label">${statusLabel}</span></article>`;
  }

  function renderDeploymentHealthSection(settings) {
    if (!isAdministrator()) return `<section class="panel settings-section" id="settings-health"><div><p class="eyebrow">SANTÉ DU SITE</p><h2>État de l’instance</h2><p>Les diagnostics de déploiement sont réservés aux administrateurs locaux.</p></div><div class="notice">${icon("lock", 17)} Un compte administrateur est requis.</div></section>`;
    const health = state.deploymentHealth;
    const checks = health?.checks || [];
    const summary = health?.summary || { ok: 0, warning: 0, neutral: 0, total: 0 };
    const probe = state.deploymentProbe;
    const portProbe = state.deploymentPortProbe;
    const certificate = probe?.certificate;
    const probeMarkup = probe ? `<div class="public-probe-result success"><div><span>${icon("shield", 18)}</span><div><strong>Domaine public vérifié</strong><p>${escapeHtml(probe.domain)} répond avec Atlas ${escapeHtml(probe.atlas?.version || "")}, via ${escapeHtml(probe.address || "adresse résolue")}.</p></div></div>${certificate ? `<dl><div><dt>Certificat</dt><dd>${escapeHtml(certificate.subject || "Nom non déclaré")}</dd></div><div><dt>Émetteur</dt><dd>${escapeHtml(certificate.issuer || "Non déclaré")}</dd></div><div><dt>Expiration</dt><dd>${certificate.validTo ? `${formatDateTime(certificate.validTo)} · ${certificate.daysRemaining} jours` : "Non disponible"}</dd></div></dl>` : ""}</div>` : "";
    const portProbeMarkup = portProbe ? `<div class="local-port-result ${portProbe.open ? "success" : "error"}"><span>${icon(portProbe.open ? "check" : "alert", 18)}</span><div><strong>${portProbe.open ? "Port Atlas ouvert sur cet ordinateur" : "Port Atlas inaccessible localement"}</strong><p>${escapeHtml(portProbe.message || "")} Cible testée : <code>${escapeHtml(portProbe.host || "127.0.0.1")}:${Number(portProbe.port) || "—"}</code>${Number.isFinite(portProbe.latencyMs) ? ` · ${portProbe.latencyMs} ms` : ""}.</p><small>${portProbe.checkedAt ? `Testé ${formatDateTime(portProbe.checkedAt)}` : ""}</small></div></div>` : "";
    return `<section class="panel settings-health-section" id="settings-health"><header><div><p class="eyebrow">SANTÉ DU SITE</p><h2>État de l’instance</h2><p>Ces contrôles sont factuels. Atlas ne modifie jamais le DNS, le certificat, le routeur ou le pare-feu.</p></div><div class="settings-health-actions"><button class="secondary compact" type="button" data-action="refresh-site-health" ${state.deploymentHealthLoading ? "disabled" : ""}>${icon("refresh", 14)} ${state.deploymentHealthLoading ? "Vérification…" : "Actualiser"}</button><button class="secondary compact" type="button" data-action="probe-local-port" ${state.deploymentHealthLoading ? "disabled" : ""}>${icon("activity", 14)} Tester le port local</button><button class="primary compact" type="button" data-action="probe-public-site" ${!settings.deployment.primaryDomain || state.deploymentHealthLoading ? "disabled" : ""}>${icon("globe", 14)} Tester le domaine public</button></div></header>
      ${health?.error ? `<div class="notice">${icon("alert", 17)} ${escapeHtml(health.error)}</div>` : `<div class="health-summary"><span class="health-summary-icon">${icon(summary.warning ? "alert" : "check", 22)}</span><div><strong>${summary.warning ? `${summary.warning} point${summary.warning === 1 ? "" : "s"} à vérifier` : "Les contrôles locaux sont prêts"}</strong><p>${summary.ok} réussi${summary.ok === 1 ? "" : "s"}, ${summary.neutral} informatif${summary.neutral === 1 ? "" : "s"}, ${summary.total} contrôle${summary.total === 1 ? "" : "s"} au total.</p></div><small>${health?.checkedAt ? `Actualisé ${formatDateTime(health.checkedAt)}` : "Actualisez pour lancer les contrôles"}</small></div>`}
      <div class="deployment-health-grid">${checks.length ? checks.map(deploymentHealthCheckMarkup).join("") : `<div class="health-empty">${state.deploymentHealthLoading ? "Vérification de l’instance…" : "Choisissez Actualiser pour afficher l’état détaillé."}</div>`}</div>
      ${portProbeMarkup}
      ${probeMarkup}
      <div class="health-boundary-note">${icon("info", 16)} Le test du port cible uniquement le listener Atlas sur cet ordinateur. Le test public est manuel, limité au domaine exact enregistré et refuse toute destination locale ou privée. Aucune exploration réseau n’est effectuée.</div>
    </section>`;
  }

  const settingsPages = new Set(["overview", "general", "appearance", "integrations", "deployment", "health", "backups", "updates", "security"]);

  function activeSettingsPage() {
    return settingsPages.has(state.detailId) ? state.detailId : "overview";
  }

  function settingsNavigationMarkup(activePage) {
    const items = [
      { key: "overview", iconName: "grid", label: "Vue des paramètres", visible: true },
      { key: "general", iconName: "settings", label: t("general"), visible: true },
      { key: "appearance", iconName: "sun", label: t("appearance"), visible: true },
      { key: "integrations", iconName: "link", label: t("integrations"), visible: true },
      { key: "deployment", iconName: "compass", label: "Configuration initiale", visible: isAdministrator(), protected: true },
      { key: "health", iconName: "activity", label: "Santé du site", visible: isAdministrator(), protected: true },
      { key: "backups", iconName: "download", label: "Sauvegardes", visible: isAdministrator(), protected: true },
      { key: "updates", iconName: "refresh", label: "Mises à jour", visible: isAdministrator(), protected: true },
      { key: "security", iconName: "shield", label: t("security"), visible: isAdministrator(), protected: true },
    ];
    return `<nav class="settings-nav" aria-label="Pages des paramètres">${items.filter((item) => item.visible).map((item) => `<button class="${activePage === item.key ? "active" : ""}" type="button" data-route="settings/${item.key}" ${activePage === item.key ? 'aria-current="page"' : ""}>${icon(item.iconName, 16)}<span>${escapeHtml(item.label)}</span>${item.protected ? `<small title="Réservé au super administrateur">${icon("lock", 12)}</small>` : ""}</button>`).join("")}${isAdministrator() ? `<button class="settings-nav-accounts" type="button" data-route="accounts">${icon("users", 16)}<span>Comptes et accès</span>${icon("chevron", 12)}</button>` : ""}</nav>`;
  }

  function renderSettingsShell(activePage, title, description, content) {
    return `<div class="page settings-page">${pageHeader(title, description)}<div class="settings-layout">${settingsNavigationMarkup(activePage)}<main class="settings-content">${content}</main></div></div>`;
  }

  function renderProtectedSettingsDenied(title) {
    return renderSettingsShell("overview", "Accès refusé", `${title} est réservée au super administrateur Atlas.`, `<section class="panel access-denied-card settings-access-denied"><span class="vault-lock-icon">${icon("lock", 22)}</span><div><p class="eyebrow">ADMINISTRATION PROTÉGÉE</p><h2>${escapeHtml(title)}</h2><p>Cette page contient des réglages qui touchent toute l’instance. Seul un administrateur local Atlas peut la consulter ou la modifier.</p></div><button class="secondary" type="button" data-route="settings/overview">Retour aux paramètres</button></section>`);
  }

  function settingsAdminMfaMarkup(reason, suffix = "") {
    const enabled = state.workspace.settings.security.privilegedMfaEnabled;
    const helpId = `settings-mfa-help${suffix ? `-${suffix}` : ""}`;
    return `<section class="settings-sensitive-confirmation"><span>${icon("shield", 20)}</span><div><p class="eyebrow">CONFIRMATION PROTÉGÉE</p><h2>${enabled ? "Confirmer avec votre MFA" : "Validation renforcée désactivée"}</h2><p>${enabled ? escapeHtml(reason) : "La politique MFA renforcée est désactivée. La session administrateur et la protection CSRF restent vérifiées."}</p></div>${enabled ? `<label>Code MFA actuel<input name="adminMfaCode" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="000000" aria-describedby="${helpId}"/><small id="${helpId}">Entrez les 6 chiffres de votre application d’authentification.</small></label>` : ""}</section>`;
  }

  function renderSettingsOverview() {
    const adminCards = isAdministrator() ? [
      { route: "settings/deployment", iconName: "compass", title: "Configuration initiale", text: "Domaine, accès HTTPS, proxy inverse, identité et démarrage Windows.", badge: "Super admin" },
      { route: "settings/health", iconName: "activity", title: "Santé du site", text: "État du service, du port local, de l’autodémarrage, du stockage et du domaine.", badge: state.deploymentHealth?.summary?.warning ? `${state.deploymentHealth.summary.warning} à vérifier` : "Protégé" },
      { route: "settings/backups", iconName: "download", title: "Sauvegardes", text: "Sauvegardes complètes chiffrées, emplacement, horaire, rétention et tests d’intégrité.", badge: state.backupStatus?.settings?.lastSuccessAt ? "Active" : "À configurer" },
      { route: "settings/updates", iconName: "refresh", title: "Mises à jour", text: "Vérification GitHub manuelle et garde-fou de signature avant toute installation.", badge: `v${ATLAS_VERSION}` },
      { route: "settings/security", iconName: "shield", title: "Sécurité locale", text: "MFA renforcé et règles de rotation des mots de passe.", badge: "Super admin" },
      { route: "accounts", iconName: "users", title: "Comptes et accès", text: "Rôles, compagnies autorisées, coffre, MFA et sessions.", badge: `${state.users.length} compte${state.users.length === 1 ? "" : "s"}` },
    ] : [];
    const commonCards = [
      { route: "settings/general", iconName: "settings", title: t("general"), text: "Nom affiché et langue par défaut de cette instance." },
      { route: "settings/appearance", iconName: "sun", title: t("appearance"), text: "Thème local de votre navigateur." },
      { route: "settings/integrations", iconName: "link", title: t("integrations"), text: "État des connecteurs facultatifs, désactivés par défaut." },
    ];
    const cardsMarkup = (cards) => cards.map((card) => `<button type="button" class="panel settings-overview-card" data-route="${card.route}"><span class="settings-overview-icon">${icon(card.iconName, 21)}</span><span class="settings-overview-copy"><span class="settings-overview-card-heading"><strong>${escapeHtml(card.title)}</strong>${card.badge ? `<em>${escapeHtml(card.badge)}</em>` : ""}</span><small>${escapeHtml(card.text)}</small></span><span class="settings-overview-arrow">${icon("chevron", 16)}</span></button>`).join("");
    const adminNotice = isAdministrator() ? `<section class="settings-admin-note">${icon("lock", 18)}<span><strong>Administration protégée</strong><small>La configuration initiale, la santé et la sécurité sont réservées au super administrateur Atlas.</small></span></section>` : "";
    const administration = adminCards.length ? `<section class="settings-overview-section"><header><div><p class="eyebrow">ADMINISTRATION DE L’INSTANCE</p><h2>Configurer et protéger Atlas</h2></div><span>${adminCards.length} espaces protégés</span></header><div class="settings-overview-grid admin">${cardsMarkup(adminCards)}</div></section>` : "";
    const preferences = `<section class="settings-overview-section"><header><div><p class="eyebrow">PRÉFÉRENCES</p><h2>Adapter l’expérience locale</h2></div></header><div class="settings-overview-grid preferences">${cardsMarkup(commonCards)}</div></section>`;
    return renderSettingsShell("overview", t("settings"), "Tous les réglages de cette instance, organisés par fonction.", `${adminNotice}${administration}${preferences}`);
  }

  function renderDeploymentSettingsPage() {
    if (!isAdministrator()) return renderProtectedSettingsDenied("Configuration initiale");
    const settings = state.workspace.settings;
    const deployment = settings.deployment;
    const autostart = state.deploymentHealth?.autostart || { supported: true, installed: false, enabled: false, state: "Chargement", trigger: "none", runAs: "" };
    const autostartReady = Boolean(state.deploymentHealth?.autostart && !state.deploymentHealthLoading && autostart.supported !== false);
    const publicUrl = deployment.primaryDomain ? `https://${deployment.primaryDomain}` : "Aucune adresse publique configurée";
    const autostartTrigger = autostart.trigger === "startup" ? "Au démarrage de Windows" : autostart.trigger === "logon" ? "À la connexion Windows" : "Non planifié";
    const deploymentForm = `<form class="settings-dedicated-form" data-form="settings-deployment"><section class="panel settings-section deployment-settings-section"><div><p class="eyebrow">CONFIGURATION INITIALE</p><h2>Adresse et certificat Atlas</h2><p>Identifiez cette installation et déclarez l’adresse HTTPS que votre proxy inverse doit servir.</p><div class="deployment-public-preview"><span>${icon("globe", 17)}</span><span><small>Adresse publique prévue</small><strong>${escapeHtml(publicUrl)}</strong></span></div></div><div class="deployment-controls">
      <div class="deployment-field-row"><label>Code court de l’instance<input name="instanceCode" maxlength="32" pattern="[A-Za-z0-9][A-Za-z0-9-]{1,31}" value="${escapeHtml(deployment.instanceCode)}" placeholder="ABC"/><small>Exemple : <code>ABC</code>. Ce code identifie l’installation, pas un utilisateur.</small></label><label>Mode d’accès<select name="accessMode" data-deployment-access-mode><option value="local" ${deployment.accessMode === "local" ? "selected" : ""}>Local seulement</option><option value="reverse-proxy" ${deployment.accessMode === "reverse-proxy" ? "selected" : ""}>HTTPS par proxy inverse</option></select><small>Le mode public exige un domaine et un certificat géré devant Atlas.</small></label></div>
      <label>Domaine public principal<input name="primaryDomain" maxlength="253" value="${escapeHtml(deployment.primaryDomain)}" placeholder="atlas.abcp.com"/><small>Saisissez seulement le domaine, sans <code>https://</code>, port ni chemin.</small></label>
      <label>Domaines secondaires<textarea name="domainAliases" rows="3" maxlength="2540" placeholder="atlas.abc.com&#10;documentation.abcp.com">${escapeHtml(deployment.domainAliases.join("\n"))}</textarea><small>Un domaine par ligne, jusqu’à 10. Ils demeurent isolés des domaines documentés dans les compagnies.</small></label>
      <label>Proxy inverse<select name="reverseProxy" data-reverse-proxy ${deployment.accessMode === "local" ? "disabled" : ""}><option value="nginx" ${deployment.reverseProxy === "nginx" ? "selected" : ""}>Nginx</option><option value="iis" ${deployment.reverseProxy === "iis" ? "selected" : ""}>IIS</option><option value="caddy" ${deployment.reverseProxy === "caddy" ? "selected" : ""}>Caddy</option><option value="other" ${deployment.reverseProxy === "other" ? "selected" : ""}>Autre</option></select><small>Le proxy termine TLS puis transmet <code>X-Forwarded-Proto: https</code> à Atlas.</small></label>
      <div class="certificate-boundary">${icon("shield", 18)}<div><strong>Certificat géré hors d’Atlas</strong><p>Installez la clé privée et le certificat dans Nginx, IIS ou Caddy. Atlas n’importe et ne conserve jamais la clé TLS.</p></div></div><div class="module-boundary-note"><strong>À ne pas confondre :</strong> Domain Tracker et SSL Tracker documentent les actifs des compagnies. Cette page configure seulement cette instance Atlas.</div>
    </div></section>${settingsAdminMfaMarkup("Un code MFA actuel est requis lorsque le domaine, le mode d’accès ou le proxy change.", "deployment")}<p class="form-error" role="alert"></p><div class="settings-save"><span>Atlas ne modifie jamais le DNS, le certificat ou le proxy.</span><button class="primary" type="submit" ${state.saving ? "disabled" : ""}>${state.saving ? "Enregistrement…" : "Enregistrer la configuration"}</button></div></form>`;
    const autostartForm = `<form class="settings-dedicated-form" data-form="settings-autostart"><section class="panel settings-section autostart-settings-section"><div><p class="eyebrow">DÉMARRAGE WINDOWS</p><h2>Lancer Atlas en arrière-plan</h2><p>Planifiez Atlas avec Windows sans fenêtre PowerShell visible. L’instance actuelle reste ouverte pendant l’application du réglage.</p><div class="autostart-current-state ${autostart.enabled ? "enabled" : "disabled"}"><span>${icon(autostart.enabled ? "check" : "clock", 17)}</span><div><small>État détecté</small><strong>${escapeHtml(autostart.message || (autostart.enabled ? "Activé" : "Désactivé"))}</strong></div></div></div><div class="autostart-controls"><label class="permission-switch"><input name="autostartEnabled" type="checkbox" ${autostart.enabled ? "checked" : ""} ${autostartReady ? "" : "disabled"}/><span><strong>Démarrer Atlas automatiquement</strong><small>Utilise une tâche Windows masquée avec redémarrage automatique en cas d’échec.</small></span></label><dl class="security-list"><div><dt>Déclencheur</dt><dd>${escapeHtml(autostartTrigger)}</dd></div><div><dt>Compte d’exécution</dt><dd>${escapeHtml(autostart.runAs || "Déterminé à l’application")}</dd></div><div><dt>Tâche Windows</dt><dd>${escapeHtml(autostart.taskName || "TRC Community Atlas")}</dd></div><div><dt>État système</dt><dd><span class="status-badge ${autostart.enabled ? "success" : "muted"}">${escapeHtml(autostart.state || "Inconnu")}</span></dd></div></dl><div class="module-boundary-note"><strong>Port conservé :</strong> la tâche réutilise l’adresse, le port et le dossier de données actifs. Aucun port supplémentaire n’est ouvert.</div></div></section>${settingsAdminMfaMarkup("Confirmez avant de créer, modifier ou désactiver la tâche de démarrage Windows.", "autostart")}<p class="form-error" role="alert"></p><div class="settings-save"><span>La modification sera visible dans Santé du site.</span><button class="primary" type="submit" ${autostartReady ? "" : "disabled"}>${state.deploymentHealthLoading ? "Vérification…" : "Configurer et appliquer"}</button></div></form>`;
    return renderSettingsShell("deployment", "Configuration initiale", "Réglages protégés du domaine, de l’accès public et du démarrage Windows.", `${deploymentForm}${autostartForm}`);
  }

  function renderBackupSettingsPage() {
    if (!isAdministrator()) return renderProtectedSettingsDenied("Sauvegardes");
    const status = state.backupStatus;
    if (!status && !state.backupLoading) queueMicrotask(() => loadBackupStatus());
    if (!status?.settings) {
      return renderSettingsShell("backups", "Sauvegardes", "Protection complète de cette instance Atlas.", `<section class="panel settings-section"><div><p class="eyebrow">SAUVEGARDES</p><h2>${state.backupLoading ? "Chargement…" : "Gestionnaire indisponible"}</h2><p>${escapeHtml(status?.error || "Lecture de la configuration locale en cours.")}</p></div><button class="secondary" type="button" data-action="refresh-backups">${icon("refresh", 15)} Réessayer</button></section>`);
    }
    const settings = status.settings;
    const weekdayOptions = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"].map((label, index) => `<option value="${index}" ${settings.weekday === index ? "selected" : ""}>${label}</option>`).join("");
    const files = status.files || [];
    const schedulerLabel = settings.enabled ? `Prochaine exécution ${settings.nextRunAt ? formatDateTime(settings.nextRunAt) : "à calculer"}` : "Planification désactivée";
    const lastRun = settings.lastSuccessAt ? `${formatDateTime(settings.lastSuccessAt)} · ${formatFileSize(settings.lastBytes)} · ${settings.lastFileCount} fichiers` : "Aucune sauvegarde complète réussie";
    const filesMarkup = files.length ? `<div class="backup-history-list">${files.map((file) => `<details class="backup-history-item"><summary><span>${icon("shield", 17)}<span><strong>${escapeHtml(file.name)}</strong><small>${formatDateTime(file.modifiedAt)} · ${formatFileSize(file.size)}</small></span></span>${icon("chevron", 14)}</summary><form data-form="backup-inspect" data-name="${escapeHtml(file.name)}"><p>Déchiffre la sauvegarde en mémoire, valide chaque empreinte SHA-256 et n’écrit aucun fichier restauré.</p><label>Phrase secrète de cette sauvegarde<input name="passphrase" type="password" minlength="12" autocomplete="new-password" required/></label>${settingsAdminMfaMarkup("Le test lit une sauvegarde contenant toutes les données de l’instance.", `inspect-${file.name.replace(/[^a-z0-9]/gi, "-")}`)}<p class="form-error" role="alert"></p><button class="secondary compact" type="submit">${icon("check", 14)} Tester l’intégrité</button></form></details>`).join("")}</div>` : emptyState("Aucune sauvegarde Atlas n’est encore présente dans cet emplacement.");
    const scheduleForm = `<form class="settings-dedicated-form" data-form="settings-backups"><section class="panel settings-section backup-settings-section"><div><p class="eyebrow">PLANIFICATION LOCALE</p><h2>Emplacement et horaire</h2><p>Atlas crée un fichier complet AES-256-GCM. La phrase secrète planifiée est protégée par Windows pour le compte qui exécute Atlas.</p><div class="backup-current-state ${settings.enabled ? "enabled" : "disabled"}"><span>${icon(settings.enabled ? "check" : "clock", 17)}</span><div><small>${escapeHtml(schedulerLabel)}</small><strong>${escapeHtml(lastRun)}</strong></div></div></div><div class="backup-settings-controls"><label class="permission-switch"><input name="enabled" type="checkbox" ${settings.enabled ? "checked" : ""}/><span><strong>Activer les sauvegardes planifiées</strong><small>Le planificateur fonctionne pendant qu’Atlas est démarré; activez aussi l’autodémarrage Windows pour une exécution fiable.</small></span></label><label>Emplacement des sauvegardes<input name="destination" value="${escapeHtml(settings.destination)}" maxlength="500" required/><small>Chemin absolu local ou UNC. Atlas ne remplace jamais une ancienne sauvegarde.</small></label><div class="backup-schedule-grid"><label>Fréquence<select name="cadence"><option value="daily" ${settings.cadence === "daily" ? "selected" : ""}>Chaque jour</option><option value="weekly" ${settings.cadence === "weekly" ? "selected" : ""}>Chaque semaine</option></select></label><label>Jour<select name="weekday">${weekdayOptions}</select></label><label>Heure<input name="hour" type="number" min="0" max="23" value="${settings.hour}" required/></label><label>Minute<input name="minute" type="number" min="0" max="59" value="${settings.minute}" required/></label></div><label>Phrase secrète planifiée<input name="passphrase" type="password" minlength="12" autocomplete="new-password" placeholder="${settings.secretConfigured ? "Déjà protégée — laisser vide pour conserver" : "12 caractères minimum"}"/><small>Conservez-la aussi dans un emplacement distinct. Atlas ne pourra pas restaurer une sauvegarde si vous la perdez.</small></label><label class="permission-switch"><input name="retentionEnabled" type="checkbox" ${settings.retentionEnabled ? "checked" : ""}/><span><strong>Rétention automatique explicite</strong><small>Après une réussite, retirer uniquement les anciens fichiers Atlas de cet emplacement.</small></span></label><label>Nombre de sauvegardes à conserver<input name="retentionCount" type="number" min="2" max="365" value="${settings.retentionCount}" required/></label><div class="module-boundary-note"><strong>Restauration hors ligne seulement :</strong> arrêtez Atlas puis utilisez l’outil local. Une copie de sécurité préalable sera créée; les sessions ne sont jamais restaurées.</div></div></section>${settingsAdminMfaMarkup("Confirmez avant de changer l’emplacement, la phrase secrète, l’horaire ou la rétention.", "backups")}<p class="form-error" role="alert"></p><div class="settings-save"><span>${status.destinationReady ? "Destination lisible" : escapeHtml(status.destinationError || "Destination non vérifiée")}</span><button class="primary" type="submit">Enregistrer la planification</button></div></form>`;
    const runForm = `<form class="panel backup-run-card" data-form="backup-run"><div><p class="eyebrow">SAUVEGARDE IMMÉDIATE</p><h2>Créer un point de restauration maintenant</h2><p>Utilisez la phrase protégée de la planification ou saisissez une phrase différente pour ce fichier seulement.</p></div><label>Phrase secrète facultative<input name="passphrase" type="password" minlength="12" autocomplete="new-password" placeholder="${settings.secretConfigured ? "Laisser vide pour utiliser la phrase planifiée" : "Requise si aucune phrase planifiée"}"/></label>${settingsAdminMfaMarkup("La sauvegarde complète lit le coffre, les comptes, le MFA, SQLite et les pièces jointes.", "backup-run")}<p class="form-error" role="alert"></p><button class="primary" type="submit" ${status.running ? "disabled" : ""}>${icon("download", 15)} ${status.running ? "Sauvegarde en cours…" : "Sauvegarder maintenant"}</button></form>`;
    const history = `<section class="panel backup-history-card"><header><div><p class="eyebrow">HISTORIQUE</p><h2>Fichiers gérés par Atlas</h2><p>${files.length} sauvegarde${files.length === 1 ? "" : "s"} trouvée${files.length === 1 ? "" : "s"}. Aucun fichier tiers n’est touché par la rétention.</p></div><button class="secondary compact" type="button" data-action="refresh-backups">${icon("refresh", 14)} Actualiser</button></header>${settings.lastError ? `<div class="notice danger">${icon("alert", 16)} Dernier échec : ${escapeHtml(settings.lastError)}</div>` : ""}${filesMarkup}<div class="health-boundary-note">${icon("info", 16)} Pour restaurer : arrêtez Atlas et exécutez <code>powershell -ExecutionPolicy Bypass -File .\\scripts\\Invoke-AtlasFullBackup.ps1 -Mode Restore -InputPath &lt;fichier&gt;</code>.</div></section>`;
    return renderSettingsShell("backups", "Sauvegardes", "Planification, emplacement, rétention et vérification des sauvegardes complètes chiffrées.", `${scheduleForm}${runForm}${history}`);
  }

  function renderUpdatesSettingsPage() {
    if (!isAdministrator()) return renderProtectedSettingsDenied("Mises à jour");
    if (!state.updateStatus && !state.updateLoading) queueMicrotask(() => loadUpdateStatus());
    const status = state.updateStatus;
    const release = status?.lastCheck;
    const prepared = status?.prepared;
    const job = status?.job;
    const releaseBadge = !release?.available
      ? { className: "muted", label: "Aucune publication" }
      : release.sameVersion
        ? { className: "success", label: "Atlas à jour" }
        : release.updateAvailable
          ? { className: "warning", label: "Mise à jour détectée" }
          : { className: "warning", label: "Version non applicable" };
    const releaseMarkup = release ? `<section class="panel update-release-card"><div class="update-release-heading"><span class="module-hero-icon">${icon(release.sameVersion ? "check" : release.updateAvailable ? "refresh" : "alert", 21)}</span><div><p class="eyebrow">DERNIÈRE VERSION STABLE</p><h2>${escapeHtml(release.name || release.tag || "Aucune version stable")}</h2><p>${release.publishedAt ? `Publiée ${formatDateTime(release.publishedAt)}` : "Aucune publication stable détectée."}</p></div><span class="status-badge ${releaseBadge.className}">${releaseBadge.label}</span></div>${release.notes ? `<pre class="release-notes-preview">${escapeHtml(release.notes)}</pre>` : ""}${release.installBlockedReason && release.available && !prepared ? `<div class="notice">${icon("shield", 16)} ${escapeHtml(release.installBlockedReason)}</div>` : ""}${release.pageUrl ? `<a class="secondary compact" href="${escapeHtml(release.pageUrl)}" target="_blank" rel="noreferrer">Voir la version sur GitHub ${icon("external", 14)}</a>` : ""}</section>` : `<section class="panel update-release-card">${emptyState(state.updateLoading ? "Vérification locale en cours…" : "Aucune vérification GitHub lancée sur cette session.")}</section>`;
    const prepareMarkup = release?.updateAvailable && (!prepared || prepared.targetVersion !== String(release.tag || "").replace(/^v/, ""))
      ? `<section class="panel update-prepare-card"><div><p class="eyebrow">TÉLÉCHARGEMENT CONTRÔLÉ</p><h2>Préparer ${escapeHtml(release.tag)}</h2><p>Télécharge le manifeste, vérifie sa signature Ed25519, puis contrôle la taille et l’empreinte SHA-256 du paquet. Le programme actif et les données ne sont pas modifiés.</p></div><button class="secondary" type="button" data-action="prepare-update" ${state.updateLoading ? "disabled" : ""}>${icon("download", 15)} Télécharger et vérifier</button></section>`
      : "";
    const preparedMarkup = prepared ? `<section class="panel update-prepared-card"><header><div><p class="eyebrow">PAQUET PRÉPARÉ</p><h2>Atlas ${escapeHtml(prepared.targetVersion)}</h2><p>${escapeHtml(prepared.assetName)} · ${formatFileSize(prepared.assetSize)}</p></div><span class="status-badge success">Vérifié</span></header><dl class="security-list"><div><dt>Signature du manifeste</dt><dd>${prepared.signatureVerified ? "Valide" : "Refusée"}</dd></div><div><dt>Empreinte du paquet</dt><dd>${prepared.packageVerified ? "Conforme" : "Refusée"}</dd></div><div><dt>Point de retour arrière</dt><dd>${prepared.rollbackReady ? "Obligatoire à l’installation" : "Indisponible"}</dd></div><div><dt>SHA-256</dt><dd><code>${escapeHtml(prepared.sha256.slice(0, 16))}…</code></dd></div></dl><form data-form="update-apply" class="update-apply-form"><div class="notice warning">${icon("alert", 16)} Atlas sera indisponible brièvement. L’assistant arrêtera le service, prendra un instantané complet, installera la version, vérifiera SQLite et le coffre, puis reviendra automatiquement à la version précédente en cas d’échec.</div><label>Confirmation<input name="confirmation" autocomplete="off" required placeholder="INSTALLER ${escapeHtml(prepared.targetVersion)}"/><small>Saisissez exactement <strong>INSTALLER ${escapeHtml(prepared.targetVersion)}</strong>.</small></label>${settingsAdminMfaMarkup(`Confirmez l’installation de la version ${prepared.targetVersion} et le redémarrage d’Atlas.`, "update-apply")}<p class="form-error" role="alert"></p><button class="primary" type="submit">${icon("refresh", 15)} Installer Atlas ${escapeHtml(prepared.targetVersion)}</button></form></section>` : "";
    const jobMarkup = job ? `<section class="panel update-job-card"><div><p class="eyebrow">DERNIÈRE OPÉRATION</p><h2>${escapeHtml(job.message || "Mise à jour Atlas")}</h2><p>${escapeHtml(job.currentVersion)} → ${escapeHtml(job.targetVersion)} · ${job.updatedAt ? formatDateTime(job.updatedAt) : "état en attente"}</p></div><span class="status-badge ${job.status === "succeeded" ? "success" : job.status === "rolled-back" ? "warning" : ["failed", "rollback-failed"].includes(job.status) ? "danger" : "muted"}">${escapeHtml(job.status || "inconnue")}</span></section>` : "";
    return renderSettingsShell("updates", "Mises à jour", "Vérification cryptographique, installation confirmée et retour arrière automatique.", `<section class="panel update-policy-card"><div><p class="eyebrow">CENTRE DE MISE À JOUR</p><h2>Atlas ${escapeHtml(status?.currentVersion || ATLAS_VERSION)}</h2><p>Atlas contacte uniquement l’API officielle de GitHub lorsque vous cliquez sur Vérifier. Il n’installe jamais une version sans action explicite, MFA et point de retour arrière.</p></div><dl class="security-list"><div><dt>Vérification automatique</dt><dd><span class="status-badge muted">Désactivée</span></dd></div><div><dt>Installation silencieuse</dt><dd><span class="status-badge muted">Interdite</span></dd></div><div><dt>Manifeste Ed25519 + SHA-256</dt><dd>Obligatoires</dd></div><div><dt>Retour arrière</dt><dd>Automatique si la santé échoue</dd></div></dl><button class="primary" type="button" data-action="check-updates" ${state.updateLoading ? "disabled" : ""}>${icon("refresh", 15)} ${state.updateLoading ? "Vérification…" : "Vérifier sur GitHub"}</button></section>${releaseMarkup}${prepareMarkup}${preparedMarkup}${jobMarkup}<div class="health-boundary-note">${icon("shield", 16)} La clé privée de publication n’est jamais incluse dans Atlas. Seule la clé publique de vérification fait partie du paquet.</div>`);
  }

  function renderGeneralSettingsPage() {
    const settings = state.workspace.settings;
    const content = `<form class="settings-dedicated-form" data-form="settings-general"><section class="panel settings-section"><div><p class="eyebrow">INSTANCE</p><h2>${t("general")}</h2><p>Identité affichée uniquement dans cette installation.</p></div><div class="settings-field-stack"><label>Nom affiché de l’instance<input name="instanceName" maxlength="96" value="${escapeHtml(settings.instanceName)}" ${canWrite() ? "" : "disabled"}/><small>Exemple : Atlas – Équipe ABC. Ce nom apparaît dans la navigation.</small></label><label>Langue par défaut<select name="defaultLocale" ${canWrite() ? "" : "disabled"}><option value="fr" ${settings.defaultLocale === "fr" ? "selected" : ""}>Français</option><option value="en" ${settings.defaultLocale === "en" ? "selected" : ""}>English</option></select></label></div></section><p class="form-error" role="alert"></p><div class="settings-save"><span>${canWrite() ? "Ces réglages n’affectent pas les données des compagnies." : "Consultation seulement"}</span>${writeButton(`<button class="primary" type="submit">${t("save")}</button>`)}</div></form>`;
    return renderSettingsShell("general", t("general"), "Nom et langue par défaut de cette instance.", content);
  }

  function renderAppearanceSettingsPage() {
    const content = `<section class="panel settings-section"><div><p class="eyebrow">INTERFACE</p><h2>${t("appearance")}</h2><p>Le choix reste dans ce navigateur et ne quitte pas l’instance.</p></div><div class="theme-choices"><button type="button" class="theme-choice ${state.theme === "light" ? "active" : ""}" data-set-theme="light"><span class="theme-preview light"></span><span>Clair</span></button><button type="button" class="theme-choice ${state.theme === "dark" ? "active" : ""}" data-set-theme="dark"><span class="theme-preview dark"></span><span>Sombre</span></button></div></section>`;
    return renderSettingsShell("appearance", t("appearance"), "Préférence visuelle propre à votre navigateur.", content);
  }

  function renderIntegrationsSettingsPage() {
    if (!isAdministrator()) return renderProtectedSettingsDenied("Intégrations");
    if (!state.localApiStatus && !state.localApiLoading) queueMicrotask(() => loadLocalApiStatus());
    const apiStatus = state.localApiStatus || { enabled: false, webhooksEnabled: false, tokens: [], webhooks: [] };
    const activeTokens = (apiStatus.tokens || []).filter((token) => !token.revokedAt);
    const tokenRows = (apiStatus.tokens || []).length ? `<div class="local-api-token-list">${apiStatus.tokens.map((token) => `<article class="${token.revokedAt ? "revoked" : ""}"><div><strong>${escapeHtml(token.label)}</strong><small>${escapeHtml((token.scopes || []).join(" · "))}</small><small>${token.organizationIds === null ? "Toutes les compagnies" : `${token.organizationIds?.length || 0} compagnie(s)`} · créé ${formatDateTime(token.createdAt)}${token.lastUsedAt ? ` · utilisé ${formatDateTime(token.lastUsedAt)}` : ""}</small></div>${token.revokedAt ? '<span class="status-badge muted">Révoqué</span>' : `<form data-form="local-api-token-revoke" data-id="${escapeHtml(token.id)}"><label>Code MFA<input name="adminMfaCode" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="000000" ${state.workspace.settings.security.privilegedMfaEnabled ? "required" : ""}/></label><button class="danger secondary compact" type="submit">Révoquer</button><p class="form-error" role="alert"></p></form>`}</article>`).join("")}</div>` : emptyState("Aucun jeton API n’a été créé.");
    const organizationOptions = state.workspace.organizations.map((organization) => `<label class="permission-switch compact"><input type="checkbox" name="organizationIds" value="${escapeHtml(organization.id)}"/><span><strong>${escapeHtml(organization.name)}</strong><small>${escapeHtml(organization.code || "Sans code")}</small></span></label>`).join("");
    const oneTimeToken = state.createdApiToken ? `<div class="notice success local-api-secret"><div><strong>Copiez ce jeton maintenant.</strong><span>Il ne sera plus affiché après fermeture de ce message.</span><code>${escapeHtml(state.createdApiToken)}</code></div><div><button class="secondary compact" type="button" data-action="copy-local-api-token">${icon("copy", 14)} Copier</button><button class="secondary compact" type="button" data-action="clear-local-api-token">Masquer</button></div></div>` : "";
    const webhookRows = (apiStatus.webhooks || []).length ? `<div class="local-api-token-list">${apiStatus.webhooks.map((webhook) => `<article><div><strong>${escapeHtml(webhook.label)}</strong><small>${escapeHtml(webhook.url)}</small><small>${escapeHtml((webhook.events || []).join(" · "))}${webhook.lastDeliveryAt ? ` · dernier essai ${formatDateTime(webhook.lastDeliveryAt)} (${webhook.lastStatus || "échec"})` : ""}</small>${webhook.lastError ? `<small class="danger-text">${escapeHtml(webhook.lastError)}</small>` : ""}</div><div class="webhook-actions"><form data-form="local-webhook-test" data-id="${escapeHtml(webhook.id)}"><label>Code MFA<input name="adminMfaCode" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="000000" ${state.workspace.settings.security.privilegedMfaEnabled ? "required" : ""}/></label><button class="secondary compact" type="submit">Tester</button><p class="form-error" role="alert"></p></form><form data-form="local-webhook-remove" data-id="${escapeHtml(webhook.id)}"><label>Code MFA<input name="adminMfaCode" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="000000" ${state.workspace.settings.security.privilegedMfaEnabled ? "required" : ""}/></label><button class="danger secondary compact" type="submit">Retirer</button><p class="form-error" role="alert"></p></form></div></article>`).join("")}</div>` : emptyState("Aucun webhook local configuré.");
    const webhookSecret = state.createdWebhookSecret ? `<div class="notice success local-api-secret"><div><strong>Secret de signature affiché une seule fois.</strong><span>Le récepteur doit vérifier l’en-tête <code>x-atlas-signature</code>.</span><code>${escapeHtml(state.createdWebhookSecret)}</code></div><div><button class="secondary compact" type="button" data-action="copy-webhook-secret">${icon("copy", 14)} Copier</button><button class="secondary compact" type="button" data-action="clear-webhook-secret">Masquer</button></div></div>` : "";
    const webhookSection = `<div class="local-webhook-section"><div><p class="eyebrow">WEBHOOKS LOCAUX</p><h3>Automatisations sur cette VM</h3><p>Les destinations sont strictement limitées à <code>localhost</code>, <code>127.0.0.1</code> ou <code>::1</code>, avec un port explicite. Atlas ne contacte ni le LAN ni Internet.</p></div>${webhookSecret}<div class="local-api-columns"><form data-form="local-webhook-create"><label>Nom du webhook<input name="label" maxlength="80" placeholder="Ex. orchestrateur local" required/></label><label>URL de boucle locale<input name="url" type="url" maxlength="500" placeholder="http://127.0.0.1:9100/atlas" required/></label><fieldset><legend>Événements</legend><label><input type="checkbox" name="events" value="workspace.updated"/> Documentation modifiée</label><label><input type="checkbox" name="events" value="backup.completed"/> Sauvegarde réussie</label><label><input type="checkbox" name="events" value="backup.failed"/> Sauvegarde échouée</label></fieldset>${settingsAdminMfaMarkup("La destination et le secret de signature sont protégés localement.", "local-webhook-create")}<p class="form-error" role="alert"></p><button class="primary" type="submit">Créer le webhook</button></form><div>${webhookRows}</div></div></div>`;
    const localApi = `<section class="panel local-api-settings"><header><div><p class="eyebrow">API LOCALE FACULTATIVE</p><h2>Accès en lecture, limité et révocable</h2><p>Les jetons ne donnent jamais accès aux secrets du coffre. Ils sont désactivés par défaut et leur valeur n’est affichée qu’une fois.</p></div><span class="status-badge ${apiStatus.enabled || apiStatus.webhooksEnabled ? "success" : "muted"}">${apiStatus.enabled || apiStatus.webhooksEnabled ? "Partiellement active" : "Désactivée"}</span></header>${apiStatus.error ? `<div class="notice danger">${escapeHtml(apiStatus.error)}</div>` : ""}<form class="local-api-enable-form" data-form="settings-local-api"><div><label class="permission-switch"><input name="enabled" type="checkbox" ${apiStatus.enabled ? "checked" : ""}/><span><strong>Activer l’API locale</strong><small>Expose uniquement les routes <code>/api/v1</code> sur le même port qu’Atlas; aucun port supplémentaire.</small></span></label><label class="permission-switch"><input name="webhooksEnabled" type="checkbox" ${apiStatus.webhooksEnabled ? "checked" : ""}/><span><strong>Activer les webhooks locaux</strong><small>Livraison signée uniquement vers la boucle locale de cette VM.</small></span></label></div>${settingsAdminMfaMarkup("Confirmez avant d’activer ou de désactiver l’API locale ou les webhooks.", "local-api-enable")}<p class="form-error" role="alert"></p><button class="primary" type="submit">Enregistrer l’état</button></form>${oneTimeToken}<div class="local-api-columns"><form data-form="local-api-token-create"><p class="eyebrow">NOUVEAU JETON</p><h3>Portées minimales</h3><label>Nom du jeton<input name="label" maxlength="80" placeholder="Ex. inventaire local" required/></label><fieldset><legend>Portées autorisées</legend><label><input type="checkbox" name="scopes" value="read:health"/> Santé locale</label><label><input type="checkbox" name="scopes" value="read:organizations"/> Liste des compagnies</label><label><input type="checkbox" name="scopes" value="read:records"/> Métadonnées des fiches</label></fieldset><label class="permission-switch compact"><input type="checkbox" name="allOrganizations" checked/><span><strong>Toutes les compagnies</strong><small>Décochez puis choisissez une portée précise ci-dessous.</small></span></label><div class="local-api-org-scope">${organizationOptions || "Aucune compagnie disponible."}</div>${settingsAdminMfaMarkup("La création d’un jeton est une action sensible.", "local-api-token")}<p class="form-error" role="alert"></p><button class="primary" type="submit">Créer le jeton</button></form><div><p class="eyebrow">JETONS</p><h3>${activeTokens.length} actif${activeTokens.length === 1 ? "" : "s"}</h3>${tokenRows}</div></div><div class="health-boundary-note">${icon("shield", 16)} Les jetons sont stockés sous forme d’empreinte SHA-256, sont limités à la lecture et n’incluent jamais mots de passe, codes OTP, notes rapides, pièces jointes ni données MFA.</div>${webhookSection}</section>`;
    const content = `<section class="panel settings-section"><div><p class="eyebrow">FACULTATIF</p><h2>${t("integrations")}</h2><p>Le connecteur et le SSO via TRC RMM sont indépendants et désactivés par défaut.</p></div><div><div class="integration-setting"><div class="integration-logo">R</div><div><strong>TRC Community RMM</strong><p>Synchronisation d’inventaire et navigation entre fiches.</p></div><span class="status-badge muted">${t("notConfigured")}</span></div><div class="integration-setting"><div class="integration-logo oidc">ID</div><div><strong>SSO facultatif via TRC RMM</strong><p>Option prévue à la fin du projet; les comptes et rôles Atlas restent locaux.</p></div><span class="status-badge muted">À venir</span></div><div class="notice">${icon("alert", 17)} Atlas reste autonome. Ces options demeurent inactives jusqu’à la validation de leurs contrats de sécurité.</div></div></section>${localApi}`;
    return renderSettingsShell("integrations", t("integrations"), "Connexions facultatives et API locale de cette instance.", content);
  }

  function renderSecuritySettingsPage() {
    if (!isAdministrator()) return renderProtectedSettingsDenied("Sécurité locale");
    const settings = state.workspace.settings;
    const content = `<form class="settings-dedicated-form" data-form="settings-security"><section class="panel settings-section security-policy-section"><div><p class="eyebrow">POLITIQUES DE SÉCURITÉ</p><h2>${t("security")}</h2><p>Le MFA de connexion reste obligatoire. Les contrôles renforcés et les rappels du coffre peuvent être adaptés à votre politique interne.</p></div><div><div class="security-policy-controls"><label class="permission-switch"><input name="privilegedMfaEnabled" type="checkbox" ${settings.security.privilegedMfaEnabled ? "checked" : ""}/><span><strong>MFA renforcé pour les actions sensibles</strong><small>Exige un code MFA actuel pour les opérations administratives protégées.</small></span></label><label class="permission-switch"><input name="passwordRotationEnabled" type="checkbox" data-rotation-policy ${settings.security.passwordRotationEnabled ? "checked" : ""}/><span><strong>Expiration et rappels de rotation</strong><small>Affiche les échéances et alertes sans modifier automatiquement les secrets.</small></span></label><div class="security-policy-numbers ${settings.security.passwordRotationEnabled ? "" : "disabled"}" data-rotation-options><label>Rotation par défaut (jours)<input name="passwordRotationDays" type="number" min="1" max="730" value="${settings.security.passwordRotationDays}" ${settings.security.passwordRotationEnabled ? "" : "disabled"}/></label><label>Rappel avant échéance (jours)<input name="passwordRotationReminderDays" type="number" min="1" max="180" value="${settings.security.passwordRotationReminderDays}" ${settings.security.passwordRotationEnabled ? "" : "disabled"}/></label></div></div><dl class="security-list"><div><dt>Compte actif</dt><dd>${escapeHtml(state.user.username)}</dd></div><div><dt>Rôle</dt><dd>Super administrateur Atlas</dd></div><div><dt>MFA de connexion</dt><dd><span class="status-badge success">Obligatoire</span></dd></div><div><dt>Durée de session</dt><dd>8 heures</dd></div><div><dt>Architecture</dt><dd><code>Autonome · aucune dépendance TRC Account</code></dd></div></dl></div></section>${settingsAdminMfaMarkup("Confirmez avec le code MFA actuel avant de modifier une politique de sécurité.")}<p class="form-error" role="alert"></p><div class="settings-save"><span>Les modifications sont journalisées localement.</span><button class="primary" type="submit" ${state.saving ? "disabled" : ""}>${state.saving ? "Enregistrement…" : "Enregistrer la sécurité"}</button></div></form>`;
    return renderSettingsShell("security", "Sécurité locale", "Politiques protégées propres à cette instance Atlas.", content);
  }

  function renderSettings() {
    const page = activeSettingsPage();
    if (page === "deployment") return renderDeploymentSettingsPage();
    if (page === "health") return isAdministrator() ? renderSettingsShell("health", "Santé du site", "Diagnostics réservés au super administrateur Atlas.", renderDeploymentHealthSection(state.workspace.settings)) : renderProtectedSettingsDenied("Santé du site");
    if (page === "security") return renderSecuritySettingsPage();
    if (page === "backups") return renderBackupSettingsPage();
    if (page === "updates") return renderUpdatesSettingsPage();
    if (page === "general") return renderGeneralSettingsPage();
    if (page === "appearance") return renderAppearanceSettingsPage();
    if (page === "integrations") return renderIntegrationsSettingsPage();
    return renderSettingsOverview();
  }

  function renderLocalUsers() {
    if (!isAdministrator()) return "";
    const pendingMfa = state.users.filter((user) => !user.mfaEnabled && user.enabled).length;
    return `<section class="panel account-launch-card" id="settings-accounts"><span class="module-hero-icon">${icon("users", 22)}</span><div><p class="eyebrow">COMPTES LOCAUX</p><h2>Comptes et accès</h2><p>${state.users.length} compte${state.users.length === 1 ? "" : "s"}, dont ${pendingMfa} en attente d’activation MFA. Gérez séparément le rôle documentaire, les compagnies et l’accès au coffre.</p></div><button class="secondary" type="button" data-route="accounts">Ouvrir la gestion ${icon("chevron", 14)}</button></section>`;
  }

  function accountOrganizationLabel(user) {
    if (user.organizationIds === null) return "Toutes les compagnies";
    if (!user.organizationIds?.length) return "Aucune compagnie";
    if (user.organizationIds.length === 1) return orgName(user.organizationIds[0]);
    const editors = (user.organizationPermissions || []).filter((permission) => permission.role === "editor").length;
    return `${user.organizationIds.length} compagnies · ${editors} en édition`;
  }

  function accountRoleLabel(user) {
    if (!user.organizationPermissions?.length) return roleLabel(user.role);
    const roles = new Set(user.organizationPermissions.map((permission) => permission.role));
    return roles.size > 1 ? "Accès mixtes" : roleLabel([...roles][0] || user.role);
  }

  function accountVaultLabel(user) {
    if (!user.organizationPermissions?.length) return user.vaultAccess ? "Autorisé" : "Masqué";
    const allowed = user.organizationPermissions.filter((permission) => permission.vaultAccess).length;
    return allowed ? `${allowed}/${user.organizationPermissions.length} compagnies` : "Masqué";
  }

  function renderAccounts() {
    if (!isAdministrator()) return `<div class="page">${pageHeader("Accès refusé", "Un administrateur local est requis pour gérer les comptes.")}</div>`;
    const activeUsers = state.users.filter((user) => user.enabled).length;
    const pendingMfa = state.users.filter((user) => user.enabled && !user.mfaEnabled).length;
    const vaultUsers = state.users.filter((user) => user.enabled && (user.vaultAccess || user.organizationPermissions?.some((permission) => permission.vaultAccess))).length;
    return `<div class="page accounts-page">
      ${pageHeader("Comptes et accès", "Gestion autonome des utilisateurs Atlas, des compagnies autorisées et du coffre de mots de passe.", `<button class="primary" type="button" data-action="new-user">${icon("plus", 15)} Nouveau compte</button>`)}
      <section class="account-metrics" aria-label="Résumé des comptes"><article><span>${icon("users", 19)}</span><div><strong>${state.users.length}</strong><small>Comptes locaux</small></div></article><article><span>${icon("check", 19)}</span><div><strong>${activeUsers}</strong><small>Comptes actifs</small></div></article><article class="${pendingMfa ? "warning" : ""}"><span>${icon("shield", 19)}</span><div><strong>${pendingMfa}</strong><small>MFA à activer</small></div></article><article><span>${icon("key", 19)}</span><div><strong>${vaultUsers}</strong><small>Accès au coffre</small></div></article></section>
      <section class="panel permission-guide"><div><p class="eyebrow">MODÈLE D’ACCÈS</p><h2>Deux droits indépendants</h2><p>Le rôle contrôle les modifications de documentation. L’accès au coffre autorise ou masque les mots de passe, même pour un compte en lecture seule.</p></div><div class="permission-profile-grid"><article><strong>Lecture seule</strong><span>Consulter la documentation autorisée.</span></article><article><strong>Édition</strong><span>Créer et modifier les fiches autorisées.</span></article><article><strong>Accès coffre</strong><span>Voir les métadonnées et révéler les secrets.</span></article><article><strong>Administrateur</strong><span>Toutes les compagnies, le coffre et la gestion locale.</span></article></div></section>
      <section class="table-card account-access-table"><div class="table-scroll"><table><thead><tr><th>Compte</th><th>Documentation</th><th>Compagnies</th><th>Mots de passe</th><th>MFA</th><th>Sessions</th><th></th></tr></thead><tbody>${state.users.map((user) => { const vaultAllowed = user.vaultAccess || user.organizationPermissions?.some((permission) => permission.vaultAccess); return `<tr class="${user.enabled ? "" : "disabled-row"}"><td data-label="Compte"><div class="table-primary"><span class="avatar small">${initials(user.displayName)}</span><span><strong>${escapeHtml(user.displayName)}</strong><small>@${escapeHtml(user.username)} · ${user.enabled ? "Actif" : "Désactivé"}</small></span></div></td><td data-label="Documentation"><span class="permission-badge ${user.role}">${escapeHtml(accountRoleLabel(user))}</span></td><td data-label="Compagnies"><span class="scope-access" title="${escapeHtml((user.organizationIds || []).map(orgName).join(", "))}">${escapeHtml(accountOrganizationLabel(user))}</span></td><td data-label="Mots de passe"><span class="status-badge ${vaultAllowed ? "success" : "muted"}">${escapeHtml(accountVaultLabel(user))}</span></td><td data-label="MFA"><span class="status-badge ${user.mfaEnabled ? "success" : "warning"}">${user.mfaEnabled ? "Activé" : "Obligatoire à la connexion"}</span></td><td data-label="Sessions"><span class="session-count">${user.activeSessions || 0} active${user.activeSessions === 1 ? "" : "s"}</span></td><td data-label="Actions">${user.id === state.user.id ? '<span class="self-label">Session actuelle</span>' : `<details class="account-actions-menu"><summary aria-label="Actions pour ${escapeHtml(user.displayName)}">${icon("more", 18)}</summary><div><button type="button" data-action="edit-user" data-id="${user.id}">${icon("edit", 15)} Modifier les accès</button><button type="button" data-action="reset-user-password" data-id="${user.id}">${icon("key", 15)} Nouveau mot de passe</button><button type="button" data-action="reset-user-mfa" data-id="${user.id}" ${!user.mfaEnabled ? "disabled" : ""}>${icon("shield", 15)} Réinitialiser le MFA</button><button type="button" data-action="revoke-user-sessions" data-id="${user.id}" ${!user.activeSessions ? "disabled" : ""}>${icon("logout", 15)} Fermer les sessions</button><button class="danger" type="button" data-action="toggle-user" data-id="${user.id}">${icon(user.enabled ? "lock" : "check", 15)} ${user.enabled ? "Désactiver" : "Réactiver"}</button></div></details>`}</td></tr>`; }).join("")}</tbody></table></div></section>
    </div>`;
  }

  function sessionDeviceLabel(userAgent) {
    const value = String(userAgent || "");
    const browser = /Edg\//.test(value) ? "Microsoft Edge" : /Chrome\//.test(value) ? "Chrome" : /Firefox\//.test(value) ? "Firefox" : /Safari\//.test(value) ? "Safari" : "Navigateur";
    const platform = /Windows/i.test(value) ? "Windows" : /Macintosh|Mac OS/i.test(value) ? "macOS" : /Linux/i.test(value) ? "Linux" : "Appareil inconnu";
    return `${browser} · ${platform}`;
  }

  function renderMyAccount() {
    return `<div class="page my-account-page">
      ${pageHeader("Mon compte", "Sécurité, mot de passe, MFA et sessions de votre compte Atlas local.", isAdministrator() ? `<button class="secondary" type="button" data-route="settings">${icon("settings", 15)} Paramètres de l’instance</button>` : "")}
      <section class="account-profile-hero panel"><span class="avatar account-profile-avatar">${initials(state.user.displayName)}</span><div><p class="eyebrow">COMPTE LOCAL</p><h2>${escapeHtml(state.user.displayName)}</h2><p>@${escapeHtml(state.user.username)} · ${escapeHtml(roleLabel(state.user.role))}</p></div><span class="status-badge success">${icon("shield", 14)} MFA actif</span></section>
      <div class="account-self-grid">
        <form class="panel account-self-card" data-form="self-password"><div><p class="eyebrow">MOT DE PASSE</p><h2>Changer mon mot de passe</h2><p>Les autres sessions seront fermées automatiquement.</p></div><label>Mot de passe actuel<input name="currentPassword" type="password" autocomplete="current-password" required /></label><label>Nouveau mot de passe<input name="password" type="password" autocomplete="new-password" minlength="10" maxlength="256" required /></label><label>Confirmer<input name="confirmPassword" type="password" autocomplete="new-password" minlength="10" maxlength="256" required /></label><label>Code MFA actuel<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required /></label><div class="form-error" role="alert"></div><button class="primary" type="submit">Mettre à jour</button></form>
        <section class="panel account-self-card"><div><p class="eyebrow">RÉCUPÉRATION</p><h2>MFA et codes de secours</h2><p>Renouvelez les codes perdus ou remplacez votre application d’authentification.</p></div><div class="account-self-actions"><button class="secondary" type="button" data-action="regenerate-recovery-codes">${icon("refresh", 15)} Nouveaux codes de récupération</button><button class="secondary" type="button" data-action="reenroll-own-mfa">${icon("shield", 15)} Remplacer mon MFA</button></div><div class="notice">${icon("alert", 16)} Les anciens codes ou l’ancien secret MFA deviennent invalides dès la confirmation.</div></section>
      </div>
      <section class="panel account-sessions"><header><div><p class="eyebrow">SESSIONS</p><h2>Appareils connectés</h2><p>${state.sessions.length} session${state.sessions.length === 1 ? "" : "s"} active${state.sessions.length === 1 ? "" : "s"}; chaque session expire au plus tard après 8 heures.</p></div><button class="secondary compact" type="button" data-action="refresh-sessions">${icon("refresh", 14)} Actualiser</button></header><div class="session-list">${state.sessions.length ? state.sessions.map((session) => `<article class="${session.current ? "current" : ""}"><span class="session-device-icon">${icon("server", 18)}</span><div><strong>${escapeHtml(sessionDeviceLabel(session.userAgent))}</strong><small>${escapeHtml(session.ip)} · activité ${formatDateTime(session.lastSeenAt)} · expiration ${formatDateTime(session.expiresAt)}</small></div>${session.current ? '<span class="status-badge success">Session actuelle</span>' : `<button class="secondary compact danger" type="button" data-action="revoke-own-session" data-id="${escapeHtml(session.id)}">Fermer</button>`}</article>`).join("") : emptyState("Aucune session active trouvée.")}</div></section>
    </div>`;
  }

  function organizationFilter(inline = false) {
    const control = `<label>${t("organization")}<select data-filter="organization"><option value="all">${t("all")}</option>${state.workspace.organizations.map((org) => `<option value="${org.id}" ${state.filter === org.id ? "selected" : ""}>${escapeHtml(organizationPathLabel(org.id))}</option>`).join("")}</select></label>`;
    return inline ? control : `<div class="toolbar filters">${control}</div>`;
  }

  function filteredByOrganization(items) {
    const organizationId = activeOrganizationId();
    return organizationId ? items.filter((item) => item.organizationId === organizationId) : [];
  }

  function filteredConfigurations() {
    const items = filteredByOrganization(state.workspace.configurations);
    if (state.filter === "critical") return items.filter((item) => item.criticality === "critical");
    if (state.filter === "review") return items.filter((item) => item.status === "review" || item.status === "draft");
    return items;
  }

  function paginate(items, pageSize = 25) {
    const pages = Math.max(1, Math.ceil(items.length / pageSize));
    const current = Math.min(Math.max(1, state.listPage), pages);
    if (current !== state.listPage) state.listPage = current;
    const start = (current - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), total: items.length, page: current, pages, start: items.length ? start + 1 : 0, end: Math.min(start + pageSize, items.length) };
  }

  function paginationMarkup(page) {
    if (page.pages <= 1) return `<div class="table-pagination single"><span>${page.total} résultat${page.total === 1 ? "" : "s"}</span></div>`;
    return `<div class="table-pagination"><span>${page.start}–${page.end} sur ${page.total}</span><div><button class="secondary compact" data-action="list-page" data-page="${page.page - 1}" ${page.page <= 1 ? "disabled" : ""}>Précédent</button><strong>Page ${page.page} / ${page.pages}</strong><button class="secondary compact" data-action="list-page" data-page="${page.page + 1}" ${page.page >= page.pages ? "disabled" : ""}>Suivant</button></div></div>`;
  }

  function orgName(id) {
    return state.workspace.organizations.find((item) => item.id === id)?.name || "—";
  }

  function siteName(id) {
    return state.workspace.sites.find((item) => item.id === id)?.name || "—";
  }

  function configById(id) {
    return state.workspace.configurations.find((item) => item.id === id);
  }

  function initials(value) {
    return String(value || "A").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return escapeHtml(value);
    return new Intl.DateTimeFormat(state.locale === "fr" ? "fr-CA" : "en-CA", { year: "numeric", month: "short", day: "numeric" }).format(date);
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat(state.locale === "fr" ? "fr-CA" : "en-CA", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function formatFileSize(value) {
    const bytes = Number(value) || 0;
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }

  function criticalityLabel(value) {
    return ({ critical: "Critique", high: "Élevée", normal: "Normale", low: "Faible" })[value] || value;
  }

  function statusLabel(value) {
    return ({ documented: "Documentée", review: "À réviser", draft: "Brouillon" })[value] || value;
  }

  function recordStatusLabel(value) {
    return ({ active: "Active", review: "À réviser", archived: "Archivée" })[value] || value;
  }

  function moduleRecordSubtitle(record, module) {
    if (module.id === "checklists" && record.checklist?.length) return `${record.checklist.filter((step) => step.done).length}/${record.checklist.length} étapes terminées`;
    if (module.id === "domain-tracker") return [record.reference, record.details?.dnsProvider].filter(Boolean).join(" · ") || "Domaine sans registraire renseigné";
    if (module.id === "ssl-tracker") return [record.reference, record.details?.hosts].filter(Boolean).join(" · ") || "Certificat sans émetteur renseigné";
    if (module.id === "contacts") return [record.reference, record.details?.role].filter(Boolean).join(" · ") || "Contact";
    if (module.id === "documents") return [record.details?.documentType, record.details?.version].filter(Boolean).join(" · ") || "Document";
    return record.summary || module.label;
  }

  function roleLabel(value) {
    return ({ administrator: "Administrateur", editor: "Éditeur", viewer: "Lecture seule" })[value] || value;
  }

  function activityRow(entry) {
    return `<div class="timeline-row"><span class="timeline-dot ${entry.kind}"></span><div><strong>${escapeHtml(entry.action)}</strong><span>${escapeHtml(entry.target)}</span><small>${escapeHtml(entry.actor)} · ${formatDateTime(entry.at)}</small></div></div>`;
  }

  function emptyState(message) {
    return `<div class="empty-state">${icon("book", 24)}<p>${escapeHtml(message)}</p></div>`;
  }

  function slug(value) {
    return String(value || "item").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "item";
  }

  function uniqueId(prefix, label, collection) {
    const base = `${prefix}-${slug(label)}`;
    let id = base;
    let count = 2;
    while (collection.some((item) => item.id === id)) id = `${base}-${count++}`;
    return id;
  }

  function relationshipTypeById(id) {
    return relationshipTypes.find((type) => type.id === id) || relationshipTypes.at(-1);
  }

  function relationshipTypeIdFromLabel(label) {
    const value = normalizeSearch(label);
    const aliases = {
      "depend de": "depends-on", "sauvegarde vers": "backed-up-to",
      "protege": "protected-by", "dessert": "connected-to", "heberge": "hosted-on", "administre avec": "managed-with",
      "procedure associee": "procedure-associated", "mentionne": "mentions", "associe a": "related-to",
    };
    return aliases[value] || relationshipTypes.find((type) => [normalizeSearch(type.label), normalizeSearch(type.reverseLabel)].includes(value))?.id || "custom";
  }

  function assetRef(type, id) {
    return `${type}:${id}`;
  }

  function assetRegistry(organizationId = "") {
    if (!state.workspace) return [];
    const assets = [];
    for (const item of state.workspace.sites) assets.push({ ref: assetRef("site", item.id), type: "site", id: item.id, organizationId: item.organizationId, label: item.name, kind: "Site", icon: "pin", subtitle: item.address || "Adresse non renseignée", status: item.status, archived: item.status === "archived", editAction: "edit-site", raw: item });
    for (const item of state.workspace.configurations) assets.push({ ref: assetRef("configuration", item.id), type: "configuration", id: item.id, organizationId: item.organizationId, label: item.name, kind: "Configuration", icon: "server", subtitle: `${item.type} · ${item.os || "Système non renseigné"}`, status: item.status, archived: item.status === "archived", editAction: "edit-configuration", route: `configuration/${item.id}`, raw: item });
    for (const item of state.workspace.procedures) assets.push({ ref: assetRef("procedure", item.id), type: "procedure", id: item.id, organizationId: item.organizationId, label: item.title, kind: "Procédure", icon: "book", subtitle: `${item.category} · ${item.owner || "Responsable non assigné"}`, status: item.status, archived: item.status === "archived", editAction: "edit-procedure", raw: item });
    for (const item of state.workspace.moduleRecords) {
      const module = moduleMap.get(item.moduleId);
      if (!module) continue;
      assets.push({ ref: assetRef("module", item.id), type: "module", id: item.id, moduleId: item.moduleId, organizationId: item.organizationId, label: item.title, kind: module.label, icon: module.icon, subtitle: item.summary || module.label, status: item.status, archived: item.status === "archived", editAction: "edit-module-record", route: `module/${item.moduleId}`, raw: item });
    }
    for (const item of state.vaultItems) assets.push({ ref: assetRef("vault", item.id), type: "vault", id: item.id, organizationId: item.organizationId, label: item.title, kind: "Mot de passe", icon: "key", subtitle: item.category || "Général", status: item.archived ? "archived" : "active", archived: Boolean(item.archived), editAction: "edit-vault-item", route: "module/passwords", raw: item });
    return organizationId ? assets.filter((asset) => asset.organizationId === organizationId) : assets;
  }

  function assetByRef(ref) {
    return assetRegistry().find((asset) => asset.ref === ref) || null;
  }

  function assetOptions(organizationId, selected = "", excludedRef = "") {
    const grouped = new Map();
    for (const asset of assetRegistry(organizationId).filter((item) => item.ref !== excludedRef).sort((a, b) => a.kind.localeCompare(b.kind, state.locale) || a.label.localeCompare(b.label, state.locale))) {
      if (!grouped.has(asset.kind)) grouped.set(asset.kind, []);
      grouped.get(asset.kind).push(asset);
    }
    return [...grouped.entries()].map(([kind, assets]) => `<optgroup label="${escapeHtml(kind)}">${assets.map((asset) => `<option value="${escapeHtml(asset.ref)}" ${asset.ref === selected ? "selected" : ""}>${escapeHtml(asset.label)}${asset.archived ? " — archivé" : ""}</option>`).join("")}</optgroup>`).join("");
  }

  function resetQuickRelationPicker() {
    state.relationQuickAddRef = "";
    state.relationQuickQuery = "";
    state.relationQuickType = "related-to";
    state.relationQuickFiltersOpen = false;
  }

  function relationAlreadyExists(sourceRef, targetRef, relationType) {
    const type = relationshipTypeById(relationType);
    return state.workspace.relations.some((relation) => {
      if (relation.archived || relation.relationType !== relationType) return false;
      if (relation.sourceRef === sourceRef && relation.targetRef === targetRef) return true;
      return !type.directional && relation.sourceRef === targetRef && relation.targetRef === sourceRef;
    });
  }

  function quickRelationResultsMarkup(sourceRef, rawQuery = state.relationQuickQuery) {
    const source = assetByRef(sourceRef);
    if (!source) return `<p class="relation-quick-empty">La fiche source n’existe plus.</p>`;
    const query = normalizeSearch(rawQuery);
    const candidates = assetRegistry(source.organizationId).filter((asset) => asset.ref !== sourceRef);
    if (!query) return `<div class="relation-quick-hint">${icon("search", 17)}<span><strong>${candidates.length} éléments disponibles</strong>Tapez un nom, un type, une catégorie ou un identifiant.</span></div>`;
    const matches = candidates.filter((asset) => normalizeSearch([asset.label, asset.kind, asset.subtitle, asset.ref].join(" ")).includes(query)).sort((a, b) => {
      const aLabel = normalizeSearch(a.label); const bLabel = normalizeSearch(b.label);
      return Number(aLabel !== query) - Number(bLabel !== query)
        || Number(!aLabel.startsWith(query)) - Number(!bLabel.startsWith(query))
        || a.kind.localeCompare(b.kind, state.locale)
        || a.label.localeCompare(b.label, state.locale);
    });
    if (!matches.length) return `<p class="relation-quick-empty">Aucun élément trouvé dans ${escapeHtml(orgName(source.organizationId))}.</p>`;
    const visible = matches.slice(0, 50);
    return `<div class="relation-quick-results" role="listbox" aria-label="Éléments disponibles">${visible.map((asset, index) => {
      const exists = relationAlreadyExists(sourceRef, asset.ref, state.relationQuickType);
      return `<button id="relation-quick-result-${index}" type="button" role="option" data-action="quick-relate-item" data-source-ref="${escapeHtml(sourceRef)}" data-target-ref="${escapeHtml(asset.ref)}" ${exists ? "disabled" : ""}><span class="relation-quick-result-icon">${icon(asset.icon, 17)}</span><span class="relation-quick-result-copy"><strong>${escapeHtml(asset.label)}</strong><small>${escapeHtml(asset.subtitle || asset.ref)}</small></span><span class="relation-quick-result-kind">${escapeHtml(asset.kind)}${asset.archived ? " · Archivé" : ""}${exists ? " · Déjà lié" : ""}</span></button>`;
    }).join("")}</div>${matches.length > visible.length ? `<p class="relation-quick-limit">50 résultats sur ${matches.length} — précisez la recherche.</p>` : ""}`;
  }

  function quickRelationPickerMarkup(asset) {
    const type = relationshipTypeById(state.relationQuickType);
    return `<div class="relation-quick-add" data-relation-quick-root data-source-ref="${escapeHtml(asset.ref)}">
      <div class="relation-quick-toolbar">
        <span class="relation-quick-scope" title="${escapeHtml(orgName(asset.organizationId))}">${icon("home", 16)}</span>
        <label class="relation-quick-search"><span class="sr-only">Rechercher un élément à relier</span>${icon("search", 15)}<input type="search" data-relation-quick-search value="${escapeHtml(state.relationQuickQuery)}" placeholder="Rechercher dans ${escapeHtml(orgName(asset.organizationId))}…" autocomplete="off" aria-controls="relation-quick-results" aria-expanded="${Boolean(state.relationQuickQuery)}" /></label>
        <button class="relation-quick-tool ${state.relationQuickFiltersOpen ? "active" : ""}" type="button" data-action="toggle-relation-quick-filters" aria-label="Choisir le type de relation" aria-expanded="${state.relationQuickFiltersOpen}">${icon("filter", 17)}</button>
        <button class="relation-quick-tool" type="button" data-action="clear-relation-quick-search" aria-label="Effacer la recherche">${icon("close", 16)}</button>
      </div>
      ${state.relationQuickFiltersOpen ? `<div class="relation-quick-filters"><label>Type de relation<select data-relation-quick-type>${relationshipTypes.filter((entry) => entry.id !== "custom").map((entry) => `<option value="${entry.id}" ${entry.id === state.relationQuickType ? "selected" : ""}>${escapeHtml(entry.label)}</option>`).join("")}</select></label><p>${escapeHtml(type.label)} ↔ ${escapeHtml(type.reverseLabel)}. Le lien inverse est automatique.</p></div>` : ""}
      <div id="relation-quick-results" data-relation-quick-results>${quickRelationResultsMarkup(asset.ref)}</div>
    </div>`;
  }

  function renderQuickRelationResults(sourceRef) {
    const container = document.querySelector("[data-relation-quick-results]");
    if (container) container.innerHTML = quickRelationResultsMarkup(sourceRef);
  }

  function relationLabelFor(relation, currentRef) {
    return currentRef === relation.sourceRef ? relation.label : relation.reverseLabel || relationshipTypeById(relation.relationType).reverseLabel;
  }

  function relationsForAsset(ref, includeArchived = true) {
    return state.workspace.relations.filter((relation) => (includeArchived || !relation.archived) && (relation.sourceRef === ref || relation.targetRef === ref));
  }

  function otherAssetForRelation(relation, ref) {
    return assetByRef(relation.sourceRef === ref ? relation.targetRef : relation.sourceRef);
  }

  function relationshipEventsForAsset(ref) {
    return (state.workspace.relationshipEvents || []).filter((event) => event.sourceRef === ref || event.targetRef === ref).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  }

  function recordRelationshipEvent(workspace, relation, action) {
    if (!Array.isArray(workspace.relationshipEvents)) workspace.relationshipEvents = [];
    workspace.relationshipEvents.unshift({
      id: `rev-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`, relationId: relation.id, at: new Date().toISOString(),
      actor: state.user?.displayName || "Système", action, sourceRef: relation.sourceRef, targetRef: relation.targetRef,
      relationType: relation.relationType, label: relation.label, organizationId: relation.organizationId,
    });
    workspace.relationshipEvents = workspace.relationshipEvents.slice(0, 1500);
  }

  async function createQuickRelation(sourceRef, targetRef) {
    const source = assetByRef(sourceRef); const target = assetByRef(targetRef);
    if (!source || !target) throw new Error("La source ou la cible n’existe plus.");
    if (source.ref === target.ref) throw new Error("Une fiche ne peut pas être liée à elle-même.");
    if (source.organizationId !== target.organizationId) throw new Error("Une relation doit rester dans une seule organisation.");
    if (relationAlreadyExists(sourceRef, targetRef, state.relationQuickType)) throw new Error("Cette relation existe déjà.");
    const type = relationshipTypeById(state.relationQuickType);
    const item = {
      id: uniqueId("rel", `${sourceRef}-${targetRef}-${type.id}`, state.workspace.relations),
      organizationId: source.organizationId,
      sourceRef,
      targetRef,
      relationType: type.id,
      label: type.label,
      reverseLabel: type.reverseLabel,
      notes: "",
      archived: false,
      autoMention: false,
      createdAt: new Date().toISOString(),
      createdBy: state.user.displayName,
      updatedAt: new Date().toISOString(),
    };
    resetQuickRelationPicker();
    await commit((workspace) => { workspace.relations.push(item); recordRelationshipEvent(workspace, item, "Relation ajoutée"); }, "Relation ajoutée", `${source.label} ↔ ${target.label}`, "relation");
  }

  function assertAssetOrganizationChange(ref, nextOrganizationId) {
    const existing = assetByRef(ref);
    if (!existing || existing.organizationId === nextOrganizationId) return;
    const linkedRelations = relationsForAsset(ref, true);
    if (linkedRelations.length) throw new Error(`Cette fiche possède ${linkedRelations.length} relation(s). Modifiez ces liens avant de changer d’organisation.`);
  }

  function mentionedAssetRefs(value) {
    const refs = new Set();
    for (const match of String(value || "").matchAll(/\[\[@[^|\]]+\|([a-z]+:[a-z0-9-]+)\]\]/gi)) refs.add(match[1]);
    return refs;
  }

  function syncMentionRelations(workspace, sourceRef, organizationId, value) {
    const desired = mentionedAssetRefs(value);
    const existing = workspace.relations.filter((relation) => relation.sourceRef === sourceRef && relation.autoMention === true);
    for (const relation of existing) {
      const shouldRemain = desired.has(relation.targetRef);
      if (shouldRemain && relation.archived) {
        relation.archived = false; relation.updatedAt = new Date().toISOString();
        recordRelationshipEvent(workspace, relation, "Relation @ réactivée");
      } else if (!shouldRemain && !relation.archived) {
        relation.archived = true; relation.updatedAt = new Date().toISOString();
        recordRelationshipEvent(workspace, relation, "Relation @ retirée");
      }
    }
    for (const targetRef of desired) {
      if (targetRef === sourceRef || existing.some((relation) => relation.targetRef === targetRef) || workspace.relations.some((relation) => !relation.archived && ((relation.sourceRef === sourceRef && relation.targetRef === targetRef) || (relation.sourceRef === targetRef && relation.targetRef === sourceRef)))) continue;
      const target = assetByRef(targetRef);
      if (!target || target.organizationId !== organizationId) continue;
      const type = relationshipTypeById("mentions");
      const relation = {
        id: uniqueId("rel", `${sourceRef}-${targetRef}-mention`, workspace.relations), organizationId, sourceRef, targetRef,
        relationType: type.id, label: type.label, reverseLabel: type.reverseLabel, notes: "Créée depuis une mention @ dans le contenu.",
        archived: false, autoMention: true, createdAt: new Date().toISOString(), createdBy: state.user?.displayName || "Système", updatedAt: new Date().toISOString(),
      };
      workspace.relations.push(relation);
      recordRelationshipEvent(workspace, relation, "Relation @ ajoutée");
    }
  }

  function syncFileSharingServerRelations(workspace, item, serverConfigurationIds) {
    const sourceRef = `module:${item.id}`;
    const desired = new Set(serverConfigurationIds
      .filter((id) => workspace.configurations.some((configuration) => configuration.id === id && configuration.organizationId === item.organizationId))
      .map((id) => `configuration:${id}`));
    const existing = workspace.relations.filter((relation) => relation.sourceRef === sourceRef && relation.autoFileSharingServer === true);
    for (const relation of existing) {
      const shouldRemain = desired.has(relation.targetRef);
      if (shouldRemain && relation.archived) {
        relation.archived = false;
        relation.updatedAt = new Date().toISOString();
        recordRelationshipEvent(workspace, relation, "Serveur du partage réactivé");
      } else if (!shouldRemain && !relation.archived) {
        relation.archived = true;
        relation.updatedAt = new Date().toISOString();
        recordRelationshipEvent(workspace, relation, "Serveur retiré du partage");
      }
    }
    const type = relationshipTypeById("hosted-on");
    for (const targetRef of desired) {
      if (existing.some((relation) => relation.targetRef === targetRef)) continue;
      const alreadyLinked = workspace.relations.some((relation) => !relation.archived && ((relation.sourceRef === sourceRef && relation.targetRef === targetRef) || (relation.sourceRef === targetRef && relation.targetRef === sourceRef)));
      if (alreadyLinked) continue;
      const relation = {
        id: uniqueId("rel", `${sourceRef}-${targetRef}-file-sharing`, workspace.relations), organizationId: item.organizationId,
        sourceRef, targetRef, relationType: type.id, label: type.label, reverseLabel: type.reverseLabel,
        notes: "Créée automatiquement depuis le champ Serveurs de la fiche File Sharing.", archived: false,
        autoFileSharingServer: true, createdAt: new Date().toISOString(), createdBy: state.user?.displayName || "Système", updatedAt: new Date().toISOString(),
      };
      workspace.relations.push(relation);
      recordRelationshipEvent(workspace, relation, "Serveur lié au partage");
    }
  }

  function syncConfigurationParentRelation(workspace, item, parentConfigurationId) {
    const sourceRef = `configuration:${item.id}`;
    const parent = workspace.configurations.find((configuration) => configuration.id === parentConfigurationId && configuration.organizationId === item.organizationId && configuration.id !== item.id);
    const targetRef = parent ? `configuration:${parent.id}` : "";
    const existing = workspace.relations.filter((relation) => relation.sourceRef === sourceRef && relation.autoConfigurationParent === true);
    for (const relation of existing) {
      const shouldRemain = Boolean(targetRef) && relation.targetRef === targetRef;
      if (shouldRemain && relation.archived) {
        relation.archived = false;
        relation.updatedAt = new Date().toISOString();
        recordRelationshipEvent(workspace, relation, "Relation avec l’hôte réactivée");
      } else if (!shouldRemain && !relation.archived) {
        relation.archived = true;
        relation.updatedAt = new Date().toISOString();
        recordRelationshipEvent(workspace, relation, "Relation avec l’hôte retirée");
      }
    }
    if (!targetRef || existing.some((relation) => relation.targetRef === targetRef)) return;
    const type = relationshipTypeById("hosted-on");
    const alreadyLinked = workspace.relations.some((relation) => !relation.archived && relation.sourceRef === sourceRef && relation.targetRef === targetRef && relation.relationType === type.id);
    if (alreadyLinked) return;
    const relation = {
      id: uniqueId("rel", `${sourceRef}-${targetRef}-configuration-parent`, workspace.relations), organizationId: item.organizationId,
      sourceRef, targetRef, relationType: type.id, label: type.label, reverseLabel: type.reverseLabel,
      notes: "Créée automatiquement depuis le champ Hôte / configuration parente.", archived: false,
      autoConfigurationParent: true, createdAt: new Date().toISOString(), createdBy: state.user?.displayName || "Système", updatedAt: new Date().toISOString(),
    };
    workspace.relations.push(relation);
    recordRelationshipEvent(workspace, relation, "Configuration liée à son hôte");
  }

  function syncPrintingConfigurationRelations(workspace, item, printServerConfigurationIds, printerConfigurationIds) {
    const sourceRef = `module:${item.id}`;
    const roles = [
      { id: "print-server", ids: printServerConfigurationIds, typeId: "hosted-on", added: "Serveur d’impression lié", removed: "Serveur d’impression retiré", note: "Créée automatiquement depuis le champ Serveur(s) d’impression de la fiche Printing." },
      { id: "printer", ids: printerConfigurationIds, typeId: "connected-to", added: "Imprimante liée", removed: "Imprimante retirée", note: "Créée automatiquement depuis le champ Configuration(s) d’imprimante de la fiche Printing." },
    ];
    for (const role of roles) {
      const desired = new Set(role.ids
        .filter((id) => workspace.configurations.some((configuration) => configuration.id === id && configuration.organizationId === item.organizationId))
        .map((id) => `configuration:${id}`));
      const existing = workspace.relations.filter((relation) => relation.sourceRef === sourceRef && relation.autoPrintingRole === role.id);
      for (const relation of existing) {
        const shouldRemain = desired.has(relation.targetRef);
        if (shouldRemain && relation.archived) {
          relation.archived = false;
          relation.updatedAt = new Date().toISOString();
          recordRelationshipEvent(workspace, relation, `${role.added} de nouveau`);
        } else if (!shouldRemain && !relation.archived) {
          relation.archived = true;
          relation.updatedAt = new Date().toISOString();
          recordRelationshipEvent(workspace, relation, role.removed);
        }
      }
      const type = relationshipTypeById(role.typeId);
      for (const targetRef of desired) {
        if (existing.some((relation) => relation.targetRef === targetRef)) continue;
        const alreadyLinked = workspace.relations.some((relation) => !relation.archived && ((relation.sourceRef === sourceRef && relation.targetRef === targetRef) || (relation.sourceRef === targetRef && relation.targetRef === sourceRef)));
        if (alreadyLinked) continue;
        const relation = {
          id: uniqueId("rel", `${sourceRef}-${targetRef}-printing-${role.id}`, workspace.relations), organizationId: item.organizationId,
          sourceRef, targetRef, relationType: type.id, label: type.label, reverseLabel: type.reverseLabel,
          notes: role.note, archived: false, autoPrintingRole: role.id,
          createdAt: new Date().toISOString(), createdBy: state.user?.displayName || "Système", updatedAt: new Date().toISOString(),
        };
        workspace.relations.push(relation);
        recordRelationshipEvent(workspace, relation, role.added);
      }
    }
  }

  function impactForAsset(ref) {
    const source = assetByRef(ref);
    if (!source) return { dependents: [], dependencies: [] };
    const active = state.workspace.relations.filter((relation) => !relation.archived && relation.organizationId === source.organizationId);
    const build = (reverse) => {
      const graph = new Map();
      const link = (from, to, relation) => { if (!graph.has(from)) graph.set(from, []); graph.get(from).push({ ref: to, relation }); };
      for (const relation of active) {
        const type = relationshipTypeById(relation.relationType);
        if (type.directional) link(reverse ? relation.targetRef : relation.sourceRef, reverse ? relation.sourceRef : relation.targetRef, relation);
        else { link(relation.sourceRef, relation.targetRef, relation); link(relation.targetRef, relation.sourceRef, relation); }
      }
      const visited = new Set([ref]); const queue = [{ ref, depth: 0 }]; const results = [];
      while (queue.length && results.length < 100) {
        const current = queue.shift();
        for (const edge of graph.get(current.ref) || []) {
          if (visited.has(edge.ref)) continue;
          visited.add(edge.ref);
          const asset = assetByRef(edge.ref);
          if (asset) results.push({ asset, relation: edge.relation, depth: current.depth + 1 });
          queue.push({ ref: edge.ref, depth: current.depth + 1 });
        }
      }
      return results;
    };
    return { dependents: build(true), dependencies: build(false) };
  }

  function renderMentionText(value) {
    const text = String(value || "");
    const pattern = /\[\[@([^|\]]+)\|([a-z]+:[a-z0-9-]+)\]\]/gi;
    let output = ""; let cursor = 0; let match;
    while ((match = pattern.exec(text))) {
      output += escapeHtml(text.slice(cursor, match.index));
      output += `<button class="inline-mention" type="button" data-action="open-asset" data-asset-ref="${escapeHtml(match[2])}">@${escapeHtml(match[1])}</button>`;
      cursor = match.index + match[0].length;
    }
    return output + escapeHtml(text.slice(cursor));
  }

  function updateMentionPicker(textarea) {
    const field = textarea.closest(".mention-field");
    const picker = field?.querySelector("[data-mention-picker]");
    if (!picker) return;
    const cursor = textarea.selectionStart ?? textarea.value.length;
    const before = textarea.value.slice(0, cursor);
    const match = before.match(/@([^@\n\r]{0,32})$/);
    if (!match) { picker.hidden = true; picker.innerHTML = ""; return; }
    const organizationId = textarea.closest("form")?.querySelector('[name="organizationId"]')?.value || (state.searchScope !== "global" ? state.searchScope : "");
    const query = normalizeSearch(match[1]);
    const results = assetRegistry(organizationId).filter((asset) => !query || normalizeSearch(`${asset.label} ${asset.kind}`).includes(query)).slice(0, 15);
    picker.innerHTML = results.length ? results.map((asset) => `<button type="button" data-action="insert-mention" data-asset-ref="${escapeHtml(asset.ref)}" data-mention-label="${escapeHtml(asset.label)}"><span class="type-icon">${icon(asset.icon, 14)}</span><span><strong>${escapeHtml(asset.label)}</strong><small>${escapeHtml(asset.kind)}</small></span></button>`).join("") : `<p>Aucune fiche correspondante dans cette organisation.</p>`;
    picker.hidden = false;
  }

  function relationshipRowMarkup(relation, currentRef) {
    const other = otherAssetForRelation(relation, currentRef);
    const missing = !other;
    return `<div class="related-item-row ${relation.archived ? "archived" : ""}">
      <button type="button" data-action="open-asset" data-asset-ref="${escapeHtml(other?.ref || "")}" ${missing ? "disabled" : ""}><span class="type-icon">${icon(other?.icon || "alert", 15)}</span><span><strong>${escapeHtml(other?.label || "Cible introuvable")}</strong><small>${escapeHtml(relationLabelFor(relation, currentRef))}${relation.notes ? ` · ${escapeHtml(relation.notes)}` : ""}</small></span></button>
      <div>${other?.archived ? '<span class="status-badge muted">Cible archivée</span>' : ""}${relation.archived ? '<span class="status-badge muted">Lien archivé</span>' : ""}${canWrite() ? `<button class="icon-button" type="button" data-action="edit-relation" data-id="${escapeHtml(relation.id)}" aria-label="Modifier la relation">${icon("edit", 14)}</button>` : ""}</div>
    </div>`;
  }

  function extraFactsMarkup(details, definitions) {
    return definitions.filter(([key]) => details?.[key]).map(([key, label, formatter]) => {
      const value = formatter ? formatter(details[key]) : escapeHtml(details[key]);
      return `<div><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`;
    }).join("");
  }

  function assetDetailsMarkup(asset) {
    const item = asset.raw;
    if (asset.type === "configuration") {
      const details = item.details || {};
      const extraFacts = extraFactsMarkup(details, [
        ["technicalRole", "Rôle technique"], ["hostname", "Nom d’hôte"], ["fqdn", "FQDN"], ["assetTag", "Étiquette d’actif"],
        ["parentConfigurationId", "Configuration parente", (id) => {
          const parent = configById(id);
          return parent ? `<button type="button" class="inline-asset-link" data-action="open-asset" data-asset-ref="configuration:${escapeHtml(parent.id)}">${escapeHtml(parent.name)}</button>` : "Cible introuvable";
        }], ["parentAsset", "Parent externe / précision"], ["manufacturer", "Fabricant"], ["model", "Modèle"], ["serialNumber", "Numéro de série"],
        ["platform", "Plateforme / hyperviseur"], ["cpu", "CPU / vCPU"], ["memory", "Mémoire"], ["storage", "Stockage / volumes"], ["firmware", "Micrologiciel / BIOS"],
        ["powerSupply", "Alimentation"], ["rackPosition", "Position de baie"], ["vlan", "VLAN principal"], ["managementPorts", "Ports de gestion"], ["managementNetwork", "Réseau de gestion"],
        ["purchaseDate", "Date d’achat", formatDate], ["installedDate", "Mise en service", formatDate], ["lifecycleDate", "Fin de vie prévue", formatDate],
        ["encryption", "Chiffrement"], ["securityAgent", "Protection / EDR"], ["monitoring", "Supervision"], ["backupPolicy", "Politique de sauvegarde"], ["patchPolicy", "Politique de mises à jour"], ["maintenanceWindow", "Fenêtre de maintenance"],
      ]);
      const detailSections = [
        ["Interfaces réseau", details.networkInterfaces], ["Adresses MAC", details.macAddresses], ["Noms DNS et alias", details.dnsNames],
        ["Dépendances opérationnelles", details.operationalDependencies], ["Attributs avancés", details.customAttributes],
      ].filter(([, value]) => value).map(([label, value]) => `<h3>${escapeHtml(label)}</h3><pre class="asset-structured-text">${escapeHtml(value)}</pre>`).join("");
      return `<dl class="asset-facts-grid"><div><dt>Type</dt><dd>${escapeHtml(item.type)}</dd></div><div><dt>Système</dt><dd>${escapeHtml(item.os || "—")}</dd></div><div><dt>Adresse IP</dt><dd><code>${escapeHtml(item.ip || "—")}</code></dd></div><div><dt>Site</dt><dd>${escapeHtml(siteName(item.siteId))}</dd></div><div><dt>Responsable</dt><dd>${escapeHtml(item.owner || "—")}</dd></div><div><dt>Emplacement</dt><dd>${escapeHtml(item.location || "—")}</dd></div><div><dt>Garantie</dt><dd>${formatDate(item.warranty)}</dd></div><div><dt>Dernière révision</dt><dd>${formatDate(item.lastReviewed)}</dd></div>${extraFacts}</dl><div class="asset-copy"><h3>Résumé</h3><p>${renderMentionText(item.summary || "Aucun résumé.")}</p>${detailSections}<h3>Notes opérationnelles</h3><p>${renderMentionText(item.notes || "Aucune note.")}</p></div>`;
    }
    if (asset.type === "site") {
      const configurations = state.workspace.configurations.filter((configuration) => configuration.siteId === item.id);
      const details = item.details || {};
      const extraFacts = extraFactsMarkup(details, [["siteType", "Type de site"], ["openingHours", "Heures d’ouverture"], ["primarySubnet", "Sous-réseau principal"], ["onsiteContact", "Contact sur place"]]);
      const context = details.accessInstructions || details.vlans ? `<div class="asset-copy"><h3>Accès au site</h3><p>${renderMentionText(details.accessInstructions || "Aucune instruction particulière.")}</p><h3>VLAN / segments</h3><p>${renderMentionText(details.vlans || "Aucun segment documenté.")}</p></div>` : "";
      return `<dl class="asset-facts-grid"><div><dt>Adresse</dt><dd>${escapeHtml(item.address || "—")}</dd></div><div><dt>Fuseau horaire</dt><dd>${escapeHtml(item.timezone || "—")}</dd></div><div><dt>État</dt><dd>${item.status === "archived" ? "Archivé" : "Actif"}</dd></div><div><dt>Configurations</dt><dd>${configurations.length}</dd></div>${extraFacts}</dl>${context}${configurations.length ? `<div class="asset-copy"><h3>Configurations de ce site</h3><div class="asset-inline-list">${configurations.map((configuration) => `<button type="button" data-action="open-asset" data-asset-ref="configuration:${escapeHtml(configuration.id)}"><span class="type-icon">${icon("server", 15)}</span><span><strong>${escapeHtml(configuration.name)}</strong><small>${escapeHtml(configuration.type)} · ${escapeHtml(configuration.os || "Système non renseigné")}</small></span>${icon("chevron", 14)}</button>`).join("")}</div></div>` : ""}`;
    }
    if (asset.type === "procedure") return `<dl class="asset-facts-grid"><div><dt>Catégorie</dt><dd>${escapeHtml(item.category || "—")}</dd></div><div><dt>Responsable</dt><dd>${escapeHtml(item.owner || "—")}</dd></div><div><dt>État</dt><dd>${item.status === "published" ? "Publiée" : item.status === "archived" ? "Archivée" : "En révision"}</dd></div><div><dt>Mise à jour</dt><dd>${formatDate(item.updatedAt)}</dd></div></dl><div class="asset-copy asset-document-copy"><h3>Résumé</h3><p>${renderMentionText(item.summary || "Aucun résumé.")}</p><h3>Procédure</h3><ol>${(item.steps || []).map((step) => `<li>${renderMentionText(step)}</li>`).join("") || "<li>Aucune étape.</li>"}</ol></div>`;
    if (asset.type === "module") {
      const module = moduleMap.get(item.moduleId);
      const profile = moduleProfile(module);
      const profileDetails = moduleProfileDetails(item, module);
      const expiry = expiryPresentation(item);
      const reviewLabels = { draft: "Brouillon", "in-review": "En révision", approved: "Approuvée", stale: "À revoir" };
      const reviewState = item.reviewState || "draft";
      const reviewTone = reviewState === "approved" ? "success" : reviewState === "in-review" ? "warning" : "muted";
      const checklist = item.checklist?.length ? (() => {
        const completed = item.checklist.filter((step) => step.done).length;
        const percent = Math.round((completed / item.checklist.length) * 100);
        return `<section class="interactive-checklist"><div class="checklist-summary"><div><h3>Checklist opérationnelle</h3><p><strong>${completed}/${item.checklist.length}</strong> étapes terminées</p></div><span>${percent}%</span></div><div class="checklist-progress" aria-label="Progression ${percent}%"><i style="width:${percent}%"></i></div><ul class="asset-checklist">${item.checklist.map((step, index) => `<li class="${step.done ? "done" : ""}"><button type="button" data-action="toggle-checklist-step" data-id="${escapeHtml(item.id)}" data-step-index="${index}" aria-pressed="${step.done}" ${canWrite() && !asset.archived ? "" : "disabled"}><span>${step.done ? "✓" : ""}</span><em>${escapeHtml(step.label)}</em></button></li>`).join("")}</ul></section>`;
      })() : "";
      return `<dl class="asset-facts-grid"><div><dt>${escapeHtml(profile.ownerLabel)}</dt><dd>${escapeHtml(item.owner || "—")}</dd></div><div><dt>Site</dt><dd>${escapeHtml(siteName(item.siteId))}</dd></div><div><dt>${escapeHtml(profile.expiryLabel)}</dt><dd>${formatDate(item.expiresOn)}</dd></div><div><dt>${escapeHtml(profile.referenceLabel)}</dt><dd>${escapeHtml(item.reference || "—")}</dd></div><div><dt>État</dt><dd><span class="status-badge ${expiry.tone}">${escapeHtml(expiry.label)}</span></dd></div><div><dt>Mise à jour</dt><dd>${formatDate(item.updatedAt)}</dd></div><div><dt>Révision</dt><dd><span class="status-badge ${reviewTone}">${escapeHtml(reviewLabels[reviewState] || reviewState)}</span></dd></div><div><dt>Responsable de révision</dt><dd>${escapeHtml(item.reviewOwner || "—")}</dd></div><div><dt>Révision prévue</dt><dd>${formatDate(item.reviewDueAt)}</dd></div><div><dt>Dernière approbation</dt><dd>${item.approvedAt ? `${formatDateTime(item.approvedAt)} · ${escapeHtml(item.approvedBy || "—")}` : "—"}</dd></div>${profileDetails.facts}</dl><div class="asset-copy asset-document-copy">${profileDetails.sections}<h3>Résumé</h3><p>${renderMentionText(item.summary || "Aucun résumé.")}</p><h3>Notes</h3><p>${renderMentionText(item.notes || "Aucune note.")}</p>${item.tags?.length ? `<h3>Étiquettes</h3><div class="asset-tags">${item.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}${checklist}</div>`;
    }
    if (asset.type === "vault") {
      const revealed = state.revealedVaultItem?.id === item.id ? state.revealedVaultItem : null;
      const strengthText = Number.isInteger(item.strength) ? `${item.strength}/4` : "Non évaluée";
      const evaluationText = item.strengthEvaluatedAt ? formatDateTime(item.strengthEvaluatedAt) : "En attente";
      if (revealed) {
        const passwordVisible = state.visibleVaultFields.has("password");
        const otpVisible = state.visibleVaultFields.has("otp");
        return `<div class="vault-page-unlocked"><div class="vault-unlocked-note">${icon("shield", 18)} <span><strong>Coffre ouvert pour cette session</strong>Le MFA ne sera pas redemandé avant la déconnexion ou l’expiration de la session. Les secrets restent masqués jusqu’à leur affichage explicite.</span></div><dl class="asset-facts-grid"><div><dt>Force structurelle</dt><dd>${escapeHtml(strengthText)}</dd></div><div><dt>Évaluée localement</dt><dd>${escapeHtml(evaluationText)}</dd></div></dl><dl class="asset-secret-grid"><div><dt>Nom d’utilisateur</dt><dd><code>${escapeHtml(revealed.username || "—")}</code><button class="icon-button" data-action="copy-vault-field" data-field="username" aria-label="Copier le nom d’utilisateur">${icon("copy", 15)}</button></dd></div><div><dt>Mot de passe</dt><dd><code class="${passwordVisible ? "" : "secret-masked"}">${passwordVisible ? escapeHtml(revealed.password || "—") : "••••••••••••"}</code><button class="icon-button" data-action="toggle-vault-field" data-field="password" aria-label="${passwordVisible ? "Masquer" : "Afficher"} le mot de passe">${icon(passwordVisible ? "eye-off" : "eye", 15)}</button><button class="icon-button" data-action="copy-vault-field" data-field="password" aria-label="Copier le mot de passe">${icon("copy", 15)}</button></dd></div>${revealed.otp ? `<div><dt>Code OTP · ${revealed.otpExpiresIn}s</dt><dd><code class="otp-code ${otpVisible ? "" : "secret-masked"}">${otpVisible ? escapeHtml(revealed.otp) : "••••••"}</code><button class="icon-button" data-action="toggle-vault-field" data-field="otp" aria-label="${otpVisible ? "Masquer" : "Afficher"} le code OTP">${icon(otpVisible ? "eye-off" : "eye", 15)}</button><button class="icon-button" data-action="copy-vault-field" data-field="otp" aria-label="Copier le code OTP">${icon("copy", 15)}</button></dd></div>` : ""}<div><dt>URL</dt><dd><code>${escapeHtml(revealed.url || "—")}</code><button class="icon-button" data-action="copy-vault-field" data-field="url" aria-label="Copier l’URL">${icon("copy", 15)}</button></dd></div><div class="span-2"><dt>Notes</dt><dd><pre>${escapeHtml(revealed.notes || "Aucune note.")}</pre></dd></div></dl></div>`;
      }
      return `<div class="vault-page-locked"><span class="vault-lock-icon">${icon("shield", 28)}</span><div><p class="eyebrow">SECRET CHIFFRÉ</p><h3>${vaultSessionUnlocked() ? "Ouverture sécurisée" : "Coffre verrouillé"}</h3><p>Le nom d’utilisateur, le mot de passe, les notes et le code OTP ne sont jamais inclus dans l’index documentaire.</p></div><dl class="asset-facts-grid"><div><dt>Catégorie</dt><dd>${escapeHtml(item.category || "Général")}</dd></div><div><dt>État</dt><dd>${item.archived ? "Archivée" : "Active"}</dd></div><div><dt>Force structurelle</dt><dd>${escapeHtml(strengthText)}</dd></div><div><dt>Évaluée localement</dt><dd>${escapeHtml(evaluationText)}</dd></div><div><dt>Créée</dt><dd>${formatDateTime(item.createdAt)}</dd></div><div><dt>Mise à jour</dt><dd>${formatDateTime(item.updatedAt)}</dd></div></dl><button class="primary" type="button" data-action="reveal-vault-item" data-id="${escapeHtml(item.id)}" ${item.archived ? "disabled" : ""}>${icon("key", 15)} ${vaultSessionUnlocked() ? "Ouvrir le mot de passe" : "Vérifier avec MFA"}</button></div>`;
    }
    return emptyState("Aucun aperçu disponible.");
  }

  function impactListMarkup(items, emptyMessage) {
    if (!items.length) return `<p class="drawer-empty">${escapeHtml(emptyMessage)}</p>`;
    return `<div class="impact-list">${items.map(({ asset, relation, depth }) => `<button type="button" data-action="open-asset" data-asset-ref="${escapeHtml(asset.ref)}"><span class="impact-depth">${depth}</span><span class="type-icon">${icon(asset.icon, 15)}</span><span><strong>${escapeHtml(asset.label)}</strong><small>${escapeHtml(relationshipTypeById(relation.relationType).label)} · ${escapeHtml(asset.kind)}</small></span>${asset.archived ? '<span class="status-badge muted">Archivé</span>' : icon("chevron", 14)}</button>`).join("")}</div>`;
  }

  function assetListContext(asset) {
    if (asset.type === "configuration") return { route: "configurations", label: "Configurations" };
    if (asset.type === "site") return { route: "sites", label: "Sites" };
    if (asset.type === "procedure") return { route: "procedures", label: "Procédures" };
    if (asset.type === "vault") return { route: "module/passwords", label: "Mots de passe" };
    if (asset.type === "module") return { route: `module/${asset.moduleId}`, label: moduleMap.get(asset.moduleId)?.label || "Fiches" };
    return { route: "dashboard", label: "Vue d’ensemble" };
  }

  function assetStatusPresentation(asset) {
    if (asset.archived) return { tone: "muted", label: "Archivé" };
    if (["review", "draft"].includes(asset.status)) return { tone: "warning", label: asset.status === "draft" ? "Brouillon" : "À réviser" };
    if (asset.type === "configuration" && asset.status !== "documented") return { tone: "warning", label: statusLabel(asset.status) };
    if (asset.type === "procedure") return { tone: asset.status === "published" ? "success" : "warning", label: asset.status === "published" ? "Publiée" : "En révision" };
    return { tone: "success", label: "Actif" };
  }

  function attachmentCardMarkup(asset) {
    const items = state.attachments.filter((item) => item.assetRef === asset.ref).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const vaultLocked = asset.type === "vault" && state.revealedVaultItem?.id !== asset.id;
    const canManage = canWrite() && !asset.archived && !vaultLocked;
    const upload = canManage ? `<label class="attachment-upload-control">${icon("plus", 14)} <span>Ajouter un fichier</span><input type="file" data-attachment-input data-asset-ref="${escapeHtml(asset.ref)}" accept=".pdf,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.gif,.webp,.docx,.xlsx,.pptx,.zip,.7z" /></label>` : "";
    const notice = vaultLocked ? `<p class="asset-context-note">Déverrouillez ce mot de passe avec le MFA pour télécharger ou ajouter un fichier.</p>` : asset.archived ? `<p class="asset-context-note">Cette fiche est archivée; ses pièces jointes restent téléchargeables.</p>` : `<p class="asset-context-note">PDF, images, documents Office, texte ou archive · 8 Mo maximum.</p>`;
    const list = items.length ? `<div class="attachment-list">${items.map((item) => `<article><span class="attachment-file-icon">${icon("file", 16)}</span><div><strong title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</strong><small>${formatFileSize(item.size)} · ${escapeHtml(item.createdBy || "Utilisateur local")}<br>${formatDateTime(item.createdAt)}</small></div><div class="attachment-actions"><button class="icon-button" type="button" data-action="download-attachment" data-id="${escapeHtml(item.id)}" aria-label="Télécharger ${escapeHtml(item.name)}" ${vaultLocked ? "disabled" : ""}>${icon("download", 15)}</button>${canManage ? `<button class="icon-button danger" type="button" data-action="delete-attachment" data-id="${escapeHtml(item.id)}" data-name="${escapeHtml(item.name)}" aria-label="Retirer ${escapeHtml(item.name)}">${icon("trash", 15)}</button>` : ""}</div></article>`).join("")}</div>` : `<p class="asset-context-empty">Aucune pièce jointe pour cette fiche.</p>`;
    return `<section class="asset-context-card attachment-card"><header><div><p class="eyebrow">FICHIERS</p><h2>Pièces jointes</h2></div><strong class="asset-context-count">${items.length}</strong></header>${upload}${list}${notice}</section>`;
  }

  function assetHistoryMarkup(asset) {
    const storedRevisions = state.assetRevisions[asset.ref];
    const actionLabels = { created: "Fiche créée", updated: "Fiche mise à jour", archived: "Fiche archivée", restored: "Fiche restaurée", removed: "Fiche retirée", migrated: "Fiche migrée vers SQLite" };
    const revisions = Array.isArray(storedRevisions) ? storedRevisions.map((entry) => ({ action: actionLabels[entry.action] || entry.action, actor: entry.savedBy, at: entry.savedAt, kind: "revision", revision: entry.workspaceRevision })) : [];
    const relationEvents = relationshipEventsForAsset(asset.ref).map((event) => ({ action: event.action, actor: event.actor, at: event.at, kind: "relation" }));
    const activities = (state.workspace.activities || []).filter((entry) => normalizeSearch(entry.target) === normalizeSearch(asset.label)).map((entry) => ({ action: entry.action, actor: entry.actor, at: entry.at, kind: entry.kind || "activity" }));
    const attachmentEvents = state.attachmentEvents.filter((event) => event.assetRef === asset.ref).map((event) => ({ action: `${event.action} · ${event.name}`, actor: event.actor, at: event.at, kind: "attachment" }));
    const events = [...revisions, ...relationEvents, ...attachmentEvents, ...activities].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 50);
    if (storedRevisions === null || storedRevisions === undefined) return `<p class="asset-context-empty">Chargement de l’historique durable…</p>`;
    return events.length ? `<div class="asset-history-list">${events.map((event) => `<div><span class="timeline-dot ${escapeHtml(event.kind)}"></span><p><strong>${escapeHtml(event.action)}</strong><small>${escapeHtml(event.actor || "Système")} · ${formatDateTime(event.at)}${event.revision ? ` · révision #${event.revision}` : ""}</small></p></div>`).join("")}</div>` : `<p class="asset-context-empty">Aucun changement consigné pour cette fiche.</p>`;
  }

  function renderAssetPage(ref) {
    const asset = assetByRef(ref);
    if (!asset) return `<div class="page">${pageHeader("Fiche introuvable", "Cette fiche n’existe plus ou son identifiant a changé.", `<button class="secondary" data-route="dashboard">Retour</button>`)}</div>`;
    const list = assetListContext(asset);
    const status = assetStatusPresentation(asset);
    const relations = relationsForAsset(asset.ref);
    const impact = impactForAsset(asset.ref);
    const edit = canWrite() && asset.editAction ? `<button class="secondary" type="button" data-action="${asset.editAction}" data-id="${escapeHtml(asset.id)}"${asset.moduleId ? ` data-module-id="${escapeHtml(asset.moduleId)}"` : ""}>${icon("edit", 15)} Modifier</button>` : "";
    const archive = canWrite() && asset.type !== "vault" ? `<button class="secondary ${asset.archived ? "" : "danger"}" type="button" data-action="toggle-asset-archive" data-asset-ref="${escapeHtml(asset.ref)}">${icon(asset.archived ? "refresh" : "trash", 15)} ${asset.archived ? "Restaurer" : "Archiver"}</button>` : "";
    const reveal = asset.type === "vault" ? (state.revealedVaultItem?.id === asset.id ? `<button class="secondary" type="button" data-action="lock-vault">${icon("lock", 15)} Verrouiller le coffre</button>` : `<button class="secondary" type="button" data-action="reveal-vault-item" data-id="${escapeHtml(asset.id)}" ${asset.archived ? "disabled" : ""}>${icon("key", 15)} Ouvrir</button>`) : "";
    const reviewActions = asset.type === "module" && !asset.archived
      ? asset.raw.reviewState === "in-review"
        ? (isAdministrator() ? `<button class="primary" type="button" data-action="approve-record" data-id="${escapeHtml(asset.id)}">${icon("check", 15)} Approuver</button>` : "")
        : asset.raw.reviewState === "approved"
          ? (canWrite() ? `<button class="secondary" type="button" data-action="mark-record-reviewed" data-id="${escapeHtml(asset.id)}">${icon("refresh", 15)} Révision terminée</button>` : "")
          : (canWrite() ? `<button class="secondary" type="button" data-action="submit-record-review" data-id="${escapeHtml(asset.id)}">${icon("arrow", 15)} Soumettre</button>` : "")
      : "";
    const quickRelationControl = canWrite() ? quickRelationPickerMarkup(asset) : "";
    return `<div class="asset-page">
      <header class="asset-page-header">
        <div class="asset-breadcrumbs">${organizationBreadcrumbMarkup(asset.organizationId)}${icon("chevron", 13)}<button type="button" data-route="${escapeHtml(list.route)}">${escapeHtml(list.label)}</button>${icon("chevron", 13)}<span>${escapeHtml(asset.label)}</span></div>
        <div class="asset-heading"><span class="asset-heading-icon">${icon(asset.icon, 24)}</span><div><p class="eyebrow">${escapeHtml(asset.kind)}</p><h1>${escapeHtml(asset.label)}</h1><p>${escapeHtml(orgName(asset.organizationId))} · ${escapeHtml(asset.subtitle)}</p></div><div class="asset-heading-actions"><span class="status-badge ${status.tone}">${escapeHtml(status.label)}</span>${reveal}${reviewActions}${edit}${archive}${writeButton(`<button class="primary" type="button" data-action="add-related-item" data-asset-ref="${escapeHtml(asset.ref)}">${icon("link", 15)} Relier</button>`)}</div></div>
      </header>
      <div class="asset-page-layout">
        <div class="asset-page-main">
          <section class="asset-page-section"><header><div><p class="eyebrow">INFORMATIONS</p><h2>Détails de la fiche</h2></div><span class="asset-record-id">${escapeHtml(asset.ref)}</span></header>${assetDetailsMarkup(asset)}</section>
          <section class="asset-page-section"><header><div><p class="eyebrow">VUE D’IMPACT</p><h2>Dépendances et éléments affectés</h2></div></header><div class="impact-summary asset-impact-summary"><div><strong>${impact.dependents.length}</strong><span>élément${impact.dependents.length === 1 ? "" : "s"} dépendant${impact.dependents.length === 1 ? "" : "s"}</span></div><div><strong>${impact.dependencies.length}</strong><span>dépendance${impact.dependencies.length === 1 ? "" : "s"}</span></div></div><div class="asset-impact-columns"><div><h3>Ce qui dépend de cette fiche</h3>${impactListMarkup(impact.dependents, "Aucun impact descendant documenté.")}</div><div><h3>Ses dépendances</h3>${impactListMarkup(impact.dependencies, "Aucune dépendance documentée.")}</div></div></section>
        </div>
        <aside class="asset-context-rail" aria-label="Contexte de la fiche">
          ${attachmentCardMarkup(asset)}
          <section class="asset-context-card relations-card"><header><div><p class="eyebrow">RELATIONS</p><h2>Éléments liés</h2></div><strong class="asset-context-count">${relations.length}</strong></header>${quickRelationControl}${relations.length ? `<div class="related-items-list">${relations.map((relation) => relationshipRowMarkup(relation, asset.ref)).join("")}</div>` : `<p class="asset-context-empty">Aucun élément lié dans cette organisation.</p>`}</section>
          <section class="asset-context-card"><header><div><p class="eyebrow">RÉVISIONS</p><h2>Historique</h2></div>${icon("history", 18)}</header>${assetHistoryMarkup(asset)}</section>
          <section class="asset-context-card"><header><div><p class="eyebrow">SÉCURITÉ</p><h2>Accès et conservation</h2></div>${icon("shield", 18)}</header><dl class="asset-security-list"><div><dt>Organisation</dt><dd>${escapeHtml(orgName(asset.organizationId))}</dd></div><div><dt>Accès</dt><dd>${asset.type === "vault" ? "Coffre chiffré + MFA" : "Selon le rôle Atlas"}</dd></div><div><dt>Indexation</dt><dd>${asset.type === "vault" ? "Métadonnées uniquement" : "Contenu documentaire local"}</dd></div><div><dt>Conservation</dt><dd>${asset.archived ? "Archivé — liens conservés" : "Actif dans l’espace local"}</dd></div></dl></section>
        </aside>
      </div>
    </div>`;
  }

  function showModal(kind, existingId = null, moduleId = null, contextRef = "") {
    if (kind === "relation") state.relationPresetRef = contextRef || state.relationPresetRef || "";
    const modal = modalMarkup(kind, existingId, moduleId);
    const editorClass = kind === "module-record" && moduleId === "documents" ? "document-editor-modal" : "";
    const accessClass = kind === "user" ? "account-access-modal" : "";
    const organizationClass = kind === "organization" ? "organization-profile-modal" : kind === "quick-notes" ? "quick-notes-modal" : "";
    const builderClass = ["custom-module", "guided-import"].includes(kind) ? "wide-admin-modal" : "";
    overlayRoot.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><section class="modal ${kind === "priorities" ? "priority-modal-shell" : ""} ${editorClass} ${accessClass} ${organizationClass} ${builderClass}" role="dialog" aria-modal="true" aria-labelledby="modal-title" data-modal-stop>${modal}</section></div>`;
    overlayRoot.querySelector('input:not([type="hidden"]), select, textarea')?.focus();
  }

  function modalMarkup(kind, existingId, moduleId) {
    const close = `<button class="icon-button" type="button" data-action="close-modal" aria-label="${t("close")}">${icon("close")}</button>`;
    if (kind === "priorities") {
      const priorities = dashboardPriorities();
      const selected = priorities.categories.find((category) => category.id === existingId);
      const category = selected || { id: "all", icon: "activity", label: state.locale === "fr" ? "Toutes les priorités" : "All priorities", description: state.locale === "fr" ? "Tous les critères factuels de cette portée" : "All factual criteria in this scope", items: priorities.categories.flatMap((entry) => entry.items.map((item) => ({ ...item, categoryLabel: entry.label }))) };
      const visibleItems = category.items.slice(0, 200);
      return `<div class="priority-dialog"><div class="modal-heading"><div><p class="eyebrow">${state.locale === "fr" ? "CRITÈRES FACTUELS" : "FACTUAL CRITERIA"}</p><h2 id="modal-title">${escapeHtml(category.label)}</h2><p>${escapeHtml(category.description)}</p></div>${close}</div><div class="priority-dialog-summary"><span class="priority-dialog-icon">${icon(category.icon, 21)}</span><div><strong>${category.items.length}</strong><span>${state.locale === "fr" ? `${category.items.length === 1 ? "signal" : "signaux"} dans la portée actuelle` : `signal${category.items.length === 1 ? "" : "s"} in the current scope`}</span></div><small>${state.dashboardIncludeTests ? (state.locale === "fr" ? "Tests inclus" : "Tests included") : (state.locale === "fr" ? "Organisations [TEST] masquées" : "[TEST] organizations hidden")}</small></div>${visibleItems.length ? `<div class="priority-dialog-list">${visibleItems.map((item) => `<button type="button" data-action="open-priority-item" data-asset-ref="${escapeHtml(item.ref || "")}" ${item.ref ? "" : "disabled"}><span class="type-icon">${icon(item.icon || "alert", 17)}</span><span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.subtitle)} · ${escapeHtml(item.reason)}${item.categoryLabel ? ` · ${escapeHtml(item.categoryLabel)}` : ""}</small></span>${item.ref ? icon("chevron", 15) : ""}</button>`).join("")}</div>` : `<div class="priority-dialog-empty">${icon("check", 24)}<h3>${state.locale === "fr" ? "Aucun signal pour ce critère" : "No signal for this criterion"}</h3><p>${state.locale === "fr" ? "Atlas n’ajoute aucune note cachée : zéro signifie simplement qu’aucune fiche ne correspond à cette règle." : "Atlas adds no hidden score: zero simply means no record matches this rule."}</p></div>`}${category.items.length > visibleItems.length ? `<p class="priority-dialog-limit">${state.locale === "fr" ? `200 résultats affichés sur ${category.items.length}. Affinez la portée en masquant les organisations de test.` : `Showing 200 of ${category.items.length}. Narrow the scope by hiding test organizations.`}</p>` : ""}<div class="modal-actions"><button class="secondary" type="button" data-action="close-modal">${t("close")}</button></div></div>`;
    }
    if (kind === "organization") {
      const item = existingId ? state.workspace.organizations.find((entry) => entry.id === existingId) : null;
      const details = item?.details || {};
      const parentId = String(item?.parentOrganizationId || "");
      const parentField = isAdministrator()
        ? `<label class="span-2 organization-parent-field">Organisation parente <span class="optional-label">Facultatif</span><select name="parentOrganizationId"><option value="">Aucune — organisation racine (niveau 1)</option>${validOrganizationParents(item).map((candidate) => `<option value="${escapeHtml(candidate.id)}" ${candidate.id === parentId ? "selected" : ""}>Niveau ${organizationDepth(candidate.id)} · ${escapeHtml(organizationPathLabel(candidate.id))}</option>`).join("")}</select><small>Une organisation peut contenir plusieurs sous-compagnies. La profondeur totale est limitée à trois niveaux.</small></label>`
        : `<input type="hidden" name="parentOrganizationId" value="${escapeHtml(parentId)}" /><div class="form-organization-context span-2">${icon("building", 17)}<span><small>ORGANISATION PARENTE</small><strong>${escapeHtml(parentId ? orgName(parentId) : "Aucune — organisation racine")}</strong></span><em>Modifiable par un administrateur</em></div>`;
      return `<form data-form="organization" data-id="${escapeHtml(existingId || "")}"><div class="modal-heading"><div><p class="eyebrow">STRUCTURE</p><h2 id="modal-title">${item ? "Modifier l’organisation" : t("addOrganization")}</h2><p>Décrivez clairement la compagnie, son contexte de service et les personnes responsables.</p></div>${close}</div><div class="form-grid organization-profile-form"><label class="span-2">Nom de la compagnie ou de l’organisation<input name="name" value="${escapeHtml(item?.name || "")}" required maxlength="120" placeholder="Ex. TheRisingCloud" /><small>Nom complet utilisé dans Atlas, les recherches et les fiches.</small></label>${parentField}<div class="organization-hierarchy-notice span-2">${icon("shield", 17)}<span><strong>Espaces strictement séparés</strong><small>Le rattachement sert au classement et au fil d’Ariane seulement. Les accès, mots de passe, sites et fiches ne sont jamais partagés ni hérités.</small></span></div><label>Code court<input name="code" value="${escapeHtml(item?.code || "")}" required maxlength="8" placeholder="Ex. TRC" /><small>Abréviation unique de 2 à 8 caractères.</small></label><label>Secteur d’activité<input name="industry" value="${escapeHtml(item?.industry || "")}" maxlength="80" placeholder="Ex. Services TI" /><small>Activité de la compagnie, pas sa ville ou sa région.</small></label><label><span class="field-label-copy">Nom usuel ou marque <em class="optional-label">Facultatif</em></span><input name="displayName" value="${escapeHtml(details.displayName || "")}" maxlength="120" placeholder="Ex. TRC" /><small>À remplir seulement si le nom utilisé au quotidien diffère.</small></label><label>Niveau de criticité<select name="customerCriticality"><option value="">Non précisé</option>${["Faible", "Normale", "Élevée", "Critique"].map((value) => `<option value="${value}" ${details.customerCriticality === value ? "selected" : ""}>${value}</option>`).join("")}</select><small>Impact opérationnel d’une interruption de service.</small></label><label>Nombre approximatif d’employés<input name="employeeCount" type="number" min="0" max="1000000" value="${escapeHtml(details.employeeCount || "")}" placeholder="Ex. 125" /></label><label>Utilisateurs à soutenir<input name="itUserCount" type="number" min="0" max="1000000" value="${escapeHtml(details.itUserCount || "")}" placeholder="Ex. 110" /><small>Personnes utilisant les services ou appareils TI documentés.</small></label><label>Fuseau horaire principal<input name="timezone" value="${escapeHtml(details.timezone || "America/Toronto")}" maxlength="80" placeholder="America/Toronto" /></label><label>Langue de service<input name="serviceLanguage" value="${escapeHtml(details.serviceLanguage || "Français")}" maxlength="80" placeholder="Français" /></label><label>Responsable technique principal<input name="owner" value="${escapeHtml(item?.owner || "")}" maxlength="96" placeholder="Nom de la personne ou de l’équipe" /></label><label>Gestionnaire de la relation client<input name="accountManager" value="${escapeHtml(details.accountManager || "")}" maxlength="96" placeholder="Nom de la personne" /></label><label class="span-2">Plage horaire de soutien<input name="supportHours" value="${escapeHtml(details.supportHours || "")}" maxlength="200" placeholder="Lun–ven 07:00–18:00, urgence 24/7" /></label><label class="span-2">Notes internes<textarea name="notes" maxlength="2000" rows="4" placeholder="Contexte utile, particularités ou consignes générales…">${escapeHtml(item?.notes || "")}</textarea></label></div>${modalActions()}</form>`;
    }
    if (kind === "quick-notes") {
      const item = state.workspace.organizations.find((entry) => entry.id === existingId);
      if (!item) return `<div class="modal-heading"><div><h2 id="modal-title">Organisation introuvable</h2></div>${close}</div>`;
      const value = String(item.quickNotes || "");
      return `<form data-form="quick-notes" data-id="${escapeHtml(item.id)}"><div class="modal-heading"><div><p class="eyebrow">REPÈRES D’ÉQUIPE</p><h2 id="modal-title">Quick Notes · ${escapeHtml(item.name)}</h2><p>Gardez les consignes essentielles visibles dès l’ouverture de cette compagnie.</p></div>${close}</div><div class="quick-notes-editor"><label><span>Contenu</span><textarea name="quickNotes" data-quick-notes-source maxlength="8000" rows="15" placeholder="Ex. Contact d’urgence, particularité du site, consigne avant intervention…">${escapeHtml(value)}</textarea><small>Markdown léger accepté : titres, listes, liens, gras, tableaux et blocs de code.</small></label><div><span>Aperçu</span><article class="quick-notes-preview document-rendered" data-quick-notes-preview>${renderDocumentMarkdown(value)}</article></div></div><div class="quick-notes-visibility-note">${icon("users", 16)} Ces notes sont limitées aux comptes autorisés à consulter cette compagnie.</div>${modalActions("Enregistrer les Quick Notes")}</form>`;
    }
    if (kind === "delete-organization") {
      const item = state.workspace.organizations.find((entry) => entry.id === existingId);
      if (!item) return `<div class="modal-heading"><div><h2 id="modal-title">Organisation introuvable</h2></div>${close}</div>`;
      const counts = {
        sites: state.workspace.sites.filter((entry) => entry.organizationId === item.id).length,
        configurations: state.workspace.configurations.filter((entry) => entry.organizationId === item.id).length,
        procedures: state.workspace.procedures.filter((entry) => entry.organizationId === item.id).length,
        records: state.workspace.moduleRecords.filter((entry) => entry.organizationId === item.id).length,
        passwords: state.vaultItems.filter((entry) => entry.organizationId === item.id).length,
        attachments: state.attachments.filter((entry) => entry.organizationId === item.id).length,
      };
      const childOrganizations = organizationChildren(item.id);
      const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
      return `<form data-form="delete-organization" data-id="${escapeHtml(item.id)}"><div class="modal-heading destructive-heading"><div><p class="eyebrow">ZONE DE DANGER</p><h2 id="modal-title">Supprimer ${escapeHtml(item.name)}</h2><p>Cette action est réservée aux administrateurs et exige votre MFA Atlas local.</p></div>${close}</div><div class="destructive-confirmation"><div class="destructive-warning">${icon("alert", 20)}<div><strong>Suppression irréversible de l’organisation active</strong><p>Les fiches, mots de passe chiffrés et pièces jointes associés seront retirés. Les traces d’audit et les sauvegardes administratives restent conservées.</p></div></div>${childOrganizations.length ? `<div class="organization-detach-warning">${icon("building", 18)}<span><strong>${childOrganizations.length} sous-compagnie${childOrganizations.length === 1 ? " sera détachée" : "s seront détachées"}</strong><small>${childOrganizations.map((child) => child.name).join(", ")} deviendra${childOrganizations.length === 1 ? "" : "ont"} une organisation racine. Leur contenu ne sera pas supprimé.</small></span></div>` : ""}<div class="destructive-count-grid"><span><strong>${counts.sites}</strong> sites</span><span><strong>${counts.configurations}</strong> configurations</span><span><strong>${counts.procedures}</strong> procédures</span><span><strong>${counts.records}</strong> fiches</span><span><strong>${counts.passwords}</strong> mots de passe</span><span><strong>${counts.attachments}</strong> pièces jointes</span></div><p class="destructive-total"><strong>${total}</strong> éléments directs seront retirés avec « ${escapeHtml(item.name)} ».</p><div class="form-grid"><label class="span-2">Tapez le nom exact de l’organisation<input name="confirmation" autocomplete="off" required maxlength="120" placeholder="${escapeHtml(item.name)}" /></label><label class="span-2">Code MFA actuel<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required placeholder="000000" /></label></div></div>${modalActions("Supprimer définitivement", true)}</form>`;
    }
    if (kind === "site") {
      const item = existingId ? state.workspace.sites.find((entry) => entry.id === existingId) : null;
      const organizationId = item?.organizationId || activeOrganizationId();
      const details = item?.details || {};
      return `<form data-form="site" data-id="${escapeHtml(existingId || "")}"><div class="modal-heading"><div><p class="eyebrow">STRUCTURE</p><h2 id="modal-title">${item ? "Modifier le site" : t("addSite")}</h2></div>${close}</div><div class="form-grid">${organizationContextField(organizationId)}<label class="span-2">Nom du site<input name="name" value="${escapeHtml(item?.name || "")}" required maxlength="120" /></label><label class="span-2">Adresse ou description<input name="address" value="${escapeHtml(item?.address || "")}" maxlength="200" /></label><label>Type de site<input name="siteType" value="${escapeHtml(details.siteType || "")}" maxlength="120" placeholder="Bureau, entrepôt, centre de données…" /></label><label>Fuseau horaire<input name="timezone" value="${escapeHtml(item?.timezone || "America/Toronto")}" required maxlength="80" /></label><label class="span-2">Heures d’ouverture<input name="openingHours" value="${escapeHtml(details.openingHours || "")}" maxlength="200" /></label><label class="span-2">Instructions d’accès<textarea name="accessInstructions" maxlength="1000" rows="3">${escapeHtml(details.accessInstructions || "")}</textarea></label><label>Sous-réseau principal<input name="primarySubnet" value="${escapeHtml(details.primarySubnet || "")}" maxlength="120" /></label><label>Contact sur place<input name="onsiteContact" value="${escapeHtml(details.onsiteContact || "")}" maxlength="300" /></label><label class="span-2">VLAN / segments<textarea name="vlans" maxlength="2000" rows="3">${escapeHtml(details.vlans || "")}</textarea></label></div>${modalActions()}</form>`;
    }
    if (kind === "procedure") { const item = existingId ? state.workspace.procedures.find((entry) => entry.id === existingId) : null; const organizationId = item?.organizationId || activeOrganizationId(); return `<form data-form="procedure" data-id="${escapeHtml(existingId || "")}"><div class="modal-heading"><div><p class="eyebrow">DOCUMENTATION</p><h2 id="modal-title">${item ? "Modifier la procédure" : t("addProcedure")}</h2></div>${close}</div><div class="form-grid">${organizationContextField(organizationId)}<label class="span-2">Titre<input name="title" value="${escapeHtml(item?.title || "")}" required maxlength="160" /></label><label>Catégorie<input name="category" value="${escapeHtml(item?.category || "")}" required maxlength="80" placeholder="Maintenance" /></label><label>Responsable<input name="owner" value="${escapeHtml(item?.owner || "")}" maxlength="96" /></label><label>${t("status")}<select name="status"><option value="review" ${item?.status === "review" ? "selected" : ""}>En révision</option><option value="published" ${item?.status === "published" ? "selected" : ""}>Publiée</option><option value="archived" ${item?.status === "archived" ? "selected" : ""}>Archivée</option></select></label><label class="span-2">Résumé<textarea name="summary" required maxlength="1000" rows="3">${escapeHtml(item?.summary || "")}</textarea></label><label class="span-2">Étapes (une par ligne)<span class="mention-field"><textarea name="steps" data-relate-input required maxlength="6000" rows="7" placeholder="Tapez @ puis le nom d’une fiche pour la relier">${escapeHtml((item?.steps || []).join("\n"))}</textarea><div class="mention-picker" data-mention-picker hidden></div></span><small>Tapez @nom-de-fiche puis choisissez un résultat; le lien inverse sera créé à l’enregistrement.</small></label></div>${modalActions()}</form>`; }
    if (kind === "relation") {
      const item = existingId ? state.workspace.relations.find((entry) => entry.id === existingId) : null;
      const preset = assetByRef(item?.sourceRef || state.relationPresetRef);
      const organizationId = item?.organizationId || preset?.organizationId || activeOrganizationId();
      const typeId = item?.relationType || "related-to";
      return `<form data-form="relation" data-id="${escapeHtml(existingId || "")}"><div class="modal-heading"><div><p class="eyebrow">CARTOGRAPHIE UNIVERSELLE</p><h2 id="modal-title">${item ? "Modifier la relation" : "Nouvelle relation"}</h2><p>Les deux objets restent dans l’organisation active.</p></div>${close}</div><div class="form-grid">${organizationContextField(organizationId)}<label>Source<select name="sourceRef" data-relation-source required>${assetOptions(organizationId, item?.sourceRef || preset?.ref || "")}</select></label><label>Cible<select name="targetRef" data-relation-target required>${assetOptions(organizationId, item?.targetRef || "", item?.sourceRef || preset?.ref || "")}</select></label><label class="span-2">Type de relation<select name="relationType" data-relation-type>${relationshipTypes.map((type) => `<option value="${type.id}" ${type.id === typeId ? "selected" : ""}>${escapeHtml(type.label)} ↔ ${escapeHtml(type.reverseLabel)}</option>`).join("")}</select></label><label class="span-2">Libellé personnalisé<input name="customLabel" value="${escapeHtml(typeId === "custom" ? item?.label || "" : "")}" maxlength="100" placeholder="Facultatif, utilisé pour une relation personnalisée" /></label><label class="span-2">Notes sur la relation<textarea name="notes" maxlength="1000" rows="3">${escapeHtml(item?.notes || "")}</textarea></label>${item ? `<label class="checkbox-label span-2"><input name="archived" type="checkbox" ${item.archived ? "checked" : ""}/> Archiver ce lien sans le supprimer de l’historique</label>` : ""}<div class="notice span-2">${icon("link", 16)} Le lien inverse est créé automatiquement et la cible archivée restera visible.</div></div>${modalActions()}</form>`;
    }
    if (kind === "template") { const item = existingId ? state.workspace.templates.find((entry) => entry.id === existingId) : null; return `<form data-form="template" data-id="${escapeHtml(existingId || "")}"><div class="modal-heading"><div><p class="eyebrow">STANDARDISATION</p><h2 id="modal-title">${item ? "Modifier le modèle" : "Nouveau modèle"}</h2></div>${close}</div><div class="form-grid"><label class="span-2">Nom du modèle<input name="name" value="${escapeHtml(item?.name || "")}" required maxlength="120" /></label><label class="span-2">Module<select name="moduleId" required>${moduleDefinitions.map((module) => `<option value="${module.id}" ${item?.moduleId === module.id ? "selected" : ""}>${escapeHtml(module.label)}</option>`).join("")}</select></label><label class="span-2">Étiquettes par défaut<input name="defaultTags" value="${escapeHtml((item?.defaultTags || []).join(", "))}" maxlength="300" /></label><label class="span-2">Résumé par défaut<textarea name="defaultSummary" maxlength="1000" rows="3">${escapeHtml(item?.defaultSummary || "")}</textarea></label><label class="span-2">Notes structurées par défaut<textarea name="defaultNotes" maxlength="3000" rows="6">${escapeHtml(item?.defaultNotes || "")}</textarea></label></div>${modalActions()}</form>`; }
    if (kind === "custom-module") {
      const item = existingId ? state.workspace.customModuleDefinitions.find((entry) => entry.id === existingId) : null;
      const iconOptions = [["grid", "Grille"], ["server", "Serveur"], ["network", "Réseau"], ["shield", "Sécurité"], ["file", "Document"], ["users", "Utilisateurs"], ["globe", "Internet"], ["key", "Clé"], ["printer", "Impression"], ["phone", "Téléphonie"], ["wifi", "Sans-fil"], ["refresh", "Sauvegarde"]].map(([value, label]) => `<option value="${value}" ${item?.icon === value ? "selected" : ""}>${label}</option>`).join("");
      const typeOptions = (current = "text") => [["text", "Texte court"], ["textarea", "Texte long"], ["number", "Nombre"], ["date", "Date"], ["url", "URL"], ["email", "Courriel"], ["tel", "Téléphone"], ["select", "Liste de choix"]].map(([value, label]) => `<option value="${value}" ${current === value ? "selected" : ""}>${label}</option>`).join("");
      const rows = Array.from({ length: Math.max(8, item?.fields?.length || 0) }, (_, index) => { const field = item?.fields?.[index] || {}; return `<div class="custom-field-row"><label>Libellé<input name="fieldLabel_${index}" value="${escapeHtml(field.label || "")}" maxlength="80" placeholder="Ex. Numéro de contrat"/></label><label>Type<select name="fieldType_${index}">${typeOptions(field.type)}</select></label><label>Choix (si liste)<input name="fieldOptions_${index}" value="${escapeHtml((field.options || []).join(", "))}" maxlength="500" placeholder="Actif, Suspendu, Fermé"/></label></div>`; }).join("");
      return `<form data-form="custom-module" data-id="${escapeHtml(existingId || "")}"><div class="modal-heading"><div><p class="eyebrow">CONSTRUCTEUR DE MODULE</p><h2 id="modal-title">${item ? "Modifier le module" : "Nouveau module local"}</h2><p>Les champs communs — organisation, titre, responsable, état, échéance, résumé, notes et checklist — sont ajoutés automatiquement.</p></div>${close}</div><div class="form-grid"><label>Nom du module<input name="label" value="${escapeHtml(item?.label || "")}" required maxlength="80" placeholder="Ex. Contrats fournisseurs"/></label><label>Icône<select name="icon">${iconOptions}</select></label><label class="span-2">Description<input name="description" value="${escapeHtml(item?.description || "")}" required maxlength="300" placeholder="Ce que ce registre documente."/></label><label class="span-2">Libellé du titre<input name="titleLabel" value="${escapeHtml(item?.titleLabel || "Nom de la fiche")}" required maxlength="80"/></label><fieldset class="span-2 custom-fields-builder"><legend>Champs métier <small>Au moins 4; laissez une ligne vide pour l’ignorer.</small></legend>${rows}</fieldset><div class="notice span-2">${icon("shield", 16)} Les noms contenant mot de passe, secret, jeton, identifiant d’API ou clé API sont refusés.</div></div>${modalActions(item ? "Enregistrer le module" : "Créer le module")}</form>`;
    }
    if (kind === "guided-import") {
      const preview = state.importPreview;
      if (!preview) return `<div class="modal-heading"><div><h2 id="modal-title">Aucun CSV préparé</h2></div>${close}</div>`;
      const moduleId = preview.target.startsWith("module:") ? preview.target.slice(7) : "";
      const targetModule = moduleMap.get(moduleId);
      const fields = preview.target === "organizations"
        ? [{ key: "name", label: "Nom de la compagnie", required: true, aliases: ["nom", "name", "compagnie", "company", "organisation", "organization"] }, { key: "code", label: "Code court", aliases: ["code", "sigle"] }, { key: "industry", label: "Secteur", aliases: ["secteur", "industry"] }, { key: "owner", label: "Responsable", aliases: ["responsable", "owner"] }, { key: "notes", label: "Notes", aliases: ["notes", "description"] }]
        : preview.target === "configurations"
          ? [{ key: "name", label: "Nom", required: true, aliases: ["nom", "name", "hostname", "hote"] }, { key: "type", label: "Type", aliases: ["type", "categorie", "category"] }, { key: "os", label: "Système / OS", aliases: ["os", "systeme", "operating system"] }, { key: "ip", label: "Adresse IP", aliases: ["ip", "adresse ip", "ip address"] }, { key: "owner", label: "Responsable", aliases: ["responsable", "owner"] }, { key: "location", label: "Emplacement", aliases: ["emplacement", "location"] }, { key: "summary", label: "Résumé", aliases: ["resume", "summary", "description"] }, { key: "notes", label: "Notes", aliases: ["notes"] }]
          : [{ key: "title", label: targetModule?.titleLabel || "Titre", required: true, aliases: ["titre", "title", "nom", "name"] }, { key: "owner", label: "Responsable", aliases: ["responsable", "owner"] }, { key: "status", label: "État", aliases: ["etat", "status"] }, { key: "reference", label: "Référence / URL", aliases: ["reference", "url"] }, { key: "expiresOn", label: "Échéance", aliases: ["echeance", "expiration", "expires"] }, { key: "tags", label: "Étiquettes", aliases: ["etiquettes", "tags"] }, { key: "summary", label: "Résumé", aliases: ["resume", "summary", "description"] }, { key: "notes", label: "Notes", aliases: ["notes"] }, ...(moduleProfile(targetModule).fields || []).map((field) => ({ key: `detail_${field.key}`, label: field.label, aliases: [field.label, field.key] }))];
      const headerOptions = (field) => {
        const normalized = preview.headers.map(normalizeSearch);
        const match = normalized.findIndex((header) => field.aliases.some((alias) => header === normalizeSearch(alias)));
        return `<option value="">Ignorer</option>${preview.headers.map((header, index) => `<option value="${index}" ${index === match ? "selected" : ""}>${escapeHtml(header)}</option>`).join("")}`;
      };
      const mapping = fields.map((field) => `<label>${escapeHtml(field.label)}${field.required ? " *" : ""}<select name="map_${field.key}" ${field.required ? "required" : ""}>${headerOptions(field)}</select></label>`).join("");
      const organizationField = preview.target === "organizations" ? "" : `<label class="span-2">Organisation de destination<select name="organizationId" required><option value="">Choisir une organisation</option>${state.workspace.organizations.map((organization) => `<option value="${escapeHtml(organization.id)}" ${organization.id === activeOrganizationId() ? "selected" : ""}>${escapeHtml(organizationPathLabel(organization.id))}</option>`).join("")}</select><small>Les lignes sont ajoutées uniquement à cette organisation; aucune portée globale implicite.</small></label>`;
      const sampleRows = preview.rows.slice(0, 5);
      return `<form data-form="guided-import"><div class="modal-heading"><div><p class="eyebrow">APERÇU CSV</p><h2 id="modal-title">${escapeHtml(preview.fileName)}</h2><p>${preview.rows.length} ligne${preview.rows.length === 1 ? "" : "s"} vers ${escapeHtml(preview.target === "organizations" ? "Organisations" : preview.target === "configurations" ? "Configurations" : targetModule?.label || "Module")}. Aucun enregistrement n’est encore écrit.</p></div>${close}</div><div class="guided-import-layout"><section><h3>1. Associer les colonnes</h3><div class="form-grid">${organizationField}${preview.target === "configurations" ? `<label class="span-2">Site par défaut<select name="siteId"><option value="">Aucun site</option>${siteOptions("", activeOrganizationId())}</select></label>` : ""}${mapping}</div></section><section><h3>2. Vérifier l’aperçu</h3><div class="table-scroll"><table><thead><tr>${preview.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${sampleRows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div><div class="notice">${icon("history", 16)} L’import complet sera enregistré dans une seule révision. La page Versions permettra un retour arrière.</div></section></div><p class="form-error" role="alert"></p>${modalActions(`Importer ${preview.rows.length} ligne${preview.rows.length === 1 ? "" : "s"}`)}</form>`;
    }
    if (kind === "user") {
      const item = existingId ? state.users.find((user) => user.id === existingId) : null;
      const role = item?.role || "editor";
      const allOrganizations = !item || item.organizationIds === null || role === "administrator";
      const vaultAccess = role === "administrator" || (item ? item.vaultAccess !== false : false);
      const permissionByOrganization = new Map((item?.organizationPermissions || []).map((permission) => [permission.organizationId, permission]));
      const organizationRows = [...state.workspace.organizations].sort((a, b) => organizationPathLabel(a.id).localeCompare(organizationPathLabel(b.id), state.locale)).map((organization) => {
        const permission = permissionByOrganization.get(organization.id);
        const selected = allOrganizations || item?.organizationIds?.includes(organization.id);
        const scopedRole = permission?.role || role;
        const scopedVault = permission ? permission.vaultAccess === true : vaultAccess;
        const pathLabel = organizationPathLabel(organization.id);
        const searchable = normalizeSearch([pathLabel, organization.code, organization.industry, organization.owner].join(" "));
        return `<article class="organization-permission-row" data-organization-permission-row data-organization-label="${escapeHtml(searchable)}">
          <label class="organization-permission-identity"><input name="organizationIds" type="checkbox" value="${escapeHtml(organization.id)}" ${selected ? "checked" : ""} ${allOrganizations || role === "administrator" ? "disabled" : ""} /><span class="org-mark">${escapeHtml(organization.code)}</span><span><strong>${escapeHtml(organization.name)}</strong><small>${escapeHtml(organization.parentOrganizationId ? pathLabel : organization.industry || organization.owner || "Organisation Atlas")}</small></span></label>
          <label class="organization-permission-role"><span>Documentation</span><select name="orgRole_${escapeHtml(organization.id)}" aria-label="Rôle documentaire pour ${escapeHtml(organization.name)}" ${allOrganizations || role === "administrator" || !selected ? "disabled" : ""}><option value="viewer" ${scopedRole === "viewer" ? "selected" : ""}>Lecture seule</option><option value="editor" ${scopedRole === "editor" ? "selected" : ""}>Édition</option></select></label>
          <label class="organization-permission-vault"><input name="orgVault_${escapeHtml(organization.id)}" type="checkbox" ${scopedVault ? "checked" : ""} ${allOrganizations || role === "administrator" || !selected ? "disabled" : ""}/><span><strong>Coffre</strong><small>Secrets</small></span></label>
        </article>`;
      }).join("");
      return `<form data-form="user" data-id="${escapeHtml(existingId || "")}">
        <div class="modal-heading"><div><p class="eyebrow">ACCÈS LOCAL</p><h2 id="modal-title">${item ? "Modifier les accès" : "Nouveau compte"}</h2><p>${item ? `Ajustez les permissions de ${escapeHtml(item.displayName)}. Ses sessions seront fermées à l’enregistrement.` : "Créez un compte Atlas autonome avec MFA obligatoire."}</p></div>${close}</div>
        <div class="form-grid account-permission-form">
          <label class="span-2">Nom affiché<input name="displayName" value="${escapeHtml(item?.displayName || "")}" required maxlength="96" /></label>
          <label>Nom d’utilisateur<input name="username" value="${escapeHtml(item?.username || "")}" required minlength="3" maxlength="64" autocomplete="off" ${item ? "readonly" : ""} /></label>
          <label>Rôle documentaire<select name="role"><option value="editor" ${role === "editor" ? "selected" : ""}>Édition</option><option value="viewer" ${role === "viewer" ? "selected" : ""}>Lecture seule</option><option value="administrator" ${role === "administrator" ? "selected" : ""}>Administrateur</option></select><small>Contrôle la création et la modification des fiches.</small></label>
          ${item ? "" : '<label class="span-2">Mot de passe temporaire<input name="password" type="password" required minlength="10" maxlength="256" autocomplete="new-password" /><small>Au moins 10 caractères. Le MFA sera configuré à la première connexion.</small></label>'}
          <fieldset class="vault-access-field span-2"><legend>Coffre de mots de passe</legend><label class="permission-switch"><input name="vaultAccess" type="checkbox" data-vault-access ${vaultAccess ? "checked" : ""} ${role === "administrator" ? "disabled" : ""} /><span><strong>Autoriser l’accès aux mots de passe</strong><small>Ce droit est indépendant du rôle documentaire. Un compte en lecture seule peut consulter et révéler les secrets sans pouvoir modifier les fiches.</small></span></label></fieldset>
          <fieldset class="organization-access-field span-2 ${allOrganizations ? "is-global" : ""}"><legend>Accès par compagnie</legend><div class="organization-access-heading"><div><strong>Portée des permissions</strong><small>Choisissez un accès global ou définissez les droits compagnie par compagnie.</small></div><span>${state.workspace.organizations.length} compagnie${state.workspace.organizations.length === 1 ? "" : "s"}</span></div><label class="organization-access-mode"><input name="allOrganizations" type="checkbox" ${allOrganizations ? "checked" : ""} data-all-organizations ${role === "administrator" ? "disabled" : ""} /><span class="organization-access-mode-icon">${icon("building", 18)}</span><span><strong>Toutes les compagnies</strong><small>Applique le rôle documentaire et l’accès coffre définis plus haut, y compris aux futures compagnies.</small></span><span class="organization-access-mode-state">${allOrganizations ? "Actif" : "Désactivé"}</span></label><div class="organization-global-summary" data-organization-global-summary ${allOrganizations ? "" : "hidden"}>${icon("check", 17)}<span><strong>Accès global actif</strong><small>${state.workspace.organizations.length} compagnie${state.workspace.organizations.length === 1 ? "" : "s"} · ${roleLabel(role)} · coffre ${vaultAccess ? "autorisé" : "masqué"}</small></span></div><div class="organization-custom-permissions" data-organization-custom ${allOrganizations ? "hidden" : ""}><div class="organization-access-toolbar"><div><strong>Permissions personnalisées</strong><small>Cochez les compagnies autorisées, puis attribuez leur rôle et leur accès au coffre.</small></div><label class="organization-permission-search">${icon("search", 15)}<input type="search" data-organization-access-filter placeholder="Filtrer les compagnies…" aria-label="Filtrer les compagnies" /></label></div><div class="organization-permission-columns" aria-hidden="true"><span>Compagnie</span><span>Documentation</span><span>Coffre</span></div><div data-organization-access-list>${organizationRows}</div><p class="organization-access-empty" data-organization-access-empty hidden>Aucune compagnie ne correspond à cette recherche.</p></div><small class="organization-access-help">Les droits sont isolés par compagnie. Un administrateur conserve automatiquement l’accès complet.</small></fieldset>
          ${privilegedMfaField()}
          <div class="account-security-notice span-2">${icon("shield", 18)}<span><strong>MFA TOTP obligatoire</strong><small>${item ? "La modification des accès ne désactive pas le MFA. Utilisez l’action dédiée seulement si l’utilisateur doit l’enrôler de nouveau." : "Le compte devra remplacer son mot de passe temporaire puis activer son application d’authentification à la première connexion."}</small></span></div>
        </div>${modalActions(item ? "Enregistrer les accès" : "Créer le compte")}
      </form>`;
    }
    if (kind === "user-password-reset") {
      const item = state.users.find((user) => user.id === existingId);
      if (!item) return "";
      return `<form data-form="user-password-reset" data-id="${escapeHtml(existingId)}"><div class="modal-heading"><div><p class="eyebrow">SÉCURITÉ DU COMPTE</p><h2 id="modal-title">Nouveau mot de passe</h2><p>${escapeHtml(item.displayName)} devra remplacer ce mot de passe temporaire à sa prochaine connexion.</p></div>${close}</div><div class="form-grid"><label class="span-2">Nouveau mot de passe temporaire<input name="password" type="password" required minlength="10" maxlength="256" autocomplete="new-password" /></label><label class="span-2">Confirmer le mot de passe<input name="confirmPassword" type="password" required minlength="10" maxlength="256" autocomplete="new-password" /></label>${privilegedMfaField()}<div class="account-security-notice warning span-2">${icon("alert", 18)}<span><strong>Toutes les sessions seront fermées</strong><small>Le MFA existant reste actif. L’utilisateur devra changer ce mot de passe avant d’ouvrir Atlas.</small></span></div></div>${modalActions("Réinitialiser le mot de passe")}</form>`;
    }
    if (kind === "privileged-action") {
      const pending = state.pendingPrivilegedAction;
      const labels = { "toggle-user": ["Modifier l’état du compte", "Confirmez l’activation ou la désactivation de ce compte."], "reset-user-mfa": ["Réinitialiser le MFA", "L’utilisateur devra enrôler un nouvel authentificateur; toutes ses sessions seront fermées."], "revoke-user-sessions": ["Fermer les sessions", "Toutes les sessions actives de cet utilisateur seront immédiatement fermées."] };
      const copy = labels[pending?.action] || ["Confirmer l’action", "Cette action modifie la sécurité du compte."];
      return `<form data-form="privileged-action"><div class="modal-heading"><div><p class="eyebrow">ACTION SENSIBLE</p><h2 id="modal-title">${escapeHtml(copy[0])}</h2><p>${escapeHtml(copy[1])}</p></div>${close}</div><div class="form-grid"><div class="account-security-notice warning span-2">${icon("alert", 18)}<span><strong>${escapeHtml(pending?.userName || "Compte local")}</strong><small>L’action sera inscrite dans le journal d’audit local.</small></span></div>${privilegedMfaField()}</div>${modalActions("Confirmer", true)}</form>`;
    }
    if (kind === "recovery-codes-regenerate") return `<form data-form="recovery-codes-regenerate"><div class="modal-heading"><div><p class="eyebrow">RÉCUPÉRATION</p><h2 id="modal-title">Générer de nouveaux codes</h2><p>Les codes de récupération actuels deviendront immédiatement invalides.</p></div>${close}</div><div class="form-grid"><label class="span-2">Code MFA actuel<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required autofocus placeholder="000000" /></label></div>${modalActions("Générer les codes")}</form>`;
    if (kind === "recovery-codes-display") return `<div><div class="modal-heading"><div><p class="eyebrow">À CONSERVER MAINTENANT</p><h2 id="modal-title">Nouveaux codes de récupération</h2><p>Chaque code fonctionne une seule fois et ne sera plus affiché.</p></div>${close}</div><div class="form-grid"><div class="recovery-codes span-2">${state.recoveryCodes.map((code) => `<code>${escapeHtml(code)}</code>`).join("")}</div><div class="notice span-2">${icon("shield", 16)} Conservez-les dans un endroit sûr distinct de cette instance.</div></div><div class="modal-actions"><button class="primary" type="button" data-action="close-recovery-codes">J’ai conservé mes codes</button></div></div>`;
    if (kind === "self-mfa-reenroll") return `<form data-form="self-mfa-reenroll"><div class="modal-heading"><div><p class="eyebrow">REMPLACER LE MFA</p><h2 id="modal-title">Vérifier votre identité</h2><p>Votre MFA actuel reste valide jusqu’à la confirmation du nouveau secret.</p></div>${close}</div><div class="form-grid"><label class="span-2">Mot de passe actuel<input name="password" type="password" autocomplete="current-password" required /></label><label class="span-2">Code MFA actuel<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required placeholder="000000" /></label></div>${modalActions("Continuer")}</form>`;
    if (kind === "vault-unlock") return `<form data-form="vault-unlock"><div class="modal-heading"><div><p class="eyebrow">COFFRE LOCAL</p><h2 id="modal-title">Vérification MFA</h2><p>Entrez un code TOTP actuel. Le coffre restera ouvert jusqu’à la déconnexion ou l’expiration de cette session Atlas.</p></div>${close}</div><div class="form-grid"><label class="span-2">Code MFA<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required autofocus placeholder="000000" /></label></div>${modalActions()}</form>`;
    if (kind === "vault-item") {
      const item = state.revealedVaultItem?.id === existingId ? state.revealedVaultItem : null;
      const organizationId = item?.organizationId || activeOrganizationId();
      return `<form data-form="vault-item" data-id="${escapeHtml(existingId || "")}"><div class="modal-heading"><div><p class="eyebrow">COFFRE CHIFFRÉ</p><h2 id="modal-title">${item ? "Modifier l’entrée" : "Nouvelle entrée"}</h2></div>${close}</div><div class="form-grid">${organizationContextField(organizationId)}<label class="span-2">Titre<input name="title" value="${escapeHtml(item?.title || "")}" required maxlength="160" /></label><label>Catégorie<input name="category" value="${escapeHtml(item?.category || "Général")}" maxlength="80" /></label><label>Nom d’utilisateur<input name="username" value="${escapeHtml(item?.username || "")}" maxlength="300" autocomplete="off" /></label><label>Mot de passe<input name="password" type="password" value="${escapeHtml(item?.password || "")}" maxlength="4096" autocomplete="new-password" /></label><label class="span-2">URL<input name="url" type="url" value="${escapeHtml(item?.url || "")}" maxlength="1000" /></label><label class="span-2">Secret OTP Base32 (facultatif)<input name="otpSecret" value="" maxlength="256" autocomplete="off" placeholder="Laisser vide pour conserver l’OTP actuel ou ne pas en créer" /></label><div class="form-section-label span-2"><span>${icon("clock", 16)}</span><div><strong>Cycle de vie du mot de passe</strong><small>${state.workspace.settings.security.passwordRotationEnabled ? "Les rappels de rotation sont actifs pour cette instance." : "Les dates sont conservées, mais les rappels sont désactivés dans Paramètres."}</small></div></div><label>Dernière rotation<input name="passwordChangedAt" type="date" value="${escapeHtml(String(item?.passwordChangedAt || new Date().toISOString()).slice(0, 10))}" /></label><label>Date d’expiration<input name="expiresAt" type="date" value="${escapeHtml(String(item?.expiresAt || "").slice(0, 10))}" /></label><label>Responsable de rotation<input name="rotationOwner" value="${escapeHtml(item?.rotationOwner || "")}" maxlength="120" /></label><label>Fréquence propre (jours)<input name="rotationIntervalDays" type="number" min="0" max="730" value="${Number(item?.rotationIntervalDays) || ""}" placeholder="Politique par défaut" /></label><label class="span-2">Notes<textarea name="notes" maxlength="5000" rows="5">${escapeHtml(item?.notes || "")}</textarea></label>${item ? `<label class="checkbox-label span-2"><input name="archived" type="checkbox" ${item.archived ? "checked" : ""}/> Archiver cette entrée</label>` : ""}<div class="notice span-2">${icon("shield", 16)} Le secret est chiffré côté serveur avant écriture et n’est jamais ajouté à l’espace de travail.</div></div>${modalActions()}</form>`;
    }
    if (kind === "module-record") {
      const module = moduleMap.get(moduleId);
      const item = existingId ? state.workspace.moduleRecords.find((record) => record.id === existingId && record.moduleId === moduleId) : null;
      const template = !item && state.activeTemplate?.moduleId === moduleId ? state.activeTemplate : null;
      if (!module) return `<div class="modal-heading"><h2 id="modal-title">Module introuvable</h2>${close}</div>`;
      const profile = moduleProfile(module);
      const organizationId = item?.organizationId || activeOrganizationId();
      return `<form data-form="module-record" data-id="${escapeHtml(existingId || "")}" data-module-id="${module.id}"><div class="modal-heading"><div><p class="eyebrow">${escapeHtml(module.label.toUpperCase())}</p><h2 id="modal-title">${item ? "Modifier la fiche" : "Nouvelle fiche"}</h2></div>${close}</div><div class="form-grid">
        ${organizationContextField(organizationId)}
        <label class="span-2">${escapeHtml(profile.titleLabel)}<input name="title" value="${escapeHtml(item?.title || "")}" required maxlength="160" /></label>
        <label>${t("site")}<select name="siteId"><option value="">Aucun site précis</option>${siteOptions(item?.siteId, organizationId)}</select></label>
        <label>${escapeHtml(profile.ownerLabel)}<input name="owner" value="${escapeHtml(item?.owner || "")}" maxlength="96" /></label>
        <label>${t("status")}<select name="status"><option value="active" ${item?.status === "active" ? "selected" : ""}>Active</option><option value="review" ${item?.status === "review" ? "selected" : ""}>À réviser</option><option value="archived" ${item?.status === "archived" ? "selected" : ""}>Archivée</option></select></label>
        <label>${escapeHtml(profile.expiryLabel)}<input name="expiresOn" type="date" value="${escapeHtml(item?.expiresOn || "")}" ${profile.expiryRequired ? "required" : ""}/></label>
        <label>${escapeHtml(profile.referenceLabel)}<input name="reference" value="${escapeHtml(item?.reference || "")}" maxlength="500" ${profile.referenceRequired ? "required" : ""}/></label>
        ${moduleProfileFieldsMarkup(module, item)}
        <label class="span-2">Étiquettes<input name="tags" value="${escapeHtml((item?.tags || template?.defaultTags || []).join(", "))}" maxlength="300" placeholder="production, critique, renouvellement" /></label>
        <label class="span-2">Résumé<textarea name="summary" maxlength="1000" rows="3">${escapeHtml(item?.summary || template?.defaultSummary || "")}</textarea></label>
        <label class="span-2">Notes opérationnelles<span class="mention-field"><textarea name="notes" data-relate-input maxlength="4000" rows="6" placeholder="Tapez @ puis le nom d’une fiche pour la relier">${escapeHtml(item?.notes || template?.defaultNotes || "")}</textarea><div class="mention-picker" data-mention-picker hidden></div></span><small>Tapez @nom-de-fiche pour créer une relation bidirectionnelle à l’enregistrement.</small></label>
        ${module.id === "checklists" ? `<label class="span-2">Étapes de la checklist<textarea name="checklistSteps" maxlength="5000" rows="8" placeholder="[ ] Étape à faire&#10;[x] Étape terminée">${escapeHtml((item?.checklist || []).map((step) => `[${step.done ? "x" : " "}] ${step.label}`).join("\n"))}</textarea><small>Utilisez [x] pour une étape terminée et [ ] pour une étape à faire.</small></label>` : ""}
        ${module.id === "passwords" ? `<div class="notice span-2">${icon("shield", 16)} Aucun champ secret n’est stocké dans les données de travail Atlas.</div>` : ""}
      </div>${modalActions()}</form>`;
    }
    const item = existingId ? configById(existingId) : null;
    const organizationId = item?.organizationId || activeOrganizationId();
    return `<form data-form="configuration" data-id="${escapeHtml(existingId || "")}"><div class="modal-heading"><div><p class="eyebrow">INVENTAIRE</p><h2 id="modal-title">${item ? "Modifier la configuration" : t("addConfiguration")}</h2></div>${close}</div><div class="form-grid">${organizationContextField(organizationId)}<label>${t("site")}<select name="siteId" required>${siteOptions(item?.siteId, organizationId)}</select></label><label class="span-2">Nom<input name="name" value="${escapeHtml(item?.name || "")}" required maxlength="120" /></label><label>${t("type")}<select name="type">${["Serveur", "Poste", "Stockage", "Réseau", "Service", "Autre"].map((value) => `<option ${item?.type === value ? "selected" : ""}>${value}</option>`).join("")}</select></label><label>Système<input name="os" value="${escapeHtml(item?.os || "")}" maxlength="120" /></label><label>Adresse IP<input name="ip" value="${escapeHtml(item?.ip || "")}" maxlength="80" /></label><label>${t("criticality")}<select name="criticality"><option value="normal">Normale</option><option value="low" ${item?.criticality === "low" ? "selected" : ""}>Faible</option><option value="high" ${item?.criticality === "high" ? "selected" : ""}>Élevée</option><option value="critical" ${item?.criticality === "critical" ? "selected" : ""}>Critique</option></select></label><label>${t("owner")}<input name="owner" value="${escapeHtml(item?.owner || "")}" maxlength="96" /></label><label>${t("location")}<input name="location" value="${escapeHtml(item?.location || "")}" maxlength="160" /></label><label>${t("warranty")}<input name="warranty" type="date" value="${escapeHtml(item?.warranty || "")}" /></label><label>${t("status")}<select name="status"><option value="draft" ${item?.status === "draft" ? "selected" : ""}>Brouillon</option><option value="review" ${item?.status === "review" ? "selected" : ""}>À réviser</option><option value="documented" ${item?.status === "documented" ? "selected" : ""}>Documentée</option></select></label><label class="span-2">Résumé<textarea name="summary" maxlength="1000" rows="3">${escapeHtml(item?.summary || "")}</textarea></label><label class="span-2">Notes opérationnelles<textarea name="notes" maxlength="2000" rows="4">${escapeHtml(item?.notes || "")}</textarea></label></div>${modalActions()}</form>`;
  }

  function modalActions(submitLabel = t("save"), destructive = false) {
    return `<div class="modal-actions"><div class="form-error" role="alert"></div><button class="secondary" type="button" data-action="close-modal">${t("cancel")}</button><button class="primary ${destructive ? "danger" : ""}" type="submit">${escapeHtml(submitLabel)}</button></div>`;
  }

  function privilegedMfaField() {
    if (!state.workspace?.settings?.security?.privilegedMfaEnabled) return `<div class="notice span-2">${icon("shield", 16)} La validation MFA renforcée est désactivée dans Paramètres; l’action reste journalisée.</div>`;
    return `<label class="span-2">Code MFA administrateur<input name="adminMfaCode" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required placeholder="000000" /><small>Validation renforcée requise par la politique de sécurité Atlas.</small></label>`;
  }

  function siteOptions(selected = "", organizationId = "") {
    return state.workspace.sites.filter((site) => !organizationId || site.organizationId === organizationId).map((site) => `<option value="${site.id}" ${selected === site.id ? "selected" : ""}>${escapeHtml(site.name)}</option>`).join("");
  }

  function configurationOptions(selected = "") {
    return state.workspace.configurations.map((item) => `<option value="${item.id}" ${selected === item.id ? "selected" : ""}>${escapeHtml(item.name)} — ${escapeHtml(orgName(item.organizationId))}</option>`).join("");
  }

  function closeModal() {
    overlayRoot.innerHTML = "";
    state.relationPresetRef = "";
    state.pendingPrivilegedAction = null;
  }

  function toast(message, type = "success") {
    const node = document.createElement("div");
    node.className = `toast ${type}`;
    node.innerHTML = `${icon(type === "success" ? "check" : "alert", 17)}<span>${escapeHtml(message)}</span>`;
    document.body.append(node);
    setTimeout(() => node.classList.add("visible"), 10);
    setTimeout(() => { node.classList.remove("visible"); setTimeout(() => node.remove(), 200); }, 3200);
  }

  async function commit(mutator, action, target, kind) {
    const previous = structuredClone(state.workspace);
    mutator(state.workspace);
    const currentAsset = state.page === "asset" ? assetByRef(state.detailId) : null;
    const organizationId = currentAsset?.organizationId || activeOrganizationId();
    state.workspace.activities.unshift({ id: `act-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`, at: new Date().toISOString(), actor: state.user.displayName, action, target, kind, organizationId });
    state.workspace.activities = state.workspace.activities.slice(0, 500);
    try {
      state.saving = true;
      const document = await api("/api/workspace", { method: "PUT", body: JSON.stringify({ revision: state.revision, data: state.workspace }) });
      state.workspace = document.data;
      state.revision = document.revision;
      normalizeWorkspace();
      await loadWorkspaceHistory();
      if (state.page === "asset" && state.detailId) await loadAssetHistory(state.detailId);
      state.saving = false;
      closeModal();
      render();
      toast(t("saved"));
    } catch (error) {
      state.workspace = previous;
      state.saving = false;
      if (error.code === "revision_conflict") await loadWorkspace();
      render();
      toast(error.message, "error");
      throw error;
    }
  }

  function normalizeSearch(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase(state.locale).trim();
  }

  function searchResultTypePriority(result) {
    return result.kind === "Organisation" ? 0 : 1;
  }

  function compareSearchResults(a, b, query) {
    const typePriority = searchResultTypePriority(a) - searchResultTypePriority(b);
    if (typePriority) return typePriority;
    const aLabel = normalizeSearch(a.label);
    const bLabel = normalizeSearch(b.label);
    return Number(aLabel !== query) - Number(bLabel !== query)
      || Number(!aLabel.startsWith(query)) - Number(!bLabel.startsWith(query))
      || a.label.localeCompare(b.label, state.locale);
  }

  function procedureOrganizationIds(procedureId) {
    return [...new Set(state.workspace.configurations.filter((configuration) => (configuration.procedureIds || []).includes(procedureId)).map((configuration) => configuration.organizationId))];
  }

  function searchEntries(rawQuery, scope = state.searchScope) {
    const query = normalizeSearch(rawQuery);
    if (!query) return [];
    const results = [];
    const add = (result, values) => {
      const organizationIds = [...new Set((result.organizationIds || []).filter(Boolean))];
      if (scope !== "global" && !organizationIds.includes(scope)) return;
      if (!normalizeSearch(values.flat().join(" ")).includes(query)) return;
      results.push({ ...result, organizationIds });
    };

    for (const item of state.workspace.organizations) add({ kind: "Organisation", icon: "building", label: item.name, meta: `${item.code} · ${item.industry || "Secteur non renseigné"}`, route: `organization/${item.id}`, organizationIds: [item.id], editAction: "edit-organization", id: item.id }, [item.id, item.name, item.code, item.owner, item.industry, item.notes, item.quickNotes, ...Object.values(item.details || {})]);
    for (const item of state.workspace.sites) add({ kind: "Site", icon: "pin", label: item.name, meta: `${orgName(item.organizationId)} · ${item.address || "Adresse non renseignée"}`, route: "sites", assetRef: `site:${item.id}`, filterOrg: item.organizationId, organizationIds: [item.organizationId], editAction: "edit-site", id: item.id }, [item.id, item.name, item.address, item.timezone, ...Object.values(item.details || {}), orgName(item.organizationId)]);
    for (const item of state.workspace.configurations) add({ kind: "Configuration", icon: "server", label: item.name, meta: `${orgName(item.organizationId)} · ${item.type}`, route: `configuration/${item.id}`, assetRef: `configuration:${item.id}`, organizationIds: [item.organizationId], editAction: "edit-configuration", id: item.id }, [item.id, item.name, item.type, item.os, item.owner, item.ip, item.location, item.summary, item.notes, ...Object.values(item.details || {}), orgName(item.organizationId), siteName(item.siteId)]);
    for (const item of state.workspace.procedures) {
      const organizationIds = [item.organizationId].filter(Boolean);
      add({ kind: "Procédure", icon: "book", label: item.title, meta: `Procédure · ${item.category}${organizationIds.length ? ` · ${organizationIds.map(orgName).join(", ")}` : ""}`, route: "procedures", assetRef: `procedure:${item.id}`, organizationIds, editAction: "edit-procedure", id: item.id }, [item.id, item.title, item.category, item.owner, item.summary, ...(item.steps || [])]);
    }
    for (const item of state.workspace.moduleRecords) {
      const module = moduleMap.get(item.moduleId);
      if (!module) continue;
      add({ kind: module.label, icon: module.icon, label: item.title, meta: `${module.label} · ${orgName(item.organizationId)}`, route: `module/${module.id}`, assetRef: `module:${item.id}`, filterOrg: item.organizationId, organizationIds: [item.organizationId], editAction: "edit-module-record", id: item.id, moduleId: module.id }, [item.id, item.title, item.owner, item.summary, item.notes, item.reference, ...(item.tags || []), ...Object.values(item.details || {}), module.label, orgName(item.organizationId), siteName(item.siteId)]);
    }
    for (const item of state.vaultItems) add({ kind: "Mot de passe", icon: "key", label: item.title, meta: `Mot de passe · ${orgName(item.organizationId)} · ${item.category}`, route: "module/passwords", assetRef: `vault:${item.id}`, filterOrg: item.organizationId, organizationIds: [item.organizationId], id: item.id }, [item.id, item.title, item.category, orgName(item.organizationId)]);
    for (const item of state.workspace.relations) {
      const source = assetByRef(item.sourceRef); const target = assetByRef(item.targetRef);
      const organizationIds = [item.organizationId].filter(Boolean);
      add({ kind: "Relation", icon: "link", label: `${source?.label || item.sourceRef} → ${target?.label || item.targetRef}`, meta: `Relation · ${item.label}${item.archived ? " · Archivée" : ""}`, route: "relations", organizationIds, editAction: "edit-relation", id: item.id }, [item.id, item.label, item.reverseLabel, item.notes, source?.label, target?.label, ...organizationIds.map(orgName)]);
    }
    if (scope === "global") for (const item of state.workspace.templates) {
      const module = moduleMap.get(item.moduleId);
      add({ kind: "Modèle", icon: "file", label: item.name, meta: `Modèle · ${module?.label || "Tous modules"}`, route: "templates", organizationIds: [], editAction: "edit-template", id: item.id }, [item.id, item.name, item.defaultSummary, ...(item.defaultTags || []), module?.label]);
    }

    return results.sort((a, b) => compareSearchResults(a, b, query));
  }

  function searchResultMarkup(result, compact = true) {
    const filterAttribute = result.filterOrg ? ` data-filter-org="${escapeHtml(result.filterOrg)}"` : "";
    const moduleAttribute = result.moduleId ? ` data-module-id="${escapeHtml(result.moduleId)}"` : "";
    const edit = canWrite() && result.editAction ? `<button class="search-result-edit" data-action="${result.editAction}" data-id="${escapeHtml(result.id)}"${moduleAttribute} aria-label="Modifier ${escapeHtml(result.label)}">${icon("edit", 15)}</button>` : "";
    const openAttributes = result.assetRef ? ` data-action="open-asset" data-asset-ref="${escapeHtml(result.assetRef)}"` : ` data-route="${escapeHtml(result.route)}"${filterAttribute}`;
    return `<div class="search-result-row ${compact ? "compact" : ""}"><button class="search-result-open"${openAttributes}><span class="type-icon">${icon(result.icon, 15)}</span><span><strong>${escapeHtml(result.label)}</strong><small>${escapeHtml(result.meta)}</small></span><span class="search-result-kind">${escapeHtml(result.kind)}</span>${icon("chevron", 15)}</button>${edit}</div>`;
  }

  function searchResultsMarkup(results, limit = 12, compact = true) {
    const visible = results.slice(0, limit);
    const organizationCount = results.filter((result) => result.kind === "Organisation").length;
    const visibleOrganizations = visible.filter((result) => result.kind === "Organisation");
    const visibleOthers = visible.filter((result) => result.kind !== "Organisation");
    const section = (label, count, items, key) => items.length ? `<section class="search-result-section" data-search-result-section="${key}"><div class="search-result-section-title"><span>${label}</span><strong>${count}</strong></div>${items.map((result) => searchResultMarkup(result, compact)).join("")}</section>` : "";
    const organizationLabel = state.locale === "fr" ? "Organisations" : "Organizations";
    const otherLabel = state.locale === "fr" ? "Autres résultats" : "Other results";
    const footer = results.length > visible.length ? `<div class="search-results-footer"><strong>${visible.length} ${state.locale === "fr" ? "affichés" : "shown"} ${state.locale === "fr" ? "sur" : "of"} ${results.length}</strong><span>${state.locale === "fr" ? "Affinez la recherche pour réduire la liste." : "Refine the search to narrow the list."}</span></div>` : "";
    return `${section(organizationLabel, organizationCount, visibleOrganizations, "organizations")}${section(otherLabel, results.length - organizationCount, visibleOthers, "others")}${footer}`;
  }

  function renderSearchResults() {
    const container = document.getElementById("search-results");
    if (!container) return;
    const query = state.search.trim();
    if (!query) { container.innerHTML = ""; return; }
    const results = searchEntries(query, state.searchScope);
    container.innerHTML = `<div class="search-popover"><div class="search-popover-heading"><span>${escapeHtml(activeSearchScopeName())}</span><strong>${results.length} résultat${results.length === 1 ? "" : "s"}</strong></div>${results.length ? searchResultsMarkup(results) : `<div class="search-empty">Aucun résultat pour « ${escapeHtml(state.search)} » dans cette portée.</div>`}</div>`;
  }

  function navigate(route) {
    const nextHash = `#/${route}`;
    const sidebarNavigation = document.querySelector("#atlas-navigation > nav");
    if (sidebarNavigation) state.sidebarScrollTop = sidebarNavigation.scrollTop;
    state.preserveSidebarScroll = location.hash !== nextHash;
    const nextPage = route.split("/")[0];
    let nextDetail = route.split("/")[1] || "";
    try { nextDetail = decodeURIComponent(nextDetail); } catch { /* keep the raw route part */ }
    if (nextPage !== state.page || nextDetail !== (state.detailId || "")) {
      state.listSearch = "";
      state.listStatus = "all";
      state.listPage = 1;
    }
    if (nextPage === "organization" && nextDetail) activateOrganizationContext(nextDetail);
    if (["sites", "configurations", "procedures", "module"].includes(nextPage) && state.searchScope !== "global" && state.workspace.organizations.some((organization) => organization.id === state.searchScope)) state.filter = state.searchScope;
    if (nextPage === "relations" && state.searchScope !== "global") state.relationOrganization = state.searchScope;
    if (nextPage !== "organization") state.organizationSearch = "";
    if (!(nextPage === "settings" && nextDetail === "integrations")) {
      state.createdApiToken = "";
      state.createdWebhookSecret = "";
    }
    if (!(nextPage === "asset" && nextDetail === state.relationQuickAddRef)) resetQuickRelationPicker();
    if (state.revealedVaultItem && !(nextPage === "asset" && nextDetail === `vault:${state.revealedVaultItem.id}`)) {
      state.revealedVaultItem = null;
      state.visibleVaultFields.clear();
    }
    state.mobileNavigation = false;
    state.helpMenuOpen = false;
    state.search = "";
    location.hash = nextHash;
  }

  document.addEventListener("click", async (event) => {
    const helpMenuRoot = event.target.closest("[data-help-menu-root]");
    if (!helpMenuRoot && state.helpMenuOpen) {
      state.helpMenuOpen = false;
      document.querySelector(".help-menu-popover")?.remove();
      document.querySelector("[data-action='toggle-help-menu']")?.setAttribute("aria-expanded", "false");
    }
    const searchScopeRoot = event.target.closest("[data-search-scope-root]");
    if (!searchScopeRoot && state.searchScopeOpen) {
      state.searchScopeOpen = false;
      state.searchScopeQuery = "";
      document.querySelector(".search-scope-popover")?.remove();
      document.querySelector("[data-action='toggle-search-scope']")?.setAttribute("aria-expanded", "false");
    }
    const modal = event.target.closest("[data-modal-stop]");
    const scrollTarget = event.target.closest("[data-scroll-target]");
    if (scrollTarget) {
      document.getElementById(scrollTarget.dataset.scrollTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const routeTarget = event.target.closest("[data-route]");
    if (routeTarget) {
      const organizationFilter = routeTarget.dataset.filterOrg;
      if (organizationFilter) { state.filter = organizationFilter; state.searchScope = organizationFilter; }
      navigate(routeTarget.dataset.route);
      return;
    }
    const actionTarget = event.target.closest("[data-action]");
    if (!actionTarget || (modal && actionTarget.classList.contains("modal-backdrop"))) return;
    const action = actionTarget.dataset.action;
    if (action === "dismiss-pwa-install") {
      localStorage.setItem(storageKeys.pwaInstallDismissedUntil, String(Date.now() + (7 * 24 * 60 * 60 * 1000)));
      renderPwaInstallBanner();
      return;
    }
    if (action === "install-pwa") {
      try { await requestPwaInstall(); }
      catch { showPwaInstallInstructions(); }
      return;
    }
    if (action === "toggle-help-menu") {
      state.helpMenuOpen = !state.helpMenuOpen;
      state.searchScopeOpen = false;
      render();
      if (state.helpMenuOpen) requestAnimationFrame(() => document.querySelector(".help-menu-popover [data-route]")?.focus());
      return;
    }
    if (action === "select-help-category") {
      state.helpCategory = actionTarget.dataset.helpCategory || "all";
      state.helpSearch = "";
      if (state.page !== "help" || state.detailId) navigate("help");
      else render();
      return;
    }
    if (action === "clear-help-search") {
      state.helpSearch = "";
      state.helpCategory = "all";
      render();
      requestAnimationFrame(() => document.querySelector("[data-help-search]")?.focus());
      return;
    }
    if (action === "password-health-help") {
      showPasswordHealthHelp();
      return;
    }
    if (action === "open-password-health-breakdown") {
      showPasswordHealthBreakdown();
      return;
    }
    if (action === "open-password-health-organization") {
      const organizationId = actionTarget.dataset.id || "";
      if (!state.workspace.organizations.some((organization) => organization.id === organizationId) || !canAccessVault(organizationId)) return;
      closeModal();
      activateOrganizationContext(organizationId);
      navigate("module/passwords");
      return;
    }
    const writerActions = new Set(["new-organization", "edit-organization", "edit-quick-notes", "new-site", "edit-site", "new-configuration", "edit-configuration", "new-procedure", "edit-procedure", "new-relation", "edit-relation", "add-related-item", "quick-relate-item", "new-template", "edit-template", "use-template", "new-vault-item", "edit-vault-item", "new-module-record", "edit-module-record", "select-file-sharing-server", "remove-file-sharing-server", "select-printing-configuration", "remove-printing-configuration", "restore-workspace", "delete-attachment", "toggle-checklist-step", "toggle-asset-archive"]);
    const administratorActions = new Set(["delete-organization", "new-user", "edit-user", "reset-user-password", "reset-user-mfa", "revoke-user-sessions", "toggle-user", "refresh-site-health", "probe-local-port", "probe-public-site"]);
    if (writerActions.has(action) && !canWrite()) { toast("Ce compte est en consultation seulement.", "error"); return; }
    if (administratorActions.has(action) && !isAdministrator()) { toast("Un compte administrateur local est requis.", "error"); return; }
    if (action === "refresh-site-health") {
      await loadDeploymentHealth();
      toast("État local de l’instance actualisé.");
      return;
    }
    if (action === "probe-public-site") {
      state.deploymentHealthLoading = true;
      render();
      try {
        state.deploymentProbe = await api("/api/settings/deployment/probe", { method: "POST", body: "{}" });
        state.deploymentHealthLoading = false;
        await loadDeploymentHealth({ renderAfter: false });
        toast("Le domaine public, HTTPS et le certificat répondent correctement.");
      } catch (error) {
        state.deploymentProbe = null;
        toast(error.message, "error");
      } finally {
        state.deploymentHealthLoading = false;
        render();
      }
      return;
    }
    if (action === "probe-local-port") {
      state.deploymentHealthLoading = true;
      render();
      try {
        state.deploymentPortProbe = await api("/api/settings/deployment/port-check", { method: "POST", body: "{}" });
        state.deploymentHealthLoading = false;
        await loadDeploymentHealth({ renderAfter: false });
        if (state.deploymentPortProbe.open) toast(`Le port ${state.deploymentPortProbe.port} est ouvert sur cet ordinateur.`);
        else toast(`Le port ${state.deploymentPortProbe.port} ne répond pas localement.`, "error");
      } catch (error) {
        state.deploymentPortProbe = null;
        toast(error.message, "error");
      } finally {
        state.deploymentHealthLoading = false;
        render();
      }
      return;
    }
    if (action === "toggle-search-scope") {
      state.searchScopeOpen = !state.searchScopeOpen;
      state.searchScopeQuery = "";
      render();
      requestAnimationFrame(() => (state.searchScopeOpen ? document.querySelector("[data-search-scope-query]") : document.querySelector("[data-action='toggle-search-scope']"))?.focus());
      return;
    }
    if (action === "select-search-scope") {
      const scope = actionTarget.dataset.scopeId || "global";
      state.searchScope = scope;
      state.filter = scope === "global" ? "all" : scope;
      state.relationOrganization = scope === "global" ? "all" : scope;
      state.searchScopeOpen = false;
      state.searchScopeQuery = "";
      if (scope !== "global") activateOrganizationContext(scope);
      if (scope === "global" && requiresOrganizationContext()) { navigate("dashboard"); return; }
      const caret = state.search.length;
      render();
      requestAnimationFrame(() => { const input = document.getElementById("global-search"); if (input) { input.focus(); input.setSelectionRange(caret, caret); } });
      return;
    }
    if (action === "document-command") {
      const editor = actionTarget.closest("[data-document-editor]");
      const textarea = editor?.querySelector("[data-document-source]");
      if (textarea) applyDocumentCommand(textarea, actionTarget.dataset.documentCommand);
      return;
    }
    if (action === "document-mode") { setDocumentEditorMode(actionTarget.closest("[data-document-editor]"), actionTarget.dataset.documentMode); return; }
    if (action === "toggle-document-fullscreen") {
      const editorShell = actionTarget.closest(".modal, .record-editor-shell");
      const full = editorShell?.classList.toggle("document-modal-fullscreen") || false;
      actionTarget.setAttribute("aria-pressed", String(full));
      actionTarget.setAttribute("title", full ? "Quitter le plein écran" : "Plein écran");
      return;
    }
    if (action === "select-file-sharing-server") {
      addFileSharingServer(actionTarget.closest("[data-file-sharing-server-picker]"), actionTarget.dataset.id);
      return;
    }
    if (action === "remove-file-sharing-server") {
      removeFileSharingServer(actionTarget.closest("[data-file-sharing-server-picker]"), actionTarget.dataset.id);
      return;
    }
    if (action === "select-printing-configuration") {
      addPrintingConfiguration(actionTarget.closest("[data-printing-configuration-picker]"), actionTarget.dataset.id);
      return;
    }
    if (action === "remove-printing-configuration") {
      removePrintingConfiguration(actionTarget.closest("[data-printing-configuration-picker]"), actionTarget.dataset.id);
      return;
    }
    if (action === "cancel-record-editor") {
      state.activeTemplate = null;
      const moduleId = actionTarget.dataset.moduleId || state.detailId || FILE_SHARING_MODULE_ID;
      const module = moduleMap.get(moduleId);
      navigate(module?.route || `module/${encodeURIComponent(moduleId)}`);
      return;
    }
    if (action === "reload") location.reload();
    if (action === "toggle-theme") {
      state.theme = state.theme === "dark" ? "light" : "dark";
      localStorage.setItem(storageKeys.theme, state.theme);
      render();
    }
    if (action === "toggle-locale") {
      state.locale = state.locale === "fr" ? "en" : "fr";
      localStorage.setItem(storageKeys.locale, state.locale);
      render();
    }
    if (action === "toggle-dashboard-tests") {
      state.dashboardIncludeTests = !state.dashboardIncludeTests;
      localStorage.setItem(storageKeys.dashboardTests, String(state.dashboardIncludeTests));
      render();
    }
    if (action === "open-priorities") showModal("priorities", actionTarget.dataset.priority || "all");
    if (action === "open-priority-item") {
      const ref = actionTarget.dataset.assetRef;
      if (!ref || !assetByRef(ref)) return;
      closeModal();
      navigate(`asset/${encodeURIComponent(ref)}`);
    }
    if (action === "open-nav") { state.mobileNavigation = true; render(); }
    if (action === "close-nav") { state.mobileNavigation = false; render(); }
    if (action === "toggle-nav-group") {
      const group = actionTarget.dataset.group;
      if (state.collapsedNavGroups.has(group)) state.collapsedNavGroups.delete(group);
      else state.collapsedNavGroups.add(group);
      render();
    }
    if (action === "open-asset") {
      const ref = actionTarget.dataset.assetRef;
      const asset = ref ? assetByRef(ref) : null;
      if (!asset) return;
      activateOrganizationContext(asset.organizationId);
      state.search = "";
      navigate(`asset/${encodeURIComponent(ref)}`);
    }
    if (action === "toggle-checklist-step") {
      const record = state.workspace.moduleRecords.find((item) => item.id === actionTarget.dataset.id);
      const stepIndex = Number(actionTarget.dataset.stepIndex);
      const step = record?.checklist?.[stepIndex];
      if (!record || !step || record.status === "archived") return;
      const done = !step.done;
      await commit((workspace) => {
        const item = workspace.moduleRecords.find((candidate) => candidate.id === record.id);
        item.checklist[stepIndex].done = done;
        item.updatedAt = new Date().toISOString().slice(0, 10);
      }, done ? "Étape de checklist terminée" : "Étape de checklist rouverte", `${record.title} · ${step.label}`, "checklist");
      return;
    }
    if (action === "toggle-asset-archive") {
      const asset = assetByRef(actionTarget.dataset.assetRef);
      if (!asset || asset.type === "vault") return;
      const restoring = asset.archived;
      if (!restoring && !window.confirm(`Archiver « ${asset.label} »? Ses relations et son historique resteront visibles.`)) return;
      await commit((workspace) => {
        const collection = asset.type === "configuration" ? workspace.configurations : asset.type === "site" ? workspace.sites : asset.type === "procedure" ? workspace.procedures : workspace.moduleRecords;
        const item = collection.find((candidate) => candidate.id === asset.id);
        if (!item) return;
        if (restoring) {
          item.status = item.previousStatus || (asset.type === "configuration" ? "review" : asset.type === "procedure" ? "review" : "active");
          delete item.previousStatus;
        } else {
          item.previousStatus = item.status || "active";
          item.status = "archived";
        }
        if ("updatedAt" in item) item.updatedAt = new Date().toISOString().slice(0, 10);
      }, restoring ? "Fiche restaurée" : "Fiche archivée", asset.label, asset.type);
      return;
    }
    if (["submit-record-review", "approve-record", "mark-record-reviewed"].includes(action)) {
      const record = state.workspace.moduleRecords.find((item) => item.id === actionTarget.dataset.id);
      if (!record || record.status === "archived") return;
      if (action === "approve-record" && !isAdministrator()) return toast("Seul un administrateur peut approuver une fiche.", "error");
      const today = new Date();
      const nextDue = Number(record.reviewIntervalDays) > 0 ? new Date(today.getTime() + Number(record.reviewIntervalDays) * 86400000).toISOString().slice(0, 10) : record.reviewDueAt || "";
      await commit((workspace) => {
        const item = workspace.moduleRecords.find((candidate) => candidate.id === record.id);
        if (!item) return;
        if (action === "submit-record-review") {
          item.reviewState = "in-review";
          item.approvedAt = "";
          item.approvedBy = "";
        } else {
          item.reviewState = "approved";
          item.lastReviewedAt = today.toISOString();
          item.reviewDueAt = nextDue;
          item.approvedAt = today.toISOString();
          item.approvedBy = state.user.displayName;
        }
        item.updatedAt = today.toISOString().slice(0, 10);
      }, action === "submit-record-review" ? "Fiche soumise en révision" : action === "approve-record" ? "Fiche approuvée" : "Révision de la fiche terminée", record.title, "review");
      return;
    }
    if (action === "add-related-item") {
      const sourceRef = actionTarget.dataset.assetRef;
      if (!sourceRef || !assetByRef(sourceRef)) return;
      state.relationQuickAddRef = sourceRef;
      requestAnimationFrame(() => {
        const input = document.querySelector("[data-relation-quick-search]");
        input?.focus();
        input?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }
    if (action === "clear-relation-quick-search") {
      const sourceRef = actionTarget.closest("[data-relation-quick-root]")?.dataset.sourceRef || "";
      state.relationQuickAddRef = sourceRef;
      state.relationQuickQuery = "";
      renderQuickRelationResults(sourceRef);
      const input = document.querySelector("[data-relation-quick-search]");
      if (input) { input.value = ""; input.setAttribute("aria-expanded", "false"); input.focus(); }
      return;
    }
    if (action === "toggle-relation-quick-filters") {
      state.relationQuickFiltersOpen = !state.relationQuickFiltersOpen;
      render();
      requestAnimationFrame(() => document.querySelector("[data-relation-quick-search]")?.focus());
      return;
    }
    if (action === "quick-relate-item") {
      try { await createQuickRelation(actionTarget.dataset.sourceRef, actionTarget.dataset.targetRef); }
      catch (error) { toast(error.message || "Impossible d’ajouter cette relation.", "error"); }
      return;
    }
    if (action === "insert-mention") {
      const field = actionTarget.closest(".mention-field"); const textarea = field?.querySelector("textarea");
      if (!textarea) return;
      const cursor = textarea.selectionStart ?? textarea.value.length;
      const before = textarea.value.slice(0, cursor); const match = before.match(/@([^@\n\r]{0,32})$/);
      if (!match) return;
      const token = `[[@${actionTarget.dataset.mentionLabel}|${actionTarget.dataset.assetRef}]]`;
      const start = cursor - match[0].length;
      textarea.value = `${textarea.value.slice(0, start)}${token}${textarea.value.slice(cursor)}`;
      const next = start + token.length; textarea.focus(); textarea.setSelectionRange(next, next);
      field.querySelector("[data-mention-picker]").hidden = true;
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (action === "new-organization") showModal("organization");
    if (action === "edit-organization") showModal("organization", actionTarget.dataset.id);
    if (action === "edit-quick-notes") showModal("quick-notes", actionTarget.dataset.id);
    if (action === "delete-organization") showModal("delete-organization", actionTarget.dataset.id);
    if (action === "new-site") { if (!creationOrganizationId("ajouter un site")) return; navigate("record/locations"); }
    if (action === "edit-site") navigate(`record/locations/${encodeURIComponent(actionTarget.dataset.id)}`);
    if (action === "new-configuration") { if (!creationOrganizationId("ajouter une configuration")) return; navigate("record/configurations"); }
    if (action === "edit-configuration") navigate(`record/configurations/${encodeURIComponent(actionTarget.dataset.id)}`);
    if (action === "new-procedure") { if (!creationOrganizationId("ajouter une procédure")) return; showModal("procedure"); }
    if (action === "edit-procedure") showModal("procedure", actionTarget.dataset.id);
    if (action === "new-relation") { if (!creationOrganizationId("ajouter une relation")) return; state.relationPresetRef = ""; showModal("relation"); }
    if (action === "edit-relation") showModal("relation", actionTarget.dataset.id);
    if (action === "new-template") showModal("template");
    if (action === "edit-template") showModal("template", actionTarget.dataset.id);
    if (action === "new-custom-module") showModal("custom-module");
    if (action === "edit-custom-module") showModal("custom-module", actionTarget.dataset.id);
    if (action === "new-user") showModal("user");
    if (action === "edit-user") showModal("user", actionTarget.dataset.id);
    if (action === "reset-user-password") showModal("user-password-reset", actionTarget.dataset.id);
    if (action === "new-vault-item") { if (!creationOrganizationId("ajouter un mot de passe")) return; state.revealedVaultItem = null; state.visibleVaultFields.clear(); navigate("record/passwords"); }
    if (action === "reveal-vault-item") {
      await revealVaultItem(actionTarget.dataset.id);
    }
    if (action === "lock-vault") {
      await api("/api/vault/lock", { method: "POST", body: "{}" });
      state.vaultUnlockedUntil = 0;
      state.revealedVaultItem = null;
      state.visibleVaultFields.clear();
      render();
      toast("Le coffre est verrouillé pour cette session.");
    }
    if (action === "edit-vault-item") showModal("vault-item", actionTarget.dataset.id);
    if (action === "copy-vault-field") {
      const value = state.revealedVaultItem?.[actionTarget.dataset.field] || "";
      if (!value) return toast("Aucune valeur à copier.", "error");
      try {
        await navigator.clipboard.writeText(value);
        const field = actionTarget.dataset.field;
        void api(`/api/vault/${encodeURIComponent(state.revealedVaultItem.id)}/access-event`, { method: "POST", body: JSON.stringify({ action: `copied-${field}` }) }).catch(() => {});
        toast("Valeur copiée dans le presse-papiers.");
      } catch { toast("Copie impossible dans ce navigateur.", "error"); }
    }
    if (action === "toggle-vault-field") {
      const field = actionTarget.dataset.field;
      if (!state.revealedVaultItem || !["password", "otp"].includes(field)) return;
      if (state.visibleVaultFields.has(field)) state.visibleVaultFields.delete(field);
      else state.visibleVaultFields.add(field);
      render();
    }
    if (action === "new-module-record") {
      if (!creationOrganizationId("ajouter une fiche")) return;
      state.activeTemplate = null;
      navigate(`record/${encodeURIComponent(actionTarget.dataset.moduleId)}`);
    }
    if (action === "edit-module-record") {
      navigate(`record/${encodeURIComponent(actionTarget.dataset.moduleId)}/${encodeURIComponent(actionTarget.dataset.id)}`);
    }
    if (action === "use-template") {
      if (!creationOrganizationId("utiliser ce modèle")) return;
      state.activeTemplate = state.workspace.templates.find((template) => template.id === actionTarget.dataset.id) || null;
      if (state.activeTemplate) navigate(`record/${encodeURIComponent(state.activeTemplate.moduleId)}`);
    }
    if (action === "module-preset") {
      const preset = actionTarget.dataset.preset;
      const selected = (preset === "all" ? moduleDefinitions.map((module) => module.id)
        : preset === "standard" ? [...coreModules, ...appServiceModules].map((module) => module.id)
          : preset === "essential" ? ["configurations", "checklists", "contacts", "documents", "domain-tracker", "locations", "passwords", "ssl-tracker"]
            : []).filter((id) => id !== "passwords" || canAccessVault());
      document.querySelectorAll('input[name="visibleModules"]').forEach((input) => { input.checked = selected.includes(input.value); });
      updateSelectedModuleCount();
    }
    if (action === "list-page") {
      state.listPage = Math.max(1, Number(actionTarget.dataset.page) || 1);
      render();
      document.getElementById("main-content")?.focus();
    }
    if (action === "restore-workspace") {
      const revision = Number(actionTarget.dataset.revision);
      if (!window.confirm(`Restaurer la révision #${revision}? L’état actuel sera conservé dans l’historique.`)) return;
      try {
        const document = await api(`/api/workspace/history/${revision}/restore`, { method: "POST", body: "{}" });
        state.workspace = document.data; state.revision = document.revision; normalizeWorkspace();
        await loadWorkspaceHistory(); render(); toast(`Révision #${revision} restaurée dans une nouvelle version.`);
      } catch (error) { toast(error.message, "error"); }
    }
    if (action === "export-workspace") {
      try {
        const response = await fetch("/api/export", { credentials: "same-origin" });
        if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || "Export impossible.");
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a"); link.href = url; link.download = `trc-atlas-export-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url);
        toast("Export documentaire téléchargé.");
      } catch (error) { toast(error.message, "error"); }
    }
    if (action === "copy-full-backup-command") {
      const command = 'powershell -ExecutionPolicy Bypass -File .\\scripts\\Invoke-AtlasFullBackup.ps1 -Mode Create';
      try { await navigator.clipboard.writeText(command); toast("Commande de sauvegarde complète copiée."); }
      catch { toast("Copie impossible dans ce navigateur.", "error"); }
    }
    if (action === "refresh-backups") {
      state.backupStatus = null;
      await loadBackupStatus();
    }
    if (action === "check-updates") {
      state.updateLoading = true;
      render();
      try {
        state.updateStatus = await api("/api/settings/updates/check", { method: "POST", body: "{}" });
        await Promise.all([loadDeploymentHealth({ renderAfter: false }), loadAudit()]);
        toast(state.updateStatus.lastCheck?.available ? `Version ${state.updateStatus.lastCheck.tag || "stable"} vérifiée sur GitHub.` : "Aucune version stable publiée sur GitHub.");
      } catch (error) { toast(error.message, "error"); }
      finally { state.updateLoading = false; render(); }
    }
    if (action === "prepare-update") {
      state.updateLoading = true;
      render();
      try {
        state.updateStatus = await api("/api/settings/updates/prepare", { method: "POST", body: "{}" });
        toast(`Atlas ${state.updateStatus.prepared?.targetVersion || ""} a été téléchargé et vérifié.`);
      } catch (error) { toast(error.message, "error"); }
      finally { state.updateLoading = false; render(); }
    }
    if (action === "copy-local-api-token" && state.createdApiToken) {
      try { await navigator.clipboard.writeText(state.createdApiToken); toast("Jeton API copié."); }
      catch { toast("Copie impossible dans ce navigateur.", "error"); }
    }
    if (action === "clear-local-api-token") {
      state.createdApiToken = "";
      render();
    }
    if (action === "copy-webhook-secret" && state.createdWebhookSecret) {
      try { await navigator.clipboard.writeText(state.createdWebhookSecret); toast("Secret de webhook copié."); }
      catch { toast("Copie impossible dans ce navigateur.", "error"); }
    }
    if (action === "clear-webhook-secret") {
      state.createdWebhookSecret = "";
      render();
    }
    if (action === "export-printing") {
      const csvCell = (value) => {
        const raw = String(value ?? "");
        const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
        return `"${safe.replaceAll('"', '""')}"`;
      };
      const query = normalizeSearch(state.listSearch);
      const includeArchived = state.listStatus === "all";
      const records = state.workspace.moduleRecords.filter((record) => record.moduleId === PRINTING_MODULE_ID)
        .filter((record) => (state.filter === "all" || record.organizationId === state.filter) && (includeArchived || record.status !== "archived"))
        .filter((record) => !query || normalizeSearch([record.title, record.summary, record.owner, ...Object.values(record.details || {})].join(" ")).includes(query));
      const lines = [["Organisation", "Site", "Serveurs d'impression", "Imprimantes", "Déploiement", "Publié AD", "Adresse IP ou hôte", "État", "Responsable", "Mise à jour"], ...records.map((record) => [orgName(record.organizationId), record.title, printingLinkedConfigurationNames(record, "printServerConfigurationIds").join(" | "), [...new Set([String(record.details?.printerNames || "").replace(/\r?\n/g, " | "), ...printingLinkedConfigurationNames(record, "printerConfigurationIds")])].filter(Boolean).join(" | "), record.details?.deployment || "", record.details?.publishedToAd || "Non", record.details?.hostAddress || "", record.status, record.owner || "", record.updatedAt || ""])]
        .map((row) => row.map(csvCell).join(",")).join("\r\n");
      const blob = new Blob(["\ufeff", lines], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = `trc-atlas-printing-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
      toast(`${records.length} fiche${records.length === 1 ? "" : "s"} Printing exportée${records.length === 1 ? "" : "s"}.`);
    }
    if (action === "download-attachment") {
      try { await downloadAttachment(actionTarget.dataset.id); } catch (error) { toast(error.message, "error"); }
    }
    if (action === "delete-attachment") {
      const name = actionTarget.dataset.name || "ce fichier";
      if (!window.confirm(`Retirer définitivement « ${name} » de cette fiche?`)) return;
      try {
        await api(`/api/attachments/${encodeURIComponent(actionTarget.dataset.id)}`, { method: "DELETE", body: "{}" });
        await loadAttachments();
        render();
        toast(`Pièce jointe « ${name} » retirée.`);
      } catch (error) { toast(error.message, "error"); }
    }
    if (action === "close-modal") closeModal();
    if (action === "open-rmm") toast(t("noRmm"), "error");
    if (action === "back-login") { state.pendingMfaToken = ""; state.mfaSecret = ""; state.phase = "login"; render(); }
    if (action === "continue-after-recovery") {
      state.recoveryCodes = [];
      await loadWorkspace();
      await Promise.all([loadVault(), loadAttachments(), loadWorkspaceHistory(), loadSessions(), loadAudit()]);
      await loadUsers();
      state.phase = "app";
      navigate("dashboard");
      render();
    }
    if (["toggle-user", "reset-user-mfa", "revoke-user-sessions"].includes(action)) {
      const user = state.users.find((entry) => entry.id === actionTarget.dataset.id);
      state.pendingPrivilegedAction = { action, userId: actionTarget.dataset.id, userName: user?.displayName || "Compte local" };
      showModal("privileged-action");
    }
    if (action === "regenerate-recovery-codes") showModal("recovery-codes-regenerate");
    if (action === "reenroll-own-mfa") showModal("self-mfa-reenroll");
    if (action === "close-recovery-codes") { state.recoveryCodes = []; closeModal(); }
    if (action === "refresh-sessions") { await loadSessions(); render(); toast("Sessions actualisées."); }
    if (action === "revoke-own-session") {
      try { await api(`/api/me/sessions/${encodeURIComponent(actionTarget.dataset.id)}`, { method: "DELETE", body: "{}" }); await loadSessions(); render(); toast("Session fermée."); }
      catch (error) { toast(error.message, "error"); }
    }
    if (action === "logout") {
      try { await api("/api/logout", { method: "POST", body: "{}" }); } catch { /* local session will still be cleared by reload if expired */ }
      resetClientSession("");
    }
  });

  document.addEventListener("change", async (event) => {
    if (event.target.matches("[data-deployment-access-mode]")) {
      const form = event.target.closest('form[data-form="settings"]');
      const proxy = form?.querySelector("[data-reverse-proxy]");
      if (proxy) proxy.disabled = !isAdministrator() || event.target.value === "local";
      return;
    }
    if (event.target.matches("[data-rotation-policy]")) {
      const form = event.target.closest('form[data-form="settings"]');
      const enabled = event.target.checked && isAdministrator();
      form?.querySelector("[data-rotation-options]")?.classList.toggle("disabled", !enabled);
      form?.querySelectorAll('[name="passwordRotationDays"], [name="passwordRotationReminderDays"]').forEach((input) => { input.disabled = !enabled; });
      return;
    }
    if (event.target.matches('[data-all-organizations], [data-vault-access], form[data-form="user"] select[name="role"], form[data-form="user"] input[name="organizationIds"]')) {
      const form = event.target.closest('form[data-form="user"]');
      const all = form?.querySelector("[data-all-organizations]");
      const administrator = form?.querySelector('[name="role"]')?.value === "administrator";
      const vaultAccess = form?.querySelector("[data-vault-access]");
      if (administrator && all) all.checked = true;
      if (all) all.disabled = administrator;
      if (vaultAccess) {
        if (administrator) vaultAccess.checked = true;
        vaultAccess.disabled = administrator;
      }
      form?.querySelectorAll(".organization-permission-row").forEach((row) => {
        const access = row.querySelector('input[name="organizationIds"]');
        if (!access) return;
        access.disabled = administrator || Boolean(all?.checked);
        row.querySelectorAll('select, input:not([name="organizationIds"])').forEach((control) => { control.disabled = administrator || Boolean(all?.checked) || !access.checked; });
      });
      const globalAccess = administrator || Boolean(all?.checked);
      const fieldset = form?.querySelector(".organization-access-field");
      fieldset?.classList.toggle("is-global", globalAccess);
      const customPermissions = form?.querySelector("[data-organization-custom]");
      const globalSummary = form?.querySelector("[data-organization-global-summary]");
      if (customPermissions) customPermissions.hidden = globalAccess;
      if (globalSummary) {
        globalSummary.hidden = !globalAccess;
        const stateLabel = all?.closest(".organization-access-mode")?.querySelector(".organization-access-mode-state");
        if (stateLabel) stateLabel.textContent = globalAccess ? "Actif" : "Désactivé";
        const summary = globalSummary.querySelector("small");
        const role = form?.querySelector('select[name="role"]')?.value || "viewer";
        if (summary) summary.textContent = `${state.workspace.organizations.length} compagnie${state.workspace.organizations.length === 1 ? "" : "s"} · ${roleLabel(role)} · coffre ${vaultAccess?.checked ? "autorisé" : "masqué"}`;
      }
      return;
    }
    const attachmentInput = event.target.closest("[data-attachment-input]");
    if (attachmentInput) {
      attachmentInput.disabled = true;
      try { await uploadAttachment(attachmentInput.files?.[0], attachmentInput.dataset.assetRef); }
      catch (error) { toast(error.message || "Ajout de la pièce jointe impossible.", "error"); }
      finally { attachmentInput.disabled = false; attachmentInput.value = ""; }
      return;
    }
    const filter = event.target.closest("[data-filter]");
    if (filter) { state.filter = filter.value; if (filter.value === "all") state.searchScope = "global"; else if (state.workspace.organizations.some((organization) => organization.id === filter.value)) state.searchScope = filter.value; state.listPage = 1; render(); }
    const listStatus = event.target.closest("[data-list-status]");
    if (listStatus) { state.listStatus = listStatus.value; state.listPage = 1; render(); }
    if (event.target.matches("[data-printing-include-archived]")) { state.listStatus = event.target.checked ? "all" : "current"; state.listPage = 1; render(); }
    const relationFilter = event.target.closest("[data-relation-filter]");
    if (relationFilter) { state.relationOrganization = relationFilter.value; state.searchScope = relationFilter.value === "all" ? "global" : relationFilter.value; state.relationImpactRef = ""; state.listPage = 1; render(); }
    const impactRef = event.target.closest("[data-impact-ref]");
    if (impactRef) { state.relationImpactRef = impactRef.value; render(); }
    const relationSource = event.target.closest("[data-relation-source]");
    if (relationSource) {
      const form = relationSource.closest('form[data-form="relation"]'); const organizationId = form?.querySelector('[name="organizationId"]')?.value;
      const target = form?.querySelector("[data-relation-target]"); const current = target?.value || "";
      if (target) target.innerHTML = assetOptions(organizationId, current === relationSource.value ? "" : current, relationSource.value);
    }
    const quickRelationType = event.target.closest("[data-relation-quick-type]");
    if (quickRelationType) {
      state.relationQuickType = quickRelationType.value;
      render();
      requestAnimationFrame(() => document.querySelector("[data-relation-quick-search]")?.focus());
    }
    const theme = event.target.closest("[data-set-theme]");
    if (theme) { state.theme = theme.dataset.setTheme; localStorage.setItem(storageKeys.theme, state.theme); render(); }
    if (event.target.matches('input[name="visibleModules"]')) updateSelectedModuleCount();
    if (event.target.matches("[data-import-workspace]")) importWorkspaceFile(event.target.files?.[0]);
    if (event.target.matches("[data-guided-import-file]")) {
      try { await prepareGuidedImport(event.target.files?.[0]); }
      catch (error) { toast(error.message || "Le CSV est invalide.", "error"); }
      finally { event.target.value = ""; }
    }
  });

  document.addEventListener("click", (event) => {
    const filter = event.target.closest("[data-set-filter]");
    if (filter) { state.filter = filter.dataset.setFilter; render(); }
    const theme = event.target.closest("[data-set-theme]");
    if (theme) { state.theme = theme.dataset.setTheme; localStorage.setItem(storageKeys.theme, state.theme); render(); }
  });

  document.addEventListener("input", (event) => {
    if (event.target.matches("[data-help-search]")) {
      state.helpSearch = event.target.value;
      state.helpCategory = "all";
      document.querySelectorAll("[data-help-category]").forEach((button) => button.classList.toggle("active", button.dataset.helpCategory === "all"));
      const results = document.querySelector("[data-help-center-results]");
      if (results) results.innerHTML = helpCenterResultsMarkup();
      return;
    }
    if (event.target.matches("[data-organization-access-filter]")) {
      const query = normalizeSearch(event.target.value);
      const fieldset = event.target.closest(".organization-access-field");
      let visible = 0;
      fieldset?.querySelectorAll("[data-organization-permission-row]").forEach((row) => {
        row.hidden = Boolean(query) && !String(row.dataset.organizationLabel || "").includes(query);
        if (!row.hidden) visible += 1;
      });
      const empty = fieldset?.querySelector("[data-organization-access-empty]");
      if (empty) empty.hidden = visible > 0;
      return;
    }
    if (event.target.id === "global-search") {
      if (state.searchScopeOpen) {
        state.searchScopeOpen = false;
        state.searchScopeQuery = "";
        document.querySelector(".search-scope-popover")?.remove();
        document.querySelector("[data-action='toggle-search-scope']")?.setAttribute("aria-expanded", "false");
      }
      state.search = event.target.value;
      renderSearchResults();
    }
    if (event.target.matches("[data-search-scope-query]")) {
      state.searchScopeQuery = event.target.value;
      const options = document.querySelector("[data-search-scope-options]");
      if (options) options.innerHTML = searchScopeOptionsMarkup();
    }
    if (event.target.matches("[data-module-search]")) {
      state.moduleSearch = event.target.value;
      const query = state.moduleSearch.trim().toLocaleLowerCase(state.locale);
      document.querySelectorAll(".module-toggle-card").forEach((card) => { card.hidden = Boolean(query) && !card.dataset.moduleLabel.includes(query); });
      document.querySelectorAll(".module-manager-group").forEach((group) => {
        const hasVisible = [...group.querySelectorAll(".module-toggle-card")].some((card) => !card.hidden);
        group.hidden = Boolean(query) && !hasVisible;
        if (query && hasVisible) group.open = true;
      });
    }
    if (event.target.matches("[data-sidebar-module-search]")) {
      state.sidebarModuleSearch = event.target.value;
      applySidebarModuleFilter();
    }
    if (event.target.matches("[data-list-search]")) {
      state.listSearch = event.target.value;
      state.listPage = 1;
      const caret = state.listSearch.length;
      render();
      requestAnimationFrame(() => {
        const input = document.querySelector("[data-list-search]");
        if (input) { input.focus(); input.setSelectionRange(caret, caret); }
      });
    }
    if (event.target.matches("[data-organization-search]")) {
      state.organizationSearch = event.target.value;
      const caret = state.organizationSearch.length;
      render();
      requestAnimationFrame(() => {
        const input = document.querySelector("[data-organization-search]");
        if (input) { input.focus(); input.setSelectionRange(caret, caret); }
      });
    }
    if (event.target.matches("[data-file-sharing-server-search]")) {
      refreshFileSharingServerPicker(event.target.closest("[data-file-sharing-server-picker]"), true);
    }
    if (event.target.matches("[data-printing-configuration-search]")) {
      refreshPrintingConfigurationPicker(event.target.closest("[data-printing-configuration-picker]"), true);
    }
    if (event.target.matches("[data-relation-quick-search]")) {
      state.relationQuickAddRef = event.target.closest("[data-relation-quick-root]")?.dataset.sourceRef || "";
      state.relationQuickQuery = event.target.value;
      event.target.dataset.activeIndex = "-1";
      event.target.removeAttribute("aria-activedescendant");
      event.target.setAttribute("aria-expanded", String(Boolean(state.relationQuickQuery.trim())));
      renderQuickRelationResults(event.target.closest("[data-relation-quick-root]")?.dataset.sourceRef || "");
    }
    if (event.target.matches("[data-relate-input]")) updateMentionPicker(event.target);
    if (event.target.matches("[data-document-source]")) updateDocumentEditor(event.target.closest("[data-document-editor]"));
    if (event.target.matches("[data-quick-notes-source]")) {
      const preview = event.target.closest("form")?.querySelector("[data-quick-notes-preview]");
      if (preview) preview.innerHTML = renderDocumentMarkdown(event.target.value);
    }
  });

  document.addEventListener("focusin", (event) => {
    if (event.target.matches("[data-file-sharing-server-search]")) refreshFileSharingServerPicker(event.target.closest("[data-file-sharing-server-picker]"), true);
    if (event.target.matches("[data-printing-configuration-search]")) refreshPrintingConfigurationPicker(event.target.closest("[data-printing-configuration-picker]"), true);
  });

  function updateSelectedModuleCount() {
    const counter = document.querySelector("[data-selected-count]");
    if (counter) counter.textContent = String(document.querySelectorAll('input[name="visibleModules"]:checked').length);
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 32768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
    return btoa(binary);
  }

  async function uploadAttachment(file, assetRef) {
    if (!file || !assetRef || !canWrite()) return;
    if (file.size <= 0 || file.size > 8 * 1024 * 1024) throw new Error("La pièce jointe doit contenir entre 1 octet et 8 Mo.");
    const data = arrayBufferToBase64(await file.arrayBuffer());
    await api("/api/attachments", { method: "POST", body: JSON.stringify({ assetRef, name: file.name, mimeType: file.type || "application/octet-stream", data }) });
    await loadAttachments();
    render();
    toast(`Pièce jointe « ${file.name} » ajoutée.`);
  }

  async function downloadAttachment(id) {
    const item = state.attachments.find((entry) => entry.id === id);
    if (!item) throw new Error("Pièce jointe introuvable.");
    const response = await fetch(`/api/attachments/${encodeURIComponent(id)}/download`, { credentials: "same-origin" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401 && state.user) resetClientSession("Votre session a expiré après 8 heures. Reconnectez-vous pour continuer.");
      throw new Error(payload.message || "Téléchargement impossible.");
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = item.name;
    link.click();
    URL.revokeObjectURL(url);
    toast(`Téléchargement de « ${item.name} » démarré.`);
  }

  async function importWorkspaceFile(file) {
    if (!file) return;
    try {
      if (file.size > 120 * 1024 * 1024) throw new Error("Le fichier dépasse la limite locale de 120 Mo.");
      const payload = JSON.parse(await file.text());
      if (!window.confirm("Importer ce fichier remplacera la documentation actuelle. Une version de retour arrière sera créée. Continuer?")) return;
      const document = await api("/api/import", { method: "POST", body: JSON.stringify(payload) });
      state.workspace = document.data; state.revision = document.revision; normalizeWorkspace();
      await loadWorkspaceHistory(); render(); toast("Import terminé; l’état précédent reste disponible dans Versions.");
    } catch (error) {
      toast(error.message || "Le fichier d’import est invalide.", "error");
    }
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let value = "";
    let quoted = false;
    const source = String(text || "").replace(/^\uFEFF/, "");
    const firstLine = source.split(/\r?\n/, 1)[0] || "";
    const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];
      if (quoted) {
        if (character === '"' && source[index + 1] === '"') { value += '"'; index += 1; }
        else if (character === '"') quoted = false;
        else value += character;
      } else if (character === '"') quoted = true;
      else if (character === delimiter) { row.push(value.trim()); value = ""; }
      else if (character === "\n") { row.push(value.trim().replace(/\r$/, "")); rows.push(row); row = []; value = ""; }
      else value += character;
    }
    if (quoted) throw new Error("Le CSV contient une valeur entre guillemets non terminée.");
    if (value || row.length) { row.push(value.trim().replace(/\r$/, "")); rows.push(row); }
    const width = Math.max(0, ...rows.map((entry) => entry.length));
    return rows.filter((entry) => entry.some((cell) => cell)).map((entry) => [...entry, ...Array(Math.max(0, width - entry.length)).fill("")]);
  }

  async function prepareGuidedImport(file) {
    if (!file) return;
    if (!isAdministrator()) throw new Error("Seul un administrateur peut importer un CSV.");
    if (file.size <= 0 || file.size > 5 * 1024 * 1024) throw new Error("Le CSV doit contenir entre 1 octet et 5 Mo.");
    const rows = parseCsv(await file.text());
    if (rows.length < 2) throw new Error("Le CSV doit contenir une ligne d’en-têtes et au moins une ligne de données.");
    if (rows.length > 1001) throw new Error("Le CSV dépasse la limite de 1 000 lignes de données.");
    const headers = rows[0].map((header, index) => header || `Colonne ${index + 1}`);
    if (new Set(headers.map(normalizeSearch)).size !== headers.length) throw new Error("Chaque colonne du CSV doit avoir un en-tête unique.");
    const target = document.querySelector("[data-guided-import-target]")?.value || "organizations";
    state.importPreview = { fileName: file.name, target, headers, rows: rows.slice(1) };
    showModal("guided-import");
  }

  document.addEventListener("keydown", (event) => {
    if (state.helpMenuOpen && event.key === "Escape") {
      event.preventDefault();
      state.helpMenuOpen = false;
      render();
      requestAnimationFrame(() => document.querySelector("[data-action='toggle-help-menu']")?.focus());
      return;
    }
    if (state.page === "help" && event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.matches("input, textarea, select")) {
      event.preventDefault();
      document.querySelector("[data-help-search]")?.focus();
      return;
    }
    const scopeTrigger = event.target.closest?.("[data-action='toggle-search-scope']");
    if (scopeTrigger && event.key === "ArrowDown") {
      event.preventDefault();
      if (!state.searchScopeOpen) scopeTrigger.click();
      else document.querySelector("[data-search-scope-query]")?.focus();
      return;
    }
    const scopeQuery = event.target.closest?.("[data-search-scope-query]");
    if (scopeQuery && event.key === "ArrowDown") {
      event.preventDefault();
      document.querySelector(".search-scope-option")?.focus();
      return;
    }
    if (state.searchScopeOpen && event.key === "Escape") {
      event.preventDefault();
      state.searchScopeOpen = false;
      state.searchScopeQuery = "";
      render();
      requestAnimationFrame(() => document.querySelector("[data-action='toggle-search-scope']")?.focus());
      return;
    }
    const documentSource = event.target.closest?.("[data-document-source]");
    if (documentSource) {
      const shortcut = (event.ctrlKey || event.metaKey) && !event.altKey ? event.key.toLowerCase() : "";
      const command = shortcut === "b" ? "bold" : shortcut === "i" ? "italic" : shortcut === "k" ? "link" : "";
      if (command) { event.preventDefault(); applyDocumentCommand(documentSource, command); return; }
      if (event.key === "Tab") { event.preventDefault(); documentSource.setRangeText("  ", documentSource.selectionStart, documentSource.selectionEnd, "end"); documentSource.dispatchEvent(new Event("input", { bubbles: true })); return; }
    }
    const quickSearch = event.target.closest?.("[data-relation-quick-search]");
    if (quickSearch && event.key === "Escape") {
      event.preventDefault();
      const sourceRef = quickSearch.closest("[data-relation-quick-root]")?.dataset.sourceRef || "";
      state.relationQuickAddRef = sourceRef;
      state.relationQuickQuery = "";
      state.relationQuickFiltersOpen = false;
      render();
      requestAnimationFrame(() => document.querySelector("[data-relation-quick-search]")?.focus());
      return;
    }
    if (quickSearch && ["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) {
      const options = [...document.querySelectorAll('[data-action="quick-relate-item"]:not(:disabled)')];
      if (!options.length) return;
      let index = Number(quickSearch.dataset.activeIndex || -1);
      if (event.key === "Enter") {
        if (index >= 0 && options[index]) { event.preventDefault(); options[index].click(); }
        return;
      }
      event.preventDefault();
      index = event.key === "ArrowDown" ? Math.min(index + 1, options.length - 1) : Math.max(index - 1, 0);
      options.forEach((option, optionIndex) => option.classList.toggle("active", optionIndex === index));
      quickSearch.dataset.activeIndex = String(index);
      quickSearch.setAttribute("aria-activedescendant", options[index].id);
      options[index].scrollIntoView({ block: "nearest" });
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      document.getElementById("global-search")?.focus();
    }
    if (event.key === "Escape") {
      if (overlayRoot.innerHTML) closeModal();
      else if (state.search) { state.search = ""; renderSearchResults(); document.getElementById("global-search")?.blur(); }
      else if (state.mobileNavigation) { state.mobileNavigation = false; render(); }
    }
  });

  document.addEventListener("submit", async (event) => {
    const form = event.target.closest("form[data-form]");
    if (!form) return;
    event.preventDefault();
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    const errorNode = form.querySelector(".form-error");
    if (errorNode) errorNode.textContent = "";
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      if (form.dataset.form === "setup") {
        if (data.password !== data.confirmPassword) throw new Error("Les deux mots de passe ne correspondent pas.");
        await api("/api/setup", { method: "POST", body: JSON.stringify({ displayName: data.displayName, username: data.username, password: data.password }) });
        state.phase = "login"; render(); return;
      }
      if (form.dataset.form === "login") {
        const session = await api("/api/login", { method: "POST", body: JSON.stringify({ username: data.username, password: data.password }) });
        if (enterAuthenticationChallenge(session)) return;
        throw new Error("Réponse d’authentification inattendue.");
      }
      if (form.dataset.form === "password-change-required") {
        if (data.password !== data.confirmPassword) throw new Error("Les deux mots de passe ne correspondent pas.");
        const session = await api("/api/password/change-required", { method: "POST", body: JSON.stringify({ pendingToken: state.pendingMfaToken, password: data.password }) });
        state.pendingMfaToken = "";
        if (enterAuthenticationChallenge(session)) return;
        throw new Error("Réponse d’authentification inattendue.");
      }
      if (form.dataset.form === "mfa-setup") {
        const session = await api("/api/mfa/confirm", { method: "POST", body: JSON.stringify({ pendingToken: state.pendingMfaToken, code: data.code }) });
        state.user = session.user;
        state.csrf = session.csrf;
        scheduleSessionExpiry(session.sessionExpiresAt);
        applyVaultUnlock(session.vaultUnlockedUntil);
        state.pendingMfaToken = "";
        state.mfaSecret = "";
        state.recoveryCodes = session.recoveryCodes || [];
        loadModulePreferences();
        state.phase = "recovery-codes";
        render();
        return;
      }
      if (form.dataset.form === "mfa-verify") {
        const session = await api("/api/mfa/verify", { method: "POST", body: JSON.stringify({ pendingToken: state.pendingMfaToken, code: data.code }) });
        state.user = session.user;
        state.csrf = session.csrf;
        scheduleSessionExpiry(session.sessionExpiresAt);
        applyVaultUnlock(session.vaultUnlockedUntil);
        state.pendingMfaToken = "";
        loadModulePreferences();
        await loadWorkspace();
        await Promise.all([loadVault(), loadAttachments(), loadWorkspaceHistory(), loadSessions(), loadAudit()]);
        await loadUsers();
        state.phase = "app";
        navigate("dashboard");
        render();
        return;
      }
      if (form.dataset.form === "organization") {
        const existing = form.dataset.id ? state.workspace.organizations.find((entry) => entry.id === form.dataset.id) : null;
        const parentOrganizationId = String(data.parentOrganizationId || "").trim();
        if (isAdministrator() && parentOrganizationId) {
          const parent = organizationById(parentOrganizationId);
          if (!parent) throw new Error("L’organisation parente sélectionnée est introuvable.");
          if (existing && (parentOrganizationId === existing.id || organizationDescendantIds(existing.id).includes(parentOrganizationId))) throw new Error("Une organisation ne peut pas être rattachée à elle-même ou à l’une de ses sous-compagnies.");
          const subtreeHeight = existing ? organizationSubtreeHeight(existing.id) : 1;
          if (organizationDepth(parentOrganizationId) + subtreeHeight > 3) throw new Error("La hiérarchie est limitée à trois niveaux.");
        }
        const item = {
          id: existing?.id || uniqueId("org", data.name, state.workspace.organizations),
          parentOrganizationId, name: data.name.trim(), code: data.code.trim().toUpperCase(), industry: data.industry.trim(), owner: data.owner.trim(), notes: data.notes.trim(), quickNotes: existing?.quickNotes || "", status: existing?.status || "active",
          details: {
            ...(existing?.details || {}),
            displayName: String(data.displayName || "").trim(), customerCriticality: String(data.customerCriticality || ""), employeeCount: String(data.employeeCount || ""), itUserCount: String(data.itUserCount || ""),
            timezone: String(data.timezone || "").trim(), serviceLanguage: String(data.serviceLanguage || "").trim(), accountManager: String(data.accountManager || "").trim(), supportHours: String(data.supportHours || "").trim(),
          },
        };
        await commit((workspace) => { const index = workspace.organizations.findIndex((entry) => entry.id === item.id); if (index >= 0) workspace.organizations[index] = item; else workspace.organizations.push(item); }, existing ? "Organisation mise à jour" : "Organisation créée", item.name, "organization"); return;
      }
      if (form.dataset.form === "quick-notes") {
        const organization = state.workspace.organizations.find((entry) => entry.id === form.dataset.id);
        if (!organization) throw new Error("Cette organisation n’existe plus.");
        const quickNotes = String(data.quickNotes || "").trim();
        if (quickNotes.length > 8000) throw new Error("Les Quick Notes doivent contenir au maximum 8 000 caractères.");
        await commit((workspace) => {
          const item = workspace.organizations.find((entry) => entry.id === organization.id);
          if (item) item.quickNotes = quickNotes;
        }, quickNotes ? "Quick Notes mises à jour" : "Quick Notes effacées", organization.name, "organization-quick-notes");
        return;
      }
      if (form.dataset.form === "delete-organization") {
        const organization = state.workspace.organizations.find((entry) => entry.id === form.dataset.id);
        if (!organization) throw new Error("Cette organisation n’existe plus.");
        if (data.confirmation.trim() !== organization.name) throw new Error("Tapez le nom exact de l’organisation pour confirmer.");
        const payload = await api(`/api/organizations/${encodeURIComponent(organization.id)}`, { method: "DELETE", body: JSON.stringify({ confirmation: data.confirmation, code: data.code }) });
        state.workspace = payload.workspace.data;
        state.revision = payload.workspace.revision;
        normalizeWorkspace();
        state.searchScope = "global";
        state.filter = "all";
        state.relationOrganization = "all";
        state.organizationSearch = "";
        state.revealedVaultItem = null;
        state.visibleVaultFields.clear();
        await Promise.all([loadVault(), loadAttachments(), loadWorkspaceHistory(), loadUsers()]);
        closeModal();
        navigate("organizations");
        render();
        const removedTotal = Object.values(payload.removed || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
        const detached = Number(payload.detachedChildOrganizations) || 0;
        toast(`Organisation « ${organization.name} » supprimée avec ${removedTotal} élément${removedTotal === 1 ? "" : "s"} associé${removedTotal === 1 ? "" : "s"}.${detached ? ` ${detached} sous-compagnie${detached === 1 ? " a été détachée" : "s ont été détachées"}.` : ""}`);
        return;
      }
      if (form.dataset.form === "site") {
        const existing = form.dataset.id ? state.workspace.sites.find((entry) => entry.id === form.dataset.id) : null;
        if (existing) assertAssetOrganizationChange(`site:${existing.id}`, data.organizationId);
        const item = {
          id: existing?.id || uniqueId("site", data.name, state.workspace.sites), organizationId: data.organizationId, name: data.name.trim(), address: data.address.trim(), timezone: data.timezone.trim(), status: existing?.status || "active",
          details: {
            ...(existing?.details || {}), siteType: String(data.siteType || "").trim(), openingHours: String(data.openingHours || "").trim(), accessInstructions: String(data.accessInstructions || "").trim(),
            primarySubnet: String(data.primarySubnet || "").trim(), vlans: String(data.vlans || "").trim(), onsiteContact: String(data.onsiteContact || "").trim(),
          },
        };
        await commit((workspace) => { const index = workspace.sites.findIndex((entry) => entry.id === item.id); if (index >= 0) workspace.sites[index] = item; else workspace.sites.push(item); }, existing ? "Site mis à jour" : "Site créé", item.name, "site");
        navigate(`asset/${encodeURIComponent(`site:${item.id}`)}`);
        return;
      }
      if (form.dataset.form === "procedure") {
        const existing = form.dataset.id ? state.workspace.procedures.find((entry) => entry.id === form.dataset.id) : null;
        if (existing) assertAssetOrganizationChange(`procedure:${existing.id}`, data.organizationId);
        const item = { id: existing?.id || uniqueId("proc", data.title, state.workspace.procedures), organizationId: data.organizationId, title: data.title.trim(), category: data.category.trim(), owner: data.owner.trim(), status: data.status || existing?.status || "review", updatedAt: new Date().toISOString().slice(0, 10), summary: data.summary.trim(), steps: data.steps.split(/\r?\n/).map((step) => step.trim()).filter(Boolean).slice(0, 80) };
        await commit((workspace) => { const index = workspace.procedures.findIndex((entry) => entry.id === item.id); if (index >= 0) workspace.procedures[index] = item; else workspace.procedures.push(item); syncMentionRelations(workspace, `procedure:${item.id}`, item.organizationId, `${item.summary}\n${item.steps.join("\n")}`); }, existing ? "Procédure mise à jour" : "Procédure créée", item.title, "procedure"); return;
      }
      if (form.dataset.form === "relation") {
        if (data.sourceRef === data.targetRef) throw new Error("La source et la cible doivent être différentes.");
        const source = assetByRef(data.sourceRef); const target = assetByRef(data.targetRef);
        if (!source || !target) throw new Error("La source ou la cible n’existe plus.");
        if (source.organizationId !== target.organizationId || source.organizationId !== data.organizationId) throw new Error("Une relation doit rester dans une seule organisation.");
        const existing = form.dataset.id ? state.workspace.relations.find((entry) => entry.id === form.dataset.id) : null;
        if (!existing && relationAlreadyExists(data.sourceRef, data.targetRef, data.relationType)) throw new Error("Cette relation existe déjà.");
        const type = relationshipTypeById(data.relationType);
        const customLabel = data.relationType === "custom" ? data.customLabel.trim() : "";
        if (data.relationType === "custom" && !customLabel) throw new Error("Ajoutez un libellé pour la relation personnalisée.");
        const archived = data.archived === "on";
        const item = { id: existing?.id || uniqueId("rel", `${data.sourceRef}-${data.targetRef}-${data.relationType}`, state.workspace.relations), organizationId: data.organizationId, sourceRef: data.sourceRef, targetRef: data.targetRef, relationType: data.relationType, label: customLabel || type.label, reverseLabel: customLabel || type.reverseLabel, notes: data.notes.trim(), archived, autoMention: existing?.autoMention || false, createdAt: existing?.createdAt || new Date().toISOString(), createdBy: existing?.createdBy || state.user.displayName, updatedAt: new Date().toISOString() };
        const eventAction = !existing ? "Relation ajoutée" : existing.archived !== archived ? (archived ? "Relation archivée" : "Relation réactivée") : "Relation modifiée";
        await commit((workspace) => { const index = workspace.relations.findIndex((entry) => entry.id === item.id); if (index >= 0) workspace.relations[index] = item; else workspace.relations.push(item); recordRelationshipEvent(workspace, item, eventAction); }, eventAction, `${source.label} ↔ ${target.label}`, "relation"); return;
      }
      if (form.dataset.form === "template") {
        const existing = form.dataset.id ? state.workspace.templates.find((entry) => entry.id === form.dataset.id) : null;
        const item = { id: existing?.id || uniqueId("tpl", data.name, state.workspace.templates), name: data.name.trim(), moduleId: data.moduleId, defaultTags: data.defaultTags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 20), defaultSummary: data.defaultSummary.trim(), defaultNotes: data.defaultNotes.trim() };
        await commit((workspace) => { const index = workspace.templates.findIndex((entry) => entry.id === item.id); if (index >= 0) workspace.templates[index] = item; else workspace.templates.push(item); }, existing ? "Modèle mis à jour" : "Modèle créé", item.name, "template"); return;
      }
      if (form.dataset.form === "custom-module") {
        if (!isAdministrator()) throw new Error("Seul le super administrateur Atlas peut créer un module local.");
        const existing = form.dataset.id ? state.workspace.customModuleDefinitions.find((entry) => entry.id === form.dataset.id) : null;
        const label = String(data.label || "").trim();
        if (!label) throw new Error("Ajoutez un nom au module.");
        const fields = [];
        const fieldKeys = new Set();
        for (let index = 0; index < 20; index += 1) {
          const fieldLabel = String(formData.get(`fieldLabel_${index}`) || "").trim();
          if (!fieldLabel) continue;
          if (/(mot.?de.?passe|password|secret|jeton|token|api.?key|clé.?api|credential)/i.test(fieldLabel)) throw new Error(`Le champ « ${fieldLabel} » doit être conservé dans Passwords.`);
          const type = String(formData.get(`fieldType_${index}`) || "text");
          const allowedTypes = new Set(["text", "textarea", "number", "date", "url", "email", "tel", "select"]);
          if (!allowedTypes.has(type)) throw new Error(`Le type du champ « ${fieldLabel} » est invalide.`);
          let key = existing?.fields?.[index]?.key || slug(fieldLabel).replaceAll("-", "").slice(0, 36);
          if (!/^[a-z]/i.test(key)) key = `field${key}`;
          if (key.length < 2) key = `field${index + 1}`;
          let uniqueKey = key;
          let suffix = 2;
          while (fieldKeys.has(uniqueKey)) uniqueKey = `${key.slice(0, 34)}${suffix++}`;
          fieldKeys.add(uniqueKey);
          const options = String(formData.get(`fieldOptions_${index}`) || "").split(/[,;\n]+/).map((value) => value.trim()).filter(Boolean).slice(0, 30);
          if (type === "select" && !options.length) throw new Error(`Ajoutez au moins un choix au champ « ${fieldLabel} ».`);
          fields.push({ key: uniqueKey, label: fieldLabel, type, ...(type === "select" ? { options } : {}), ...(type === "textarea" ? { rows: 4, span: 2 } : {}) });
        }
        if (fields.length < 4) throw new Error("Ajoutez au moins quatre champs métier pour créer un module utile.");
        const item = {
          id: existing?.id || uniqueId("local", label, state.workspace.customModuleDefinitions),
          label,
          description: String(data.description || "").trim(),
          titleLabel: String(data.titleLabel || "Nom de la fiche").trim(),
          icon: String(data.icon || "grid"),
          fields,
          createdAt: existing?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await commit((workspace) => {
          const index = workspace.customModuleDefinitions.findIndex((definition) => definition.id === item.id);
          if (index >= 0) workspace.customModuleDefinitions[index] = item;
          else workspace.customModuleDefinitions.push(item);
        }, existing ? "Module personnalisé mis à jour" : "Module personnalisé créé", item.label, "module-definition");
        state.visibleModuleIds.add(item.id);
        const selected = [...state.visibleModuleIds].filter((id) => moduleMap.has(id));
        const preferences = await api("/api/me/preferences", { method: "PUT", body: JSON.stringify({ visibleModules: selected }) });
        state.user = preferences.user;
        localStorage.setItem(modulePreferenceKey(), JSON.stringify(selected));
        render();
        toast(`Module « ${item.label} » prêt dans la navigation de l’organisation active.`);
        return;
      }
      if (form.dataset.form === "guided-import") {
        if (!isAdministrator()) throw new Error("Seul le super administrateur Atlas peut appliquer cet import.");
        const preview = state.importPreview;
        if (!preview?.rows?.length) throw new Error("L’aperçu CSV a expiré.");
        const mapped = (key, row) => {
          const selected = formData.get(`map_${key}`);
          if (selected === null || selected === "") return "";
          const index = Number(selected);
          return Number.isInteger(index) && index >= 0 ? String(row[index] || "").trim() : "";
        };
        const imported = [];
        if (preview.target === "organizations") {
          const identifiers = [...state.workspace.organizations];
          for (const row of preview.rows) {
            const name = mapped("name", row);
            if (!name) throw new Error("Chaque ligne doit contenir un nom de compagnie.");
            const item = { id: uniqueId("org", name, identifiers), name: name.slice(0, 120), code: (mapped("code", row) || name.split(/\s+/).map((part) => part[0]).join("")).replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() || "ORG", industry: mapped("industry", row).slice(0, 80), owner: mapped("owner", row).slice(0, 96), notes: mapped("notes", row).slice(0, 2000), quickNotes: "", parentOrganizationId: "", status: "active", details: {} };
            identifiers.push(item); imported.push(item);
          }
          await commit((workspace) => workspace.organizations.push(...imported), "Import CSV terminé", `${imported.length} organisations`, "import");
        } else if (preview.target === "configurations") {
          const organizationId = String(data.organizationId || "");
          if (!state.workspace.organizations.some((organization) => organization.id === organizationId)) throw new Error("Choisissez l’organisation de destination.");
          const identifiers = [...state.workspace.configurations];
          const siteId = state.workspace.sites.some((site) => site.id === data.siteId && site.organizationId === organizationId) ? data.siteId : "";
          for (const row of preview.rows) {
            const name = mapped("name", row);
            if (!name) throw new Error("Chaque ligne doit contenir un nom de configuration.");
            const item = { id: uniqueId("cfg", name, identifiers), organizationId, siteId, name: name.slice(0, 120), type: (mapped("type", row) || "Autre").slice(0, 80), os: mapped("os", row).slice(0, 160), ip: mapped("ip", row).slice(0, 80), owner: mapped("owner", row).slice(0, 96), location: mapped("location", row).slice(0, 160), warranty: "", criticality: "normal", status: "draft", lastReviewed: "", rmmId: "", summary: mapped("summary", row).slice(0, 1200), notes: mapped("notes", row).slice(0, 6000), procedureIds: [], relationIds: [], details: {} };
            identifiers.push(item); imported.push(item);
          }
          await commit((workspace) => workspace.configurations.push(...imported), "Import CSV terminé", `${imported.length} configurations · ${orgName(organizationId)}`, "import");
        } else {
          const moduleId = preview.target.startsWith("module:") ? preview.target.slice(7) : "";
          const module = moduleMap.get(moduleId);
          const organizationId = String(data.organizationId || "");
          if (!module || module.id === "passwords") throw new Error("Le module de destination n’est plus disponible.");
          if (!state.workspace.organizations.some((organization) => organization.id === organizationId)) throw new Error("Choisissez l’organisation de destination.");
          const identifiers = [...state.workspace.moduleRecords];
          for (const row of preview.rows) {
            const title = mapped("title", row);
            if (!title) throw new Error("Chaque ligne doit contenir un titre.");
            const rawStatus = normalizeSearch(mapped("status", row));
            const details = {};
            for (const field of moduleProfile(module).fields || []) details[field.key] = mapped(`detail_${field.key}`, row).slice(0, field.type === "textarea" ? 8000 : 1000);
            const item = { id: uniqueId("rec", title, identifiers), moduleId, organizationId, siteId: "", title: title.slice(0, 160), owner: mapped("owner", row).slice(0, 96), status: rawStatus === "archive" || rawStatus === "archived" ? "archived" : rawStatus === "review" || rawStatus === "a reviser" ? "review" : "active", expiresOn: mapped("expiresOn", row).slice(0, 10), reference: mapped("reference", row).slice(0, 500), tags: mapped("tags", row).split(/[,;]+/).map((tag) => tag.trim()).filter(Boolean).slice(0, 20), summary: mapped("summary", row).slice(0, 1000), notes: mapped("notes", row).slice(0, 4000), updatedAt: new Date().toISOString().slice(0, 10), reviewState: "draft", reviewOwner: mapped("owner", row).slice(0, 96), reviewDueAt: "", reviewIntervalDays: 0, details, checklist: [] };
            identifiers.push(item); imported.push(item);
          }
          await commit((workspace) => workspace.moduleRecords.push(...imported), "Import CSV terminé", `${imported.length} fiches ${module.label} · ${orgName(organizationId)}`, "import");
        }
        state.importPreview = null;
        toast(`${imported.length} ligne${imported.length === 1 ? "" : "s"} importée${imported.length === 1 ? "" : "s"} dans une révision restaurable.`);
        return;
      }
      if (form.dataset.form === "workflows") {
        const expiryDays = Number(data.expiryDays); const staleDays = Number(data.staleDays);
        if (!Number.isInteger(expiryDays) || expiryDays < 1 || expiryDays > 365 || !Number.isInteger(staleDays) || staleDays < 7 || staleDays > 730) throw new Error("Les seuils de workflow sont invalides.");
        await commit((workspace) => { workspace.settings.workflows = { expiryDays, staleDays, requireOwner: data.requireOwner === "on" }; }, "Workflows mis à jour", "Seuils de suivi", "settings"); return;
      }
      if (form.dataset.form === "user") {
        const organizationIds = data.allOrganizations === "on" || data.role === "administrator" ? null : formData.getAll("organizationIds");
        if (organizationIds && !organizationIds.length) throw new Error("Choisissez au moins une organisation ou autorisez toutes les organisations.");
        const existingId = form.dataset.id;
        const organizationPermissions = organizationIds?.map((organizationId) => ({ organizationId, role: String(formData.get(`orgRole_${organizationId}`) || data.role), vaultAccess: formData.has(`orgVault_${organizationId}`) })) || null;
        const payload = { displayName: data.displayName, username: data.username, role: data.role, organizationIds, organizationPermissions, vaultAccess: data.role === "administrator" || data.vaultAccess === "on", adminMfaCode: data.adminMfaCode || "" };
        if (!existingId) payload.password = data.password;
        await api(existingId ? `/api/users/${encodeURIComponent(existingId)}` : "/api/users", { method: existingId ? "PUT" : "POST", body: JSON.stringify(payload) });
        await loadUsers();
        closeModal();
        render();
        toast(existingId ? "Accès mis à jour. Les anciennes sessions ont été fermées." : "Compte local créé. Le MFA sera requis à sa première connexion.");
        return;
      }
      if (form.dataset.form === "user-password-reset") {
        if (data.password !== data.confirmPassword) throw new Error("Les deux mots de passe ne correspondent pas.");
        await api(`/api/users/${encodeURIComponent(form.dataset.id)}/reset-password`, { method: "POST", body: JSON.stringify({ password: data.password, adminMfaCode: data.adminMfaCode || "" }) });
        await loadUsers();
        closeModal();
        render();
        toast("Mot de passe réinitialisé. Toutes les anciennes sessions ont été fermées.");
        return;
      }
      if (form.dataset.form === "privileged-action") {
        const pending = state.pendingPrivilegedAction;
        if (!pending) throw new Error("L’action sensible a expiré.");
        const endpoint = pending.action === "toggle-user" ? "toggle" : pending.action === "reset-user-mfa" ? "reset-mfa" : "revoke-sessions";
        await api(`/api/users/${encodeURIComponent(pending.userId)}/${endpoint}`, { method: "POST", body: JSON.stringify({ adminMfaCode: data.adminMfaCode || "" }) });
        const message = pending.action === "toggle-user" ? "État du compte mis à jour." : pending.action === "reset-user-mfa" ? "MFA réinitialisé. Le compte devra l’activer à sa prochaine connexion." : "Toutes les sessions de ce compte ont été fermées.";
        state.pendingPrivilegedAction = null;
        await Promise.all([loadUsers(), loadAudit()]); closeModal(); render(); toast(message); return;
      }
      if (form.dataset.form === "self-password") {
        if (data.password !== data.confirmPassword) throw new Error("Les deux nouveaux mots de passe ne correspondent pas.");
        const payload = await api("/api/me/change-password", { method: "POST", body: JSON.stringify({ currentPassword: data.currentPassword, password: data.password, code: data.code }) });
        state.user = payload.user; form.reset(); await Promise.all([loadSessions(), loadAudit()]); render(); toast("Mot de passe mis à jour; les autres sessions ont été fermées."); return;
      }
      if (form.dataset.form === "recovery-codes-regenerate") {
        const payload = await api("/api/me/recovery-codes", { method: "POST", body: JSON.stringify({ code: data.code }) });
        state.recoveryCodes = payload.recoveryCodes || []; showModal("recovery-codes-display"); return;
      }
      if (form.dataset.form === "self-mfa-reenroll") {
        const payload = await api("/api/me/mfa/re-enroll", { method: "POST", body: JSON.stringify({ password: data.password, code: data.code }) });
        state.pendingMfaToken = payload.pendingToken; state.mfaSecret = payload.secret; state.mfaUri = payload.otpauthUri; closeModal(); state.phase = "mfa-setup"; render(); return;
      }
      if (form.dataset.form === "vault-unlock") {
        const unlock = await api("/api/vault/unlock", { method: "POST", body: JSON.stringify({ code: data.code }) });
        applyVaultUnlock(unlock.unlockedUntil);
        const revealId = state.pendingVaultReveal;
        state.pendingVaultReveal = "";
        closeModal();
        await revealVaultItem(revealId, { promptOnLocked: false });
        return;
      }
      if (form.dataset.form === "vault-item") {
        const existingId = form.dataset.id;
        if (existingId) assertAssetOrganizationChange(`vault:${existingId}`, data.organizationId);
        const body = { title: data.title, organizationId: data.organizationId, category: data.category, username: data.username, password: data.password, url: data.url, notes: data.notes, otpSecret: data.otpSecret, archived: data.archived === "on", passwordChangedAt: data.passwordChangedAt || "", expiresAt: data.expiresAt || "", rotationOwner: data.rotationOwner || "", rotationIntervalDays: Number(data.rotationIntervalDays) || 0 };
        const payload = await api(existingId ? `/api/vault/${encodeURIComponent(existingId)}` : "/api/vault", { method: existingId ? "PUT" : "POST", body: JSON.stringify(body) });
        state.revealedVaultItem = null;
        state.visibleVaultFields.clear();
        await loadVault(); closeModal(); navigate(`asset/${encodeURIComponent(`vault:${payload.item.id}`)}`); render(); toast(existingId ? "Entrée chiffrée mise à jour." : "Entrée ajoutée au coffre chiffré.");
        return;
      }
      if (form.dataset.form === "module-preferences") {
        const selected = new FormData(form).getAll("visibleModules").filter((id) => moduleMap.has(id));
        const payload = await api("/api/me/preferences", { method: "PUT", body: JSON.stringify({ visibleModules: selected }) });
        state.visibleModuleIds = new Set(selected);
        state.user = payload.user;
        localStorage.setItem(modulePreferenceKey(), JSON.stringify(selected));
        render();
        toast("Navigation personnalisée enregistrée pour ce compte.");
        return;
      }
      if (form.dataset.form === "module-record") {
        const moduleId = form.dataset.moduleId;
        const module = moduleMap.get(moduleId);
        if (!module) throw new Error("Le module sélectionné n’existe plus.");
        const profile = moduleProfile(module);
        const existing = form.dataset.id ? state.workspace.moduleRecords.find((record) => record.id === form.dataset.id) : null;
        if (existing) assertAssetOrganizationChange(`module:${existing.id}`, data.organizationId);
        const details = { ...(existing?.details || {}) };
        for (const field of profile.fields) details[field.key] = String(data[`detail_${field.key}`] || "").trim();
        const serverConfigurationIds = moduleId === FILE_SHARING_MODULE_ID
          ? [...new Set(formData.getAll("serverConfigurationIds").map(String).filter((id) => state.workspace.configurations.some((configuration) => configuration.id === id && configuration.organizationId === data.organizationId)))]
          : [];
        if (moduleId === FILE_SHARING_MODULE_ID) details.serverConfigurationIds = serverConfigurationIds;
        const printServerConfigurationIds = moduleId === PRINTING_MODULE_ID
          ? [...new Set(formData.getAll("printServerConfigurationIds").map(String).filter((id) => state.workspace.configurations.some((configuration) => configuration.id === id && configuration.organizationId === data.organizationId)))]
          : [];
        const printerConfigurationIds = moduleId === PRINTING_MODULE_ID
          ? [...new Set(formData.getAll("printerConfigurationIds").map(String).filter((id) => state.workspace.configurations.some((configuration) => configuration.id === id && configuration.organizationId === data.organizationId)))]
          : [];
        if (moduleId === PRINTING_MODULE_ID) {
          details.printServerConfigurationIds = printServerConfigurationIds;
          details.printerConfigurationIds = printerConfigurationIds;
          details.publishedToAd = formData.has("detail_publishedToAd") ? "Oui" : "Non";
        }
        const item = {
          id: existing?.id || uniqueId("rec", data.title, state.workspace.moduleRecords), moduleId, organizationId: data.organizationId, siteId: data.siteId || "",
          title: data.title.trim(), owner: data.owner.trim(), status: data.status, expiresOn: data.expiresOn || "", reference: moduleId === PRINTING_MODULE_ID ? String(details.hostAddress || "").trim() : data.reference.trim(),
          tags: data.tags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 20), summary: data.summary.trim(), notes: data.notes.trim(), updatedAt: new Date().toISOString().slice(0, 10),
          details,
          reviewState: ["draft", "in-review", "approved", "stale"].includes(data.reviewState) ? data.reviewState : existing?.reviewState || "draft",
          reviewOwner: String(data.reviewOwner || "").trim(),
          reviewDueAt: String(data.reviewDueAt || ""),
          reviewIntervalDays: Math.min(Math.max(Number(data.reviewIntervalDays) || 0, 0), 730),
          lastReviewedAt: existing?.lastReviewedAt || "",
          approvedAt: data.reviewState === "approved" ? (existing?.approvedAt || new Date().toISOString()) : "",
          approvedBy: data.reviewState === "approved" ? (existing?.approvedBy || state.user.displayName) : "",
          checklist: typeof data.checklistSteps === "string" ? data.checklistSteps.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 100).map((line) => ({ done: /^\[x\]/i.test(line), label: line.replace(/^\[[ x]\]\s*/i, "").slice(0, 300) })) : (existing?.checklist || []),
        };
        await commit((workspace) => {
          const index = workspace.moduleRecords.findIndex((record) => record.id === item.id);
          if (index >= 0) workspace.moduleRecords[index] = item;
          else workspace.moduleRecords.push(item);
          syncMentionRelations(workspace, `module:${item.id}`, item.organizationId, [item.summary, item.notes, ...Object.values(details)].join("\n"));
          if (moduleId === FILE_SHARING_MODULE_ID) syncFileSharingServerRelations(workspace, item, serverConfigurationIds);
          if (moduleId === PRINTING_MODULE_ID) syncPrintingConfigurationRelations(workspace, item, printServerConfigurationIds, printerConfigurationIds);
        }, existing ? "Fiche mise à jour" : "Fiche créée", `${module.label} · ${item.title}`, "module");
        state.activeTemplate = null;
        navigate(`asset/${encodeURIComponent(`module:${item.id}`)}`);
        return;
      }
      if (form.dataset.form === "configuration") {
        const existing = form.dataset.id ? configById(form.dataset.id) : null;
        if (existing) assertAssetOrganizationChange(`configuration:${existing.id}`, data.organizationId);
        const item = {
          id: existing?.id || uniqueId("cfg", data.name, state.workspace.configurations), organizationId: data.organizationId, siteId: data.siteId, name: data.name.trim(), type: data.type,
          os: data.os.trim(), ip: data.ip.trim(), owner: data.owner.trim(), location: data.location.trim(), warranty: data.warranty, criticality: data.criticality, status: data.status,
          lastReviewed: new Date().toISOString().slice(0, 10), rmmId: existing?.rmmId || "", summary: data.summary.trim(), notes: data.notes.trim(), procedureIds: existing?.procedureIds || [], relationIds: existing?.relationIds || [],
          details: {
            ...(existing?.details || {}), technicalRole: String(data.technicalRole || "").trim(), parentConfigurationId: String(data.parentConfigurationId || "").trim(), parentAsset: String(data.parentAsset || "").trim(),
            hostname: String(data.hostname || "").trim(), fqdn: String(data.fqdn || "").trim(), assetTag: String(data.assetTag || "").trim(),
            manufacturer: String(data.manufacturer || "").trim(), model: String(data.model || "").trim(), serialNumber: String(data.serialNumber || "").trim(), platform: String(data.platform || "").trim(),
            cpu: String(data.cpu || "").trim(), memory: String(data.memory || "").trim(), storage: String(data.storage || "").trim(), firmware: String(data.firmware || "").trim(),
            powerSupply: String(data.powerSupply || "").trim(), rackPosition: String(data.rackPosition || "").trim(), vlan: String(data.vlan || "").trim(), networkInterfaces: String(data.networkInterfaces || "").trim(),
            macAddresses: String(data.macAddresses || "").trim(), dnsNames: String(data.dnsNames || "").trim(), managementPorts: String(data.managementPorts || "").trim(), managementNetwork: String(data.managementNetwork || "").trim(),
            purchaseDate: String(data.purchaseDate || ""), installedDate: String(data.installedDate || ""), lifecycleDate: String(data.lifecycleDate || ""),
            encryption: String(data.encryption || "").trim(), securityAgent: String(data.securityAgent || "").trim(), monitoring: String(data.monitoring || "").trim(), backupPolicy: String(data.backupPolicy || "").trim(),
            patchPolicy: String(data.patchPolicy || "").trim(), maintenanceWindow: String(data.maintenanceWindow || "").trim(), operationalDependencies: String(data.operationalDependencies || "").trim(), customAttributes: String(data.customAttributes || "").trim(),
          },
        };
        await commit((workspace) => {
          const index = workspace.configurations.findIndex((entry) => entry.id === item.id);
          if (index >= 0) workspace.configurations[index] = item; else workspace.configurations.push(item);
          syncMentionRelations(workspace, `configuration:${item.id}`, item.organizationId, `${item.summary}\n${item.notes}\n${item.details.operationalDependencies}\n${item.details.customAttributes}`);
          syncConfigurationParentRelation(workspace, item, item.details.parentConfigurationId);
        }, existing ? "Configuration mise à jour" : "Configuration créée", item.name, "configuration");
        navigate(`asset/${encodeURIComponent(`configuration:${item.id}`)}`); return;
      }
      if (form.dataset.form === "settings-general") {
        const previousGeneral = { instanceName: state.workspace.settings.instanceName, defaultLocale: state.workspace.settings.defaultLocale };
        const nextGeneral = { instanceName: data.instanceName.trim(), defaultLocale: data.defaultLocale };
        const generalChanged = JSON.stringify(previousGeneral) !== JSON.stringify(nextGeneral);
        if (!generalChanged) { toast("Aucune modification à enregistrer."); return; }
        await commit((workspace) => { workspace.settings.instanceName = nextGeneral.instanceName; workspace.settings.defaultLocale = nextGeneral.defaultLocale; }, "Paramètres mis à jour", "Instance Atlas", "settings");
        render();
        toast("Paramètres généraux enregistrés.");
        return;
      }
      if (form.dataset.form === "settings-backups") {
        if (!isAdministrator()) throw new Error("Seul le super administrateur Atlas peut configurer les sauvegardes.");
        const currentSecurity = state.workspace.settings.security;
        if (currentSecurity.privilegedMfaEnabled && !/^\d{6}$/.test(String(data.adminMfaCode || ""))) throw new Error("Entrez le code MFA actuel affiché dans votre application d’authentification.");
        const payload = {
          enabled: data.enabled === "on",
          destination: String(data.destination || "").trim(),
          cadence: data.cadence === "weekly" ? "weekly" : "daily",
          weekday: Number(data.weekday),
          hour: Number(data.hour),
          minute: Number(data.minute),
          retentionEnabled: data.retentionEnabled === "on",
          retentionCount: Number(data.retentionCount),
          passphrase: String(data.passphrase || ""),
          adminMfaCode: data.adminMfaCode || "",
        };
        if (payload.passphrase && payload.passphrase.length < 12) throw new Error("La phrase secrète doit contenir au moins 12 caractères.");
        state.backupStatus = await api("/api/settings/backups", { method: "PUT", body: JSON.stringify(payload) });
        await Promise.all([loadDeploymentHealth({ renderAfter: false }), loadAudit()]);
        render();
        toast(payload.enabled ? "Planification de sauvegarde enregistrée." : "Configuration enregistrée; la planification est désactivée.");
        return;
      }
      if (form.dataset.form === "settings-local-api") {
        if (!isAdministrator()) throw new Error("Seul le super administrateur Atlas peut configurer l’API locale.");
        const currentSecurity = state.workspace.settings.security;
        if (currentSecurity.privilegedMfaEnabled && !/^\d{6}$/.test(String(data.adminMfaCode || ""))) throw new Error("Entrez le code MFA actuel affiché dans votre application d’authentification.");
        state.localApiStatus = await api("/api/settings/local-api", { method: "PUT", body: JSON.stringify({ enabled: data.enabled === "on", webhooksEnabled: data.webhooksEnabled === "on", adminMfaCode: data.adminMfaCode || "" }) });
        state.createdApiToken = "";
        state.createdWebhookSecret = "";
        await loadAudit();
        render();
        toast(state.localApiStatus.enabled ? "API locale activée." : "API locale désactivée.");
        return;
      }
      if (form.dataset.form === "local-webhook-create") {
        if (!isAdministrator()) throw new Error("Seul le super administrateur Atlas peut créer un webhook.");
        const events = formData.getAll("events").map(String);
        if (!events.length) throw new Error("Choisissez au moins un événement.");
        const currentSecurity = state.workspace.settings.security;
        if (currentSecurity.privilegedMfaEnabled && !/^\d{6}$/.test(String(data.adminMfaCode || ""))) throw new Error("Entrez le code MFA actuel affiché dans votre application d’authentification.");
        const result = await api("/api/settings/local-api/webhooks", { method: "POST", body: JSON.stringify({ label: String(data.label || "").trim(), url: String(data.url || "").trim(), events, adminMfaCode: data.adminMfaCode || "" }) });
        state.createdWebhookSecret = result.secret;
        await Promise.all([loadLocalApiStatus({ renderAfter: false }), loadAudit()]);
        render();
        toast("Webhook local créé. Copiez son secret de signature maintenant.");
        return;
      }
      if (form.dataset.form === "local-webhook-test") {
        const currentSecurity = state.workspace.settings.security;
        if (currentSecurity.privilegedMfaEnabled && !/^\d{6}$/.test(String(data.adminMfaCode || ""))) throw new Error("Entrez le code MFA actuel affiché dans votre application d’authentification.");
        state.localApiStatus = await api(`/api/settings/local-api/webhooks/${encodeURIComponent(form.dataset.id)}/test`, { method: "POST", body: JSON.stringify({ adminMfaCode: data.adminMfaCode || "" }) });
        await loadAudit(); render(); toast("Webhook local livré avec succès."); return;
      }
      if (form.dataset.form === "local-webhook-remove") {
        const currentSecurity = state.workspace.settings.security;
        if (currentSecurity.privilegedMfaEnabled && !/^\d{6}$/.test(String(data.adminMfaCode || ""))) throw new Error("Entrez le code MFA actuel affiché dans votre application d’authentification.");
        state.localApiStatus = await api(`/api/settings/local-api/webhooks/${encodeURIComponent(form.dataset.id)}`, { method: "DELETE", body: JSON.stringify({ adminMfaCode: data.adminMfaCode || "" }) });
        state.createdWebhookSecret = "";
        await loadAudit(); render(); toast("Webhook local retiré."); return;
      }
      if (form.dataset.form === "local-api-token-create") {
        if (!isAdministrator()) throw new Error("Seul le super administrateur Atlas peut créer un jeton.");
        const scopes = formData.getAll("scopes").map(String);
        const organizationIds = formData.getAll("organizationIds").map(String);
        if (!scopes.length) throw new Error("Choisissez au moins une portée.");
        const currentSecurity = state.workspace.settings.security;
        if (currentSecurity.privilegedMfaEnabled && !/^\d{6}$/.test(String(data.adminMfaCode || ""))) throw new Error("Entrez le code MFA actuel affiché dans votre application d’authentification.");
        const result = await api("/api/settings/local-api/tokens", { method: "POST", body: JSON.stringify({ label: String(data.label || "").trim(), scopes, allOrganizations: data.allOrganizations === "on", organizationIds, adminMfaCode: data.adminMfaCode || "" }) });
        state.createdApiToken = result.token;
        await Promise.all([loadLocalApiStatus({ renderAfter: false }), loadAudit()]);
        render();
        toast("Jeton créé. Copiez-le maintenant; il ne sera plus affiché.");
        return;
      }
      if (form.dataset.form === "local-api-token-revoke") {
        if (!isAdministrator()) throw new Error("Seul le super administrateur Atlas peut révoquer un jeton.");
        const currentSecurity = state.workspace.settings.security;
        if (currentSecurity.privilegedMfaEnabled && !/^\d{6}$/.test(String(data.adminMfaCode || ""))) throw new Error("Entrez le code MFA actuel affiché dans votre application d’authentification.");
        state.localApiStatus = await api(`/api/settings/local-api/tokens/${encodeURIComponent(form.dataset.id)}`, { method: "DELETE", body: JSON.stringify({ adminMfaCode: data.adminMfaCode || "" }) });
        state.createdApiToken = "";
        await loadAudit();
        render();
        toast("Jeton API révoqué.");
        return;
      }
      if (form.dataset.form === "update-apply") {
        if (!isAdministrator()) throw new Error("Seul le super administrateur Atlas peut installer une mise à jour.");
        const targetVersion = state.updateStatus?.prepared?.targetVersion || "";
        if (String(data.confirmation || "").trim() !== `INSTALLER ${targetVersion}`) throw new Error(`Saisissez exactement INSTALLER ${targetVersion}.`);
        const currentSecurity = state.workspace.settings.security;
        if (currentSecurity.privilegedMfaEnabled && !/^\d{6}$/.test(String(data.adminMfaCode || ""))) throw new Error("Entrez le code MFA actuel affiché dans votre application d’authentification.");
        const result = await api("/api/settings/updates/apply", { method: "POST", body: JSON.stringify({ confirmation: data.confirmation, adminMfaCode: data.adminMfaCode || "" }) });
        state.updateStatus = { ...state.updateStatus, job: { jobId: result.jobId, status: result.status, message: result.message, currentVersion: ATLAS_VERSION, targetVersion: result.targetVersion, updatedAt: new Date().toISOString() } };
        render();
        toast("Mise à jour lancée. Atlas va redémarrer automatiquement.");
        const reconnect = setInterval(async () => {
          try {
            const response = await fetch("/api/status", { cache: "no-store" });
            const payload = await response.json();
            if (response.ok && payload.version === result.targetVersion) { clearInterval(reconnect); window.location.reload(); }
          } catch { /* Atlas est temporairement arrêté. */ }
        }, 2500);
        setTimeout(() => clearInterval(reconnect), 5 * 60 * 1000);
        return;
      }
      if (form.dataset.form === "backup-run") {
        if (!isAdministrator()) throw new Error("Seul le super administrateur Atlas peut créer une sauvegarde complète.");
        const currentSecurity = state.workspace.settings.security;
        if (currentSecurity.privilegedMfaEnabled && !/^\d{6}$/.test(String(data.adminMfaCode || ""))) throw new Error("Entrez le code MFA actuel affiché dans votre application d’authentification.");
        const payload = await api("/api/settings/backups/run", { method: "POST", body: JSON.stringify({ passphrase: data.passphrase || "", adminMfaCode: data.adminMfaCode || "" }) });
        state.backupStatus = payload.status;
        await Promise.all([loadDeploymentHealth({ renderAfter: false }), loadAudit()]);
        render();
        toast(`Sauvegarde ${payload.result.name} créée et chiffrée.`);
        return;
      }
      if (form.dataset.form === "backup-inspect") {
        if (!isAdministrator()) throw new Error("Seul le super administrateur Atlas peut tester une sauvegarde complète.");
        const currentSecurity = state.workspace.settings.security;
        if (currentSecurity.privilegedMfaEnabled && !/^\d{6}$/.test(String(data.adminMfaCode || ""))) throw new Error("Entrez le code MFA actuel affiché dans votre application d’authentification.");
        const result = await api("/api/settings/backups/inspect", { method: "POST", body: JSON.stringify({ name: form.dataset.name, passphrase: data.passphrase || "", adminMfaCode: data.adminMfaCode || "" }) });
        await loadAudit();
        form.reset();
        toast(`Intégrité confirmée : ${result.fileCount} fichiers vérifiés, aucune restauration effectuée.`);
        return;
      }
      if (form.dataset.form === "settings-deployment") {
        if (!isAdministrator()) throw new Error("Seul le super administrateur Atlas peut modifier la configuration initiale.");
        const currentDeployment = state.workspace.settings.deployment;
        const nextDeployment = {
          instanceCode: String(data.instanceCode || currentDeployment.instanceCode).trim().toUpperCase(),
          primaryDomain: String(data.primaryDomain || "").trim().toLowerCase().replace(/\.$/, ""),
          domainAliases: String(data.domainAliases || "").split(/[\n,;]+/).map((domain) => domain.trim().toLowerCase().replace(/\.$/, "")).filter(Boolean),
          accessMode: data.accessMode === "reverse-proxy" ? "reverse-proxy" : "local",
          reverseProxy: data.reverseProxy || currentDeployment.reverseProxy || "nginx",
          certificateManagement: "reverse-proxy",
        };
        if (!/^[A-Z0-9][A-Z0-9-]{1,31}$/.test(nextDeployment.instanceCode)) throw new Error("Le code de l’instance doit contenir de 2 à 32 lettres, chiffres ou tirets.");
        const invalidDomain = (domain) => domain && (/^[a-z][a-z0-9+.-]*:\/\//i.test(domain) || /[\s/:\\@?#]/.test(domain) || !domain.includes("."));
        if (invalidDomain(nextDeployment.primaryDomain)) throw new Error("Saisissez le domaine principal sans protocole, port ni chemin, par exemple atlas.abcp.com.");
        if (nextDeployment.domainAliases.length > 10 || nextDeployment.domainAliases.some(invalidDomain)) throw new Error("Vérifiez les domaines secondaires; un maximum de 10 domaines complets est permis.");
        if (nextDeployment.accessMode === "reverse-proxy" && !nextDeployment.primaryDomain) throw new Error("Un domaine principal est requis pour le mode HTTPS par proxy inverse.");
        const deploymentChanged = JSON.stringify(currentDeployment) !== JSON.stringify(nextDeployment);
        if (!deploymentChanged) { toast("Aucune modification à enregistrer."); return; }
        const currentSecurity = state.workspace.settings.security;
        if (currentSecurity.privilegedMfaEnabled && !/^\d{6}$/.test(String(data.adminMfaCode || ""))) throw new Error("Entrez le code MFA actuel affiché dans votre application d’authentification.");
        const document = await api("/api/settings/deployment", { method: "PUT", body: JSON.stringify({ revision: state.revision, ...nextDeployment, adminMfaCode: data.adminMfaCode || "" }) });
        state.workspace = document.data; state.revision = document.revision; normalizeWorkspace();
        state.deploymentProbe = null;
        await Promise.all([loadDeploymentHealth({ renderAfter: false }), loadWorkspaceHistory(), loadAudit()]);
        render();
        toast("Configuration initiale enregistrée.");
        return;
      }
      if (form.dataset.form === "settings-autostart") {
        if (!isAdministrator()) throw new Error("Seul le super administrateur Atlas peut configurer le démarrage Windows.");
        const currentSecurity = state.workspace.settings.security;
        if (currentSecurity.privilegedMfaEnabled && !/^\d{6}$/.test(String(data.adminMfaCode || ""))) throw new Error("Entrez le code MFA actuel affiché dans votre application d’authentification.");
        const result = await api("/api/settings/autostart", { method: "PUT", body: JSON.stringify({ enabled: data.autostartEnabled === "on", adminMfaCode: data.adminMfaCode || "" }) });
        if (!state.deploymentHealth) state.deploymentHealth = { checks: [], summary: { ok: 0, warning: 0, neutral: 0, total: 0 } };
        state.deploymentHealth.autostart = result;
        await Promise.all([loadDeploymentHealth({ renderAfter: false }), loadAudit()]);
        render();
        toast(result.enabled ? "Démarrage automatique configuré en arrière-plan." : "Démarrage automatique désactivé. Atlas reste ouvert pour cette session.");
        return;
      }
      if (form.dataset.form === "settings-security") {
        if (!isAdministrator()) throw new Error("Seul le super administrateur Atlas peut modifier les politiques de sécurité.");
        const currentSecurity = state.workspace.settings.security;
        const nextSecurity = {
          privilegedMfaEnabled: data.privilegedMfaEnabled === "on",
          passwordRotationEnabled: data.passwordRotationEnabled === "on",
          passwordRotationDays: Number(data.passwordRotationDays || currentSecurity.passwordRotationDays || 90),
          passwordRotationReminderDays: Number(data.passwordRotationReminderDays || currentSecurity.passwordRotationReminderDays || 14),
        };
        const securityChanged = JSON.stringify(currentSecurity) !== JSON.stringify(nextSecurity);
        if (!securityChanged) { toast("Aucune modification à enregistrer."); return; }
        if (currentSecurity.privilegedMfaEnabled && !/^\d{6}$/.test(String(data.adminMfaCode || ""))) throw new Error("Entrez le code MFA actuel affiché dans votre application d’authentification.");
        const document = await api("/api/settings/security", { method: "PUT", body: JSON.stringify({ revision: state.revision, ...nextSecurity, adminMfaCode: data.adminMfaCode || "" }) });
        state.workspace = document.data; state.revision = document.revision; normalizeWorkspace();
        await Promise.all([loadWorkspaceHistory(), loadAudit()]);
        render();
        toast("Politiques de sécurité enregistrées.");
        return;
      }
    } catch (error) {
      if (errorNode) errorNode.textContent = error.message;
      else toast(error.message, "error");
      if (form.dataset.form === "delete-organization" && error.code === "invalid_mfa") {
        const codeInput = form.querySelector('[name="code"]');
        if (codeInput) { codeInput.value = ""; codeInput.focus(); }
      }
    } finally {
      if (submit) submit.disabled = false;
    }
  });

  window.addEventListener("hashchange", () => {
    parseRoute();
    state.mobileNavigation = false;
    if (state.page === "asset" && state.detailId) void loadAssetHistory(state.detailId).then(() => {
      if (state.page === "asset") render();
    });
    render();
    if (state.page === "settings" && isAdministrator() && !state.deploymentHealth && !state.deploymentHealthLoading) void loadDeploymentHealth();
    if (state.page === "settings" && state.detailId === "backups" && isAdministrator() && !state.backupStatus && !state.backupLoading) void loadBackupStatus();
    if (state.page === "settings" && state.detailId === "updates" && isAdministrator() && !state.updateStatus && !state.updateLoading) void loadUpdateStatus();
    if (state.page === "settings" && state.detailId === "integrations" && isAdministrator() && !state.localApiStatus && !state.localApiLoading) void loadLocalApiStatus();
    if (state.page === "asset" && state.detailId?.startsWith("vault:") && vaultSessionUnlocked() && state.revealedVaultItem?.id !== state.detailId.slice(6)) {
      void revealVaultItem(state.detailId.slice(6), { promptOnLocked: false });
    }
    requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  });
  initializePwaInstall();
  if (!window.__ATLAS_TEST_NO_BOOT__) boot();
})();

