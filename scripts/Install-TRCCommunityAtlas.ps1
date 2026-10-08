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
    [ValidateSet('stable', 'beta')]
    [string]$Channel = 'stable',
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
if ($DataRoot.StartsWith('\\')) {
    throw 'Le dossier de donnees doit etre sur un disque local. SQLite ne doit pas etre installe sur un partage reseau.'
}
$instanceRoot = Split-Path -Parent $DataRoot
$configDirectory = Join-Path $instanceRoot 'config'
$logsDirectory = Join-Path $instanceRoot 'logs'
$configPath = Join-Path $configDirectory 'instance.json'
$previousConfiguration = $null
$configCandidates = [Collections.Generic.List[string]]::new()
foreach ($pointerPath in @((Join-Path $sourceRoot 'instance-location.json'), (Join-Path $InstallRoot 'instance-location.json'))) {
    if (-not (Test-Path -LiteralPath $pointerPath -PathType Leaf)) {
        continue
    }
    try {
        $pointer = Get-Content -LiteralPath $pointerPath -Raw | ConvertFrom-Json
        if ($pointer.configPath) {
            $configCandidates.Add([string]$pointer.configPath)
        }
    }
    catch {
        throw "Le pointeur de configuration Atlas est illisible : $pointerPath"
    }
}
$configCandidates.Add($configPath)
foreach ($candidateConfigPath in ($configCandidates | Select-Object -Unique)) {
    if (Test-Path -LiteralPath $candidateConfigPath -PathType Leaf) {
        try {
            $previousConfiguration = Get-Content -LiteralPath $candidateConfigPath -Raw | ConvertFrom-Json
            break
        }
        catch {
            throw "La configuration Atlas existante est illisible : $candidateConfigPath"
        }
    }
}
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

if ($previousConfiguration -and $previousConfiguration.port -and $previousConfiguration.installRoot) {
    $previousPort = [int]$previousConfiguration.port
    $previousServer = Join-Path ([string]$previousConfiguration.installRoot) 'server.mjs'
    $previousListener = Get-ListeningProcessId -ListenerPort $previousPort
    if ($previousListener -and ($previousPort -ne $Port -or [IO.Path]::GetFullPath([string]$previousConfiguration.installRoot) -ne $InstallRoot)) {
        $previousProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $previousListener" -ErrorAction SilentlyContinue
        if (-not $previousProcess -or $previousProcess.CommandLine -notlike "*$previousServer*") {
            throw "L'ancien port Atlas $previousPort est maintenant utilise par un autre processus ($previousListener). Arretez-le avant de reconfigurer Atlas."
        }
        Write-Step "Arret de l'ancienne instance Atlas sur le port $previousPort avant la reconfiguration."
        Stop-Process -Id $previousListener
        $deadline = (Get-Date).AddSeconds(15)
        do {
            Start-Sleep -Milliseconds 250
        } while ((Get-ListeningProcessId -ListenerPort $previousPort) -and (Get-Date) -lt $deadline)
        if (Get-ListeningProcessId -ListenerPort $previousPort) {
            throw "L'ancienne instance Atlas sur le port $previousPort ne s'est pas arretee correctement."
        }
    }
}

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

New-Item -ItemType Directory -Path $configDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $logsDirectory -Force | Out-Null
$installedAt = (Get-Date).ToUniversalTime().ToString('o')
if ($previousConfiguration -and $previousConfiguration.installedAt) {
    $installedAt = [string]$previousConfiguration.installedAt
}
$taskName = 'TRC Community Atlas'
$configuration = [ordered]@{
    schemaVersion = 1
    version = $version
    installedAt = $installedAt
    updatedAt = (Get-Date).ToUniversalTime().ToString('o')
    installRoot = $InstallRoot
    dataRoot = $DataRoot
    bindAddress = $BindAddress
    port = $Port
    allowedOrigins = @($AllowedOrigin)
    channel = $Channel
    autostart = -not $SkipAutostart
    shortcut = -not $SkipShortcuts
    taskName = $taskName
}
$configuration | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $configPath -Encoding UTF8
$instancePointer = [ordered]@{
    schemaVersion = 1
    configPath = $configPath
    dataRoot = $DataRoot
}
$instancePointer | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $InstallRoot 'instance-location.json') -Encoding UTF8

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
else {
    $configuredTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($configuredTask) {
        Disable-ScheduledTask -TaskName $taskName | Out-Null
        $autostartMode = 'Desactive; la tache Atlas existante a ete conservee mais desactivee'
    }
}

$legacyTaskNames = [Collections.Generic.List[string]]::new()
if ($previousConfiguration -and $previousConfiguration.taskName) {
    $legacyTaskNames.Add([string]$previousConfiguration.taskName)
}
if ($previousConfiguration -and $previousConfiguration.port) {
    $legacyTaskNames.Add("TRC Community Atlas - $([int]$previousConfiguration.port)")
}
foreach ($legacyTaskName in ($legacyTaskNames | Select-Object -Unique)) {
    if ($legacyTaskName -eq $taskName) {
        continue
    }
    $legacyTask = Get-ScheduledTask -TaskName $legacyTaskName -ErrorAction SilentlyContinue
    if ($legacyTask) {
        Disable-ScheduledTask -TaskName $legacyTaskName | Out-Null
    }
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

    $configurationShortcutPath = Join-Path $programsDirectory 'Configurer TRC Community Atlas.lnk'
    $shell = New-Object -ComObject WScript.Shell
    $configurationShortcut = $shell.CreateShortcut($configurationShortcutPath)
    $configurationShortcut.TargetPath = Join-Path $InstallRoot 'Install-Atlas.cmd'
    $configurationShortcut.WorkingDirectory = $InstallRoot
    $configurationShortcut.Description = 'Modifier le port, les dossiers et le demarrage de TRC Community Atlas'
    $configurationShortcut.Save()
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
    channel = $Channel
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
