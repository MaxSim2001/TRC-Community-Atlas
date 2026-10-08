# Installation Windows — TRC Community Atlas

Version du guide : 0.13.2

## Parcours recommandé

1. Télécharger l’artéfact `TRC-Atlas-Windows-…` d’une exécution GitHub Actions
   réussie du dépôt officiel.
2. Décompresser complètement le ZIP téléchargé.
3. Ouvrir le dossier `TRC Community Atlas 0.13.2`.
4. Double-cliquer sur `Installer-Atlas.cmd`.
5. Choisir le port, les dossiers et les options dans le configurateur.
6. Cliquer sur **Installer Atlas**.
7. Dans le navigateur, créer le premier compte administrateur et activer son MFA.

Le paquet contient son propre runtime Node.js. Aucun compte cloud, abonnement,
télémétrie ou connexion à TRC Account n’est requis.

## Configuration graphique

Le configurateur propose tous les choix nécessaires sans modifier le réseau de
Windows à la place de l’administrateur :

- accès limité à cet ordinateur, recommandé, ou écoute réseau avancée;
- adresse d’écoute et port Atlas entre `1024` et `65535`;
- test local de disponibilité du port choisi;
- origines HTTPS autorisées pour un proxy inverse;
- dossiers distincts pour le programme et les données persistantes;
- démarrage automatique masqué, raccourcis et canal `stable` ou `beta`.

Le mode local utilise `127.0.0.1`. Le mode réseau affiche un avertissement et
n’ouvre jamais le pare-feu, le routeur, le DNS ou le certificat. Pour modifier
une installation existante, ouvrir **Configurer TRC Community Atlas** depuis le
menu Démarrer. Le configurateur recharge les valeurs enregistrées et vérifie le
nouveau port avant de relancer Atlas.

### Combien de ports faut-il?

Un seul port Atlas est nécessaire. L’interface Web et l’API utilisent ensemble
le même listener HTTP. La base SQLite est le fichier local `atlas.sqlite`; elle
n’exécute aucun serveur et n’utilise donc aucun port.

Avec un proxy inverse, le navigateur rejoint habituellement le port public
HTTPS `443`, puis Nginx, IIS ou Caddy transmet la requête vers l’unique port
Atlas interne choisi, par exemple `9092`. Le port public du proxy n’est pas un
deuxième port à configurer dans Atlas.

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

Deux raccourcis sont ajoutés au menu Démarrer : `TRC Community Atlas` ouvre
l’instance dans le navigateur, et `Configurer TRC Community Atlas` rouvre le
configurateur. Changer uniquement le port arrête proprement l’ancien listener,
réutilise le même dossier de données et conserve la base SQLite.

Le super administrateur peut ensuite gérer la même tâche depuis
**Paramètres > Configuration initiale > Démarrage Windows**. Le bouton
**Configurer et appliquer** demande le MFA lorsque la politique renforcée est
active. **Santé du site** affiche l’état réel de la tâche et propose
**Tester le port local**, limité au listener Atlas courant sur cet ordinateur.
Ces actions n’ouvrent aucun port et ne modifient pas le pare-feu.

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
- `-Channel stable` ou `-Channel beta` enregistre le canal de mise à jour;
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
5. relancer le configurateur pour réparer uniquement les fichiers du programme.

## Statut de distribution

Le paquet produit par GitHub Actions sert actuellement à la validation. La
Release stable signée, la désinstallation guidée et le bouton de mise à jour
avec sauvegarde, validation et retour arrière restent les prochains lots.
