# Sécurité et accès — TRC Community Atlas

Version du guide : 0.15.4

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

Les échecs de mot de passe et de MFA sont limités séparément par compte et par
adresse cliente. Ces compteurs sont conservés localement sous forme de sujets
hachés afin qu’un redémarrage ne réinitialise pas la protection. Un défi MFA
expire après cinq minutes et devient inutilisable après cinq codes incorrects.
Atlas retourne alors `429` avec un délai de reprise.

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

## Proxy et surface publique

Atlas ne fait confiance à aucun en-tête de proxy par défaut. Le super
administrateur doit déclarer l’adresse IP exacte de chaque proxy dans
**Paramètres > Configuration initiale**. Les en-têtes `X-Forwarded-For`,
`X-Real-IP`, `CF-Connecting-IP`, `X-Forwarded-Proto` et `X-Forwarded-Host` sont
ignorés lorsqu’ils viennent d’une autre adresse.

`/api/status` publie uniquement `{ "ok": true }`. Le diagnostic détaillé
`/api/status/details` est réservé aux connexions provenant de la VM. Les chemins
non publiés retournent un vrai `404`; ils ne reçoivent jamais le shell HTML.

Les corps JSON sensibles sont limités à 8 Kio, les requêtes ordinaires à
256 Kio, les imports à 16 Mio et l’enveloppe des pièces jointes à 12 Mio.

## Récupération

La récupération hors bande est locale, réservée à un administrateur et doit
commencer par un mode de simulation. Elle conserve une sauvegarde datée, invalide
les sessions concernées et force un nouveau mot de passe ainsi qu’un nouvel
enrôlement MFA.

