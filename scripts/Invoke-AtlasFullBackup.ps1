[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('Create', 'Inspect', 'Restore')]
    [string]$Mode,

    [string]$DataRoot = (Join-Path (Split-Path -Parent $PSScriptRoot) 'data'),
    [string]$InputPath,
    [string]$OutputPath
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else { $null }
if (-not $nodePath) {
    $bundledNode = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    if (Test-Path -LiteralPath $bundledNode) { $nodePath = (Get-Item -LiteralPath $bundledNode).FullName }
}
if (-not $nodePath) { throw 'Node.js 22 ou plus récent est requis.' }

$securePassphrase = Read-Host 'Phrase secrète de la sauvegarde (12 caractères minimum)' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassphrase)
try {
    $env:ATLAS_BACKUP_PASSPHRASE = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    $scriptPath = Join-Path $PSScriptRoot 'atlas-full-backup.mjs'
    if ($Mode -eq 'Create') {
        if (-not $OutputPath) {
            $backupRoot = Join-Path $projectRoot 'backups'
            New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
            $stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
            $OutputPath = Join-Path $backupRoot "TRC_Community_Atlas_Full_Backup_$stamp.trcatlas"
        }
        & $nodePath $scriptPath create --data $DataRoot --output $OutputPath
    } elseif ($Mode -eq 'Inspect') {
        if (-not $InputPath) { throw 'InputPath est requis en mode Inspect.' }
        & $nodePath $scriptPath inspect --input $InputPath
    } else {
        if (-not $InputPath) { throw 'InputPath est requis en mode Restore.' }
        Write-Warning 'Arrêtez le service Atlas avant la restauration. Les sessions ne seront jamais restaurées.'
        $confirmation = Read-Host 'Tapez RESTORE_ATLAS pour confirmer la restauration'
        & $nodePath $scriptPath restore --data $DataRoot --input $InputPath --confirm $confirmation
    }
    if ($LASTEXITCODE -ne 0) { throw "L'opération Atlas a échoué avec le code $LASTEXITCODE." }
} finally {
    Remove-Item Env:ATLAS_BACKUP_PASSPHRASE -ErrorAction SilentlyContinue
    if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
