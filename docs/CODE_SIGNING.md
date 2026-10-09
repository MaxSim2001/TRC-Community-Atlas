# Signing Windows releases

## Two trust layers

Atlas Releases use an **Ed25519-signed manifest**. Atlas embeds only the public
key, verifies the manifest signature, and then verifies the ZIP size and
SHA-256. The encrypted private key and its DPAPI-protected passphrase remain in
`%ProgramData%\TRC\AtlasReleaseSigning`, outside the repository, with ACLs
limited to the publishing administrator, `SYSTEM`, and Administrators.

The complementary target for Windows 10 and Windows 11 reputation is **Azure
Artifact Signing** under TheRisingCloud's verified publisher identity.
Authenticode protects the future Windows executable; it does not replace the
internal Ed25519 update-chain verification.

## Initialize the manifest key

Run once on the controlled publishing computer:

~~~powershell
.\scripts\Initialize-AtlasReleaseSigning.ps1
~~~

Build, sign, and re-verify a Release:

~~~powershell
.\scripts\New-AtlasSignedRelease.ps1
~~~

The command produces the Windows ZIP, `SHA256SUMS.txt`,
`atlas-release-manifest.json`, and `atlas-release-manifest.sig`. The scripts
must never place a passphrase in a command line, Git, or logs.

## Development certificate

A self-signed certificate must never be presented as publicly trusted. Windows
does not trust it by default. It is only for locally testing build, signing,
verification, and tamper rejection.

Create or locate the non-exportable local certificate:

~~~powershell
.\scripts\New-AtlasDevelopmentSigningCertificate.ps1
~~~

The private key remains in `Cert:\CurrentUser\My`. Do not place a PFX file or a
certificate password in Git, logs, or plaintext GitHub variables.

Sign a test artifact:

~~~powershell
.\scripts\Sign-AtlasWindowsArtifact.ps1 `
  -Path .\dist\TRC-Atlas-Setup-test.exe `
  -Thumbprint CERTIFICATE_THUMBPRINT
~~~

Verify its presence and identity:

~~~powershell
.\scripts\Test-AtlasWindowsArtifactSignature.ps1 `
  -Path .\dist\TRC-Atlas-Setup-test.exe `
  -ExpectedThumbprint CERTIFICATE_THUMBPRINT
~~~

Use `-RequireTrusted` only with the recognized public certificate or on a test
machine where the development root was deliberately installed.

## Public Authenticode work

Before describing a future executable as trusted by Windows:

1. Create Azure Artifact Signing under TheRisingCloud.
2. Complete Microsoft's publisher identity verification.
3. Limit signing access to the protected GitHub release workflow.
4. Require human approval for the `release` environment.
5. Sign executables with SHA-256 and a trusted timestamp.
6. Verify Authenticode, SHA-256, and GitHub attestation after download.
7. Publish only after clean Windows 10 and Windows 11 installation tests pass.

Azure configuration uses an external identity and may involve cost. The account
owner must complete it; no Azure secret belongs in the repository or on end-user
computers.

## Rotation and incidents

- Record every key or certificate identity and validity period.
- Permit multiple public keys only during a controlled rotation.
- Stop publishing immediately if a key or signing account may be compromised.
- Revoke the affected key, publish a security notice, and issue a new version.
- Never silently replace an artifact attached to an existing Release.
