# TRC Community Atlas — Cahier des charges

Date : 22 septembre 2026. Version : 0.2 — socle local démarré le 5 octobre 2026.

Statut : **développement local autorisé et démarré le 5 octobre 2026**. Le feu
vert explicite a été donné avec carte blanche pour mettre le cahier en place dans
ce dossier. Le socle écoute uniquement sur `127.0.0.1:9092`, après vérification
que le port était libre. Aucun site public, DNS, proxy ou connecteur Atlas n'est
créé. Le RMM reste un produit autonome et prioritaire selon son propre cahier.

## 1. Identité et objectif

- Nom : **TRC Community Atlas** ; nom court possible dans l'interface : **TRC Atlas**.
- Produit communautaire, gratuit, source disponible et entièrement self-hosted;
  il ne doit pas être qualifié d'open source au sens OSI.
- Documentation et inventaire IT organisés par organisations, sites et actifs.
- Inspiration fonctionnelle : usages de documentation d'IT Glue, sans reprise de
  son code, de sa marque, de ses contenus ou de son identité visuelle.
- Identité TRC ; nom et disponibilité à vérifier avant publication publique.

Complémentarité : le RMM supervise et administre ; Atlas documente et relie les
informations. Ni le RMM ni Atlas n'exige l'installation ou l'usage de l'autre.

La licence retenue est la TRC Community Atlas Source-Available License 1.0. Elle
autorise gratuitement les usages personnels, professionnels, internes et MSP,
tout en interdisant la revente, les forks commercialisés et les offres SaaS dont
Atlas est le produit principal sans autorisation écrite. Cette licence
personnalisée doit être validée juridiquement avant publication.

## 2. Deux produits autonomes

Atlas possède son installation, ses comptes locaux, ses permissions, ses données,
ses sauvegardes et son cycle de mise à jour. Le RMM conserve les siens.
Déploiement sur une même machine ou des machines distinctes possible en cible.
Les bases logiques et comptes d'accès aux données restent séparés, même si le
serveur physique de base de données est commun. Aucune lecture/écriture directe
des tables de l'autre produit ; les échanges passent par une API explicite.

Sans intégration : Atlas doit permettre de documenter des appareils et des actifs
qui n'ont aucun agent RMM. Créer une configuration Atlas n'enrôle pas une machine.
Réciproquement, le RMM doit rester pleinement utilisable sans Atlas.

Aucune dépendance à TRC Account, compte commercial ou infrastructure centrale TRC.
Aucune transmission automatique des inventaires, documents, secrets, sessions ou
autres données opérationnelles à TRC. Pas d'accès maître, clé universelle ou
activation commerciale obligatoire.

## 3. Périmètre fonctionnel initial à détailler

Le besoin confirmé couvre les organisations/sites, les appareils dans une section
« Configurations », leur documentation, les relations entre informations et les
liens vers leurs fiches dans le RMM. Prévoir des informations métier comme le
propriétaire, l'emplacement, la garantie, la criticité et des procédures associées.

Le détail des autres modules n'est pas encore arrêté : coffre-fort de secrets,
contacts, réseaux, domaines/certificats, pièces jointes, modèles documentaires,
versions, imports et exports seront cadrés avant implémentation. Le mot « copie »
ne signifie ni parité complète promise avec IT Glue ni autorisation de tout
développer dès maintenant. Aucun coffre-fort n'est implicitement livré ou conçu.

## 4. Deux options indépendantes : données et SSO

| Synchronisation | SSO | Comportement attendu |
|---|---|---|
| Non configurée | Non configuré | Deux applications autonomes ; connexion locale demandée dans chacune |
| Configurée | Non configuré | Échange des données choisies ; connexions distinctes |
| Non configurée | Configuré | Connexion fédérée possible ; aucun inventaire synchronisé automatiquement |
| Configurée | Configuré | Échanges autorisés et navigation avec SSO selon sessions/droits |

Les deux options sont désactivées/non configurées par défaut. Installer les deux
produits, partager un domaine ou utiliser le même courriel n'active aucune liaison.
Un lien simple entre fiches n'accorde ni session ni permission supplémentaire.

## 5. Synchronisation facultative RMM ↔ Atlas

### 5.1 Propriété des informations

Une source de référence est définie pour chaque famille de champs, afin d'éviter
écrasements concurrents et boucles. La synchronisation est bidirectionnelle pour
les champs sélectionnés ; elle n'autorise pas toute modification dans les deux sens.

