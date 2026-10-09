# Plan de mise en place — installation et mises à jour par GitHub

Statut : code source publié; installateur, Releases et mise à jour intégrée à implémenter  
Date : 8 octobre 2026  
Version Atlas analysée : 0.14.2

État d’avancement : la version 0.14.2 réalise le premier paquet Windows autonome,
la séparation programme/données, le configurateur graphique, le démarrage caché
et les tests de déploiement/reconfiguration sur les ports 9095 et 9096. La signature publique, les Releases stables,
la mise à jour transactionnelle et le retour arrière restent à compléter avant
de présenter ce paquet comme distribution stable.

## 1. Objectif

Permettre à un utilisateur de télécharger TRC Community Atlas depuis GitHub,
de l'installer sur un ordinateur ou un serveur et de mettre l'application à
jour depuis Atlas, après confirmation explicite, sans perdre :

- les organisations et toutes les fiches documentaires;
- les comptes, rôles, MFA et paramètres de sécurité;
- les mots de passe chiffrés et la clé locale du coffre;
- les pièces jointes, relations, historiques et journaux;
- la configuration locale de l'instance.

GitHub hébergera le code, les versions publiées et leurs métadonnées. GitHub ne
recevra aucune donnée Atlas, aucun mot de passe, aucune sauvegarde et aucune
télémétrie. Atlas demeure autonome et ne dépend pas de TRC Account.

## 2. Décisions recommandées

| Sujet | Décision recommandée pour la première version |
| --- | --- |
| Plateforme initiale | Windows 10 et Windows 11 x64 |
| Distribution | Installateur graphique signé et paquet ZIP portable |
| Exécution | Service Windows ou tâche planifiée SYSTEM cachée, sans fenêtre PowerShell |
| Dépôt | `MaxSim2001/TRC-Community-Atlas` |
| Titulaire | TheRisingCloud |
| Licence | PolyForm Noncommercial 1.0.0, source disponible, sans usage commercial accordé |
| Contributions | Cession de droits signée avant toute fusion externe |
| Signature publique | Azure Artifact Signing; autosigné seulement pour les essais locaux |
| Versions | Versionnement sémantique `MAJEURE.MINEURE.CORRECTIF` |
| Canaux | `stable` par défaut, `beta` sur activation volontaire |
| Recherche de mise à jour | Manuelle par défaut; vérification quotidienne configurable |
| Installation d'une mise à jour | Jamais automatique; confirmation et MFA administrateur requis |
| Données | Répertoire persistant séparé des fichiers du programme |
| Retour arrière | Ancienne version et instantané local conservés jusqu'à validation |
| Autres plateformes | Hors portée initiale |

La disponibilité du code sous une licence non commerciale doit être présentée
comme « source disponible » et non « open source ». La configuration du service
de signature public nécessite encore la vérification externe de l'identité
TheRisingCloud et l'approbation de ses éventuels frais.

## 3. Architecture cible sur Windows

L'installateur ne doit pas exécuter Atlas directement depuis un clone Git. Il
installe une version immuable et place toutes les données modifiables ailleurs.

```text
C:\Program Files\TRC Community Atlas\
├── current.json                 # version active et chemin exact
├── updater\                     # assistant de mise à jour indépendant
└── versions\
    ├── 0.12.9\                  # application et runtime Node inclus
    └── 0.13.0\

C:\ProgramData\TRC Community Atlas\
├── config\instance.json        # port, écoute, origine autorisée, canal
├── data\                       # données métier persistantes
│   ├── atlas.sqlite
│   ├── auth.json
│   ├── sessions.json
│   ├── vault.json
│   ├── vault.key
│   ├── attachments.json
│   ├── attachments\
│   └── ...
├── backups\
│   ├── updates\                # instantanés locaux de retour arrière
│   └── exports\                # sauvegardes .trcatlas chiffrées
├── logs\
└── update-state.json
```

Le répertoire `data` n'est jamais inclus dans un paquet de version et ne doit
jamais être supprimé lors d'une mise à jour ou d'une désinstallation normale.
L'option de suppression des données, si elle est offerte un jour, doit être
séparée, désactivée par défaut et protégée par une confirmation forte.

