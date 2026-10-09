# Guide utilisateur — TRC Community Atlas

Version du guide : 0.14.0

Ce guide accompagne le centre d’aide intégré accessible par l’icône `?` dans
l’en-tête. Atlas reste autonome, self-hosted et sans appel externe pour afficher
sa documentation.

## Parcours recommandé

1. Ouvrir ou créer une organisation.
2. Vérifier la compagnie active dans le sélecteur de recherche et le fil
   d’Ariane.
3. Activer seulement les modules utiles dans **Gérer les modules**.
4. Ajouter les sites, configurations, contacts et documents prioritaires.
5. Relier les fiches à partir du panneau **Éléments liés**.
6. Ajouter des Quick Notes seulement pour les consignes qui doivent être vues à
   chaque ouverture de la compagnie.

## Portée d’une organisation

Les listes, compteurs et créations suivent la compagnie active. Une
sous-compagnie possède ses propres sites, fiches, mots de passe et permissions;
la relation parent-enfant sert uniquement au classement et au fil d’Ariane. La
hiérarchie est limitée à trois niveaux.

## Recherche

La recherche du haut peut viser toutes les organisations accessibles ou une
compagnie précise. Les organisations correspondantes sont classées avant leurs
fiches. Les secrets du coffre ne sont jamais indexés.

Le raccourci `Ctrl+K` place le focus dans la recherche globale. Dans le centre
d’aide, la touche `/` place le focus dans la recherche documentaire.

## Documents et procédures

L’éditeur comprend les modes Écrire, Partagé et Aperçu, ainsi qu’un mode plein
écran. Il accepte les titres, listes, listes de tâches, tableaux, citations,
liens et blocs de code. La syntaxe `@nom-de-fiche` permet de préparer une
relation vers une fiche de la même compagnie.

Un mot de passe ne doit jamais être copié dans un document. Créez plutôt une
fiche dans le coffre et reliez-la au document.

## Relations

Toute fiche peut être reliée à un site, une configuration, une procédure, un mot
de passe ou une fiche des modules actifs, à condition que les deux objets
appartiennent à la même compagnie. Atlas crée le lien inverse et conserve
l’historique des ajouts et retraits.

## Archivage

Archiver retire une fiche des listes courantes sans la supprimer. Les relations
restent visibles avec leur état et la fiche peut être restaurée.

## Mobile

Atlas peut être installé comme application Web depuis un navigateur compatible.
Le cache contient uniquement le shell statique; les API et données métier restent
toujours servies par l’instance Atlas.

## Configuration initiale et santé

Le super administrateur peut activer le démarrage Windows en arrière-plan dans
**Paramètres > Configuration initiale**, puis voir l’état de la tâche dans
**Santé du site**. Le bouton **Tester le port local** vérifie seulement le port
du processus Atlas courant sur cet ordinateur; il ne teste ni le LAN ni le
pare-feu. Le test du domaine public demeure une action séparée et explicite.

## Aide intégrée

Le centre d’aide contient les guides suivants :

- concepts et navigation;
- organisations et Quick Notes;
- modules, recherche, documents et relations;
- coffre, santé des mots de passe, comptes, MFA et sessions;
- pièces jointes, versions et archivage;
- sauvegardes, import/export et PWA mobile;
- limites de l’intégration RMM;
- notes de version, diagnostic et état de préparation GitHub.

