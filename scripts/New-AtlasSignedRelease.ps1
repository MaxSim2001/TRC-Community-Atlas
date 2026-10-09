[CmdletBinding()]
param(
    [string]$OutputDirectory = '',
    [string]$SigningRoot = "$env:ProgramData\TRC\AtlasReleaseSigning",
    [string]$NodePath = '',
    [string]$CurrentVersion = '0.15.3'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $projectRoot 'dist\release' }
if (-not $NodePath) { $NodePath = (Get-Command node -ErrorAction Stop).Source }
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$package = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
$version = [string]$package.version
$privateKeyPath = Join-Path $SigningRoot 'atlas-release-private-key.pem'
$secretPath = Join-Path $SigningRoot 'atlas-release-signing-secret.clixml'
$publicKeyPath = Join-Path $projectRoot 'resources\atlas-release-public-key.pem'
foreach ($required in @($privateKeyPath, $secretPath, $publicKeyPath)) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Fichier de signature requis absent : $required" }
}

$built = & (Join-Path $PSScriptRoot 'New-TRCCommunityAtlasPortablePackage.ps1') -OutputDirectory $OutputDirectory -NodePath $NodePath
$archivePath = [string]$built.Archive
$manifestPath = Join-Path $OutputDirectory 'atlas-release-manifest.json'
$signaturePath = Join-Path $OutputDirectory 'atlas-release-manifest.sig'
$helper = Join-Path $PSScriptRoot 'atlas-release-sign.mjs'
& $NodePath $helper manifest --package $archivePath --output $manifestPath --version $version --public $publicKeyPath | Out-Null

$secure = Import-Clixml -LiteralPath $secretPath
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $passphrase = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    $passphrase | & $NodePath $helper sign --private $privateKeyPath --manifest $manifestPath --signature $signaturePath | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'La signature du manifeste Atlas a échoué.' }
}
finally {
    if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    $passphrase = $null
}

$verifyScript = Join-Path $PSScriptRoot 'Test-AtlasSignedRelease.mjs'
$verification = & $NodePath $verifyScript --manifest $manifestPath --signature $signaturePath --package $archivePath --public $publicKeyPath --current $CurrentVersion
if ($LASTEXITCODE -ne 0) { throw 'La vérification indépendante de la Release signée a échoué.' }
[pscustomobject]@{
    Version = $version
    Archive = $archivePath
    Manifest = $manifestPath
    Signature = $signaturePath
    HashFile = [string]$built.HashFile
    Verification = ($verification | ConvertFrom-Json)
}
