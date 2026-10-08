[CmdletBinding()]
param(
    [string]$OutputDirectory = '',
    [string]$NodePath = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$sourceRoot = Split-Path -Parent $PSScriptRoot
if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path $sourceRoot 'dist'
}
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

if (-not $NodePath) {
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeCommand) {
        $NodePath = $nodeCommand.Source
    }
}
if (-not $NodePath -or -not (Test-Path -LiteralPath $NodePath -PathType Leaf)) {
    throw 'Un runtime Node.js Windows est requis. Utilisez -NodePath ou installez Node.js 22+.'
}

$nodeVersion = (& $NodePath --version 2>$null).Trim()
if ($nodeVersion -notmatch '^v(?<major>\d+)\.' -or [int]$Matches.major -lt 22) {
    throw "Node.js 22 ou plus recent est requis; version detectee : $nodeVersion"
}

$package = Get-Content -LiteralPath (Join-Path $sourceRoot 'package.json') -Raw | ConvertFrom-Json
$version = [string]$package.version
$archiveName = "TRC-Atlas-Portable-$version-win-x64.zip"
$archivePath = Join-Path $OutputDirectory $archiveName
$hashPath = Join-Path $OutputDirectory 'SHA256SUMS.txt'
if (Test-Path -LiteralPath $archivePath) {
    throw "Le paquet existe deja et ne sera pas remplace : $archivePath"
}

$temporaryBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$temporaryRoot = Join-Path $temporaryBase ("trc-atlas-package-" + [Guid]::NewGuid().ToString('N'))
$packageRoot = Join-Path $temporaryRoot "TRC Community Atlas $version"

try {
    New-Item -ItemType Directory -Path $packageRoot -Force | Out-Null
    foreach ($relativePath in @('server.mjs', 'package.json', 'README.md', 'LICENSE.txt', 'NOTICE.txt', 'Start-TRCCommunityAtlas.ps1', 'Install-Atlas.cmd')) {
        Copy-Item -LiteralPath (Join-Path $sourceRoot $relativePath) -Destination (Join-Path $packageRoot $relativePath) -Force
    }
    foreach ($directoryName in @('public', 'lib', 'scripts', 'docs')) {
        Copy-Item -LiteralPath (Join-Path $sourceRoot $directoryName) -Destination (Join-Path $packageRoot $directoryName) -Recurse -Force
    }
    $runtimeDirectory = Join-Path $packageRoot 'runtime'
    New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
    Copy-Item -LiteralPath $NodePath -Destination (Join-Path $runtimeDirectory 'node.exe') -Force

    @"
TRC Community Atlas $version
============================

1. Decompressez completement cette archive.
2. Double-cliquez sur Installer-Atlas.cmd.
3. Atlas demarre en arriere-plan et ouvre l'assistant initial dans votre navigateur.

Par defaut :
- adresse locale : http://127.0.0.1:9092/
- programme : %LOCALAPPDATA%\Programs\TRC Community Atlas
- donnees : %LOCALAPPDATA%\TRC Community Atlas\data

Le runtime Node.js est inclus. Aucun compte en ligne ni telemetrie ne sont requis.
"@ | Set-Content -LiteralPath (Join-Path $packageRoot 'COMMENCER-ICI.txt') -Encoding UTF8

    Compress-Archive -LiteralPath $packageRoot -DestinationPath $archivePath -CompressionLevel Optimal
}
finally {
    $resolvedTemporaryRoot = [IO.Path]::GetFullPath($temporaryRoot)
    if ($resolvedTemporaryRoot.StartsWith($temporaryBase, [StringComparison]::OrdinalIgnoreCase) -and (Split-Path -Leaf $resolvedTemporaryRoot) -like 'trc-atlas-package-*') {
        Remove-Item -LiteralPath $resolvedTemporaryRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

$hash = Get-FileHash -LiteralPath $archivePath -Algorithm SHA256
"$($hash.Hash.ToLowerInvariant())  $archiveName" | Set-Content -LiteralPath $hashPath -Encoding ASCII

[pscustomobject]@{
    Product = 'TRC Community Atlas'
    Version = $version
    NodeVersion = $nodeVersion
    Archive = $archivePath
    SizeBytes = (Get-Item -LiteralPath $archivePath).Length
    Sha256 = $hash.Hash.ToLowerInvariant()
    HashFile = $hashPath
}
