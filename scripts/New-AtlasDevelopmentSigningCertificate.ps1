[CmdletBinding()]
param(
    [string]$Subject = 'CN=TheRisingCloud TRC Community Atlas Development',
    [ValidateRange(1, 5)]
    [int]$ValidYears = 2
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$minimumValidity = (Get-Date).AddDays(30)
$existing = Get-ChildItem -Path Cert:\CurrentUser\My |
    Where-Object {
        $_.Subject -eq $Subject -and
        $_.HasPrivateKey -and
        $_.NotAfter -gt $minimumValidity -and
        ($_.EnhancedKeyUsageList | Where-Object { $_.ObjectId -eq '1.3.6.1.5.5.7.3.3' })
    } |
    Sort-Object NotAfter -Descending |
    Select-Object -First 1

$created = $false
if (-not $existing) {
    $existing = New-SelfSignedCertificate `
        -Type CodeSigningCert `
        -Subject $Subject `
        -FriendlyName 'TRC Community Atlas - signature de développement' `
        -CertStoreLocation 'Cert:\CurrentUser\My' `
        -HashAlgorithm SHA256 `
        -KeyAlgorithm RSA `
        -KeyLength 3072 `
        -KeyUsage DigitalSignature `
        -KeyExportPolicy NonExportable `
        -NotAfter (Get-Date).AddYears($ValidYears)
    $created = $true
}

[pscustomobject]@{
    Created = $created
    Subject = $existing.Subject
    Thumbprint = $existing.Thumbprint
    NotBefore = $existing.NotBefore
    NotAfter = $existing.NotAfter
    Store = 'Cert:\CurrentUser\My'
    HasPrivateKey = $existing.HasPrivateKey
    PubliclyTrusted = $false
    IntendedUse = 'Développement et tests locaux seulement'
}
