[CmdletBinding()]
param(
    [ValidateSet('Status', 'Enable', 'Disable')]
    [string]$Mode = 'Status',
    [string]$ProjectRoot = '',
    [string]$NodePath = '',
    [string]$DataRoot = '',
    [ValidatePattern('^[A-Za-z0-9 ._-]{1,120}$')]
    [string]$TaskName = 'TRC Community Atlas',
    [ValidateRange(1024, 65535)]
    [int]$Port = 9092,
    [ValidatePattern('^[a-zA-Z0-9.:-]+$')]
    [string]$BindAddress = '127.0.0.1',
    [string]$AllowedOrigins = '',
    [string]$TrustedProxies = '',
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Quote-AtlasArgument {
    param([string]$Value)
    return '"{0}"' -f ($Value -replace '"', '\"')
}

function Set-InstanceConfigurationValue {
    param([bool]$Enabled)
    $configPath = Join-Path (Split-Path -Parent $DataRoot) 'config\instance.json'
    if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
        return
    }
    $configuration = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    foreach ($entry in @{
        autostart = $Enabled
        taskName = $TaskName
        bindAddress = $BindAddress
        port = $Port
        allowedOrigins = @($allowedOriginList)
        trustedProxies = @($trustedProxyList)
        updatedAt = (Get-Date).ToUniversalTime().ToString('o')
    }.GetEnumerator()) {
        if ($configuration.PSObject.Properties.Name -contains $entry.Key) {
            $configuration.($entry.Key) = $entry.Value
        }
        else {
            $configuration | Add-Member -NotePropertyName $entry.Key -NotePropertyValue $entry.Value
        }
    }
    $configuration | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $configPath -Encoding UTF8
}

function Get-AtlasAutostartStatus {
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if (-not $task) {
        return [ordered]@{
            supported = $true
            installed = $false
            enabled = $false
            taskName = $TaskName
            state = 'Absent'
            trigger = 'none'
            runAs = ''
            hidden = $null
            lastRunAt = $null
            lastTaskResult = $null
            message = 'Le demarrage automatique Atlas n''est pas configure.'
        }
    }
    $taskInfo = Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction SilentlyContinue
    $triggerClasses = @($task.Triggers | ForEach-Object { $_.CimClass.CimClassName })
    $trigger = if ($triggerClasses -contains 'MSFT_TaskBootTrigger') { 'startup' } elseif ($triggerClasses -contains 'MSFT_TaskLogonTrigger') { 'logon' } else { 'other' }
    $enabled = [string]$task.State -ne 'Disabled'
    $lastRunAt = $null
    if ($taskInfo -and $taskInfo.LastRunTime -and $taskInfo.LastRunTime.Year -gt 2000) {
        $lastRunAt = $taskInfo.LastRunTime.ToUniversalTime().ToString('o')
    }
    return [ordered]@{
        supported = $true
        installed = $true
        enabled = $enabled
        taskName = $TaskName
        state = [string]$task.State
        trigger = $trigger
        runAs = [string]$task.Principal.UserId
        hidden = [bool]$task.Settings.Hidden
        lastRunAt = $lastRunAt
        lastTaskResult = if ($taskInfo) { [int]$taskInfo.LastTaskResult } else { $null }
        message = if ($enabled) { 'Atlas est planifie en arriere-plan avec Windows.' } else { 'La tache Atlas existe, mais elle est desactivee.' }
    }
}

if (-not $ProjectRoot) {
    $ProjectRoot = Split-Path -Parent $PSScriptRoot
}
if (-not $DataRoot) {
    $DataRoot = Join-Path $ProjectRoot 'data'
}
if (-not $NodePath) {
    $bundledNode = Join-Path $ProjectRoot 'runtime\node.exe'
    if (Test-Path -LiteralPath $bundledNode -PathType Leaf) {
        $NodePath = $bundledNode
    }
}

$ProjectRoot = [IO.Path]::GetFullPath($ProjectRoot)
$DataRoot = [IO.Path]::GetFullPath($DataRoot)
if ($DataRoot.StartsWith('\\')) {
    throw 'Le dossier de donnees SQLite doit rester sur un disque local.'
}

$parsedAddress = $null
if (-not [Net.IPAddress]::TryParse($BindAddress, [ref]$parsedAddress)) {
    throw "Adresse d'ecoute invalide : $BindAddress"
}
$allowedOriginList = @($AllowedOrigins -split '\|' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
foreach ($origin in $allowedOriginList) {
    $uri = $null
    if (-not [Uri]::TryCreate($origin, [UriKind]::Absolute, [ref]$uri) -or $uri.Scheme -ne 'https' -or $uri.PathAndQuery -ne '/') {
        throw "Origine HTTPS invalide : $origin"
    }
}
$trustedProxyList = @($TrustedProxies -split '[|,;\r\n]+' | ForEach-Object { $_.Trim() } | Where-Object { $_ } | Select-Object -Unique)
if ($trustedProxyList.Count -gt 16) {
    throw 'Un maximum de 16 proxys de confiance peut etre configure.'
}
foreach ($proxyAddress in $trustedProxyList) {
    $parsedProxyAddress = $null
    if (-not [Net.IPAddress]::TryParse($proxyAddress, [ref]$parsedProxyAddress)) {
        throw "Adresse de proxy de confiance invalide : $proxyAddress"
    }
}

if ($Mode -eq 'Enable') {
    $serverPath = Join-Path $ProjectRoot 'server.mjs'
    if (-not (Test-Path -LiteralPath $serverPath -PathType Leaf)) {
        throw "Serveur Atlas introuvable : $serverPath"
    }
    if (-not $NodePath -or -not (Test-Path -LiteralPath $NodePath -PathType Leaf)) {
        throw 'Runtime Node.js Atlas introuvable.'
    }

    $existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        $backupRoot = Join-Path (Split-Path -Parent $DataRoot) 'backups\autostart'
        New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
        $backupPath = Join-Path $backupRoot ("TRC_Community_Atlas_Autostart_{0}.xml" -f (Get-Date -Format 'yyyy-MM-dd_HH-mm-ss-fff'))
        Export-ScheduledTask -TaskName $TaskName | Set-Content -LiteralPath $backupPath -Encoding Unicode
    }

    $arguments = @(
        (Quote-AtlasArgument $serverPath),
        '--port', [string]$Port,
        '--host', $BindAddress,
        '--data', (Quote-AtlasArgument $DataRoot)
    )
    foreach ($origin in $allowedOriginList) {
        $arguments += @('--origin', (Quote-AtlasArgument $origin))
    }
    foreach ($proxyAddress in $trustedProxyList) {
        $arguments += @('--trusted-proxy', (Quote-AtlasArgument $proxyAddress))
    }
    $action = New-ScheduledTaskAction -Execute $NodePath -Argument ($arguments -join ' ') -WorkingDirectory $ProjectRoot
    if (Test-IsAdministrator) {
        $trigger = New-ScheduledTaskTrigger -AtStartup
        $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
    }
    else {
        $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name
        $trigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
        $principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType S4U -RunLevel Limited
    }
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
        -Description 'Demarre TRC Community Atlas en arriere-plan avec Windows, sans fenetre interactive.' `
        -Force | Out-Null
    Set-InstanceConfigurationValue -Enabled $true
}
elseif ($Mode -eq 'Disable') {
    $existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        Disable-ScheduledTask -TaskName $TaskName | Out-Null
    }
    Set-InstanceConfigurationValue -Enabled $false
}

$result = Get-AtlasAutostartStatus
if ($Json) {
    $result | ConvertTo-Json -Depth 5 -Compress
}
else {
    [pscustomobject]$result
}