| Information | Référence proposée | Échange cible |
|---|---|---|
| Nom d'hôte collecté, OS, matériel, logiciels collectés, dernier contact, état RMM | RMM | RMM vers configuration Atlas |
| Propriétaire métier, emplacement, garantie, criticité, liens documentaires | Atlas, selon paramétrage | Atlas vers les champs métier prévus du RMM |
| Organisations et sites | Autorité choisie lors du raccordement | Correspondances explicites ; pas de fusion automatique par nom |
| Procédures et documentation complète | Atlas | Liens ou résumé autorisé depuis le RMM |

Le mapping détaillé et les champs modifiables seront validés avant le connecteur.
Ne publier que les champs réellement disponibles ; valeurs absentes ou anciennes
restent explicitement absentes ou datées. Ne pas copier les historiques de métriques
complets par défaut lorsqu'un lien vers le RMM suffit.

Exemple cible : une nouvelle version Windows collectée par le RMM actualise la
configuration Atlas ; une garantie renseignée dans Atlas apparaît sur la fiche
RMM correspondante. Modifier un libellé documentaire ne renomme pas Windows et
ne déclenche jamais une commande, un script ou un changement de machine.

### 5.2 Identité, conflits et suppressions

- Correspondance par identifiants stables incluant l'instance et l'identifiant
  local de l'objet, pas seulement son nom, son IP ou son numéro de série.
- Renommer un appareil conserve sa fiche et sa liaison ; pas de doublon silencieux.
- Liaison aux objets existants revue par l'administrateur, notamment org/site.
- Événements/requêtes dédupliqués, versions/provenance conservées, reprise bornée.
- Conflits visibles ; aucune règle implicite « dernier arrivé gagne » sur un champ
  que les deux produits seraient autorisés à modifier.
- Retrait/archivage RMM ne supprime pas automatiquement la documentation Atlas.
- Désactivation du connecteur arrête les échanges sans effacer les données locales.
- Une fiche Atlas ne commande pas la suppression, la révocation ou l'enrôlement RMM.

### 5.3 Exploitation et sécurité

Configuration volontaire : URL exacte, confiance TLS, identité de service dédiée,
organisations/sites autorisés, sens des échanges et champs sélectionnés.
API versionnée, droits minimaux et révocables, débit et volume bornés, pagination,
traçabilité des changements et erreurs sans secrets. Aucune session humaine
partagée avec le travail de synchronisation serveur à serveur.

Les destinations privées explicitement configurées pour le self-hosting sont
possibles ; cela n'autorise pas le connecteur à explorer le LAN, suivre une
redirection arbitraire ou appeler d'autres services. Authentification et validation
des destinations seront qualifiées avant toute activation.

Si l'un des produits est indisponible, l'autre continue. Montrer la dernière
synchronisation réussie et les erreurs ; reprendre sans dupliquer les mutations.
Ne jamais présenter une copie ancienne comme une information en temps réel.
Pas de synchronisation automatique des mots de passe/coffres ou jetons.
Tout futur accès à un secret nécessitera un contrat de sécurité séparé.

## 6. SSO facultatif

### 6.1 Mode non configuré — exigence explicite

Chaque application présente son propre écran de connexion, ses comptes locaux
et ses protections MFA. Être connecté dans une application avec un compte local
indépendant n'authentifie pas automatiquement dans l'autre.

### 6.2 Mode SSO volontaire

Objectif : dans le même profil de navigateur, ouvrir la fiche de l'autre produit
sans ressaisir les identifiants lorsque la session chez le fournisseur d'identité,
les conditions de sécurité et les permissions du produit cible sont valides.
Un bref aller-retour de redirection reste possible. Une expiration, révocation,
absence d'autorisation ou nécessité de MFA récente peut imposer une interaction.

Utiliser un protocole standard OIDC, pas un échange de mot de passe ou un jeton
maison placé dans un lien. Sessions/cookies propres à chaque application ; pas
de cookie commun de domaine ni de copie de cookies entre produits. Identité
fédérée liée à issuer+subject, pas de fusion automatique par adresse courriel.
URI de retour exactes et contrôles state/nonce/PKCE prévus ; les détails de
l'implémentation seront revus avant développement.

Topologie retenue le 5 octobre 2026 : **TRC RMM comme fournisseur d'identité
facultatif et configurable**. Atlas proposera une connexion via le RMM lorsque
l'administrateur l'active. Une connexion Atlas passée par ce fournisseur pourra
ensuite faciliter l'ouverture du RMM, et réciproquement. Les nouvelles connexions
SSO Atlas dépendront alors de la disponibilité de cette autorité RMM ; une simple
session locale Atlas n'établit pas cette session commune.

