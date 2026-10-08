[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$Path,

    [ValidatePattern('^[A-Fa-f0-9]{40,64}$')]
    [string]$ExpectedThumbprint,

    [switch]$RequireTrusted
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$artifactPath = (Resolve-Path -LiteralPath $Path -ErrorAction Stop).ProviderPath
$signature = Get-AuthenticodeSignature -LiteralPath $artifactPath

if (-not $signature.SignerCertificate -or
    $signature.Status -in @('NotSigned', 'HashMismatch', 'NotSupported')) {
    throw "Signature Authenticode refusée : $($signature.Status) — $($signature.StatusMessage)"
}

if ($ExpectedThumbprint) {
    $normalizedThumbprint = ($ExpectedThumbprint -replace '\s', '').ToUpperInvariant()
    if ($signature.SignerCertificate.Thumbprint -ne $normalizedThumbprint) {
        throw "Le signataire ne correspond pas au certificat attendu $normalizedThumbprint."
    }
}

if ($RequireTrusted -and $signature.Status -ne 'Valid') {
    throw "La signature est présente, mais Windows ne la considère pas fiable : $($signature.Status)."
}

[pscustomobject]@{
    Path = $artifactPath
    Subject = $signature.SignerCertificate.Subject
    Thumbprint = $signature.SignerCertificate.Thumbprint
    Status = $signature.Status
    StatusMessage = $signature.StatusMessage
    Trusted = $signature.Status -eq 'Valid'
    Timestamped = [bool]$signature.TimeStamperCertificate
    Sha256 = (Get-FileHash -LiteralPath $artifactPath -Algorithm SHA256).Hash
}
