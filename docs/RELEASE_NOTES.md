# Notes de version — TRC Community Atlas

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

