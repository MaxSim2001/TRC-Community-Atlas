[CmdletBinding()]
param(
    [string]$SigningRoot = "$env:ProgramData\TRC\AtlasReleaseSigning",
    [string]$PublicKeyOutput = '',
    [string]$NodePath = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $PublicKeyOutput) { $PublicKeyOutput = Join-Path $projectRoot 'resources\atlas-release-public-key.pem' }
if (-not $NodePath) { $NodePath = (Get-Command node -ErrorAction Stop).Source }
$SigningRoot = [IO.Path]::GetFullPath($SigningRoot)
$PublicKeyOutput = [IO.Path]::GetFullPath($PublicKeyOutput)
$privateKeyPath = Join-Path $SigningRoot 'atlas-release-private-key.pem'
$secretPath = Join-Path $SigningRoot 'atlas-release-signing-secret.clixml'
if ((Test-Path -LiteralPath $privateKeyPath) -or (Test-Path -LiteralPath $PublicKeyOutput)) {
    throw 'Une clé de signature existe déjà. Atlas refuse de la remplacer.'
}

New-Item -ItemType Directory -Path $SigningRoot -Force | Out-Null
New-Item -ItemType Directory -Path (Split-Path -Parent $PublicKeyOutput) -Force | Out-Null
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$acl = New-Object Security.AccessControl.DirectorySecurity
$acl.SetAccessRuleProtection($true, $false)
foreach ($sid in @($identity.User, [Security.Principal.SecurityIdentifier]'S-1-5-18', [Security.Principal.SecurityIdentifier]'S-1-5-32-544')) {
    $rule = New-Object Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    $acl.AddAccessRule($rule)
}
Set-Acl -LiteralPath $SigningRoot -AclObject $acl

$random = $null
if (Test-Path -LiteralPath $secretPath -PathType Leaf) {
    $secure = Import-Clixml -LiteralPath $secretPath
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $passphrase = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) } }
}
else {
    $random = [byte[]]::new(48)
    [Security.Cryptography.RandomNumberGenerator]::Fill($random)
    $passphrase = [Convert]::ToBase64String($random)
    $secure = ConvertTo-SecureString -String $passphrase -AsPlainText -Force
    $secure | Export-Clixml -LiteralPath $secretPath
}
$helper = Join-Path $PSScriptRoot 'atlas-release-sign.mjs'
$result = $passphrase | & $NodePath $helper generate-key --private $privateKeyPath --public $PublicKeyOutput
if ($LASTEXITCODE -ne 0) { throw 'La génération de la clé de publication Atlas a échoué.' }
$passphrase = $null
if ($random) { $random.AsSpan().Clear() }

[pscustomobject]@{
    SigningRoot = $SigningRoot
    PrivateKey = $privateKeyPath
    ProtectedSecret = $secretPath
    PublicKey = $PublicKeyOutput
    Fingerprint = ($result | ConvertFrom-Json).fingerprint
}
