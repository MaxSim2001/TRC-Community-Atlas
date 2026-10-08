# Guide opérateur — TRC Community Atlas

Version du guide : 0.13.0

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

## Vérification de santé

Avant un redémarrage ou une modification, comparer :

1. l’état de la tâche ou du processus Atlas;
2. le listener local attendu;
3. la réponse locale de `/api/status`;
4. la réponse publique, lorsqu’une publication a été autorisée;
5. les contrôles séparés dans **Paramètres > Santé du site**;
6. les journaux applicatifs et ceux du mandataire inverse.

Un problème public avec une API locale saine ne prouve pas un arrêt d’Atlas.

## Sauvegarde complète

La sauvegarde complète chiffrée inclut les comptes, le MFA, le coffre, sa clé,
SQLite et les pièces jointes. Les sessions sont volontairement exclues.

```powershell
.\scripts\Invoke-AtlasFullBackup.ps1 -Mode Create
```

La phrase secrète est saisie dans une invite protégée. Elle ne doit pas être
placée dans la commande, un journal ou un fichier non protégé.

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

## Cache navigateur et PWA

Le service worker utilise un nom de cache lié à la version. Les CSS, JavaScript
et le manifeste portent aussi une version dans leur URL. Les routes `/api/` ne
sont jamais mises en cache.

