# Validation de la chaîne de mise à jour signée — 9 octobre 2026

## Portée

- plateforme : Windows, Node.js 24;
- instance isolée sur `127.0.0.1:9095`;
- aucune donnée de production utilisée;
- compte, MFA et secret de coffre entièrement factices;
- tâche planifiée QA distincte de la tâche Atlas de production.

## Résultats

1. Installation propre d’Atlas 0.15.0 avec données séparées du programme.
2. Création d’un compte administrateur avec MFA et d’un secret AES-256-GCM
   factice servant de témoin de déchiffrement.
3. Construction d’un paquet 0.15.1, manifeste signé Ed25519 et contrôle SHA-256.
4. Mise à jour 0.15.0 vers 0.15.1 : **réussie**.
5. Contrôles après redémarrage : version 0.15.1, `PRAGMA quick_check = ok`,
   secret témoin déchiffrable et compteurs métier inchangés.
6. Construction d’un paquet 0.15.2 valide, puis injection volontaire d’un échec
   de santé immédiatement après son démarrage.
7. Retour automatique vers 0.15.1 : **réussi**.
8. Contrôles après retour arrière : version 0.15.1, SQLite valide, coffre
   déchiffrable et compteurs métier inchangés.

Le scénario est reproductible avec :

```powershell
.\scripts\Test-AtlasSignedUpdateLifecycle.ps1 `
  -Port 9095 `
  -NodePath (Get-Command node).Source
```

Le script refuse de démarrer si le port est occupé, conserve les preuves sous un
dossier temporaire daté, utilise une tâche Windows au nom aléatoire et retire
cette tâche à la fin du test. Il ne balaie pas le réseau et ne modifie pas le
pare-feu, le DNS ou le proxy.
