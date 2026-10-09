[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$DataRoot,

    [Parameter(Mandatory)]
    [string]$OutputPath,

    [Parameter(Mandatory)]
    [string]$SecretPath
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $SecretPath)) { throw 'Le secret de sauvegarde planifiée est absent.' }

$projectRoot = Split-Path -Parent $PSScriptRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else { $null }
if (-not $nodePath) {
    $bundledNode = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    if (Test-Path -LiteralPath $bundledNode) { $nodePath = (Get-Item -LiteralPath $bundledNode).FullName }
}
if (-not $nodePath) { throw 'Node.js 22 ou plus récent est requis.' }

$secure = Import-Clixml -LiteralPath $SecretPath
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $env:ATLAS_BACKUP_PASSPHRASE = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    & $nodePath (Join-Path $PSScriptRoot 'atlas-full-backup.mjs') create --data $DataRoot --output $OutputPath
    if ($LASTEXITCODE -ne 0) { throw "La sauvegarde Atlas a échoué avec le code $LASTEXITCODE." }
} finally {
    Remove-Item Env:ATLAS_BACKUP_PASSPHRASE -ErrorAction SilentlyContinue
    if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
