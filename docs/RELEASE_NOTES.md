# Notes de version — TRC Community Atlas

## 0.15.6 — Profil regroupé dans l’en-tête

- profil retiré du bas de la navigation afin d’éliminer le doublon;
- menu compact ajouté au profil supérieur avec l’identité du compte, le compte
  local, le coffre autorisé, les paramètres administratifs et la déconnexion;
- ouverture au clavier, fermeture avec Échap ou clic extérieur et mise en page
  adaptée aux petits écrans.

## 0.15.5 — Confirmation MFA des webhooks finalisée

- carte MFA des webhooks réorganisée verticalement dans sa colonne afin de
  conserver un titre, une explication et un champ lisibles à toutes les tailles.

## 0.15.4 — Intégrations locales réalignées

- page Intégrations restructurée avec une hiérarchie plus claire entre
  activation, confirmation MFA, création de jeton et accès existants;
- cases à cocher normalisées et accompagnées d’une description lisible pour
  chaque portée API;
- cartes de création et de liste indépendantes afin d’éviter les grands espaces
  vides et les hauteurs forcées;
- mise en page adaptée aux écrans étroits sans défilement horizontal, avec les
  actions principales sur toute la largeur au besoin.

## 0.15.3 — Centre d’aide enrichi et alertes guidées

- centre d’aide complété avec les parcours GitHub, installation Windows,
  mises à jour signées, sauvegardes, restauration et liens officiels;
- captures réelles produites depuis une instance QA locale avec des données
  factices, sans exposer la documentation ni les secrets de production;
- compteur d’alerte repris dans la navigation des Paramètres sur **Santé du
  site** et sur la page qui permet de corriger le problème;
- alertes dirigées vers Configuration initiale, Sauvegardes, Mises à jour ou
  Comptes et accès selon le contrôle en erreur;
- mise à jour Windows corrigée pour conserver les proxys de confiance déjà
  configurés pendant l’installation d’une nouvelle version;
- cache PWA renouvelé et tests de régression étendus aux nouveaux guides et
  indicateurs d’état.

## 0.15.2 — Mise à jour GitHub tolérante aux fins de ligne

- identité de la clé de publication vérifiée à partir de la clé Ed25519 réelle,
  tout en acceptant les représentations PEM LF et CRLF produites par Git;
- règle Git explicite imposant LF pour les fichiers PEM afin de rendre les
  prochains paquets reproductibles entre Windows et GitHub Actions;
- test de régression empêchant le retour de l’erreur `release_key_mismatch`
  lorsque seule la fin de ligne du fichier de clé publique change;
- la Release 0.15.1 demeure vérifiable et installable, mais la 0.15.2 devient
  la version stable recommandée pour les mises à jour intégrées.

## 0.15.1 — Correctifs de sécurité de l’authentification et du proxy

- limitation persistante des tentatives de mot de passe et de MFA par compte et
  par adresse cliente, avec `429` et délai de reprise;
- défis MFA réduits à cinq minutes et invalidés après cinq codes incorrects;
- limites de corps adaptées à chaque endpoint afin d’éviter l’accumulation de
  requêtes anonymes volumineuses en mémoire;
- confiance explicite envers les adresses IP de proxy; les en-têtes transmis
  sont ignorés lorsqu’ils viennent d’une source non déclarée;
- statut public réduit à `{ "ok": true }`, diagnostic détaillé limité à la VM
  et vrais `404` pour les chemins non publiés;
- retrait des adresses, chemins et détails d’exploitation des rapports publics.

## 0.15.0 — Release signée et mise à jour transactionnelle

- manifeste de Release signé avec Ed25519; seule la clé publique de vérification
  est incluse dans Atlas et la clé privée chiffrée demeure hors du dépôt;
- téléchargement limité aux hôtes GitHub approuvés, contrôle de la taille et du
  SHA-256 du paquet, puis seconde vérification juste avant toute modification;
- préparation sans effet sur le programme actif, installation réservée au super
  administrateur avec CSRF, MFA et confirmation exacte de la version;
- instantané complet du programme, de SQLite, du coffre, des comptes, des pièces
  jointes et de la configuration avant remplacement;
- vérification après redémarrage de la version, de SQLite, du coffre déchiffrable
  et des compteurs métier; retour automatique à la version précédente si un de
  ces contrôles échoue;
- tâche Windows paramétrable permettant de valider les mises à jour sur les ports
  QA 9095/9096 sans interférer avec l’instance de production.

## 0.14.3 — Vérification GitHub durcie

- comparaison explicite de la version installée avec le tag stable publié;
- état **Atlas à jour**, **Mise à jour détectée** ou **Aucune publication**
  affiché sans présenter un paquet non vérifié comme installable;
- présence d’un manifeste et d’une signature traitée comme un indice seulement :
  Atlas exige toujours leur vérification cryptographique, celle du paquet et un
  retour arrière prêt avant d’autoriser une installation;
- tests d’intégration ajoutés pour l’authentification administrateur, le CSRF,
  l’audit et l’absence volontaire de route d’installation non sécurisée.

## 0.14.2 — Connexion responsive

- écran de connexion basculé en une seule colonne avant que ses largeurs
  minimales puissent provoquer un débordement horizontal;
- rendu validé dans le navigateur intégré à 807 px et sur téléphone;
- nouvelle clé de cache pour distribuer immédiatement le correctif public.

## 0.14.1 — Finalisation visuelle et responsive

- noms d’organisation longs désormais affichés au complet dans l’espace de la
  compagnie;
- navigation des Paramètres transformée en grille lisible sur téléphone, sans
  défilement horizontal pour atteindre une section;
- tableau **Comptes et accès** ajusté sur ordinateur et présenté en fiches
  verticales sur mobile;
