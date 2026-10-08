# TRC Community Atlas — règles de travail

## Sources de vérité

Lire `CAHIER_DES_CHARGES_TRC_COMMUNITY_ATLAS.md`, `README.md` et
`docs/ARCHITECTURE.md` avant toute modification. Consulter `TRC_Style` en lecture
seule pour l'interface; ne jamais créer une dépendance de build vers son chemin
Windows absolu.

## Frontières obligatoires

- Atlas ne doit avoir aucun lien ni aucune dépendance à TRC Account.
- Comptes, MFA, rôles, organisations, sessions et données appartiennent à Atlas.
- TRC Community RMM reste autonome.
- Le connecteur RMM et le SSO OIDC via RMM sont facultatifs, configurables,
  indépendants et désactivés par défaut.
- Le SSO RMM sera traité à la fin du projet; ne pas le simuler comme actif.
- Ne jamais lire ou écrire directement la base d'un autre produit.

## Environnement

Travailler uniquement dans cette VM. Aucun accès aux autres machines du LAN,
routeur, DNS, firewall réseau ou service public sans autorisation explicite.
L'application locale écoute par défaut sur `127.0.0.1:9092`; vérifier que le port
est libre avant chaque démarrage. Aucun secret dans Git, les logs ou l'historique
shell. Aucun appel sortant, CDN, police distante ou télémétrie.

## Qualité

Préserver l'authentification locale lorsque le SSO n'est pas configuré. Toute
évolution sensible doit vérifier les rôles, le MFA, les sessions, le CSRF,
l'isolation des données et la non-régression du fonctionnement autonome.