Le runtime Node.js compatible est inclus dans le paquet afin que l'utilisateur
n'ait rien à installer séparément. Le processus écoute uniquement sur
`127.0.0.1` par défaut. L'écoute LAN, HTTPS et le mandataire inverse restent des
choix explicites; l'installateur ne modifie ni le routeur, ni le DNS, ni le
pare-feu réseau.

## 4. Contenu d'une GitHub Release

Chaque version publiée, par exemple `v0.13.0`, contient :

- `TRC-Atlas-Setup-0.13.0-win-x64.exe`;
- `TRC-Atlas-Portable-0.13.0-win-x64.zip`;
- `atlas-release.json`, le manifeste signé de la version;
- `SHA256SUMS` et sa signature;
- la nomenclature logicielle `SBOM.spdx.json`;
- les notes de version et les instructions de migration;
- une attestation GitHub de provenance de chaque binaire.

Le manifeste contient au minimum :

```json
{
  "formatVersion": 1,
  "version": "0.13.0",
  "channel": "stable",
  "publishedAt": "2026-10-08T00:00:00Z",
  "minimumUpgradableVersion": "0.12.0",
  "minimumDataSchema": 5,
  "targetDataSchema": 6,
  "platform": "win32-x64",
  "assetName": "TRC-Atlas-Portable-0.13.0-win-x64.zip",
  "assetSize": 0,
  "sha256": "...",
  "requiresRestart": true,
  "backupRequired": true,
  "rollbackMode": "snapshot",
  "releaseNotesUrl": "https://github.com/OWNER/REPO/releases/tag/v0.13.0"
}
```

Atlas interroge l'API GitHub de la dernière release stable. Une ressource
publique peut être consultée sans jeton, ce qui évite de conserver une clé
GitHub chez les utilisateurs. Les résultats sont mis en cache et une
vérification planifiée ne doit pas dépasser une fois par jour.

## 5. Chaîne de confiance

Le HTTPS de GitHub ne suffit pas à lui seul pour autoriser l'installation.
L'assistant de mise à jour doit appliquer toutes les vérifications suivantes :

1. propriétaire et nom du dépôt codés dans l'application;
2. version sémantique valide, supérieure à la version installée;
3. manifeste signé par une clé de publication approuvée;
4. taille et SHA-256 du fichier identiques au manifeste;
5. signature de code Windows valide lorsque le certificat sera disponible;
6. attestation de provenance GitHub vérifiable;
7. plateforme, architecture et schéma de données compatibles;
8. refus complet si une vérification échoue.

La clé privée de publication n'est jamais présente dans Atlas, le dépôt ou la
VM d'un utilisateur. Seule la clé publique de vérification est intégrée à
l'assistant. Les attestations GitHub complètent cette signature; elles ne
remplacent ni la validation du signataire ni les contrôles locaux.

## 6. Installation initiale

### Parcours graphique

1. L'utilisateur télécharge l'installateur depuis la page Releases officielle.
2. L'installateur affiche la version, l'éditeur, le hash et la signature.
3. Il vérifie Windows, l'architecture, l'espace libre et la disponibilité du port.
4. Il propose le port, l'adresse d'écoute et le chemin de données; `127.0.0.1`
   demeure la valeur sécuritaire par défaut.
5. Il installe le runtime et Atlas dans `Program Files`, puis crée le répertoire
   de données avec des ACL réservées au compte de service et aux administrateurs.
6. Il installe le démarrage en arrière-plan sans fenêtre interactive.
7. Il démarre Atlas et vérifie `/api/status` localement.
8. Il ouvre l'assistant de première configuration. Le premier compte et son MFA
   sont créés dans Atlas; aucun identifiant n'est passé en ligne de commande.
9. L’administrateur choisit un code d’instance, le mode local ou proxy inverse,
   le domaine public, les alias et le type de proxy. Atlas n’importe jamais la
   clé privée du certificat.
10. Le tableau de santé valide séparément le service, SQLite, les comptes, le
    coffre, le domaine, HTTPS, les en-têtes du proxy et l’origine autorisée. Le
    test Internet du domaine demeure une action manuelle explicite.

