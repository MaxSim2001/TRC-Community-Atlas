[CmdletBinding()]
param(
    [string]$ProjectRoot = '',
    [string]$SourceNodePath = '',
    [string]$DataRoot = '',
    [string]$TaskName = '',
    [ValidateRange(1, 65535)]
    [int]$Port = 9092,
    [string]$BindAddress = '127.0.0.1',
    [string[]]$AllowedOrigin = @(),
    [string[]]$TrustedProxy = @()
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Assert-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Cette installation doit etre executee dans une session administrateur.'
    }
}

function Get-ListeningProcessId {
    param([int]$ListenerPort)

    $match = netstat -ano -p tcp |
        Select-String -Pattern (':{0}\s+.*LISTENING\s+(\d+)\s*$' -f $ListenerPort) |
        Select-Object -First 1

    if (-not $match) {
        return $null
    }

    return [int]$match.Matches[0].Groups[1].Value
}

Assert-Administrator

if (-not $ProjectRoot) {
    $ProjectRoot = Split-Path -Parent $PSScriptRoot
}
$ProjectRoot = [IO.Path]::GetFullPath($ProjectRoot)
if (-not $DataRoot) {
    $DataRoot = Join-Path $ProjectRoot 'data'
}
$DataRoot = [IO.Path]::GetFullPath($DataRoot)
if (-not $TaskName) {
    $TaskName = "TRC Community Atlas - $Port"
}

$serverPath = Join-Path $ProjectRoot 'server.mjs'
if (-not (Test-Path -LiteralPath $serverPath -PathType Leaf)) {
    throw "Serveur Atlas introuvable : $serverPath"
}
if (-not $SourceNodePath) {
    $bundledNode = Join-Path $ProjectRoot 'runtime\node.exe'
    if (Test-Path -LiteralPath $bundledNode -PathType Leaf) {
        $SourceNodePath = $bundledNode
    }
    else {
        $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
        if ($nodeCommand) {
            $SourceNodePath = $nodeCommand.Source
        }
    }
}
if (-not $SourceNodePath -or -not (Test-Path -LiteralPath $SourceNodePath -PathType Leaf)) {
    throw 'Runtime Node.js 22 ou plus recent introuvable.'
}

$parsedAddress = $null
if (-not [Net.IPAddress]::TryParse($BindAddress, [ref]$parsedAddress)) {
    throw "Adresse d'ecoute invalide : $BindAddress"
}

foreach ($origin in $AllowedOrigin) {
    $originUri = $null
    if (-not [Uri]::TryCreate($origin, [UriKind]::Absolute, [ref]$originUri) -or $originUri.Scheme -ne 'https') {
        throw "Origine HTTPS invalide : $origin"
    }
}
foreach ($proxyAddress in $TrustedProxy) {
    $parsedProxyAddress = $null
    if (-not [Net.IPAddress]::TryParse($proxyAddress, [ref]$parsedProxyAddress)) {
        throw "Adresse de proxy de confiance invalide : $proxyAddress"
    }
}

$runtimeDirectory = Join-Path $ProjectRoot 'runtime'
$runtimeNodePath = Join-Path $runtimeDirectory 'node.exe'
New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null

$copyRuntime = -not (Test-Path -LiteralPath $runtimeNodePath -PathType Leaf)
if (-not $copyRuntime) {
    $sourceHash = (Get-FileHash -LiteralPath $SourceNodePath -Algorithm SHA256).Hash
    $runtimeHash = (Get-FileHash -LiteralPath $runtimeNodePath -Algorithm SHA256).Hash
    $copyRuntime = $sourceHash -ne $runtimeHash
}
if ($copyRuntime) {
    Copy-Item -LiteralPath $SourceNodePath -Destination $runtimeNodePath -Force
}

$backupDirectory = Join-Path $ProjectRoot 'backups'
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existingTask) {
    New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
    $timestamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
    $taskBackupPath = Join-Path $backupDirectory "TRC_Community_Atlas_Autostart_$timestamp.xml"
    Export-ScheduledTask -TaskName $TaskName | Set-Content -LiteralPath $taskBackupPath -Encoding Unicode
}

$arguments = ('"{0}" --port {1} --host {2} --data "{3}"' -f $serverPath, $Port, $BindAddress, $DataRoot)
foreach ($origin in $AllowedOrigin) {
    $arguments += (' --origin "{0}"' -f $origin)
}
foreach ($proxyAddress in $TrustedProxy) {
    $arguments += (' --trusted-proxy "{0}"' -f $proxyAddress)
}
$action = New-ScheduledTaskAction `
    -Execute $runtimeNodePath `
    -Argument $arguments `
    -WorkingDirectory $ProjectRoot
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal `
    -UserId 'SYSTEM' `
    -LogonType ServiceAccount `
    -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
    -Hidden `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -RestartCount 5 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Description 'Demarre TRC Community Atlas en arriere-plan au demarrage de Windows, sans fenetre interactive.' `
    -Force | Out-Null

$listenerProcessId = Get-ListeningProcessId -ListenerPort $Port
if ($listenerProcessId) {
    $listener = Get-CimInstance Win32_Process -Filter "ProcessId = $listenerProcessId" -ErrorAction SilentlyContinue
    if (-not $listener -or $listener.CommandLine -notlike "*$serverPath*") {
        throw "Le port $Port est deja occupe par le PID $listenerProcessId. La tache est installee, mais elle n'a pas ete demarree."
    }

    Stop-Process -Id $listenerProcessId -Force
    $deadline = (Get-Date).AddSeconds(10)
    do {
        Start-Sleep -Milliseconds 250
    } while ((Get-ListeningProcessId -ListenerPort $Port) -and (Get-Date) -lt $deadline)
}

Start-ScheduledTask -TaskName $TaskName

$healthAddress = if ($BindAddress -eq '0.0.0.0' -or $BindAddress -eq '::') { '127.0.0.1' } else { $BindAddress }
$healthUri = "http://${healthAddress}:$Port/api/status/details"
$deadline = (Get-Date).AddSeconds(20)
$status = $null
do {
    Start-Sleep -Milliseconds 500
    try {
        $status = Invoke-RestMethod -Uri $healthUri -TimeoutSec 2
    }
    catch {
        $status = $null
    }
} while (-not $status -and (Get-Date) -lt $deadline)

if (-not $status) {
    $taskInfo = Get-ScheduledTaskInfo -TaskName $TaskName
    throw "Atlas n'a pas repondu sur $healthUri. Dernier resultat de la tache : $($taskInfo.LastTaskResult)."
}

$installedTask = Get-ScheduledTask -TaskName $TaskName
$installedInfo = Get-ScheduledTaskInfo -TaskName $TaskName
$listenerProcessId = Get-ListeningProcessId -ListenerPort $Port

[pscustomobject]@{
    TaskName = $TaskName
    TaskState = $installedTask.State
    Hidden = $installedTask.Settings.Hidden
    RunAs = $installedTask.Principal.UserId
    Executable = $installedTask.Actions.Execute
    Arguments = $installedTask.Actions.Arguments
    Listener = "${BindAddress}:$Port"
    ProcessId = $listenerProcessId
    AtlasVersion = $status.version
    Initialized = $status.initialized
    LastTaskResult = $installedInfo.LastTaskResult
}
