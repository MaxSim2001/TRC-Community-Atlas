[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$JobId,
    [Parameter(Mandatory)][string]$InstallRoot,
    [Parameter(Mandatory)][string]$DataRoot,
    [Parameter(Mandatory)][string]$UpdateRoot,
    [Parameter(Mandatory)][string]$PackagePath,
    [Parameter(Mandatory)][string]$ManifestPath,
    [Parameter(Mandatory)][string]$SignaturePath,
    [Parameter(Mandatory)][string]$PublicKeyPath,
    [Parameter(Mandatory)][string]$ExpectedVersion,
    [string]$TaskName = 'TRC Community Atlas',
    [ValidateRange(1024,65535)][int]$Port = 9092,
    [ValidatePattern('^[a-zA-Z0-9.:-]+$')][string]$BindAddress = '127.0.0.1',
    [string]$AllowedOrigins = '',
    [string]$TrustedProxies = '',
    [int]$ParentProcessId = 0,
    [switch]$SimulateHealthFailure
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Assert-SafeDirectory {
    param([string]$Value, [string]$Label)
    $full = [IO.Path]::GetFullPath($Value)
    if ($full -eq [IO.Path]::GetPathRoot($full) -or $full.Length -lt 8) { throw "$Label est trop large ou invalide." }
    return $full
}

function Write-JobState {
    param([string]$Status, [string]$Message, [hashtable]$Extra = @{})
    New-Item -ItemType Directory -Path (Split-Path -Parent $script:JobPath) -Force | Out-Null
    $payload = [ordered]@{
        schemaVersion = 1
        jobId = $JobId
        status = $Status
        message = $Message
        currentVersion = $script:CurrentVersion
        targetVersion = $ExpectedVersion
        snapshotPath = $script:SnapshotRoot
        updatedAt = (Get-Date).ToUniversalTime().ToString('o')
    }
    foreach ($entry in $Extra.GetEnumerator()) { $payload[$entry.Key] = $entry.Value }
    $temporary = "$script:JobPath.$PID.tmp"
    $payload | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $temporary -Encoding UTF8
    Move-Item -LiteralPath $temporary -Destination $script:JobPath -Force
}

function Get-ProgramItems {
    param([string]$Root)
    $protected = @('data','backups','config','logs','updates')
    return @(Get-ChildItem -LiteralPath $Root -Force | Where-Object { $_.Name -notin $protected })
}

function Copy-ProgramSnapshot {
    param([string]$Source, [string]$Destination)
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    foreach ($item in (Get-ProgramItems $Source)) { Copy-Item -LiteralPath $item.FullName -Destination $Destination -Recurse -Force }
}

function Clear-ProgramContent {
    param([string]$Root)
    foreach ($item in (Get-ProgramItems $Root)) { Remove-Item -LiteralPath $item.FullName -Recurse -Force }
}

function Restore-Directory {
    param([string]$Snapshot, [string]$Destination)
    if (Test-Path -LiteralPath $Destination) {
        Get-ChildItem -LiteralPath $Destination -Force | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Recurse -Force }
    }
    else { New-Item -ItemType Directory -Path $Destination -Force | Out-Null }
    if (Test-Path -LiteralPath $Snapshot) {
        Get-ChildItem -LiteralPath $Snapshot -Force | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $Destination -Recurse -Force }
    }
}

function Wait-AtlasStatus {
    param([string]$Version, [int]$Seconds = 30)
    $healthHost = if ($BindAddress -in @('0.0.0.0','::')) { '127.0.0.1' } elseif ($BindAddress.Contains(':')) { "[$BindAddress]" } else { $BindAddress }
    $uri = "http://${healthHost}:$Port/api/status/details"
    $deadline = (Get-Date).AddSeconds($Seconds)
    do {
        Start-Sleep -Milliseconds 500
        try { $status = Invoke-RestMethod -Uri $uri -TimeoutSec 2 } catch { $status = $null }
        if ($status -and [string]$status.version -eq $Version -and [string]$status.storage -eq 'sqlite') { return $status }
    } while ((Get-Date) -lt $deadline)
    throw "Atlas $Version n'a pas réussi son contrôle de santé local."
}

