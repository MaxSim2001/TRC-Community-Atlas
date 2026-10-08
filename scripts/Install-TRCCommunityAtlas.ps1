[CmdletBinding()]
param(
    [string]$InstallRoot = '',
    [string]$DataRoot = '',

    [ValidateRange(1024, 65535)]
    [int]$Port = 9092,

    [ValidatePattern('^[a-zA-Z0-9.:-]+$')]
    [string]$BindAddress = '127.0.0.1',

    [string[]]$AllowedOrigin = @(),
    [string]$NodePath = '',
    [switch]$SkipAutostart,
    [switch]$SkipShortcuts,
    [switch]$SkipStart,
    [switch]$OpenBrowser,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Step {
    param([string]$Message)
    if (-not $Json) {
        Write-Host "[Atlas] $Message" -ForegroundColor Cyan
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

function Resolve-NodeRuntime {
    param(
        [string]$RequestedPath,
        [string]$SourceRoot
    )

    $candidates = [Collections.Generic.List[string]]::new()
    if ($RequestedPath) {
        $candidates.Add($RequestedPath)
    }
    $candidates.Add((Join-Path $SourceRoot 'runtime\node.exe'))

    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeCommand) {
        $candidates.Add($nodeCommand.Source)
    }

    foreach ($candidate in $candidates) {
        if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            continue
        }

        $resolved = (Get-Item -LiteralPath $candidate).FullName
        $rawVersion = (& $resolved --version 2>$null).Trim()
        if ($rawVersion -notmatch '^v(?<major>\d+)\.') {
            continue
        }
        if ([int]$Matches.major -lt 22) {
            continue
        }
        return $resolved
    }

    throw @'
Node.js 22 ou plus recent est requis.

- Le paquet Windows Atlas officiel inclut deja ce runtime.
- Depuis le code source, installez Node.js 22+ puis relancez Installer-Atlas.cmd.
'@
}

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Quote-CommandArgument {
    param([string]$Value)
    return '"{0}"' -f ($Value -replace '"', '\"')
}

$sourceRoot = Split-Path -Parent $PSScriptRoot
$localApplicationData = [Environment]::GetFolderPath('LocalApplicationData')
if (-not $InstallRoot) {
    $InstallRoot = Join-Path $localApplicationData 'Programs\TRC Community Atlas'
}
if (-not $DataRoot) {
    $DataRoot = Join-Path $localApplicationData 'TRC Community Atlas\data'
}

$sourceRoot = [IO.Path]::GetFullPath($sourceRoot)
$InstallRoot = [IO.Path]::GetFullPath($InstallRoot)
$DataRoot = [IO.Path]::GetFullPath($DataRoot)
$sourceServerPath = Join-Path $sourceRoot 'server.mjs'
if (-not (Test-Path -LiteralPath $sourceServerPath -PathType Leaf)) {
    throw "Le paquet Atlas est incomplet : server.mjs est introuvable dans $sourceRoot."
}

$package = Get-Content -LiteralPath (Join-Path $sourceRoot 'package.json') -Raw | ConvertFrom-Json
$version = [string]$package.version
if (-not $version) {
    throw 'La version Atlas est absente de package.json.'
}

$parsedAddress = $null
if (-not [Net.IPAddress]::TryParse($BindAddress, [ref]$parsedAddress)) {
    throw "Adresse d'ecoute invalide : $BindAddress"
}

foreach ($origin in $AllowedOrigin) {
    $originUri = $null
    if (-not [Uri]::TryCreate($origin, [UriKind]::Absolute, [ref]$originUri) -or $originUri.Scheme -ne 'https' -or $originUri.PathAndQuery -ne '/') {
        throw "Origine HTTPS invalide : $origin. Utilisez uniquement une origine comme https://atlas.exemple.com."
    }
}

$runtimeSource = Resolve-NodeRuntime -RequestedPath $NodePath -SourceRoot $sourceRoot
$existingListener = Get-ListeningProcessId -ListenerPort $Port
if ($existingListener) {
    $expectedServer = Join-Path $InstallRoot 'server.mjs'
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $existingListener" -ErrorAction SilentlyContinue
    if (-not $process -or $process.CommandLine -notlike "*$expectedServer*") {
        throw "Le port $Port est deja utilise par le processus $existingListener. Choisissez un autre port ou arretez ce service."
    }

    Write-Step "Arret de l'ancienne instance Atlas sur le port $Port pour effectuer la reparation."
    Stop-Process -Id $existingListener
    $deadline = (Get-Date).AddSeconds(15)
    do {
        Start-Sleep -Milliseconds 250
    } while ((Get-ListeningProcessId -ListenerPort $Port) -and (Get-Date) -lt $deadline)
    if (Get-ListeningProcessId -ListenerPort $Port) {
        throw "L'ancienne instance Atlas ne s'est pas arretee correctement."
    }
}

Write-Step "Installation de TRC Community Atlas $version."
New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null
New-Item -ItemType Directory -Path $DataRoot -Force | Out-Null

$rootFiles = @(
    'server.mjs',
    'package.json',
    'README.md',
    'LICENSE.txt',
    'NOTICE.txt',
    'Start-TRCCommunityAtlas.ps1',
    'Install-Atlas.cmd'
)
foreach ($relativePath in $rootFiles) {
    $sourcePath = Join-Path $sourceRoot $relativePath
    if (Test-Path -LiteralPath $sourcePath -PathType Leaf) {
        Copy-Item -LiteralPath $sourcePath -Destination (Join-Path $InstallRoot $relativePath) -Force
    }
}

foreach ($directoryName in @('public', 'lib', 'scripts', 'docs')) {
    $sourceDirectory = Join-Path $sourceRoot $directoryName
    if (-not (Test-Path -LiteralPath $sourceDirectory -PathType Container)) {
        continue
    }
    $targetDirectory = Join-Path $InstallRoot $directoryName
    New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
    Copy-Item -Path (Join-Path $sourceDirectory '*') -Destination $targetDirectory -Recurse -Force
}

$runtimeDirectory = Join-Path $InstallRoot 'runtime'
$runtimeTarget = Join-Path $runtimeDirectory 'node.exe'
New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
if ([IO.Path]::GetFullPath($runtimeSource) -ne [IO.Path]::GetFullPath($runtimeTarget)) {
    Copy-Item -LiteralPath $runtimeSource -Destination $runtimeTarget -Force
}

$instanceRoot = Split-Path -Parent $DataRoot
$configDirectory = Join-Path $instanceRoot 'config'
$logsDirectory = Join-Path $instanceRoot 'logs'
New-Item -ItemType Directory -Path $configDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $logsDirectory -Force | Out-Null
$configPath = Join-Path $configDirectory 'instance.json'
$configuration = [ordered]@{
    schemaVersion = 1
    version = $version
    installedAt = (Get-Date).ToUniversalTime().ToString('o')
    installRoot = $InstallRoot
    dataRoot = $DataRoot
    bindAddress = $BindAddress
    port = $Port
    allowedOrigins = @($AllowedOrigin)
    channel = 'stable'
}
$configuration | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $configPath -Encoding UTF8

$installedServerPath = Join-Path $InstallRoot 'server.mjs'
$serverArguments = @(
    (Quote-CommandArgument $installedServerPath),
    '--port', [string]$Port,
    '--host', $BindAddress,
    '--data', (Quote-CommandArgument $DataRoot)
)
foreach ($origin in $AllowedOrigin) {
    $serverArguments += @('--origin', (Quote-CommandArgument $origin))
}
$argumentLine = $serverArguments -join ' '

$taskName = "TRC Community Atlas - $Port"
$autostartMode = 'Desactive pour ce deploiement'
if (-not $SkipAutostart) {
    Write-Step 'Configuration du demarrage automatique en arriere-plan.'
    $action = New-ScheduledTaskAction -Execute $runtimeTarget -Argument $argumentLine -WorkingDirectory $InstallRoot
    if (Test-IsAdministrator) {
        $trigger = New-ScheduledTaskTrigger -AtStartup
        $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
        $autostartMode = 'Au demarrage de Windows, compte SYSTEM'
    }
    else {
        $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name
        $trigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
        $principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType S4U -RunLevel Limited
        $autostartMode = 'A la connexion, en arriere-plan pour l utilisateur courant'
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
        -TaskName $taskName `
        -Action $action `
        -Trigger $trigger `
        -Principal $principal `
        -Settings $settings `
        -Description "TRC Community Atlas $version - demarrage local en arriere-plan" `
        -Force | Out-Null
}

$browserHost = $BindAddress
if ($browserHost -eq '0.0.0.0' -or $browserHost -eq '::') {
    $browserHost = '127.0.0.1'
}
if ($browserHost.Contains(':') -and -not $browserHost.StartsWith('[')) {
    $browserHost = "[$browserHost]"
}
$applicationUrl = "http://${browserHost}:$Port/"

if (-not $SkipShortcuts) {
    Write-Step 'Creation du raccourci dans le menu Demarrer.'
    $programsDirectory = [Environment]::GetFolderPath('Programs')
    $shortcutPath = Join-Path $programsDirectory 'TRC Community Atlas.url'
    @(
        '[InternetShortcut]'
        "URL=$applicationUrl"
        'IconIndex=0'
        "IconFile=$env:SystemRoot\System32\shell32.dll"
    ) | Set-Content -LiteralPath $shortcutPath -Encoding ASCII
}

$atlasProcess = $null
$status = $null
if (-not $SkipStart) {
    Write-Step "Demarrage securise sur $applicationUrl"
    $standardOutput = Join-Path $logsDirectory 'atlas.out.log'
    $standardError = Join-Path $logsDirectory 'atlas.error.log'
    $atlasProcess = Start-Process `
        -FilePath $runtimeTarget `
        -ArgumentList $argumentLine `
        -WorkingDirectory $InstallRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput $standardOutput `
        -RedirectStandardError $standardError `
        -PassThru

    $deadline = (Get-Date).AddSeconds(25)
    do {
        Start-Sleep -Milliseconds 500
        try {
            $status = Invoke-RestMethod -Uri ($applicationUrl + 'api/status') -TimeoutSec 2
        }
        catch {
            $status = $null
        }
    } while (-not $status -and -not $atlasProcess.HasExited -and (Get-Date) -lt $deadline)

    if (-not $status) {
        $details = ''
        if (Test-Path -LiteralPath $standardError) {
            $details = (Get-Content -LiteralPath $standardError -Tail 8 -ErrorAction SilentlyContinue) -join [Environment]::NewLine
        }
        throw "Atlas n'a pas repondu sur $applicationUrl. $details"
    }

    if ($OpenBrowser) {
        Start-Process $applicationUrl
    }
}

$result = [ordered]@{
    product = 'TRC Community Atlas'
    version = $version
    url = $applicationUrl
    installRoot = $InstallRoot
    dataRoot = $DataRoot
    configPath = $configPath
    processId = if ($atlasProcess) { $atlasProcess.Id } else { $null }
    initialized = if ($status) { [bool]$status.initialized } else { $null }
    storage = if ($status) { [string]$status.storage } else { $null }
    autostart = $autostartMode
    taskName = if ($SkipAutostart) { $null } else { $taskName }
}

if ($Json) {
    $result | ConvertTo-Json -Depth 4 -Compress
}
else {
    Write-Host ''
    Write-Host 'Installation terminee.' -ForegroundColor Green
    Write-Host "Adresse : $applicationUrl"
    Write-Host "Donnees : $DataRoot"
    Write-Host "Demarrage automatique : $autostartMode"
    if ($status -and -not $status.initialized) {
        Write-Host 'Prochaine etape : creez le premier compte administrateur et activez son MFA dans le navigateur.' -ForegroundColor Yellow
    }
    [pscustomobject]$result
}