### Installation serveur automatisable

Une commande PowerShell officielle sera aussi fournie avec des paramètres
explicites (`InstallRoot`, `DataRoot`, `Port`, `BindAddress`, `AllowedOrigin`,
`Channel`). Elle ne contient aucun secret, n'ouvre aucun accès Internet et ne
change pas le pare-feu sans une option dédiée et confirmée.

Éviter de conseiller `curl ... | iex`. L'utilisateur doit télécharger un
installateur signé ou un script versionné, en vérifier la signature, puis
l'exécuter.

## 7. Centre de mises à jour dans Atlas

Ajouter **Paramètres > Mises à jour**, accessible seulement aux administrateurs.

L'écran affiche :

- version installée et schéma de données;
- canal `stable` ou `beta`;
- date de la dernière vérification et résultat;
- version disponible, notes, taille et compatibilité;
- statut de la signature et de l'attestation;
- sauvegarde qui sera créée et espace libre requis;
- durée d'indisponibilité estimée;
- boutons `Vérifier`, `Télécharger et vérifier`, puis `Installer`;
- historique des mises à jour et bouton `Revenir à la version précédente` si
  un instantané compatible existe.

La vérification manuelle ne nécessite pas de MFA. Le téléchargement ne modifie
pas l'instance. L'installation et le retour arrière demandent une confirmation
claire et un MFA administrateur récent. Un utilisateur en lecture seule ne voit
que la version courante.

Une vérification automatique, si l'administrateur l'active, effectue uniquement
une requête sortante vers GitHub et affiche une disponibilité. Elle ne
télécharge et n'installe jamais une version sans action humaine.

## 8. Mise à jour transactionnelle

Le navigateur ne peut pas remplacer le processus qui le sert. Atlas lance donc
un petit assistant local privilégié et indépendant, puis suit un travail de
mise à jour par identifiant.

### Préparation en ligne

1. Valider le rôle, le CSRF, le MFA et la confirmation de l'administrateur.
2. Acquérir un verrou exclusif; refuser une mise à jour pendant une restauration,
   une autre mise à jour ou une opération de sauvegarde.
3. Télécharger le paquet dans un répertoire temporaire unique.
4. Vérifier manifeste, signature, attestation, hash, taille et compatibilité.
5. Vérifier espace disque, permissions, port, service et santé des données.
6. Calculer un inventaire avant mise à jour : nombres d'organisations, fiches,
   comptes, secrets et pièces jointes, sans journaliser leur contenu.

### Fenêtre d'arrêt contrôlé

7. Passer Atlas en mode maintenance et terminer les écritures en cours.
8. Arrêter proprement le service.
9. Effectuer un point de contrôle SQLite et créer un instantané cohérent de tout
   `data`, de la configuration et de la définition du service.
10. Tester que l'instantané est lisible avant de poursuivre.
11. Extraire la nouvelle version dans un nouveau dossier immuable; ne jamais
    écraser la version active en place.
12. Exécuter les migrations idempotentes dans une transaction.
13. Basculer atomiquement `current.json` vers la nouvelle version.
14. Redémarrer le service et exécuter les contrôles de santé.

### Validation et retour arrière

Les contrôles postérieurs vérifient :

- `/api/status`, version du programme et schéma attendu;
- ouverture de SQLite et intégrité logique des tables;
- même inventaire métier avant/après, sauf migration documentée;
- présence des comptes, métadonnées du coffre et pièces jointes;
- déchiffrement d'un témoin interne avec la clé du coffre, sans afficher ni
  journaliser aucun secret;
- connexion locale et démarrage automatique.

Si un contrôle échoue, l'assistant arrête la nouvelle version, remet l'ancien
pointeur et restaure l'instantané si une migration a changé les données. Il
redémarre ensuite l'ancienne version et vérifie sa santé. Les sessions peuvent
être invalidées après une restauration, mais les comptes, le MFA et le coffre
doivent être conservés.

## 9. Sauvegarde sans perte de données

Deux mécanismes distincts sont requis :