function Stop-AtlasInstance {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    $serverPath = Join-Path $InstallRoot 'server.mjs'
    $runtimePath = Join-Path $InstallRoot 'runtime\node.exe'
    $deadline = (Get-Date).AddSeconds(20)
    do {
        $matchingProcesses = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
            $_.CommandLine -and $_.CommandLine.IndexOf($serverPath, [StringComparison]::OrdinalIgnoreCase) -ge 0
        })
        foreach ($process in $matchingProcesses) { Stop-Process -Id ([int]$process.ProcessId) -ErrorAction SilentlyContinue }
        $listener = netstat -ano -p tcp | Select-String -Pattern (':{0}\s+.*LISTENING\s+(\d+)\s*$' -f $Port) | Select-Object -First 1
        if ($listener) {
            $listenerId = [int]$listener.Matches[0].Groups[1].Value
            $listenerProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $listenerId" -ErrorAction SilentlyContinue
            $commandMatches = $listenerProcess -and $listenerProcess.CommandLine -and $listenerProcess.CommandLine.IndexOf($serverPath, [StringComparison]::OrdinalIgnoreCase) -ge 0
            $runtimeMatches = $listenerProcess -and $listenerProcess.ExecutablePath -and [IO.Path]::GetFullPath([string]$listenerProcess.ExecutablePath).Equals([IO.Path]::GetFullPath($runtimePath), [StringComparison]::OrdinalIgnoreCase)
            if ($commandMatches -or $runtimeMatches) {
                Stop-Process -Id $listenerId -ErrorAction SilentlyContinue
            }
            elseif ($listenerProcess) { throw "Le port $Port est occupé par un processus qui n’est pas cette instance Atlas." }
        }
        if (-not $matchingProcesses -and -not $listener) { return }
        Start-Sleep -Milliseconds 300
    } while ((Get-Date) -lt $deadline)
    throw 'Le processus Atlas ne s est pas arrete dans le delai de securite.'
}

$InstallRoot = Assert-SafeDirectory $InstallRoot 'Le dossier du programme'
$DataRoot = Assert-SafeDirectory $DataRoot 'Le dossier de données'
$UpdateRoot = Assert-SafeDirectory $UpdateRoot 'Le dossier de mise à jour'
$script:JobPath = Join-Path $UpdateRoot "jobs\$JobId.json"
$script:SnapshotRoot = Join-Path $UpdateRoot "snapshots\$JobId"
$programSnapshot = Join-Path $script:SnapshotRoot 'program'
$dataSnapshot = Join-Path $script:SnapshotRoot 'data'
$configRoot = Join-Path (Split-Path -Parent $DataRoot) 'config'
$configSnapshot = Join-Path $script:SnapshotRoot 'config'
$oldPackage = Get-Content -LiteralPath (Join-Path $InstallRoot 'package.json') -Raw | ConvertFrom-Json
$script:CurrentVersion = [string]$oldPackage.version
$oldNode = Join-Path $InstallRoot 'runtime\node.exe'
$inventoryScript = Join-Path $InstallRoot 'scripts\atlas-update-inventory.mjs'
$verificationScript = Join-Path $InstallRoot 'scripts\Test-AtlasSignedRelease.mjs'
$before = $null
$mutationStarted = $false

