# Sécurité et accès — TRC Community Atlas

Version du guide : 0.14.3

## Modèle autonome

Atlas possède ses comptes, organisations, rôles, sessions et données. Il ne
dépend pas de TRC Account. Le futur SSO fourni par TRC RMM demeure facultatif,
non configuré et désactivé par défaut.

## Comptes et permissions

Trois rôles documentaires existent : administrateur, éditeur et lecture seule.
Pour chaque compagnie, l’accès documentaire et l’accès au coffre sont séparés.
Un compte peut donc :

- modifier une compagnie;
- consulter seulement une autre compagnie;
- accéder au coffre d’une compagnie sans pouvoir modifier ses autres fiches;
- ne recevoir aucune donnée d’une compagnie non autorisée.

Les restrictions sont appliquées côté serveur au workspace, au coffre, aux
pièces jointes et aux historiques.

## MFA et sessions

Le MFA TOTP est obligatoire à la première connexion. Les codes de récupération
sont à usage unique. La session expire absolument huit heures après
l’authentification; l’activité ne prolonge pas cette échéance.

Une validation MFA déverrouille le coffre pour la session courante. Les secrets
restent masqués jusqu’à leur affichage explicite. La révélation et la copie sont
journalisées.

## Coffre

Les secrets sont chiffrés avec AES-256-GCM et une clé locale distincte. Les mots
de passe, codes OTP et notes confidentielles sont exclus :

- de la recherche documentaire;
- des relations;
- de l’export JSON;
- du cache PWA;
- des journaux applicatifs.

## Actions renforcées

La politique de MFA renforcé peut obliger une nouvelle validation pour les
actions administratives sensibles. La suppression d’une organisation exige
toujours le nom exact et une validation MFA.

## Récupération

La récupération hors bande est locale, réservée à un administrateur et doit
commencer par un mode de simulation. Elle conserve une sauvegarde datée, invalide
les sessions concernées et force un nouveau mot de passe ainsi qu’un nouvel
enrôlement MFA.

