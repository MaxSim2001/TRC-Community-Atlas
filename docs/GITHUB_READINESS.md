# GitHub — code source et état de la distribution

Le code source officiel d’Atlas est publié dans
[`MaxSim2001/TRC-Community-Atlas`](https://github.com/MaxSim2001/TRC-Community-Atlas).
Le dépôt public appartient directement au compte GitHub du propriétaire. La
version 0.15.0 introduit la première Release stable avec manifeste Ed25519,
paquet Windows autonome, contrôle SHA-256 et assistant de mise à jour
transactionnelle. Les artéfacts produits automatiquement par GitHub Actions
demeurent des artéfacts de validation; les utilisateurs doivent télécharger les
versions stables depuis **Releases**.

Le plan proposé pour l'installateur, les GitHub Releases, la vérification des
paquets, les migrations et le retour arrière est consigné dans
[`PLAN_GITHUB_INSTALL_UPDATE.md`](PLAN_GITHUB_INSTALL_UPDATE.md). Les phases de
signature du manifeste, préparation, installation et retour arrière sont
implémentées; les éléments encore ouverts y restent identifiés.

## Décisions confirmées

- dépôt officiel actuel : `MaxSim2001/TRC-Community-Atlas`;
- titulaire : TheRisingCloud;
- licence : TRC Community Atlas Source-Available License 1.0; utilisation
  personnelle, professionnelle et MSP gratuite, revente et commercialisation
  d'Atlas interdites sans autorisation écrite;
- contributions externes : cession de droits signée avant fusion;
- plateformes initiales : Windows 10 et Windows 11 x64;
- signature de manifeste : Ed25519 avec clé privée chiffrée et ACL locale
  restreinte, clé publique embarquée dans Atlas;
- signature Authenticode publique cible : Azure Artifact Signing; certificat
  autosigné réservé aux essais locaux;

## À compléter après la première distribution stable

- signature Authenticode reconnue par Windows pour le futur exécutable
  d’installation;
- configuration HTTPS et mandataire inverse pour les déploiements publics;
- politique de sécurité et canal de signalement des vulnérabilités;
- conventions de branches et cycle de versions;
- matrice de migration et compatibilité des sauvegardes.

## Déjà prêt

- dépôt public détenu par le propriétaire;
- workflow GitHub Actions exécutant les validations JavaScript et les tests sur Windows;
- installation guidée en un double-clic avec runtime Node.js inclus;
- séparation du programme et des données persistantes;
- test de déploiement propre sur le port 9095;
- génération du ZIP Windows et de son SHA-256 comme artéfacts de validation;
- manifeste JSON signé Ed25519, seconde vérification avant mutation et
  téléchargements limités aux hôtes GitHub approuvés;
- mise à jour avec contrôle MFA, confirmation exacte, instantané du programme et
  des données, inventaire avant/après et retour arrière automatique testé;
- [preuve QA du cycle signé et du retour arrière](QA_SIGNED_UPDATE_2026-10-09.md);
- README fonctionnel;
- architecture et frontières d’autonomie;
- guides utilisateur, sécurité et exploitation;
- tests automatisés du serveur et de l’interface;
- actifs locaux versionnés, PWA sans cache des API et absence de télémétrie.

## Règle documentaire

Le centre d’aide pointe vers le dépôt officiel et distingue les artéfacts de CI
des Releases stables. Une version n’est présentée comme installable qu’après
validation Ed25519 du manifeste et du SHA-256 du paquet. Atlas 0.15.0 est la
version d’amorçage : son installation initiale est manuelle; le bouton intégré
sert aux versions stables ultérieures.

Une validation juridique indépendante de cette licence personnalisée demeure
recommandée, sans être une condition technique de publication. Atlas doit être
présenté comme un logiciel « source disponible »,
jamais comme un logiciel open source approuvé par l'OSI. Le détail des usages MSP
permis et des offres interdites est consigné dans [`LICENSING.md`](LICENSING.md).

