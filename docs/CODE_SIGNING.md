# Signature des versions Windows

## Décision

La cible publique retenue pour Windows 10 et 11 est **Azure Artifact Signing**
(anciennement Trusted Signing), avec identité de publication TheRisingCloud.
Une chaîne de développement locale permet de tester Authenticode avant que le
compte de signature public soit validé.

Un certificat autosigné ne doit jamais être présenté comme une signature
publique fiable. Windows ne lui fait pas confiance par défaut. Il sert seulement
à tester la fabrication, la signature, la vérification et le refus d'un fichier
altéré sur cette VM.

## Certificat de développement

Créer ou retrouver le certificat local non exportable :

```powershell
.\scripts\New-AtlasDevelopmentSigningCertificate.ps1
```

La clé privée demeure dans `Cert:\CurrentUser\My`. Aucun fichier PFX et aucun
mot de passe de certificat ne doivent être placés dans Git, un journal ou une
variable GitHub en clair.

Signer un artefact de test :

```powershell
.\scripts\Sign-AtlasWindowsArtifact.ps1 `
  -Path .\dist\TRC-Atlas-Setup-test.exe `
  -Thumbprint CERTIFICATE_THUMBPRINT
```

Vérifier sa présence et son identité :

```powershell
.\scripts\Test-AtlasWindowsArtifactSignature.ps1 `
  -Path .\dist\TRC-Atlas-Setup-test.exe `
  -ExpectedThumbprint CERTIFICATE_THUMBPRINT
```

`-RequireTrusted` est réservé au certificat public reconnu ou à une machine de
test sur laquelle la racine de développement a été installée volontairement.

## Production

Avant une release stable :

1. créer le compte Azure Artifact Signing au nom de TheRisingCloud;
2. compléter la vérification d'identité exigée par Microsoft;
3. limiter l'accès de signature au workflow GitHub protégé;
4. exiger une approbation humaine pour l'environnement `release`;
5. signer l'installateur et les exécutables avec SHA-256 et horodatage;
6. vérifier Authenticode, SHA-256 et l'attestation GitHub après téléchargement;
7. ne publier la release qu'après réussite de l'installation sur Windows 10 et 11.

La configuration Azure implique une identité externe et possiblement des frais.
Elle doit être réalisée par le propriétaire du compte; aucun secret Azure ne
doit être conservé dans le dépôt ou sur les machines des utilisateurs.

## Rotation et incident

- consigner l'identité et la période de validité de chaque certificat;
- autoriser plusieurs clés publiques pendant une rotation contrôlée;
- arrêter les publications si une clé ou un compte de signature est compromis;
- révoquer la clé, publier un avis de sécurité et produire une nouvelle version;
- ne jamais remplacer silencieusement un artefact attaché à une release existante.
