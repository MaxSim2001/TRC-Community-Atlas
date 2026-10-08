# Installation Windows — TRC Community Atlas

Version du guide : 0.13.0

## Parcours recommandé

1. Télécharger l’artéfact `TRC-Atlas-Windows-…` d’une exécution GitHub Actions
   réussie du dépôt officiel.
2. Décompresser complètement le ZIP téléchargé.
3. Ouvrir le dossier `TRC Community Atlas 0.13.0`.
4. Double-cliquer sur `Installer-Atlas.cmd`.
5. Dans le navigateur, créer le premier compte administrateur et activer son MFA.

Le paquet contient son propre runtime Node.js. Aucun compte cloud, abonnement,
télémétrie ou connexion à TRC Account n’est requis.

## Emplacements par défaut

| Élément | Emplacement |
| --- | --- |
| Programme | `%LOCALAPPDATA%\Programs\TRC Community Atlas` |
| Données | `%LOCALAPPDATA%\TRC Community Atlas\data` |
| Configuration | `%LOCALAPPDATA%\TRC Community Atlas\config\instance.json` |
| Journaux | `%LOCALAPPDATA%\TRC Community Atlas\logs` |
| Adresse locale | `http://127.0.0.1:9092/` |

Le programme et les données sont volontairement séparés. Une réparation ou une
nouvelle copie du programme ne supprime pas `atlas.sqlite`, les comptes, le MFA,
le coffre, la clé du coffre ou les pièces jointes.

## Démarrage automatique

L’installateur crée une tâche Windows masquée qui lance directement le runtime
Node.js, sans fenêtre PowerShell sur le bureau :

- avec des droits administrateur, Atlas démarre avec Windows sous `SYSTEM`;
- avec un compte standard, Atlas démarre à l’ouverture de session de ce compte.

Un raccourci `TRC Community Atlas` est ajouté au menu Démarrer. Il ouvre
l’adresse locale de l’instance dans le navigateur par défaut.

## Installation avancée

Le script peut aussi être appelé directement :

```powershell
.\scripts\Install-TRCCommunityAtlas.ps1 `
  -Port 9095 `
  -InstallRoot 'C:\Atlas\programme' `
  -DataRoot 'D:\Atlas\donnees'
```

Options utiles :

- `-BindAddress 127.0.0.1` conserve une écoute strictement locale;
- `-AllowedOrigin https://atlas.exemple.com` autorise une origine HTTPS précise;
- `-SkipAutostart` n’installe aucune tâche Windows;
- `-SkipShortcuts` ne crée aucun raccourci;
- `-SkipStart` installe les fichiers sans démarrer Atlas;
- `-OpenBrowser` ouvre l’assistant initial après le contrôle de santé.

L’installateur ne modifie jamais le DNS, le certificat, le routeur ou le pare-feu.
Une écoute réseau et un proxy inverse doivent être configurés volontairement par
l’administrateur selon le guide d’exploitation.

## Vérification et diagnostic

Après l’installation, ouvrir `http://127.0.0.1:9092/api/status`. Une instance
neuve répond notamment avec `initialized: false`; après la création du premier
compte, cette valeur devient `true`.

En cas d’échec :

1. lire le message conservé par la fenêtre d’installation;
2. vérifier que le port choisi n’est pas déjà utilisé;
3. consulter `atlas.error.log` dans le dossier `logs` sans publier son contenu
   s’il contient des renseignements sur l’environnement;
4. ne pas supprimer le dossier `data` pour tenter une réparation;
5. relancer l’installateur pour réparer uniquement les fichiers du programme.

## Statut de distribution

Le paquet produit par GitHub Actions sert actuellement à la validation. La
Release stable signée, la désinstallation guidée et le bouton de mise à jour
avec sauvegarde, validation et retour arrière restent les prochains lots.
