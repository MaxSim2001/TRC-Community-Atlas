(() => {
  "use strict";

  const copy = (fr, en) => ({ fr, en });
  const section = (headingFr, headingEn, options = {}) => ({ heading: copy(headingFr, headingEn), ...options });

  window.ATLAS_HELP_CATALOG = {
    categories: [
      { id: "getting-started", icon: "home", label: copy("Premiers pas", "Getting started"), description: copy("Comprendre l’espace Atlas et commencer à documenter.", "Understand the Atlas workspace and start documenting.") },
      { id: "documentation", icon: "book", label: copy("Documentation", "Documentation"), description: copy("Fiches, documents, recherche et relations.", "Records, documents, search and relationships.") },
      { id: "security", icon: "shield", label: copy("Sécurité et accès", "Security and access"), description: copy("Comptes, permissions, MFA et coffre local.", "Accounts, permissions, MFA and the local vault.") },
      { id: "administration", icon: "settings", label: copy("Administration", "Administration"), description: copy("Modules, sauvegardes et exploitation de l’instance.", "Modules, backups and instance operations.") },
      { id: "resources", icon: "info", label: copy("Ressources", "Resources"), description: copy("Versions, projet communautaire et prochaines étapes.", "Releases, community project and next steps.") },
    ],
    articles: [
      {
        id: "welcome", category: "getting-started", icon: "layers", featured: true,
        title: copy("Bienvenue dans TRC Community Atlas", "Welcome to TRC Community Atlas"),
        summary: copy("Les concepts essentiels pour comprendre ce qu’Atlas documente et ce qui reste local.", "The essential concepts behind what Atlas documents and what stays local."),
        keywords: ["introduction", "concepts", "autonome", "self-hosted", "local"],
        sections: [
          section("Le rôle d’Atlas", "What Atlas does", { paragraphs: [copy("Atlas centralise la documentation et l’inventaire TI par compagnie. Il relie les équipements, procédures, contacts, mots de passe et fiches métier sans dépendre d’un service infonuagique.", "Atlas centralizes IT documentation and inventory by company. It links equipment, procedures, contacts, passwords and business records without depending on a cloud service.")] }),
          section("Trois repères", "Three key ideas", { bullets: [copy("Une organisation définit toujours la portée des données métier.", "An organization always defines the scope of business data."), copy("Les relations rendent la documentation navigable sans copier les secrets.", "Relationships make documentation navigable without copying secrets."), copy("Les comptes, le MFA, les sessions et les sauvegardes restent dans votre instance.", "Accounts, MFA, sessions and backups remain in your instance.")] }),
          section("Commencer", "Start here", { steps: [copy("Créez ou ouvrez une organisation.", "Create or open an organization."), copy("Activez seulement les modules utiles à l’équipe.", "Enable only the modules your team needs."), copy("Ajoutez les sites, configurations et procédures prioritaires.", "Add the priority sites, configurations and procedures."), copy("Reliez les fiches afin de représenter les dépendances réelles.", "Link records to represent real dependencies.")] }),
        ],
      },
      {
        id: "navigation-scope", category: "getting-started", icon: "compass", featured: true,
        title: copy("Navigation et portée active", "Navigation and active scope"),
        summary: copy("Savoir dans quelle compagnie vous travaillez et pourquoi les compteurs changent.", "Know which company you are working in and why counts change."),
        keywords: ["navigation", "portée", "menu", "compteurs", "fil d'ariane"],
        sections: [
          section("Sans compagnie sélectionnée", "Without a selected company", { paragraphs: [copy("Atlas affiche seulement la Vue d’ensemble et les Organisations. Les modules apparaissent dès qu’une compagnie devient active.", "Atlas shows only Overview and Organizations. Modules appear once a company becomes active.")] }),
          section("Avec une compagnie active", "With an active company", { bullets: [copy("Le menu affiche les modules activés et leurs compteurs pour cette compagnie seulement.", "The menu shows enabled modules and their counts for that company only."), copy("Le fil d’Ariane reprend la hiérarchie de compagnies jusqu’à trois niveaux.", "Breadcrumbs show the company hierarchy up to three levels."), copy("Créer une fiche depuis un module l’associe automatiquement à la compagnie active.", "Creating a record from a module automatically associates it with the active company.")] }),
          section("Changer de portée", "Change scope", { paragraphs: [copy("Utilisez le sélecteur à gauche de la recherche globale. Le choix modifie la recherche, les listes et les compteurs sans fusionner les données des compagnies.", "Use the selector to the left of global search. The choice changes search, lists and counts without merging company data.")] }),
        ],
      },
      {
        id: "organizations", category: "getting-started", icon: "building", featured: true,
        title: copy("Organisations et sous-compagnies", "Organizations and child companies"),
        summary: copy("Structurer les clients et leurs filiales sans mélanger les accès ni les secrets.", "Structure customers and subsidiaries without mixing access or secrets."),
        keywords: ["organisation", "compagnie", "sous-compagnie", "hiérarchie", "parent"],
        sections: [
          section("Créer une organisation", "Create an organization", { steps: [copy("Ouvrez Organisations, puis choisissez Nouvelle organisation.", "Open Organizations, then choose New organization."), copy("Saisissez le nom de la compagnie, son code court et son contexte de service.", "Enter the company name, short code and service context."), copy("Choisissez une compagnie parente seulement si une hiérarchie est réellement nécessaire.", "Choose a parent company only when a hierarchy is actually needed.")] }),
          section("Isolation garantie", "Guaranteed isolation", { paragraphs: [copy("Une sous-compagnie ne partage pas automatiquement ses mots de passe, sites, fiches ou autorisations avec sa parente. Le rattachement sert au classement et au fil d’Ariane.", "A child company does not automatically share passwords, sites, records or permissions with its parent. The relationship is for organization and breadcrumbs.")] }),
          section("Limite", "Limit", { callout: { tone: "info", title: copy("Trois niveaux maximum", "Three levels maximum"), text: copy("Atlas refuse les cycles et toute hiérarchie plus profonde afin de garder la navigation claire.", "Atlas rejects cycles and deeper hierarchies to keep navigation clear.") } }),
        ],
      },
      {
        id: "quick-notes", category: "getting-started", icon: "message",
        title: copy("Quick Notes d’une compagnie", "Company Quick Notes"),
        summary: copy("Afficher les consignes essentielles dès l’ouverture de la compagnie.", "Show essential instructions as soon as a company is opened."),
        keywords: ["quick notes", "notes", "consignes", "accueil compagnie"],
        sections: [
          section("Utilisation", "Use", { paragraphs: [copy("La carte Quick Notes est toujours visible sur l’accueil de la compagnie et reste vide par défaut. Utilisez-la pour les avertissements opérationnels, les habitudes du client ou les repères que l’équipe doit voir immédiatement.", "The Quick Notes card is always visible on the company home and is empty by default. Use it for operational warnings, customer habits or information the team must see immediately.")] }),
          section("Édition", "Editing", { bullets: [copy("Le bouton crayon est visible seulement aux comptes autorisés à modifier la compagnie.", "The pencil button is visible only to accounts allowed to edit the company."), copy("Le Markdown léger permet les titres, listes, liens, tableaux et blocs de code.", "Lightweight Markdown supports headings, lists, links, tables and code blocks."), copy("La modification est inscrite dans l’activité Atlas.", "The change is recorded in Atlas activity.")] }),
        ],
      },
      {
        id: "search", category: "documentation", icon: "search", featured: true,
        title: copy("Recherche globale et recherche par compagnie", "Global and company search"),
        summary: copy("Retrouver rapidement une compagnie, une fiche ou une relation dans la bonne portée.", "Quickly find a company, record or relationship in the correct scope."),
        keywords: ["recherche", "global", "organisation", "ctrl k", "résultats"],
        sections: [
          section("Recherche globale", "Global search", { paragraphs: [copy("La barre du haut cherche dans toutes les compagnies accessibles. Les organisations correspondantes sont toujours classées avant leurs configurations et autres fiches.", "The top bar searches all accessible companies. Matching organizations are always ranked before their configurations and other records.")] }),
          section("Recherche limitée", "Scoped search", { paragraphs: [copy("Choisissez une compagnie dans le sélecteur de portée pour limiter les résultats. L’accueil de chaque compagnie possède également sa propre recherche interne.", "Choose a company in the scope selector to limit results. Each company home also has its own internal search.")] }),
          section("Bonnes pratiques", "Best practices", { bullets: [copy("Utilisez des noms stables et descriptifs.", "Use stable, descriptive names."), copy("Ajoutez les adresses IP, responsables, catégories et identifiants dans les champs prévus.", "Add IP addresses, owners, categories and identifiers in the intended fields."), copy("Les secrets du coffre ne sont jamais indexés.", "Vault secrets are never indexed.")] }),
        ],
      },
      {
        id: "modules-records", category: "documentation", icon: "grid",
        title: copy("Modules et fiches structurées", "Modules and structured records"),
        summary: copy("Utiliser les 179 modules sans transformer le menu en liste ingérable.", "Use all 179 modules without turning the menu into an unmanageable list."),
        keywords: ["modules", "fiches", "179", "formulaire", "registre"],
        sections: [
          section("Choisir les modules", "Choose modules", { paragraphs: [copy("La page Gérer les modules contrôle ce qui apparaît dans la navigation de votre compte. Masquer un module ne supprime aucune donnée.", "The Manage modules page controls what appears in your account navigation. Hiding a module does not delete data.")] }),
          section("Créer une fiche", "Create a record", { steps: [copy("Ouvrez la compagnie concernée.", "Open the relevant company."), copy("Choisissez le module puis Nouveau.", "Choose the module, then New."), copy("Remplissez les champs structurés; la compagnie est imposée par le contexte actif.", "Fill in the structured fields; the company is imposed by the active context."), copy("Ajoutez des relations vers les autres objets utiles.", "Add relationships to other useful objects.")] }),
          section("Volumes importants", "Large volumes", { bullets: [copy("Les listes sont paginées et recherchables.", "Lists are paginated and searchable."), copy("Les compteurs du menu concernent uniquement la compagnie active.", "Menu counts apply only to the active company."), copy("Les vues mobiles remplacent les tableaux trop larges par des cartes lisibles.", "Mobile views replace overly wide tables with readable cards.")] }),
        ],
      },
      {
        id: "documents", category: "documentation", icon: "book",
        title: copy("Documents, procédures et éditeur Markdown", "Documents, procedures and the Markdown editor"),
        summary: copy("Rédiger des procédures lisibles avec aperçu, tableaux, tâches et relations rapides.", "Write readable procedures with preview, tables, tasks and quick relationships."),
        keywords: ["document", "procédure", "markdown", "éditeur", "tableau", "checklist"],
        sections: [
          section("Écrire et prévisualiser", "Write and preview", { paragraphs: [copy("L’éditeur propose les modes Écrire, Partagé et Aperçu, ainsi qu’un mode plein écran. La barre d’outils insère les structures courantes sans nécessiter de connaître toute la syntaxe Markdown.", "The editor provides Write, Split and Preview modes, plus full screen. The toolbar inserts common structures without requiring full Markdown knowledge.")] }),
          section("Contenu pris en charge", "Supported content", { bullets: [copy("Titres, texte en gras ou italique et liens.", "Headings, bold or italic text and links."), copy("Listes ordonnées, listes à puces et listes de tâches.", "Ordered, bulleted and task lists."), copy("Tableaux, citations, séparateurs et blocs de code.", "Tables, quotes, dividers and code blocks."), copy("Mentions @nom-de-fiche pour préparer une relation bidirectionnelle.", "@record-name mentions to prepare a bidirectional relationship.")] }),
          section("Sécurité", "Security", { paragraphs: [copy("L’aperçu est produit localement et neutralise le HTML arbitraire. N’inscrivez jamais un mot de passe directement dans un document; reliez plutôt la fiche du coffre.", "Preview is produced locally and neutralizes arbitrary HTML. Never place a password directly in a document; link the vault record instead.")] }),
        ],
      },
      {
        id: "relationships", category: "documentation", icon: "link", featured: true,
        title: copy("Éléments liés et vue d’impact", "Related items and impact view"),
        summary: copy("Relier n’importe quels objets d’une même compagnie et suivre leurs dépendances.", "Link any objects within the same company and follow their dependencies."),
        keywords: ["relations", "éléments liés", "impact", "dépend", "bidirectionnel"],
        sections: [
          section("Ajouter une relation", "Add a relationship", { steps: [copy("Ouvrez une fiche.", "Open a record."), copy("Dans Éléments liés, tapez le nom, le type, la catégorie ou l’identifiant recherché.", "In Related items, type the name, type, category or identifier."), copy("Choisissez le type de relation, puis la cible.", "Choose the relationship type, then the target."), copy("Atlas affiche automatiquement le lien inverse sur l’autre fiche.", "Atlas automatically shows the reverse link on the other record.")] }),
          section("Règles", "Rules", { bullets: [copy("Les deux objets doivent appartenir à la même compagnie.", "Both objects must belong to the same company."), copy("Un lien vers un mot de passe ne contient jamais le secret.", "A link to a password never contains the secret."), copy("L’archivage conserve la relation avec un état explicite.", "Archiving keeps the relationship with an explicit state."), copy("Chaque ajout et retrait est conservé dans l’historique.", "Every addition and removal is kept in history.")] }),
          section("Vue d’impact", "Impact view", { paragraphs: [copy("Utilisez la vue d’impact pour voir les objets qui dépendent d’un équipement, d’un service ou d’une procédure. Le graphe suit plusieurs niveaux sans accorder de permission supplémentaire.", "Use the impact view to see what depends on equipment, a service or a procedure. The graph follows multiple levels without granting extra permission.")] }),
        ],
      },
      {
        id: "passwords", category: "security", icon: "key", featured: true,
        title: copy("Coffre de mots de passe", "Password vault"),
        summary: copy("Comprendre le déverrouillage de session, l’affichage des secrets et la rotation.", "Understand session unlock, secret display and rotation."),
        keywords: ["mot de passe", "coffre", "secret", "otp", "rotation", "mfa"],
        sections: [
          section("Protection locale", "Local protection", { paragraphs: [copy("Les secrets sont chiffrés avec AES-256-GCM dans un stockage séparé. Le mot de passe, le code OTP et les notes confidentielles ne sont pas ajoutés à la recherche documentaire, aux relations ou aux exports JSON.", "Secrets are encrypted with AES-256-GCM in separate storage. Passwords, OTP codes and confidential notes are not added to document search, relationships or JSON exports.")] }),
          section("Déverrouillage", "Unlocking", { paragraphs: [copy("Une validation MFA déverrouille le coffre pour la session Atlas courante. Vous pouvez ensuite ouvrir plusieurs fiches sans ressaisir le code, jusqu’au verrouillage manuel ou à l’expiration de la session.", "One MFA verification unlocks the vault for the current Atlas session. You can then open multiple records without re-entering the code until manual lock or session expiry.")] }),
          section("Affichage et audit", "Display and audit", { bullets: [copy("Les champs sensibles restent masqués jusqu’à une action explicite.", "Sensitive fields remain hidden until an explicit action."), copy("La copie et l’affichage sont inscrits dans le journal d’accès.", "Copy and reveal actions are recorded in the access log."), copy("Les dates de rotation et d’expiration peuvent alimenter les rappels si la politique est activée.", "Rotation and expiry dates can feed reminders when the policy is enabled.")] }),
        ],
      },
      {
        id: "accounts-permissions", category: "security", icon: "users",
        title: copy("Comptes, rôles et accès par compagnie", "Accounts, roles and per-company access"),
        summary: copy("Combiner lecture, édition et accès au coffre pour chaque compagnie.", "Combine read, edit and vault access for each company."),
        keywords: ["comptes", "rôles", "permissions", "lecture", "édition", "compagnie"],
        sections: [
          section("Droits indépendants", "Independent permissions", { bullets: [copy("Lecture seule : consulter la documentation autorisée.", "Read-only: view authorized documentation."), copy("Édition : créer et modifier les fiches autorisées.", "Edit: create and modify authorized records."), copy("Accès coffre : voir les métadonnées et révéler les secrets avec une session MFA valide.", "Vault access: view metadata and reveal secrets with a valid MFA session."), copy("Administrateur : gérer les comptes, politiques et toutes les compagnies.", "Administrator: manage accounts, policies and all companies.")] }),
          section("Portée par compagnie", "Per-company scope", { paragraphs: [copy("Un même compte peut modifier une compagnie, en consulter une autre et ne pas voir une troisième. L’accès au coffre est décidé séparément pour chaque compagnie.", "The same account can edit one company, view another and not see a third. Vault access is decided separately for each company.")] }),
          section("Création d’un compte", "Create an account", { steps: [copy("Créez le compte avec un mot de passe temporaire.", "Create the account with a temporary password."), copy("Attribuez les compagnies, le niveau documentaire et l’accès au coffre.", "Assign companies, documentation level and vault access."), copy("L’utilisateur remplace le mot de passe puis active son MFA à la première connexion.", "The user replaces the password and enables MFA on first sign-in.")] }),
        ],
      },
      {
        id: "mfa-sessions", category: "security", icon: "shield",
        title: copy("MFA, récupération et sessions", "MFA, recovery and sessions"),
        summary: copy("Protéger les comptes locaux et comprendre l’expiration de huit heures.", "Protect local accounts and understand the eight-hour expiry."),
        keywords: ["mfa", "totp", "session", "8 heures", "récupération", "codes"],
        sections: [
          section("MFA obligatoire", "Mandatory MFA", { paragraphs: [copy("Chaque compte local doit enregistrer une application TOTP à sa première connexion. Les codes de récupération sont affichés une seule fois et doivent être conservés hors d’Atlas.", "Every local account must enroll a TOTP app on first sign-in. Recovery codes are shown once and must be stored outside Atlas.")] }),
          section("Durée de session", "Session duration", { paragraphs: [copy("La session expire huit heures après l’authentification. L’activité ne prolonge pas cette échéance absolue. À l’expiration, Atlas efface l’état sensible du navigateur et demande une nouvelle connexion.", "The session expires eight hours after authentication. Activity does not extend this absolute deadline. At expiry, Atlas clears sensitive browser state and requires a new sign-in.")] }),
          section("Actions disponibles", "Available actions", { bullets: [copy("Remplacer son MFA depuis Mon compte.", "Replace your MFA from My account."), copy("Régénérer ses codes de récupération.", "Regenerate recovery codes."), copy("Fermer une session précise ou toutes les sessions d’un compte en administration.", "Close a specific session or all sessions for an account in administration."), copy("Utiliser la récupération hors bande locale pour un administrateur bloqué.", "Use local break-glass recovery for a locked-out administrator.")] }),
        ],
      },
      {
        id: "password-health", category: "security", icon: "activity",
        title: copy("Santé des mots de passe", "Password health"),
        summary: copy("Interpréter les niveaux de force sans exposer ni transmettre les secrets.", "Interpret strength levels without exposing or transmitting secrets."),
        keywords: ["santé", "force", "réutilisé", "mot de passe", "score"],
        sections: [
          section("Évaluation", "Evaluation", { paragraphs: [copy("Atlas analyse localement la longueur et la variété des caractères lors de la création ou de la modification. Les anciens secrets sont évalués une fois puis la note est conservée avec la fiche.", "Atlas locally analyzes length and character variety during creation or editing. Existing secrets are evaluated once, then the rating is stored with the record.")] }),
          section("Ce que le résultat signifie", "What the result means", { bullets: [copy("Très faible, faible, moyen, fort ou très fort décrivent uniquement la structure locale.", "Very weak, weak, fair, strong or very strong describe local structure only."), copy("Non évalué signifie qu’aucune note n’a encore été enregistrée.", "Not evaluated means no rating has been stored yet."), copy("Réutilisé indique qu’une même empreinte locale a été détectée dans les secrets accessibles.", "Reused indicates the same local fingerprint was detected among accessible secrets.")] }),
          section("Limite", "Limit", { callout: { tone: "warning", title: copy("Ce n’est pas une vérification de fuite", "This is not a breach check"), text: copy("Atlas n’envoie aucun secret à un service externe et ne compare pas les mots de passe à une base publique de compromission.", "Atlas sends no secret to an external service and does not compare passwords against a public breach database.") } }),
        ],
      },
      {
        id: "attachments-history", category: "documentation", icon: "file",
        title: copy("Pièces jointes, versions et archivage", "Attachments, versions and archiving"),
        summary: copy("Conserver le contexte d’une fiche sans perdre ses relations ni son historique.", "Keep record context without losing relationships or history."),
        keywords: ["pièces jointes", "versions", "historique", "archivage", "restauration"],
        sections: [
          section("Pièces jointes", "Attachments", { paragraphs: [copy("Chaque fiche accepte des fichiers locaux jusqu’à 8 Mo. Les extensions exécutables sont refusées. Les pièces jointes d’un mot de passe exigent aussi un coffre déverrouillé.", "Each record accepts local files up to 8 MB. Executable extensions are rejected. Password attachments also require an unlocked vault.")] }),
          section("Historique", "History", { bullets: [copy("Les révisions de fiche conservent l’auteur, la date et le résumé du changement.", "Record revisions keep the author, date and change summary."), copy("Les relations possèdent leur propre journal d’ajout et de retrait.", "Relationships have their own addition and removal log."), copy("L’activité globale facilite les vérifications opérationnelles.", "Global activity supports operational review.")] }),
          section("Archivage", "Archiving", { paragraphs: [copy("Archiver retire la fiche des listes courantes sans la supprimer. Ses relations restent visibles avec un état archivé et la fiche peut être restaurée.", "Archiving removes the record from current lists without deleting it. Relationships remain visible with an archived state and the record can be restored.")] }),
        ],
      },
      {
        id: "manage-modules", category: "administration", icon: "settings",
        title: copy("Gérer les modules", "Manage modules"),
        summary: copy("Adapter la navigation à l’équipe tout en conservant les données existantes.", "Adapt navigation to the team while preserving existing data."),
        keywords: ["gérer modules", "activer", "masquer", "profil", "catalogue"],
        sections: [
          section("Visibilité personnelle", "Personal visibility", { paragraphs: [copy("Les modules cochés déterminent le menu de votre compte. Ce réglage n’efface pas les fiches et ne change pas les permissions d’un autre utilisateur.", "Selected modules determine your account menu. This setting does not delete records or change another user’s permissions.")] }),
          section("Profils métier", "Business profiles", { paragraphs: [copy("Chaque module utilise un profil de champs adapté à son usage : serveurs, réseau, stockage, sécurité, impression, téléphonie, cloud et autres. La page indique le profil et le nombre de champs disponibles.", "Each module uses a field profile suited to its purpose: servers, network, storage, security, printing, telephony, cloud and more. The page shows the profile and available field count.")] }),
          section("Conseil", "Tip", { callout: { tone: "info", title: copy("Commencez petit", "Start small"), text: copy("Activez les modules réellement utilisés; vous pourrez élargir le catalogue sans migration plus tard.", "Enable the modules you actually use; you can expand the catalog later without migration.") } }),
        ],
      },
      {
        id: "initial-deployment", category: "administration", icon: "globe", featured: true,
        title: copy("Configuration initiale, domaine et certificat", "Initial setup, domain and certificate"),
        summary: copy("Déclarer l’adresse publique d’Atlas et vérifier le déploiement sans confier la clé TLS à l’application.", "Declare Atlas's public address and verify the deployment without giving the TLS key to the application."),
        keywords: ["configuration initiale", "domaine", "certificat", "https", "nginx", "iis", "caddy", "santé", "port", "autodémarrage", "windows"],
        sections: [
          section("Deux renseignements différents", "Two different values", { bullets: [copy("Le code d’instance est un repère court comme ABC; il n’est ni un nom de personne ni un domaine.", "The instance code is a short identifier such as ABC; it is neither a person's name nor a domain."), copy("Le domaine public est le nom DNS complet utilisé par le navigateur, par exemple atlas.abcp.com.", "The public domain is the full DNS name used by the browser, for example atlas.abcp.com.")] }),
          section("Certificat et proxy inverse", "Certificate and reverse proxy", { steps: [copy("Créez le nom DNS chez votre fournisseur DNS.", "Create the DNS name with your DNS provider."), copy("Installez le certificat et sa clé privée dans Nginx, IIS ou Caddy.", "Install the certificate and its private key in Nginx, IIS or Caddy."), copy("Transmettez les requêtes à Atlas avec X-Forwarded-Proto: https.", "Forward requests to Atlas with X-Forwarded-Proto: https."), copy("Enregistrez le domaine dans Paramètres > Configuration initiale, puis utilisez le test public manuel.", "Save the domain under Settings > Initial setup, then use the manual public test.")] }),
          section("Démarrage Windows", "Windows startup", { paragraphs: [copy("Dans Paramètres > Configuration initiale, le super administrateur peut activer ou désactiver une tâche Windows masquée avec le bouton Configurer et appliquer. La tâche reprend le port, l’adresse d’écoute, les origines HTTPS et le dossier de données actifs sans ouvrir de fenêtre PowerShell.", "Under Settings > Initial setup, the super administrator can enable or disable a hidden Windows task with Configure and apply. The task reuses the active port, listen address, HTTPS origins and data directory without opening a PowerShell window.")] }),
          section("Tableau de santé", "Health dashboard", { paragraphs: [copy("Le tableau distingue le service Atlas, le port local, le démarrage automatique, SQLite, l’authentification locale, le coffre, le domaine, HTTPS, le proxy et l’origine autorisée. Le bouton Tester le port local vérifie uniquement le listener Atlas actuellement utilisé sur cet ordinateur; il ne balaie aucun autre port ni aucune machine.", "The dashboard separately reports Atlas, the local port, automatic startup, SQLite, local authentication, the vault, domain, HTTPS, proxy and allowed origin. The Test local port button checks only the Atlas listener currently used on this computer; it scans no other port or computer.")] }),
          section("Frontière de sécurité", "Security boundary", { callout: { tone: "warning", title: copy("Aucune configuration réseau automatique", "No automatic network configuration"), text: copy("Atlas ne modifie pas le DNS, le routeur, le pare-feu ni le certificat. Le test public est manuel, limité au domaine enregistré et refuse les destinations privées.", "Atlas does not modify DNS, the router, firewall or certificate. The public test is manual, limited to the saved domain and rejects private destinations.") } }),
        ],
      },
      {
        id: "backups", category: "administration", icon: "download", featured: true,
        title: copy("Sauvegardes complètes et restauration", "Full backups and restore"),
        summary: copy("Protéger les données documentaires, comptes, MFA, coffre et pièces jointes.", "Protect documentation data, accounts, MFA, vault and attachments."),
        keywords: ["sauvegarde", "backup", "restauration", "chiffrement", "trcatlas"],
        sections: [
          section("Deux outils différents", "Two different tools", { bullets: [copy("L’export JSON transporte la documentation, mais exclut les comptes, sessions, secrets et fichiers binaires.", "JSON export carries documentation but excludes accounts, sessions, secrets and binary files."), copy("La sauvegarde complète chiffrée couvre SQLite, comptes, MFA, coffre, clé et pièces jointes; les sessions sont volontairement exclues.", "The encrypted full backup covers SQLite, accounts, MFA, vault, key and attachments; sessions are intentionally excluded.")] }),
          section("Créer une sauvegarde complète", "Create a full backup", { steps: [copy("Exécutez le script de sauvegarde depuis la VM Atlas.", "Run the backup script from the Atlas VM."), copy("Saisissez la phrase secrète dans l’invite protégée.", "Enter the passphrase in the protected prompt."), copy("Conservez le fichier .trcatlas et sa phrase secrète dans des emplacements séparés.", "Keep the .trcatlas file and passphrase in separate locations."), copy("Validez régulièrement le fichier avec le mode Inspect.", "Regularly validate the file with Inspect mode.")] }),
          section("Restaurer", "Restore", { callout: { tone: "warning", title: copy("Service arrêté et confirmation requise", "Stopped service and confirmation required"), text: copy("Une restauration conserve d’abord une copie de sécurité de l’état remplacé et invalide toutes les sessions. Suivez le guide opérateur du dépôt local.", "A restore first keeps a safety copy of the replaced state and invalidates all sessions. Follow the operator guide in the local repository.") } }),
        ],
      },
      {
        id: "import-export", category: "administration", icon: "upload",
        title: copy("Import et export documentaires", "Documentation import and export"),
        summary: copy("Déplacer la documentation sans confondre export pratique et sauvegarde complète.", "Move documentation without confusing a convenient export with a full backup."),
        keywords: ["import", "export", "json", "migration", "données"],
        sections: [
          section("Export JSON", "JSON export", { paragraphs: [copy("L’export administrateur produit un fichier versionné contenant le workspace documentaire. Il n’inclut jamais les comptes, le MFA, les sessions, le coffre ni les pièces jointes.", "Administrator export produces a versioned file containing the documentation workspace. It never includes accounts, MFA, sessions, the vault or attachments.")] }),
          section("Import", "Import", { paragraphs: [copy("L’import remplace la documentation active, mais Atlas crée une version de retour arrière avant la modification. Vérifiez toujours la portée et la provenance du fichier.", "Import replaces active documentation, but Atlas creates a rollback version before the change. Always verify the file scope and origin.")] }),
          section("Quand utiliser quoi", "Which tool to use", { bullets: [copy("Export JSON : transfert, examen ou migration documentaire.", "JSON export: documentation transfer, review or migration."), copy("Sauvegarde complète : reprise après incident et protection de toute l’instance.", "Full backup: disaster recovery and complete instance protection."), copy("Export CSV Printing : analyse ponctuelle du registre d’impression.", "Printing CSV export: one-time analysis of the printing register.")] }),
        ],
      },
      {
        id: "mobile-pwa", category: "administration", icon: "phone",
        title: copy("Application Web mobile", "Mobile Web App"),
        summary: copy("Installer Atlas depuis le navigateur et comprendre son fonctionnement hors shell.", "Install Atlas from the browser and understand its shell-only offline behavior."),
        keywords: ["mobile", "pwa", "installer", "écran accueil", "application"],
        sections: [
          section("Installation", "Installation", { paragraphs: [copy("Sur un navigateur mobile compatible, Atlas affiche une bannière proposant l’installation. Une fois lancé comme application, cette bannière disparaît automatiquement.", "On a compatible mobile browser, Atlas shows an installation banner. Once launched as an app, that banner automatically disappears.")] }),
          section("Données et cache", "Data and cache", { paragraphs: [copy("Le service worker conserve uniquement le shell statique. Les API, comptes, secrets et données métier ne sont jamais placés dans le cache hors ligne.", "The service worker keeps only the static shell. APIs, accounts, secrets and business data are never placed in the offline cache.")] }),
          section("Limite", "Limit", { callout: { tone: "info", title: copy("Le serveur Atlas reste requis", "The Atlas server is still required"), text: copy("L’application installée ne crée pas une copie autonome des données et nécessite l’accès normal à votre instance.", "The installed app does not create a standalone copy of data and requires normal access to your instance.") } }),
        ],
      },
      {
        id: "rmm-integration", category: "administration", icon: "network",
        title: copy("Intégration TRC RMM facultative", "Optional TRC RMM integration"),
        summary: copy("Comprendre la frontière actuelle entre Atlas, le connecteur futur et le SSO.", "Understand the current boundary between Atlas, the future connector and SSO."),
        keywords: ["rmm", "sso", "oidc", "connecteur", "intégration"],
        sections: [
          section("Aujourd’hui", "Today", { paragraphs: [copy("Atlas est entièrement autonome. Le connecteur de données et le SSO RMM sont non configurés, désactivés et ne sont pas simulés comme actifs.", "Atlas is fully autonomous. The data connector and RMM SSO are unconfigured, disabled and are not simulated as active.")] }),
          section("Deux options séparées", "Two separate options", { bullets: [copy("Le connecteur futur échangera seulement les champs explicitement autorisés.", "The future connector will exchange only explicitly authorized fields."), copy("Le SSO futur utilisera OIDC et conservera les sessions et rôles propres à Atlas.", "Future SSO will use OIDC while retaining Atlas-specific sessions and roles."), copy("Activer l’un n’activera jamais automatiquement l’autre.", "Enabling one will never automatically enable the other.")] }),
          section("Secrets", "Secrets", { callout: { tone: "warning", title: copy("Aucune synchronisation du coffre", "No vault synchronization"), text: copy("Les mots de passe, codes OTP et jetons ne font pas partie du périmètre d’intégration prévu.", "Passwords, OTP codes and tokens are outside the planned integration scope.") } }),
        ],
      },
      {
        id: "release-notes", category: "resources", icon: "history",
        title: copy("Notes de version", "Release notes"),
        summary: copy("Les principales améliorations livrées dans les versions récentes d’Atlas.", "The main improvements delivered in recent Atlas releases."),
        keywords: ["version", "nouveautés", "release notes", "0.15.0", "0.14.3", "0.14.2", "0.14.1", "0.14.0", "0.13.2", "0.13.1", "0.13.0"],
        sections: [
          section("Version 0.15.0", "Version 0.15.0", { bullets: [copy("Release stable avec manifeste signé Ed25519 et paquet contrôlé par taille et SHA-256.", "Stable Release with an Ed25519-signed manifest and package verified by size and SHA-256."), copy("Installation protégée par les droits super administrateur, le CSRF, le MFA et une confirmation exacte.", "Installation protected by super-administrator rights, CSRF, MFA and exact confirmation."), copy("Instantané complet, vérification de SQLite et du coffre, puis retour automatique à la version précédente en cas d’échec.", "Full snapshot, SQLite and vault verification, then automatic rollback to the previous version on failure.")] }),
          section("Version 0.14.3", "Version 0.14.3", { bullets: [copy("Comparaison fiable entre la version Atlas installée et la dernière Release stable GitHub.", "Reliable comparison between the installed Atlas version and the latest stable GitHub Release."), copy("Un manifeste présent n’est plus présenté comme signé ou installable avant sa vérification cryptographique.", "A present manifest is no longer presented as signed or installable before cryptographic verification."), copy("Tests de sécurité ajoutés pour les droits administrateur, le CSRF, l’audit et le blocage de l’installation.", "Security tests added for administrator permissions, CSRF, auditing and installation blocking.")] }),
          section("Version 0.14.2", "Version 0.14.2", { bullets: [copy("Écran de connexion adapté aux fenêtres intermédiaires sans débordement horizontal.", "Sign-in screen adapted to medium-width windows without horizontal overflow."), copy("Nouvelle clé de cache pour charger immédiatement le correctif public.", "New cache key to load the public fix immediately.")] }),
          section("Version 0.14.1", "Version 0.14.1", { bullets: [copy("Affichage complet des noms de compagnie et cibles tactiles principales agrandies.", "Full company-name display and larger primary touch targets."), copy("Navigation des Paramètres sans défilement horizontal sur mobile.", "Settings navigation without horizontal scrolling on mobile."), copy("Comptes et accès présenté en tableau compact sur ordinateur et en fiches lisibles sur téléphone.", "Accounts and access shown as a compact desktop table and readable mobile cards.")] }),
          section("Version 0.14.0", "Version 0.14.0", { bullets: [copy("Gestionnaire de sauvegardes chiffrées avec emplacement local ou UNC, horaire, rétention, historique et test d’intégrité.", "Encrypted backup manager with local or UNC destination, schedule, retention, history and integrity test."), copy("Santé étendue, constructeur de modules locaux, cycle de révision et import CSV guidé.", "Extended health, local module builder, review lifecycle and guided CSV import."), copy("API locale facultative avec jetons de lecture limités par portée et compagnie, plus des webhooks HMAC limités à cette VM, sans accès au coffre.", "Optional local API with read tokens limited by scope and organization, plus HMAC webhooks restricted to this VM, without vault access.")] }),
          section("Version 0.13.2", "Version 0.13.2", { bullets: [copy("Configuration du démarrage automatique Windows directement depuis la page Configuration initiale, avec confirmation MFA.", "Windows automatic startup configuration directly from the Initial setup page, with MFA confirmation."), copy("État réel de la tâche Windows affiché dans Santé du site.", "Actual Windows task state displayed in Site health."), copy("Test manuel du seul port Atlas actif sur cet ordinateur, sans balayage réseau ni modification du pare-feu.", "Manual test of the only active Atlas port on this computer, with no network scan or firewall change.")] }),
          section("Version 0.13.1", "Version 0.13.1", { bullets: [copy("Configurateur Windows graphique pour choisir le port, l’adresse d’écoute, les dossiers et les origines HTTPS.", "Graphical Windows configurator for choosing the port, listen address, folders and HTTPS origins."), copy("Reconfiguration du port avec arrêt et redémarrage contrôlés sans modifier la base SQLite.", "Port reconfiguration with controlled stop and restart without changing the SQLite database."), copy("Raccourci Configurer Atlas et explication claire qu’aucun port de base de données n’est requis.", "Configure Atlas shortcut and clear explanation that no database port is required.")] }),
          section("Version 0.13.0", "Version 0.13.0", { bullets: [copy("Installation Windows guidée en un double-clic avec runtime autonome.", "Guided one-click Windows installation with a self-contained runtime."), copy("Programme et données séparés afin de préserver les comptes, le MFA, le coffre et les pièces jointes lors d’une réparation.", "Program and data are separated to preserve accounts, MFA, vault and attachments during a repair."), copy("Déploiement propre vérifié automatiquement sur le port de test 9095.", "Clean deployment automatically verified on test port 9095.")] }),
          section("Version 0.12.9", "Version 0.12.9", { bullets: [copy("Vue des paramètres réorganisée en sections larges et lisibles.", "Settings overview reorganized into wide, readable sections."), copy("Navigation interne compacte placée au-dessus du contenu.", "Compact internal navigation placed above the content."), copy("Correction du grand avertissement étiré dans une colonne vide.", "Fixed the large warning stretched into an empty column.")] }),
          section("Version 0.12.8", "Version 0.12.8", { bullets: [copy("Paramètres séparés en pages dédiées au lieu d’un formulaire unique.", "Settings split into dedicated pages instead of one combined form."), copy("Configuration initiale réservée à l’administrateur Atlas avec saisie MFA visible près de l’action d’enregistrement.", "Initial setup restricted to the Atlas administrator with the MFA field visible next to the save action."), copy("Navigation simplifiée avec un seul point d’entrée Paramètres.", "Simplified navigation with a single Settings entry point.")] }),
          section("Version 0.12.7", "Version 0.12.7", { bullets: [copy("Assistant de configuration initiale pour le code d’instance, le domaine public, les alias et le proxy inverse.", "Initial setup assistant for the instance code, public domain, aliases and reverse proxy."), copy("Tableau de santé factuel pour Atlas, le stockage, l’authentification, le coffre, HTTPS, le proxy et l’origine autorisée.", "Factual health dashboard for Atlas, storage, authentication, vault, HTTPS, proxy and allowed origin."), copy("Test public manuel du domaine et du certificat avec blocage des destinations privées.", "Manual public domain and certificate test with private destination blocking.")] }),
          section("Version 0.12.6", "Version 0.12.6", { bullets: [copy("Centre d’aide intégré accessible depuis l’icône ? de l’en-tête.", "Built-in help center available from the ? icon in the header."), copy("Documentation locale recherchable, structurée par catégories et adaptée au mobile.", "Searchable local documentation organized by category and adapted to mobile."), copy("Guides opérateur ajoutés au dépôt en préparation de la future publication GitHub.", "Operator guides added to the repository in preparation for future GitHub publication.")] }),
          section("Version 0.12.5", "Version 0.12.5", { bullets: [copy("Quick Notes par compagnie, vides par défaut et éditables en Markdown.", "Per-company Quick Notes, empty by default and editable in Markdown."), copy("Recherche des Quick Notes et journalisation des modifications.", "Quick Notes search and change logging.")] }),
          section("Version 0.12", "Version 0.12", { bullets: [copy("Comptes et droits par compagnie, hiérarchie à trois niveaux et PWA mobile.", "Per-company accounts and permissions, three-level hierarchy and mobile PWA."), copy("Santé des mots de passe, formulaires complets et navigation contextualisée.", "Password health, complete forms and contextual navigation.")] }),
        ],
      },
      {
        id: "github-installation", category: "resources", icon: "external",
        title: copy("GitHub et installation", "GitHub and installation"),
        summary: copy("Dépôt public officiel et état de préparation de l’installation Windows.", "Official public repository and Windows installation readiness."),
        keywords: ["github", "installation", "source disponible", "licence", "déploiement"],
        sections: [
          section("État actuel", "Current status", { callout: { tone: "info", title: copy("Release Windows signée", "Signed Windows Release"), text: copy("Le dépôt officiel est https://github.com/MaxSim2001/TRC-Community-Atlas. La Release stable porte un manifeste signé Ed25519 et un SHA-256 vérifié avant installation; les artéfacts GitHub Actions restent réservés aux essais.", "The official repository is https://github.com/MaxSim2001/TRC-Community-Atlas. The stable Release includes an Ed25519-signed manifest and a SHA-256 verified before installation; GitHub Actions artifacts remain test-only.") } }),
          section("Installer la Release stable", "Install the stable Release", { steps: [copy("Téléchargez le ZIP depuis la page Releases officielle.", "Download the ZIP from the official Releases page."), copy("Décompressez complètement le fichier ZIP.", "Fully extract the ZIP file."), copy("Double-cliquez sur Installer-Atlas.cmd.", "Double-click Installer-Atlas.cmd."), copy("Créez le premier compte administrateur et activez son MFA dans le navigateur.", "Create the first administrator account and enable its MFA in the browser.")] }),
          section("Protection des données", "Data protection", { bullets: [copy("Le programme et les données Atlas utilisent des dossiers distincts.", "The Atlas program and data use separate folders."), copy("Relancer l’installateur répare le programme sans effacer les données.", "Running the installer again repairs the program without deleting data."), copy("Le service écoute seulement sur 127.0.0.1 par défaut et n’ouvre aucun pare-feu.", "The service listens only on 127.0.0.1 by default and does not open any firewall.")] }),
          section("Mises à jour suivantes", "Future updates", { paragraphs: [copy("Atlas 0.15.0 amorce la confiance avec la clé publique embarquée. Pour une version stable ultérieure, Paramètres > Mises à jour télécharge le manifeste et le paquet depuis GitHub, vérifie Ed25519 et SHA-256, puis exige le MFA et crée un instantané avant installation. Un échec de santé déclenche le retour arrière automatique.", "Atlas 0.15.0 bootstraps trust with the embedded public key. For a later stable version, Settings > Updates downloads the manifest and package from GitHub, verifies Ed25519 and SHA-256, then requires MFA and creates a snapshot before installation. A failed health check triggers automatic rollback.")] }),
        ],
      },
      {
        id: "troubleshooting", category: "resources", icon: "alert",
        title: copy("Diagnostic de base", "Basic troubleshooting"),
        summary: copy("Vérifications simples avant de redémarrer ou modifier une instance.", "Simple checks before restarting or changing an instance."),
        keywords: ["diagnostic", "erreur", "indisponible", "cache", "navigateur", "status"],
        sections: [
          section("Interface ancienne ou incohérente", "Old or inconsistent interface", { steps: [copy("Rechargez la page une fois.", "Reload the page once."), copy("Vérifiez la version affichée dans le menu d’aide.", "Check the version shown in the help menu."), copy("Si nécessaire, fermez les anciens onglets et rouvrez Atlas afin que le service worker récupère les actifs versionnés.", "If needed, close old tabs and reopen Atlas so the service worker fetches versioned assets.")] }),
          section("Service indisponible", "Service unavailable", { bullets: [copy("Vérifiez d’abord l’état local de l’API et du processus Atlas.", "First check the local API and Atlas process status."), copy("Comparez ensuite l’accès local et l’accès public avant de modifier le proxy ou le réseau.", "Then compare local and public access before changing proxy or network settings."), copy("Consultez les journaux sans y copier de secrets.", "Review logs without copying secrets into them.")] }),
          section("Avant une modification", "Before a change", { callout: { tone: "warning", title: copy("Conservez une sauvegarde datée", "Keep a dated backup"), text: copy("Une mise à jour, une restauration ou une opération de récupération doit préserver une voie de retour vérifiable.", "An update, restore or recovery operation must preserve a verifiable rollback path.") } }),
        ],
      },
    ],
  };
})();
