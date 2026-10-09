# Guide opérateur — TRC Community Atlas

Version du guide : 0.15.0

## Port et configuration de l’instance

Atlas utilise un seul port pour son interface et son API. SQLite est un fichier
local et n’ouvre aucun port de base de données. Le port par défaut est `9092`.

Ouvrir **Configurer TRC Community Atlas** dans le menu Démarrer pour relire et
modifier l’adresse d’écoute, le port, les origines HTTPS, les dossiers, le canal
ou le démarrage automatique. Un changement de port arrête uniquement le
processus Atlas identifié, conserve le même dossier `data` et relance le contrôle
de santé sur la nouvelle adresse. Aucun pare-feu, DNS ou proxy n’est modifié.

L’état enregistré se trouve dans
`%LOCALAPPDATA%\TRC Community Atlas\config\instance.json` avec les emplacements
par défaut. Une installation utilisant un dossier de données personnalisé garde
son fichier `instance.json` à côté de ce dossier et le programme conserve un
pointeur local vers cette configuration.

## Configuration initiale du domaine

Dans **Paramètres > Configuration initiale**, distinguer toujours :

- le code court de l’instance, par exemple `ABC`;
- le domaine public complet, par exemple `atlas.abcp.com`;
- les domaines secondaires facultatifs;
- le proxy inverse réellement utilisé : Nginx, IIS, Caddy ou autre.

Atlas enregistre ces noms et autorise leurs origines HTTPS. Il ne crée pas
l’entrée DNS, n’installe pas le certificat et ne modifie aucun pare-feu. La clé
privée TLS reste uniquement dans le proxy inverse. Celui-ci doit transmettre
`X-Forwarded-Proto: https` et le nom demandé à Atlas.

Le bouton **Tester le domaine public** est volontairement manuel. Il appelle
uniquement `https://<domaine-enregistré>/api/status`, ne suit aucune redirection,
valide TLS et refuse les domaines qui résolvent vers une adresse locale, privée,
réservée ou de test. Il ne remplace pas une vérification indépendante du DNS et
du proxy.

## Démarrage automatique depuis Atlas

Dans **Paramètres > Configuration initiale**, le super administrateur peut
activer ou désactiver **Démarrer Atlas automatiquement**, saisir son code MFA
si la validation renforcée est active, puis choisir **Configurer et appliquer**.
Atlas crée ou met à jour la tâche Windows masquée `TRC Community Atlas`. Avec
des droits administrateur, elle utilise le déclencheur de démarrage et le compte
`SYSTEM`; sinon, elle utilise l’ouverture de session du compte Windows courant.

Cette action ne redémarre pas le processus actif et ne modifie ni le pare-feu,
ni le DNS, ni le proxy. Elle reprend exactement le port, l’adresse d’écoute, les
origines HTTPS et le dossier de données de l’instance courante. Désactiver
l’option conserve la tâche de façon réversible, mais la désactive.

## Vérification de santé

Avant un redémarrage ou une modification, comparer :

1. l’état de la tâche ou du processus Atlas;
2. le listener local attendu;
3. la réponse locale de `/api/status`;
4. la réponse publique, lorsqu’une publication a été autorisée;
5. les contrôles séparés dans **Paramètres > Santé du site**;
6. les journaux applicatifs et ceux du mandataire inverse.

Le bouton **Tester le port local** ouvre une connexion TCP seulement vers le
listener réellement utilisé par le processus Atlas courant et sur cet
ordinateur. Il n’accepte aucune adresse fournie par l’utilisateur, ne balaie
aucun autre port et ne contacte aucune autre machine du réseau.

Un problème public avec une API locale saine ne prouve pas un arrêt d’Atlas.

## Sauvegarde complète

La sauvegarde complète chiffrée inclut les comptes, le MFA, le coffre, sa clé,
SQLite et les pièces jointes. Les sessions sont volontairement exclues.

```powershell
.\scripts\Invoke-AtlasFullBackup.ps1 -Mode Create
```

