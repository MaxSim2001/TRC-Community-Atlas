# Architecture locale — TRC Community Atlas

## Autorités et données

TRC Community Atlas est une application autonome. Elle possède ses comptes, sessions, organisations, sites, rôles, préférences et données documentaires. Elle ne communique pas avec TRC Account et ne dépend d’aucun service Account.

TRC Community RMM demeure un produit distinct. Deux options pourront être configurées séparément à la fin du projet :

1. un connecteur d’inventaire et de métadonnées explicitement sélectionnées;
2. un SSO OIDC facultatif fourni par TRC RMM.

Les deux options seront désactivées par défaut. Un raccordement de données n’activera pas le SSO, et le SSO ne déclenchera aucune synchronisation. Atlas conservera ses propres sessions, permissions et rôles.

## Socle actuel

- serveur Node.js sans dépendance externe;
- écoute exclusive sur `127.0.0.1:9092`;
- comptes locaux administrables avec rôles `administrator`, `editor` et `viewer`;
- dérivation de mot de passe `scrypt`, MFA TOTP obligatoire et codes de récupération à usage unique;
- sessions locales persistantes par hachage de jeton, cookie HttpOnly/SameSite Strict et protection CSRF; un redémarrage du processus ne déconnecte plus les sessions non expirées, sans jamais écrire le jeton de cookie brut sur disque;
- stockage documentaire SQLite local en mode WAL, avec contraintes d’intégrité, transactions atomiques et miroir JSON de compatibilité;
- historique tournant des 200 versions précédentes, révisions durables par fiche, journal d’audit et import/export documentaire versionné;
- coffre séparé chiffré `AES-256-GCM`, clé aléatoire locale distincte et déverrouillage lié à la session locale de 8 heures après MFA; verrouillage manuel disponible et secrets masqués par défaut;
- pièces jointes binaires séparées dans `data/attachments/`, métadonnées et journal dans `data/attachments.json`, limite de 8 Mo et extensions exécutables refusées;
- listes volumineuses paginées côté interface avec recherche locale, sans chargement de centaines de lignes visibles à la fois;
- index de recherche local transversal construit en mémoire à partir des données autorisées : portée globale sélectionnable ou portée limitée à une organisation, sans indexer les secrets du coffre;
- page d’organisation autonome avec recherche interne, raccourcis filtrés et actions de modification soumises aux rôles existants;
- hiérarchie documentaire facultative par `parentOrganizationId`, limitée à trois niveaux et validée côté serveur contre les cycles; ce rattachement n’accorde aucun droit et n’agrège jamais les sites, fiches, relations ou secrets d’une organisation enfant dans sa parente;
- schéma documentaire version 4 avec registre universel `relations`, références typées (`site:`, `configuration:`, `procedure:`, `module:` et `vault:`) et journal `relationshipEvents`;
- relations bidirectionnelles limitées à une organisation, ajout rapide par recherche universelle dans la fiche, libellés avant/arrière, types directionnels, état archivé et navigation dans une fiche plein espace;
- graphe d’impact calculé localement sur plusieurs niveaux et synchronisation des mentions `@fiche` vers des relations automatiques;
- références de coffre limitées à l’identifiant et aux métadonnées autorisées; aucun secret, nom d’utilisateur ou code OTP n’est copié dans une relation, la recherche ou l’espace documentaire;
- générateur de charge QA déterministe avec sauvegarde locale datée avant insertion et refus des doublons;
- préférences de modules et portées d’organisations enregistrées par compte local; les comptes limités ne reçoivent jamais les objets, secrets ou pièces jointes des autres organisations;
- interface statique locale sans police, CDN, télémétrie ou appel sortant.
- installation Windows avec programme et runtime sous un répertoire applicatif,
  tandis que SQLite, les comptes, le MFA, le coffre, les pièces jointes, la
  configuration et les journaux demeurent dans un répertoire d’instance séparé;
- paquet Windows autonome produit par la CI et test de déploiement propre sur
  `127.0.0.1:9095`, sans modification du pare-feu, du DNS ou du réseau;
- paramètres de déploiement locaux séparant code d’instance, domaine principal,
  alias et proxy inverse; les origines HTTPS enregistrées sont chargées par le
  serveur sans importer de certificat ni modifier le DNS ou le réseau;
- tableau de santé administrateur calculé localement et sonde HTTPS publique
  uniquement manuelle, limitée au domaine enregistré, sans redirection et avec
  refus des adresses privées, locales, réservées ou de documentation;
- gestion administrateur d’une tâche Windows masquée pour l’autodémarrage,
  appelée avec des arguments fixes sans shell et protégée par session, CSRF et
  MFA renforcé; son état réel est exposé dans la santé du site;
- sonde TCP locale limitée au listener courant d’Atlas, sans paramètre d’adresse
  ou de port fourni par le navigateur et sans exploration du LAN.
- manifeste PWA et service worker limité au shell statique : la bannière d’installation est réservée aux petits écrans de navigateur et disparaît en mode `standalone`; toutes les routes `/api/` restent strictement réseau et ne sont jamais placées dans le cache PWA.

Le stockage PostgreSQL n’est pas requis pour cette instance locale mono-nœud. Les protections avancées de production, le connecteur RMM et le SSO feront l’objet de lots distincts avant une exposition publique. Les pièces jointes ne sont pas incluses dans l’export JSON documentaire et doivent être couvertes par la sauvegarde du dossier `data/`. Le coffre et les pièces jointes ne remplacent pas le chiffrement du disque ni la protection des sauvegardes de la VM.

