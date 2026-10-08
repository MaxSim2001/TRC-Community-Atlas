# GitHub — code source et état de la distribution

Le code source officiel d’Atlas est publié dans
[`MaxSim2001/TRC-Community-Atlas`](https://github.com/MaxSim2001/TRC-Community-Atlas).
Le dépôt public appartient directement au compte GitHub du propriétaire. Cette
publication du code ne signifie pas encore qu’un installateur général ou un
mécanisme de mise à jour intégré est disponible.

Le plan proposé pour l'installateur, les GitHub Releases, la vérification des
paquets, les migrations et le retour arrière est consigné dans
[`PLAN_GITHUB_INSTALL_UPDATE.md`](PLAN_GITHUB_INSTALL_UPDATE.md). Il demeure un
plan tant que les décisions ci-dessous ne sont pas approuvées et implémentées.

## Décisions confirmées

- dépôt officiel actuel : `MaxSim2001/TRC-Community-Atlas`;
- titulaire : TheRisingCloud;
- licence : PolyForm Noncommercial 1.0.0, source disponible et usage commercial
  interdit sans licence écrite distincte;
- contributions externes : cession de droits signée avant fusion;
- plateformes initiales : Windows 10 et Windows 11 x64;
- signature publique cible : Azure Artifact Signing; certificat autosigné
  réservé aux essais locaux;

## À implémenter avant la première distribution installable

- installateur autonome et runtime intégré;
- méthode d’installation et de mise à jour;
- génération et rotation des secrets d’instance;
- configuration HTTPS et mandataire inverse pour les déploiements publics;
- politique de sécurité et canal de signalement des vulnérabilités;
- conventions de branches et cycle de versions;
- matrice de migration et compatibilité des sauvegardes.

## Déjà prêt

- dépôt public détenu par le propriétaire;
- workflow GitHub Actions exécutant les validations JavaScript et les tests sur Windows;
- README fonctionnel;
- architecture et frontières d’autonomie;
- guides utilisateur, sécurité et exploitation;
- tests automatisés du serveur et de l’interface;
- actifs locaux versionnés, PWA sans cache des API et absence de télémétrie.

## Règle documentaire

Le centre d’aide peut pointer vers le dépôt officiel, mais doit distinguer le
code source publié de l’installation générale encore en préparation. Aucun
installateur, paquet Release ou mécanisme de mise à jour ne doit être présenté
comme disponible avant sa validation et sa signature.