1. **Instantané de retour arrière automatique** : copie locale complète et
   cohérente, protégée par les ACL du système, créée après l'arrêt du service.
   Elle permet un retour arrière sans demander une phrase secrète à un processus
   non interactif.
2. **Sauvegarde opérateur chiffrée `.trcatlas`** : le mécanisme existant demeure
   disponible et recommandé avant une mise à jour majeure. Sa phrase secrète
   n'est jamais stockée par l'assistant.

L'instantané couvre au minimum `atlas.sqlite`, `auth.json`, `vault.json`,
`vault.key`, les métadonnées et fichiers des pièces jointes, les historiques et
la configuration d'instance. Les sessions peuvent être invalidées par sécurité.

Les sauvegardes sont horodatées et ne sont jamais remplacées. Une future
politique de rétention doit être activée explicitement par l'administrateur;
elle ne doit pas supprimer silencieusement le dernier retour arrière valide.

## 10. Contrat de migrations

Ajouter un registre `schema_migrations` dans SQLite et un état de mise à jour
séparé. Chaque migration possède un identifiant unique, sa version source, sa
version cible et son résultat.

Règles obligatoires :

- migration idempotente et testable indépendamment;
- transaction SQLite lorsque possible;
- migration des fichiers JSON par écriture atomique;
- aucun secret dans les journaux ou messages d'erreur;
- compatibilité testée depuis chaque version encore prise en charge;
- aucun retour arrière de schéma en place;
- restauration de l'instantané pour revenir à une version incompatible;
- blocage d'une mise à jour trop ancienne avec parcours intermédiaire indiqué.

## 11. API locale proposée

| Route | Protection | Rôle |
| --- | --- | --- |
| `GET /api/update/status` | administrateur | État, version et dernier contrôle |
| `POST /api/update/check` | administrateur + CSRF | Interroger GitHub sans installer |
| `POST /api/update/prepare` | administrateur + CSRF | Télécharger et vérifier |
| `POST /api/update/apply` | administrateur + CSRF + MFA | Confirmer et lancer l'assistant |
| `GET /api/update/jobs/:id` | administrateur | Suivre la progression |
| `POST /api/update/rollback` | administrateur + CSRF + MFA | Restaurer le dernier état valide |

Le serveur ne reçoit jamais d'URL de téléchargement arbitraire du navigateur.
Il choisit la ressource correspondant au dépôt, au canal, au système et à
l'architecture préconfigurés.

## 12. Pipeline de publication GitHub

Une étiquette Git `vX.Y.Z` déclenche un workflow GitHub Actions qui :

1. vérifie la concordance entre l'étiquette, `package.json` et les notes;
2. exécute les tests unitaires, API, interface, sauvegarde et migrations;
3. fabrique les paquets à partir d'un environnement propre;
4. génère le SBOM, les hashes, le manifeste et les signatures;
5. produit les attestations de provenance;
6. installe réellement le paquet sur une VM Windows vierge;
7. teste une mise à jour depuis la version prise en charge précédente;
8. crée une release brouillon;
9. attend une approbation humaine avant publication.

Les préversions GitHub ne sont visibles que sur le canal `beta`. Le canal
`stable` utilise exclusivement les releases publiées non brouillon et non
préversion.

## 13. Matrice de tests bloquants

### Installation

- Windows 10 et Windows 11 x64;
- compte administrateur et compte standard;
- port libre ou occupé, chemin avec espaces, redémarrage de Windows;
- absence de Node.js sur la machine;
- installation hors ligne depuis un paquet déjà téléchargé;
- désinstallation conservant les données.

### Mise à jour

- version précédente vers version actuelle;
- plus ancienne version encore prise en charge vers version actuelle;
- données vides, petites et volumineuses;
- comptes multiples, MFA, hiérarchie d'organisations, 179 modules;
- secrets existants déchiffrables après mise à jour;
- pièces jointes et relations intactes;
- base verrouillée, espace disque insuffisant, téléchargement coupé;
- hash, signature ou attestation invalide;
- GitHub indisponible ou limite API atteinte;
- interruption du processus ou redémarrage pendant chaque étape;
- migration volontairement défaillante et retour arrière complet.

