# Couverture fonctionnelle inspirée d’IT Glue

Date de revue : 5 octobre 2026.

Ce document décrit la couverture d’usage retenue pour TRC Community Atlas. Il ne copie ni le code, ni les textes, ni l’identité visuelle d’IT Glue. Les sources officielles ont servi à comprendre les catégories de fonctions seulement :

- https://www.itglue.com/features/
- https://help.itglue.kaseya.com/help/Content/1-admin/getting-started/best-practices-for-using-it-glue.htm
- https://help.itglue.kaseya.com/help/Content/2-using/get-to-know-it-glue/introduction-to-the-key-concepts.html
- https://api.itglue.com/developer/

## Couverture livrée dans le lot actuel

| Famille | Couverture Atlas |
|---|---|
| Actifs de base | Configurations, Checklists, Contacts, Documents, Charge de compte technique, Domain Tracker, Locations, Passwords et SSL Tracker |
| Apps & Services | Les 22 modules fournis par l’utilisateur, de M365 à Wireless |
| Types personnalisés | Les 148 types fournis par l’utilisateur, conservés comme bibliothèque activable |
| Gestion de navigation | Page Gérer les modules, recherche, groupes repliables, préréglages et choix par compte local/profil navigateur |
| Registres | Compteurs réels, recherche, filtre par organisation/état, pagination par 25, création et modification de fiches, propriétaire, échéance, référence, étiquettes et notes |
| Volumétrie d’interface | Dashboard statistique, liste complète des organisations en tableau compact et navigation filtrable même avec de nombreux modules activés |
| Recherche | Portée globale ou organisation sélectionnée, page interne par organisation, recherche accent-insensible sur tous les registres et modification directe selon le rôle; seuls les titres et métadonnées du coffre sont indexés |
| Documentation existante | Organisations, emplacements, configurations, procédures/SOP, relations et journal d’activité |
| Relations universelles | Liens typés et bidirectionnels entre tous les objets d’une organisation, y compris les 179 modules, les sites, procédures et métadonnées du coffre; liens archivés conservés |
| Fiche universelle | Page plein espace uniforme avec détails, pièces jointes, éléments liés, impact, historique et sécurité, tout en conservant la navigation Atlas |
| Pièces jointes | Ajout, téléchargement et retrait local sur tous les objets, journal d’auteur/date, limite de 8 Mo et MFA récent pour les fiches de mot de passe |
| Mentions rapides | Syntaxe `@nom-de-fiche` dans les procédures et notes documentaires, avec sélecteur limité à l’organisation active et création automatique du lien inverse |
| Analyse d’impact | Parcours multiniveau des dépendants et dépendances depuis une fiche ou le registre universel |
| Sécurité locale | Comptes locaux, rôles et MFA obligatoires conservés; aucun lien TRC Account |
| Coffre | Secrets chiffrés AES-256-GCM, clé locale distincte, MFA réutilisé pendant la session locale de 8 heures, verrouillage manuel et code OTP calculé à la demande |
| Volumétrie | Pagination et recherche sur toutes les collections susceptibles de contenir des centaines d’éléments; jeu QA local de plus de 1 300 éléments |
| Rôles | Commandes d’écriture masquées pour les lecteurs; contrôles serveur appliqués aux administrateurs, éditeurs et lecteurs; portée facultative par organisation pour chaque compte local |
| Résilience | SQLite transactionnel en WAL, historique automatique de 200 révisions, historique durable par fiche, journal d’audit, restauration avec conservation de l’état courant et export/import documentaire versionné |
| Standardisation | Modèles applicables aux fiches, checklists structurées et seuils locaux de workflow |

Les nombres visibles dans les captures de référence n’ont pas été importés. Tous les compteurs Atlas proviennent uniquement des données locales de l’instance.

## Limites explicites

- Les secrets du coffre sont chiffrés au repos et exclus des exports documentaires. La protection complète dépend encore de la sécurité du compte Windows, du disque et des sauvegardes de la VM.
- Les intégrations RMM, PSA, Microsoft 365, Network Glue, API publique, webhooks et découverte réseau ne sont pas activées par l’existence d’un module.
- Le connecteur et le SSO via TRC RMM restent facultatifs, non configurés et prévus en fin de projet.
- Les fonctions externes ou commerciales d’IT Glue (MyGlue, GlueConnect, applications mobiles, extensions de navigateur, Office Cloud Editor et services de migration) ne sont pas simulées comme si elles étaient opérationnelles.
- L’édition collaborative simultanée reste hors de ce lot local. Les pièces jointes sont locales et ne sont pas incluses dans l’export JSON documentaire.