Cette topologie n'est pas encore implémentée et sera traitée à la fin du projet.
Les comptes locaux, leur MFA et la récupération locale restent actifs lorsque le
SSO n'est pas configuré et demeurent une voie d'administration protégée. Aucun
fournisseur TRC central obligatoire. Le changement de mode, la révocation et la
déconnexion locale/globale restent à détailler.
Une panne SSO ne doit jamais déclencher un repli permissif ou créer un compte.
Les rôles restent contrôlés par chaque produit ; SSO ne signifie pas administrateur
des deux ni accès à toutes les organisations. Un clic vers Remote conserve tous
les contrôles d'autorisation et d'audit du RMM.

## 7. Navigation et expérience

Prévoir « Ouvrir dans le RMM » et « Ouvrir dans Atlas » sur les objets liés, avec
retour vers la bonne fiche après connexion. Aucune donnée sensible ni credential
dans les liens. Cible absente, liaison périmée ou accès refusé : message explicite.
La visibilité d'un lien n'est jamais une preuve d'autorisation dans la cible.

Interface dans l'identité TRC, documentation structurée et recherche utile.
Réutilisation visuelle de TRC_Style seulement : les obligations TRC Account des
produits commerciaux connectés ne s'appliquent pas à cette édition self-hosted.
Langues, thèmes, navigation détaillée et accessibilité seront précisés au cadrage.

## 8. Anticipation autorisée dans le RMM dès maintenant

- Préserver les identifiants stables et les périmètres organisation/site/appareil.
- Préférer des contrats/API explicites, versionnables et contrôlés par RBAC.
- Séparer données d'inventaire observées et métadonnées métier éditables.
- Conserver les comptes locaux, la sécurité et le fonctionnement autonome.
- Ne pas coupler la base RMM, ses agents, son démarrage ou ses mises à jour à Atlas.
- Prévoir la provenance, les révisions et les futurs liens sans ajouter maintenant
  une synchronisation active, un fournisseur SSO ou un endpoint Atlas fictif.

Cette anticipation ne doit pas retarder l'agent permanent, le monitoring, les jobs
et le Remote du RMM. Pas de tables, permissions interproduits, migration, listener,
secret, abonnement webhook ou UI simulant Atlas avant un lot explicitement revu.

## 9. Ordre prévu et critères futurs

1. Achever et qualifier le RMM selon son propre cahier Community.
2. Obtenir le feu vert de démarrage Atlas et compléter son périmètre MVP.
3. Livrer et qualifier Atlas autonome.
4. Qualifier le connecteur facultatif, d'abord inventaire RMM vers Atlas et liens.
5. Ajouter les retours métier sélectionnés et le SSO facultatif, en lots distincts.

Critères à vérifier à la livraison : les quatre modes de la section4 ; absence
de dépendance obligatoire ; isolation des organisations ; changement de nom sans
doublon ; reprises après coupure ; absence de propagation destructive ; refus
des accès non autorisés ; expiration/révocation/MFA SSO ; sauvegarde/restauration
de chaque produit ; compatibilité des versions et désactivation du connecteur.

## 10. Points ouverts et limites

Nom technique du dépôt, OS/stack/DB, ports/domaines, périmètre du
coffre et modules complémentaires, provider SSO, gestion du logout global,
fréquence de synchronisation, conflits avancés et multi-instance : à décider.
Ce document ne promet ni compatibilité totale avec l'API propriétaire d'IT Glue,
ni import de ses données, ni intégration déjà fonctionnelle.

Référence RMM : [cahier Community, section58.31](../TRC_RMM/CAHIER_DES_CHARGES_TRC_RMM.md).
Les décisions spécifiques de l'utilisateur priment sur les anciennes consignes
génériques de centralisation Account. Aucune licence de logiciel existant n'est
modifiée et aucun secret opérationnel n'appartient à ce document.

## 11. Socle local mis en place le 5 octobre 2026

Premier lot autonome livré dans ce dossier :

- serveur Node.js sans dépendance externe, limité à `127.0.0.1:9092`;
- comptes locaux administrables, rôles administrateur/éditeur/lecture seule;
- mot de passe dérivé avec `scrypt`, MFA TOTP obligatoire à la première connexion
  et codes de récupération à usage unique;
- organisations, sites, configurations, procédures, relations, recherche et
  journal d'activité, avec données initiales modifiables;
- interface FR/EN, thèmes clair/sombre, responsive, utilisant TRC Style 1.1.1 et
  le logo Atlas fourni le 5 octobre 2026;
- données JSON locales versionnées et écrites atomiquement pour ce premier lot.

TRC Account est totalement exclu du produit. Le connecteur de données et le SSO
OIDC via TRC RMM restent deux options séparées, configurables, désactivées par
défaut et prévues à la fin du projet. Ils ne sont ni simulés ni actifs dans ce lot.

Les limites du premier lot et les instructions reproductibles sont consignées
dans `README.md` et `docs/ARCHITECTURE.md`.
