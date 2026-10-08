[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$Path,

    [Parameter(Mandatory)]
    [ValidatePattern('^[A-Fa-f0-9]{40,64}$')]
    [string]$Thumbprint,

    [string]$TimestampServer
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$artifactPath = (Resolve-Path -LiteralPath $Path -ErrorAction Stop).ProviderPath
$normalizedThumbprint = ($Thumbprint -replace '\s', '').ToUpperInvariant()
$certificatePath = "Cert:\CurrentUser\My\$normalizedThumbprint"
$certificate = Get-Item -LiteralPath $certificatePath -ErrorAction Stop

if (-not $certificate.HasPrivateKey) {
    throw "Le certificat $normalizedThumbprint ne possède pas de clé privée accessible."
}
if (-not ($certificate.EnhancedKeyUsageList | Where-Object { $_.ObjectId -eq '1.3.6.1.5.5.7.3.3' })) {
    throw "Le certificat $normalizedThumbprint n'est pas autorisé pour la signature de code."
}
if ($certificate.NotAfter -le (Get-Date)) {
    throw "Le certificat $normalizedThumbprint est expiré."
}

$signingParameters = @{
    FilePath = $artifactPath
    Certificate = $certificate
    HashAlgorithm = 'SHA256'
}

if ($TimestampServer) {
    $timestampUri = $null
    if (-not [Uri]::TryCreate($TimestampServer, [UriKind]::Absolute, [ref]$timestampUri) -or
        $timestampUri.Scheme -notin @('http', 'https')) {
        throw 'TimestampServer doit être une URL HTTP ou HTTPS absolue.'
    }
    $signingParameters.TimestampServer = $timestampUri.AbsoluteUri
}

$signature = Set-AuthenticodeSignature @signingParameters
if (-not $signature.SignerCertificate -or
    $signature.SignerCertificate.Thumbprint -ne $normalizedThumbprint -or
    $signature.Status -in @('NotSigned', 'HashMismatch', 'NotSupported')) {
    throw "La signature Authenticode a échoué : $($signature.Status) — $($signature.StatusMessage)"
}

[pscustomobject]@{
    Path = $artifactPath
    Thumbprint = $signature.SignerCertificate.Thumbprint
    Status = $signature.Status
    StatusMessage = $signature.StatusMessage
    Timestamped = [bool]$signature.TimeStamperCertificate
    Sha256 = (Get-FileHash -LiteralPath $artifactPath -Algorithm SHA256).Hash
}