La phrase secrète est saisie dans une invite protégée. Elle ne doit pas être
placée dans la commande, un journal ou un fichier non protégé.

Le super administrateur peut aussi utiliser **Paramètres > Sauvegardes**. Cette
page permet de choisir un dossier absolu local ou UNC, une exécution quotidienne
ou hebdomadaire et une rétention facultative. La phrase secrète planifiée est
chiffrée avec DPAPI pour le compte Windows qui exécute Atlas. Elle n’est ni
retournée par l’API ni affichée après enregistrement. Le planificateur fonctionne
seulement lorsque le service Atlas est actif; activer le démarrage automatique
Windows est donc recommandé.

La rétention est désactivée par défaut. Lorsqu’elle est activée, Atlas ne retire
que les anciens fichiers portant exactement son préfixe de sauvegarde gérée et
ne touche à aucun autre fichier dans le dossier. Chaque fichier existant peut
être déchiffré et contrôlé en mémoire depuis la page, sans écrire de restauration.

Valider périodiquement une sauvegarde sans la restaurer :

```powershell
.\scripts\Invoke-AtlasFullBackup.ps1 -Mode Inspect -InputPath .\backups\TRC_Community_Atlas_Full_Backup_YYYY-MM-DD_HH-mm-ss.trcatlas
```

## Restauration

Arrêter Atlas avant la restauration. Le processus demande la confirmation exacte
`RESTORE_ATLAS`, conserve l’état remplacé dans un dossier de sécurité daté puis
invalide toutes les sessions.

## Import/export

L’export JSON est documentaire. Il exclut les comptes, le MFA, les sessions, le
coffre et les fichiers binaires. L’import remplace le workspace actif après avoir
créé une révision de retour arrière. Il ne remplace pas une sauvegarde complète.

## Mise à jour

Avant chaque mise à jour :

- créer une sauvegarde datée sans écraser les précédentes;
- conserver le dossier `data/` de production;
- mettre à jour les URL versionnées des actifs publics;
- exécuter les tests sur les fichiers déployés;
- vérifier la version locale et publique après redémarrage.

La page **Paramètres > Mises à jour** vérifie manuellement l’API officielle
GitHub. **Télécharger et vérifier** récupère uniquement le manifeste, sa
signature et le paquet depuis des hôtes GitHub approuvés, sans modifier le
programme actif. Atlas contrôle Ed25519, la taille et SHA-256. **Installer**
exige ensuite un super administrateur, le MFA et la confirmation exacte
`INSTALLER <version>`. L’assistant crée un instantané, redémarre Atlas, vérifie
SQLite, le coffre et les compteurs métier, puis restaure automatiquement la
version antérieure si un contrôle échoue. Aucune installation n’est automatique.

## API locale facultative

Dans **Paramètres > Intégrations**, le super administrateur peut activer une API
de lecture et créer des jetons limités aux portées `read:health`,
`read:organizations` et `read:records`. Les jetons utilisent le port Atlas
existant, peuvent être limités à certaines compagnies et sont affichés une seule
fois. Atlas n’enregistre que leur empreinte SHA-256. Le coffre, les mots de
passe, les OTP, les notes rapides, les pièces jointes et le MFA ne sont jamais
retournés par ces routes. La création, l’activation et la révocation sont
protégées par la politique MFA renforcée et journalisées.

La même page peut émettre des webhooks signés pour les modifications du
workspace et les résultats de sauvegarde. Par sécurité, une destination doit
être une URL HTTP explicite sur `localhost`, `127.0.0.1` ou `::1`; Atlas refuse
les adresses du LAN et Internet. Le secret HMAC est affiché une seule fois et
chiffré localement dans le registre Atlas.

## Cache navigateur et PWA

Le service worker utilise un nom de cache lié à la version. Les CSS, JavaScript
et le manifeste portent aussi une version dans leur URL. Les routes `/api/` ne
sont jamais mises en cache.