try {
    Write-JobState 'verifying' 'Vérification cryptographique finale du paquet.'
    & $oldNode $verificationScript --manifest $ManifestPath --signature $SignaturePath --package $PackagePath --public $PublicKeyPath --current $script:CurrentVersion --tag "v$ExpectedVersion" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'La vérification cryptographique finale a échoué.' }
    $before = (& $oldNode $inventoryScript $DataRoot | ConvertFrom-Json)
    if ($before.quickCheck -ne 'ok' -or -not $before.vaultWitness) { throw 'Integrite Atlas prealable insuffisante pour la mise a jour.' }

    Write-JobState 'waiting-for-shutdown' 'Arrêt contrôlé du serveur Atlas.'
    if ($ParentProcessId -gt 0) {
        $deadline = (Get-Date).AddSeconds(30)
        while ((Get-Process -Id $ParentProcessId -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 250 }
        if (Get-Process -Id $ParentProcessId -ErrorAction SilentlyContinue) { throw 'Le serveur Atlas ne s est pas arrete dans le delai prevu.' }
    }
    Stop-AtlasInstance

    Write-JobState 'snapshotting' 'Création du point de retour arrière local.'
    New-Item -ItemType Directory -Path $script:SnapshotRoot -Force | Out-Null
    Copy-ProgramSnapshot $InstallRoot $programSnapshot
    Copy-Item -LiteralPath $DataRoot -Destination $dataSnapshot -Recurse -Force
    if (Test-Path -LiteralPath $configRoot) { Copy-Item -LiteralPath $configRoot -Destination $configSnapshot -Recurse -Force }
    if (-not (Test-Path -LiteralPath (Join-Path $dataSnapshot 'atlas.sqlite'))) { throw 'Le point de retour arrière ne contient pas SQLite.' }

    Write-JobState 'installing' 'Installation de la nouvelle version Atlas.'
    $workRoot = Join-Path $UpdateRoot "work\$JobId"
    New-Item -ItemType Directory -Path $workRoot -Force | Out-Null
    Expand-Archive -LiteralPath $PackagePath -DestinationPath $workRoot -Force
    $candidateRoot = Get-ChildItem -LiteralPath $workRoot -Directory | Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'server.mjs') } | Select-Object -First 1
    if (-not $candidateRoot) { throw 'Le paquet Atlas ne contient pas de programme installable.' }
    $candidatePackage = Get-Content -LiteralPath (Join-Path $candidateRoot.FullName 'package.json') -Raw | ConvertFrom-Json
    if ([string]$candidatePackage.version -ne $ExpectedVersion) { throw 'La version du programme extrait ne correspond pas au manifeste signé.' }
    $mutationStarted = $true
    Clear-ProgramContent $InstallRoot
    $originList = @($AllowedOrigins -split '\|' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    $trustedProxyList = @($TrustedProxies -split '\|' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    & (Join-Path $candidateRoot.FullName 'scripts\Install-TRCCommunityAtlas.ps1') -InstallRoot $InstallRoot -DataRoot $DataRoot -Port $Port -BindAddress $BindAddress -AllowedOrigin $originList -TrustedProxy $trustedProxyList -NodePath (Join-Path $candidateRoot.FullName 'runtime\node.exe') -TaskName $TaskName -Channel stable -SkipShortcuts -SkipStart -Json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Installation du paquet Atlas echouee.' }
    Start-ScheduledTask -TaskName $TaskName
    if ($SimulateHealthFailure) { throw 'Échec de santé simulé pour valider le retour arrière.' }
    Wait-AtlasStatus $ExpectedVersion | Out-Null
    $newNode = Join-Path $InstallRoot 'runtime\node.exe'
    $after = (& $newNode (Join-Path $InstallRoot 'scripts\atlas-update-inventory.mjs') $DataRoot | ConvertFrom-Json)
    foreach ($field in @('organizations','configurations','moduleRecords','procedures','users','vaultItems','attachments')) {
        if ($after.$field -ne $before.$field) { throw "Inventaire Atlas modifie pendant la mise a jour ($field)." }
    }
    if ($after.quickCheck -ne 'ok' -or -not $after.vaultWitness) { throw 'Le contrôle final de SQLite ou du coffre a échoué.' }
    Write-JobState 'succeeded' "Atlas $ExpectedVersion est installé et vérifié." @{ completedAt = (Get-Date).ToUniversalTime().ToString('o'); before = $before; after = $after }
    exit 0
}
catch {
    $failure = $_.Exception.Message
    if ($mutationStarted -and (Test-Path -LiteralPath $programSnapshot)) {
        try {
            Stop-AtlasInstance
            Clear-ProgramContent $InstallRoot
            Get-ChildItem -LiteralPath $programSnapshot -Force | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $InstallRoot -Recurse -Force }
            Restore-Directory $dataSnapshot $DataRoot
            if (Test-Path -LiteralPath $configSnapshot) { Restore-Directory $configSnapshot $configRoot }
            Start-ScheduledTask -TaskName $TaskName
            Wait-AtlasStatus $script:CurrentVersion | Out-Null
            Write-JobState 'rolled-back' "La mise à jour a échoué et Atlas $($script:CurrentVersion) a été restauré." @{ failedReason = $failure; rolledBackAt = (Get-Date).ToUniversalTime().ToString('o') }
        }
        catch {
            Write-JobState 'rollback-failed' 'La mise à jour et le retour arrière ont échoué. Une intervention locale est requise.' @{ failedReason = $failure; rollbackReason = $_.Exception.Message }
        }
    }
    else { Write-JobState 'failed' 'La mise à jour a été refusée avant toute modification du programme.' @{ failedReason = $failure } }
    exit 1
}
