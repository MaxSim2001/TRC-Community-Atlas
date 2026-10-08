# TRC Community Atlas

Version actuelle : **0.13.0**.

[![Tests Atlas](https://github.com/MaxSim2001/TRC-Community-Atlas/actions/workflows/tests.yml/badge.svg)](https://github.com/MaxSim2001/TRC-Community-Atlas/actions/workflows/tests.yml)

Code source officiel : [MaxSim2001/TRC-Community-Atlas](https://github.com/MaxSim2001/TRC-Community-Atlas). Le paquet Windows autonome est maintenant fabriqué et testé par GitHub Actions. Il demeure un paquet de validation jusqu’à la publication d’une Release stable signée; le bouton de mise à jour intégré reste en préparation.

Socle local de documentation et d’inventaire IT, inspiré du cahier des charges du 22 septembre 2026. Cette édition reste autonome : comptes, données et préférences sont stockés localement dans l’instance.

## Installation Windows simple

Le paquet Windows autonome contient déjà Node.js. Après avoir téléchargé
l’artéfact d’une exécution GitHub Actions réussie :

1. décompresser complètement le fichier ZIP;
2. double-cliquer sur `Installer-Atlas.cmd`;
3. laisser Atlas démarrer en arrière-plan;
4. créer le premier compte administrateur et activer son MFA dans le navigateur.

L’installation utilisateur par défaut place le programme dans
`%LOCALAPPDATA%\Programs\TRC Community Atlas` et les données dans
`%LOCALAPPDATA%\TRC Community Atlas\data`. Relancer l’installateur répare le
programme sans effacer les comptes, le MFA, le coffre ou les pièces jointes.
Atlas crée aussi un raccourci dans le menu Démarrer et se relance en arrière-plan
au démarrage de Windows ou à la connexion, selon les droits disponibles.

Le paquet GitHub Actions est encore destiné aux essais. La Release stable signée
et le mécanisme de mise à jour avec sauvegarde et retour arrière seront publiés
après leur validation complète.

Voir [Installation Windows](docs/INSTALLATION_WINDOWS.md) pour les paramètres
avancés et le diagnostic.

## Démarrage depuis le code source

Dans PowerShell :

```powershell
.\Start-TRCCommunityAtlas.ps1
```

Ouvrir ensuite `http://127.0.0.1:9092`. Au premier démarrage, l’application demande la création du compte administrateur local. Les données sont écrites dans `data/`; le serveur écoute uniquement sur la boucle locale par défaut. Depuis une archive de code source sans runtime, Node.js 22 ou plus récent est requis.

Pour publier Atlas derrière un mandataire inverse de confiance, fournir explicitement l’adresse privée d’écoute et chaque origine HTTPS autorisée. Exemple : `Start-TRCCommunityAtlas.ps1 -BindAddress 192.168.50.12 -Port 9092 -AllowedOrigin https://atlas.therisingcloud.com`. Ne pas utiliser `0.0.0.0` lorsqu’une adresse privée précise est disponible. Le mandataire inverse doit forcer TLS, transmettre `X-Forwarded-Proto https` et marquer le cookie `atlas_session` comme `Secure`.

## Démarrage automatique Windows

Le script `scripts/Install-TRCCommunityAtlasAutostart.ps1` installe une tâche
Windows déclenchée au démarrage de la VM. Elle exécute directement une copie
locale du runtime Node.js sous le compte `SYSTEM`, en arrière-plan et sans
fenêtre PowerShell. Le script est idempotent, conserve une copie XML datée de
toute tâche Atlas remplacée, puis valide l’état de l’API locale après démarrage.

## Fonctions incluses

- organisations, sites et configurations;
- hiérarchie documentaire d’organisations limitée à trois niveaux, avec fil d’Ariane complet et sous-compagnies visibles sur l’accueil du parent, sans héritage ni mélange des accès, mots de passe, sites ou fiches;
- bibliothèque de 9 actifs de base, 22 modules Apps & Services et 148 types personnalisés;
- page « Gérer les modules » avec navigation configurable par compte local;
- pages de registre pour chaque module, compteurs réels, filtres par organisation et fiches structurées;
- création et modification en page complète pour chacun des 179 modules, les configurations et les sites, avec navigation gauche stable et organisation active implicite;
- configurations complexes structurées : identité et rôle, hôte parent relié automatiquement, matériel, multiples interfaces réseau, cycle de vie, supervision, sauvegarde, maintenance, dépendances et attributs constructeur indexables;
- profil File Sharing enrichi avec chemins réseau, sélecteur de serveurs et relations inverses automatiques;
- profil Printing complet avec registre compact, export CSV, serveurs d’impression et imprimantes reliés aux configurations, déploiement, publication AD, pilotes, soutien et notes enrichies;
- tableau de bord statistique et listes compactes recherchables/paginées pour les organisations et les registres volumineux;
- bloc « Priorités documentaires » sans score arbitraire, fondé sur cinq critères explicites et ouvrables; les organisations `[TEST]` sont masquées par défaut et peuvent être incluses à la demande;
- coffre local AES-256-GCM déverrouillé par le MFA de la session de 8 heures, verrouillage manuel et génération OTP;
- stockage transactionnel SQLite local avec migration automatique depuis le JSON, copie JSON de compatibilité et 200 révisions complètes;
- historique durable par fiche et journal d’audit local administrateur;
- import/export JSON administrateur excluant explicitement comptes, MFA, sessions et coffre;
- modèles de fiches réutilisables, checklists interactives avec progression et workflows locaux dotés d’une file d’actions ouvrable;
- éditeur documentaire local complet avec Markdown assisté, aperçu sécurisé en direct, tableaux, listes de tâches, liens, citations, blocs de code, compteurs et mode plein écran;
- modification des organisations, sites, configurations, procédures, relations et fiches de modules;
- propriétaires, emplacements, garanties et criticité;
- registre universel de relations bidirectionnelles entre sites, configurations, procédures, mots de passe et toutes les fiches des 179 modules, limité à l’organisation active, avec recherche compacte directement dans le panneau « Éléments liés »;
- relations typées, liens inverses automatiques, conservation des liens archivés, historique par relation et vue d’impact multiniveau;
- fiche plein espace universelle pour les sites, configurations, procédures, mots de passe et les 179 modules, avec navigation Atlas toujours disponible;
- informations, éléments liés, impact, historique et sécurité visibles ensemble sans sous-onglets; une seule validation MFA ouvre le coffre jusqu’à la fin de la session, tandis que les mots de passe et OTP restent masqués jusqu’à leur affichage explicite;
- pièces jointes universelles sur toutes les fiches : dépôt local jusqu’à 8 Mo, téléchargement, retrait contrôlé par rôle et historique avec auteur/date; les pièces jointes d’un mot de passe exigent aussi un MFA récent;
- mentions `@nom-de-fiche` dans les procédures et notes documentaires pour créer rapidement une relation navigable;
- recherche globale avec portée modifiable, recherche interne par organisation, organisations correspondantes toujours épinglées dans un groupe prioritaire et résultats ouvrables/modifiables selon le rôle;
- espace propre à chaque organisation avec compteurs, raccourcis et recherche couvrant configurations, sites, documents, procédures, mots de passe et fiches de modules;
- panneau « Quick Notes » toujours visible dans chaque espace de compagnie, vide par défaut, isolé par compagnie et modifiable avec aperçu Markdown par les comptes autorisés;
- centre d’aide intégré accessible par l’icône `?`, avec menu compact, recherche locale, catégories, articles détaillés, notes de version et mise en page responsive;
- assistant administrateur « Configuration initiale » séparant clairement le code d’instance, le domaine public, les alias et le proxy inverse; Atlas autorise les origines enregistrées mais ne modifie jamais le DNS, le certificat ou le pare-feu;
- tableau « Santé du site » avec contrôles factuels du service, de SQLite, des comptes, du coffre, du domaine, de HTTPS, du proxy et de l’origine, plus un test public manuel limité au domaine enregistré et refusant les destinations privées;
- dépôt public `MaxSim2001/TRC-Community-Atlas`, tests Windows automatisés, déploiement propre sur le port 9095 et paquet autonome produit à chaque exécution réussie; la Release stable signée et les mises à jour intégrées restent en préparation;
- journal d’activité;
- interface français/anglais et thèmes clair/sombre;
- statut explicite du raccordement RMM et du futur SSO facultatif via TRC RMM;
- page dédiée « Comptes et accès » avec création, modification, activation/désactivation, changement du mot de passe temporaire, fermeture des sessions actives et réinitialisation MFA;
- droits indépendants et combinables par compagnie : lecture ou édition et accès au coffre oui/non; un même compte peut donc modifier une compagnie, lire une autre et consulter seulement les mots de passe explicitement autorisés;
- MFA TOTP obligatoire à la première connexion de chaque compte, codes de récupération, mot de passe dérivé par `scrypt` et protection contre la désactivation du dernier administrateur local;
- politique configurable de MFA renforcé pour les actions administratives sensibles, avec validation serveur et journalisation locale;
- politique configurable d’expiration et de rappels de rotation des mots de passe, dates et responsables par secret, score de force et détection locale des réutilisations sans indexer les secrets;
- panneau « Santé des mots de passe » dans chaque espace de compagnie et vue consolidée dans le tableau de bord global, avec six niveaux factuels, ventilation par compagnie et explication transparente du calcul local;
- page « Mon compte » avec changement autonome du mot de passe, remplacement MFA, régénération des codes de récupération et révocation session par session;
- sauvegarde complète chiffrée AES-256-GCM incluant comptes, MFA, coffre, clé, SQLite et pièces jointes, avec restauration confirmée et copie de sécurité préalable; les sessions sont volontairement exclues;
- outil de récupération hors bande local pour réinitialiser un administrateur, avec mot de passe temporaire, nouvel enrôlement MFA, sauvegarde datée et trace d’audit;
- portée des comptes imposée côté serveur au workspace, au coffre, aux pièces jointes et aux historiques; le coffre est refusé par défaut aux nouveaux comptes tant qu’un administrateur ne l’autorise pas;
- archivage et restauration directs des fiches sans rompre leurs relations;
- vues volumineuses paginées et recherchables pour les organisations, sites, configurations, procédures, relations, activités, modèles, fiches de modules et coffre;
- affichage en consultation adapté au rôle lecteur, sans commandes d’écriture trompeuses;
- sessions locales durables protégées par jeton haché, cookie HttpOnly et contrôle CSRF, conservées pendant les redémarrages Atlas, avec expiration absolue après 8 heures et verrouillage automatique de l’interface.
- installation PWA sur mobile avec bannière compacte dans le navigateur, instructions adaptées à iOS/Android et suppression automatique de cette bannière lorsque Atlas est ouvert comme application; le service worker ne met jamais en cache les API ni les données métier.

## Limites de cette première version

Le stockage documentaire principal est `data/atlas.sqlite` avec journal WAL, transactions et révisions. `data/workspace.json` et `data/workspace-history.json` restent générés comme copies de compatibilité; ils ne sont plus la source d’autorité après migration. Les secrets sont séparés dans `data/vault.json`, chiffrés avec une clé locale distincte `data/vault.key`; ils ne sont jamais inclus dans l’export documentaire. Les sessions actives sont conservées dans `data/sessions.json` uniquement sous forme de hachages de jetons et sont purgées à leur échéance; les jetons de cookie bruts ne sont jamais écrits sur disque. Les pièces jointes sont conservées séparément dans `data/attachments/` avec leurs métadonnées et leur journal dans `data/attachments.json`; l’export JSON documentaire ne transporte pas les fichiers binaires. La visibilité des modules est enregistrée dans le compte local, avec une copie de compatibilité dans le profil de navigateur. PostgreSQL, les connecteurs externes, la découverte réseau et le SSO facultatif via TRC RMM restent désactivés tant que leurs contrats ne sont pas cadrés.

## Licence et propriété

TRC Community Atlas est un logiciel **source disponible**, et non un logiciel
open source au sens OSI. Il est offert pour les usages non commerciaux selon la
[PolyForm Noncommercial License 1.0.0](LICENSE.txt). Toute exploitation
commerciale nécessite une autorisation écrite distincte de TheRisingCloud.

TheRisingCloud demeure titulaire du projet. Une contribution externe ne peut
être fusionnée qu'après signature d'une entente de cession conforme à
[`CONTRIBUTING.md`](CONTRIBUTING.md) et à la
[politique de propriété](docs/CONTRIBUTOR_OWNERSHIP.md).

## Jeu de charge QA

`npm run seed:qa` ajoute une organisation clairement marquée `[TEST]` et plus de mille éléments fictifs pour valider la recherche, les filtres et la pagination. Le script est idempotent par refus : s’il détecte déjà `org-qa-scale`, il s’arrête sans modifier les données. Avant l’ajout, il conserve une copie datée dans `data/qa-backups` et ajoute l’état courant à l’historique Atlas. Le jeu ne contient aucun mot de passe, jeton ou renseignement réel.

## Sauvegarde complète et récupération locale

La sauvegarde complète demande sa phrase secrète dans une saisie PowerShell protégée; elle ne la place ni dans la ligne de commande ni dans un fichier :

```powershell
.\scripts\Invoke-AtlasFullBackup.ps1 -Mode Create
```

Pour valider un fichier sans le restaurer :

```powershell
.\scripts\Invoke-AtlasFullBackup.ps1 -Mode Inspect -InputPath .\backups\TRC_Community_Atlas_Full_Backup_YYYY-MM-DD_HH-mm-ss.trcatlas
```

Une restauration doit être effectuée service Atlas arrêté. Le script exige la confirmation exacte `RESTORE_ATLAS`, déplace l’état remplacé dans `data\restore-safety\` et invalide toutes les sessions.

En récupération hors bande, exécuter d’abord `atlas-break-glass.mjs` avec `--dry-run`, puis avec `--confirm RESET_MFA`. L’outil accepte uniquement un compte administrateur local, conserve `auth.json` et `sessions.json` dans un dossier daté sous `data\emergency-backups\`, génère un mot de passe temporaire et exige un changement de mot de passe suivi d’un nouvel enrôlement MFA.

## Conventions

- TRC Style adopté : version 1.1.1, ressources copiées localement et aucune police distante.
- Bibliothèque de 179 modules auditée automatiquement : 9 registres de base, 22 Apps & Services et 148 types spécialisés.
- Plus de 30 profils métier alimentent les formulaires pleine page (serveurs, postes, stockage, SQL, sécurité, téléphonie, cloud, OT, supervision et autres) au lieu d’un formulaire générique minimal.
- La page Gérer les modules affiche la couverture, le profil et le nombre de champs de chaque type; une matrice QA valide tous les schémas et leur persistance SQLite.
- Aucun lien ni aucune dépendance à TRC Account.
- TRC RMM demeure autonome; son connecteur et son SSO seront des options configurables et désactivées par défaut.
- Aucun service Internet ni télémétrie. La future vérification de version GitHub sera le seul appel sortant prévu, manuel par défaut et configurable.
- Port local par défaut : `9092`, modifiable avec `-Port`.