### Critères d'acceptation

- aucune mise à jour ne débute sans sauvegarde validée;
- aucune donnée Atlas n'est envoyée vers GitHub;
- aucun jeton GitHub n'est requis pour une release publique;
- l'utilisateur confirme chaque installation;
- un échec remet automatiquement une version fonctionnelle;
- l'inventaire avant/après est identique et le coffre reste déchiffrable;
- les journaux ne contiennent ni mot de passe, ni clé, ni code MFA;
- le service redémarre en arrière-plan après le redémarrage de Windows.

## 14. Phases de réalisation

### Phase 0 — décisions et menace

- consigner les décisions confirmées sur le dépôt, la licence et Windows 10/11;
- faire valider l'entente de cession avant la première contribution externe;
- configurer Azure Artifact Signing et la garde des accès de publication;
- produire un modèle de menace de la chaîne de mise à jour.

Livrable : décisions consignées et critères de sécurité approuvés.

### Phase 1 — séparation programme/données

- rendre `DataRoot`, `InstallRoot` et la configuration explicites;
- déplacer l'instance de test vers la nouvelle disposition;
- conserver un outil de migration depuis l'installation actuelle;
- ajouter inventaire, santé et registre de migrations.

Livrable : Atlas fonctionne avec une version immuable et des données externes.

### Phase 2 — paquets et installateur Windows

- intégrer le runtime;
- produire ZIP portable et installateur;
- installer le démarrage caché et les ACL;
- ajouter installation, réparation et désinstallation conservatrice.

Livrable : installation sur VM vierge sans prérequis manuel.

### Phase 3 — publication reproductible

- workflow CI, tests, SBOM, manifestes, signatures et attestations;
- release brouillon avec approbation;
- documentation d'installation et de vérification.

Livrable : première release `beta` vérifiable.

### Phase 4 — assistant de mise à jour

- téléchargement sécurisé et prévalidation;
- instantané cohérent, arrêt, migration, bascule atomique;
- santé postérieure et retour arrière automatique;
- reprise après interruption.

Livrable : mise à jour locale fiable sans interface.

### Phase 5 — interface Atlas

- centre de mises à jour;
- confirmation, MFA, progression et historique;
- choix du canal et vérification planifiée configurable;
- messages clairs en cas d'incompatibilité ou d'échec.

Livrable : parcours administrateur complet.

### Phase 6 — campagne de validation

- exécuter toute la matrice sur copies de données factices complexes;
- tester installation, mise à jour, interruption et retour arrière;
- publier d'abord sur `beta`, puis promouvoir exactement le même artefact vers
  `stable` après validation.

Livrable : rapport de QA et autorisation de publication stable.

### Phase 7 — publication publique

- publier le dépôt, la licence, `SECURITY.md`, contribution et notes;
- publier l'installateur stable et sa documentation;
- activer le bouton de vérification pour le dépôt officiel.

Livrable : Atlas téléchargeable et maintenable par ses utilisateurs.

## 15. Hors portée de ce plan

- publication immédiate du dépôt;
- ouverture de ports, DNS, routeur ou exposition Internet;
- synchronisation de données avec GitHub ou TRC Account;
- mise à jour silencieuse imposée;
- suppression automatique des anciennes sauvegardes;
- prise en charge de Windows Server, Linux ou macOS dans la première version.

## 16. Ordre recommandé

Commencer par **Phase 0**, puis terminer entièrement la **Phase 1** avant de
construire l'installateur. Le bouton de mise à jour ne doit être ajouté qu'après
la réussite d'un cycle complet en ligne de commande : sauvegarde, installation,
migration, santé et retour arrière. Cette dépendance empêche qu'une interface
convaincante masque une mise à jour qui pourrait endommager le coffre.

## Références techniques GitHub

- API Releases : https://docs.github.com/en/rest/releases/releases
- Ressources de release : https://docs.github.com/en/rest/releases/assets
- Attestations de provenance : https://docs.github.com/en/actions/concepts/security/artifact-attestations
- Limites de l'API REST : https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