- cibles tactiles principales portées à 44 px dans l’en-tête et la navigation;
- nouvelle clé de cache afin que les navigateurs et le mode PWA chargent les
  corrections visuelles sans conserver les anciens fichiers.

## 0.14.0 — Centre d’exploitation et documentation avancée

- gestion des sauvegardes complètes depuis les Paramètres : chemin local ou UNC,
  planification quotidienne ou hebdomadaire, secret protégé par DPAPI, rétention
  explicite, historique et inspection d’intégrité sans restauration;
- Santé du site enrichie avec l’intégrité SQLite, l’espace libre, les volumes de
  données, l’âge des sauvegardes et l’état des vérifications de version;
- vérification manuelle des Releases GitHub, sans téléchargement ni installation
  tant qu’un manifeste signé et un retour arrière testé ne sont pas présents;
- constructeur de modules locaux avec schéma validé côté serveur;
- cycle de révision documentaire avec brouillon, validation, approbation,
  responsable et échéance;
- import CSV guidé avec aperçu, mappage, portée de compagnie et retour arrière
  par révision;
- API locale de lecture facultative, désactivée par défaut, limitée par portée et
  compagnie, avec jetons affichés une fois, hachés sur disque et révocables par MFA;
- webhooks facultatifs signés par HMAC, limités à la boucle locale de la VM et
  couvrant les modifications documentaires et les résultats de sauvegarde.

## 0.13.2 — Autodémarrage et contrôle local du port

- activation ou désactivation du démarrage automatique depuis
  **Paramètres > Configuration initiale**;
- tâche Windows masquée, protégée par les droits administrateur, le CSRF et la
  politique MFA renforcée;
- réutilisation de l’adresse, du port, des origines HTTPS et du dossier de
  données actifs, sans port supplémentaire;
- état réel de la tâche Windows intégré au tableau **Santé du site**;
- bouton **Tester le port local** limité au listener Atlas courant sur cette
  machine, sans balayage du LAN et sans modification du pare-feu;
- test Windows automatisé d’activation, de désactivation et de nettoyage d’une
  tâche QA isolée.

## 0.13.1 — Configuration complète du déploiement

- configurateur Windows graphique ouvert par `Installer-Atlas.cmd`;
- choix du port Atlas, de l’adresse d’écoute, des origines HTTPS, des dossiers,
  du canal et des options de démarrage;
- vérification locale de la disponibilité du port sans exploration du réseau;
- rappel intégré que SQLite est un fichier local sans port supplémentaire;
- reconfiguration contrôlée d’une instance active avec conservation vérifiée de
  la base SQLite;
- raccourci distinct « Configurer TRC Community Atlas » dans le menu Démarrer;
- refus des dossiers de données UNC afin d’éviter un SQLite sur partage réseau;
- test automatisé du passage du port 9095 au port 9096.

## 0.13.0 — Installation Windows simplifiée

- ajout de `Installer-Atlas.cmd` pour une installation guidée en un double-clic;
- paquet Windows autonome avec runtime Node.js inclus;
- séparation explicite du programme, de la configuration, des journaux et des
  données persistantes;
- réparation du programme sans suppression des comptes, du MFA, du coffre ou
  des pièces jointes;
- raccourci du menu Démarrer et démarrage automatique sans fenêtre interactive;
- test de déploiement propre sur `127.0.0.1:9095` dans la CI Windows;
- production automatique d’un ZIP de validation et de son SHA-256;
- mise à niveau des actions GitHub vers leur runtime Node.js actuel.

## 0.12.9 — Vue des paramètres réorganisée

- navigation interne compacte placée au-dessus du contenu;
- réglages regroupés entre administration de l’instance et préférences;
- cartes élargies avec une hiérarchie typographique plus lisible;
- avertissement administrateur ramené à un bandeau court;
- correction du placement qui pouvait étirer l’avertissement dans une colonne vide.
- publication du code source officiel et ajout des tests GitHub Actions sur Windows.

## 0.12.8 — Paramètres dédiés et confirmation MFA visible

- remplacement du formulaire unique par des pages séparées;
- configuration initiale et santé du site réservées aux administrateurs;
- saisie MFA placée directement dans les pages protégées;
- navigation simplifiée avec un seul bouton Paramètres;
- comptes et accès disponibles depuis l’accueil des paramètres.

## 0.12.7 — Configuration initiale et santé du site

- Configuration administrateur du code d’instance, du domaine principal, des
  alias et du proxy inverse, avec validation MFA renforcée.
- Origines HTTPS enregistrées chargées automatiquement par Atlas sans modifier
  le DNS, le certificat, le routeur ou le pare-feu.
- Tableau de santé factuel et sonde publique manuelle avec validation TLS et
  refus des destinations privées ou réservées.
- Documentation intégrée et guide opérateur pour le parcours self-hosted.

## 0.12.6 — Centre d’aide intégré

- icône `?` dans l’en-tête avec menu d’aide compact;
- centre d’aide local avec recherche et catégories;
- articles détaillés en français et en anglais;
- affichage responsive pour ordinateur et mobile;
- version et nouveautés visibles dans le menu d’aide;
- guides utilisateur, sécurité et exploitation ajoutés au dépôt;
- page GitHub et installation marquée à compléter, sans prétendre qu’un dépôt
  public ou un installateur officiel existe déjà.

## 0.12.5 — Quick Notes

- Quick Notes propres à chaque compagnie;
- état vide par défaut;
- édition Markdown avec aperçu;
- recherche et activité mises à jour sans mélanger les compagnies.

## 0.12 — Administration et expérience

- comptes et permissions par compagnie;
- hiérarchie d’organisations limitée à trois niveaux;
- formulaires métier pleine page;
- santé des mots de passe;
- installation PWA mobile;
- navigation et compteurs limités à la compagnie active.

