[CmdletBinding()]
param(
    [ValidateRange(1024, 65535)]
    [int]$Port = 9092,

    [ValidatePattern('^[a-zA-Z0-9.:-]+$')]
    [string]$BindAddress = '127.0.0.1',

    [string[]]$AllowedOrigin = @()
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverPath = Join-Path $projectRoot 'server.mjs'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else { $null }

if (-not $nodePath) {
    $userProfilePath = [Environment]::GetFolderPath('UserProfile')
    $bundledNode = Join-Path $userProfilePath '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    if (Test-Path -LiteralPath $bundledNode) {
        $nodePath = (Get-Item -LiteralPath $bundledNode).FullName
    }
}

if (-not $nodePath) {
    throw 'Node.js 22 ou plus récent est requis. Aucun exécutable Node.js local n’a été trouvé.'
}

$serverArguments = @($serverPath, '--port', [string]$Port, '--host', $BindAddress)
foreach ($origin in $AllowedOrigin) {
    $serverArguments += @('--origin', $origin)
}

Write-Host "TRC Community Atlas démarre sur http://${BindAddress}:$Port" -ForegroundColor Cyan
if ($AllowedOrigin.Count -gt 0) {
    Write-Host "Origines autorisées : $($AllowedOrigin -join ', ')" -ForegroundColor DarkCyan
}
Write-Host 'Appuyez sur Ctrl+C pour arrêter le serveur.' -ForegroundColor DarkGray
& $nodePath @serverArguments

