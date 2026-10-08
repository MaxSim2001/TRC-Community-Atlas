[CmdletBinding()]
param(
    [string]$ProjectRoot = 'C:\Users\Administrateur.AD-01\Documents\TRC_Community_Atlas',
    [string]$SourceNodePath = 'C:\Users\Administrateur.AD-01\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe',
    [string]$TaskName = 'TRC Community Atlas - Production 9092',
    [ValidateRange(1, 65535)]
    [int]$Port = 9092,
    [string]$BindAddress = '192.168.50.12',
    [string]$AllowedOrigin = 'https://atlas.therisingcloud.com'
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

$serverPath = Join-Path $ProjectRoot 'server.mjs'
if (-not (Test-Path -LiteralPath $serverPath -PathType Leaf)) {
    throw "Serveur Atlas introuvable : $serverPath"
}
if (-not (Test-Path -LiteralPath $SourceNodePath -PathType Leaf)) {
    throw "Runtime Node.js introuvable : $SourceNodePath"
}

$parsedAddress = $null
if (-not [Net.IPAddress]::TryParse($BindAddress, [ref]$parsedAddress)) {
    throw "Adresse d'ecoute invalide : $BindAddress"
}

$originUri = $null
if (-not [Uri]::TryCreate($AllowedOrigin, [UriKind]::Absolute, [ref]$originUri) -or $originUri.Scheme -ne 'https') {
    throw "Origine HTTPS invalide : $AllowedOrigin"
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

$arguments = ('"{0}" --port {1} --host {2} --origin "{3}"' -f $serverPath, $Port, $BindAddress, $AllowedOrigin)
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
    -Description 'Demarre TRC Community Atlas 0.11 en arriere-plan au demarrage de Windows, sans fenetre interactive.' `
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

$healthUri = "http://${BindAddress}:$Port/api/status"
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
