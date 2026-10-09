[CmdletBinding()]
param(
    [ValidateRange(1024, 65535)]
    [int]$Port = 9095,
    [ValidateRange(1024, 65535)]
    [int]$ReconfiguredPort = 9096,
    [string]$NodePath = '',
    [string]$TestRoot = '',
    [switch]$TestAutostart
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not $TestRoot) {
    $timestamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
    $TestRoot = Join-Path ([IO.Path]::GetTempPath()) "TRCAtlas-Deployment-QA-$timestamp"
}
$TestRoot = [IO.Path]::GetFullPath($TestRoot)
$installRoot = Join-Path $TestRoot 'program'
$dataRoot = Join-Path $TestRoot 'instance\data'
$installerPath = Join-Path $PSScriptRoot 'Install-TRCCommunityAtlas.ps1'

if ($Port -eq $ReconfiguredPort) {
    throw 'Le port initial et le port de reconfiguration doivent etre differents.'
}
foreach ($candidatePort in @($Port, $ReconfiguredPort)) {
    $existing = netstat -ano -p tcp | Select-String -Pattern (':{0}\s+.*LISTENING\s+\d+\s*$' -f $candidatePort) | Select-Object -First 1
    if ($existing) {
        throw "Le port de test $candidatePort est deja occupe. Aucun deploiement n'a ete lance."
    }
}

$arguments = @{
    InstallRoot = $installRoot
    DataRoot = $dataRoot
    Port = $Port
    BindAddress = '127.0.0.1'
    SkipAutostart = $true
    SkipShortcuts = $true
    Json = $true
}
if ($NodePath) {
    $arguments.NodePath = $NodePath
}

$deployment = $null
$runningDeployment = $null
$reconfiguredDeployment = $null
$autostartTaskName = "TRC Community Atlas QA $([Guid]::NewGuid().ToString('N'))"
$autostartResult = 'NOT_RUN'
try {
    $deploymentJson = & $installerPath @arguments
    $deployment = $deploymentJson | ConvertFrom-Json
    $status = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/status/details" -TimeoutSec 5
    $homeResponse = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 5
    $config = Get-Content -LiteralPath $deployment.configPath -Raw | ConvertFrom-Json

    if ($status.product -ne 'TRC Community Atlas') {
        throw 'La reponse de sante ne provient pas de TRC Community Atlas.'
    }
    if ($status.version -ne $deployment.version) {
        throw "La version deployee ($($status.version)) ne correspond pas au paquet ($($deployment.version))."
    }
    if ($homeResponse.StatusCode -ne 200 -or $homeResponse.Content -notmatch 'TRC Community Atlas') {
        throw 'La page initiale Atlas n est pas accessible.'
    }
    if ([IO.Path]::GetFullPath([string]$config.dataRoot) -ne [IO.Path]::GetFullPath($dataRoot)) {
        throw 'Le repertoire de donnees configure ne correspond pas au repertoire isole demande.'
    }

    $databasePath = Join-Path $dataRoot 'atlas.sqlite'
    Stop-Process -Id ([int]$deployment.processId)
    $deadline = (Get-Date).AddSeconds(10)
    do {
        Start-Sleep -Milliseconds 200
        $initialListener = netstat -ano -p tcp | Select-String -Pattern (':{0}\s+.*LISTENING\s+\d+\s*$' -f $Port) | Select-Object -First 1
    } while ($initialListener -and (Get-Date) -lt $deadline)
    $databaseHashBefore = (Get-FileHash -LiteralPath $databasePath -Algorithm SHA256).Hash

    $runningJson = & $installerPath @arguments
    $runningDeployment = $runningJson | ConvertFrom-Json
    Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/status/details" -TimeoutSec 5 | Out-Null

    $reconfigurationArguments = @{
        InstallRoot = $installRoot
        DataRoot = $dataRoot
        Port = $ReconfiguredPort
        BindAddress = '127.0.0.1'
        SkipAutostart = $true
        SkipShortcuts = $true
        Json = $true
    }
    if ($NodePath) {
        $reconfigurationArguments.NodePath = $NodePath
    }
    $reconfiguredJson = & $installerPath @reconfigurationArguments
    $reconfiguredDeployment = $reconfiguredJson | ConvertFrom-Json
    $reconfiguredStatus = Invoke-RestMethod -Uri "http://127.0.0.1:$ReconfiguredPort/api/status/details" -TimeoutSec 5
    $reconfiguredConfig = Get-Content -LiteralPath $reconfiguredDeployment.configPath -Raw | ConvertFrom-Json
    if ($reconfiguredStatus.version -ne $deployment.version -or [int]$reconfiguredConfig.port -ne $ReconfiguredPort) {
        throw 'La reconfiguration du port Atlas n a pas ete appliquee.'
    }
    $installedConfigurator = Join-Path $installRoot 'scripts\Configure-TRCCommunityAtlas.ps1'
    $rememberedConfiguration = (& $installedConfigurator -DefaultsOnly | ConvertFrom-Json)
    if ([int]$rememberedConfiguration.port -ne $ReconfiguredPort -or [IO.Path]::GetFullPath([string]$rememberedConfiguration.dataRoot) -ne [IO.Path]::GetFullPath($dataRoot)) {
        throw 'Le configurateur installe ne recharge pas la configuration active.'
    }
    if ($TestAutostart) {
        $autostartManager = Join-Path $installRoot 'scripts\Set-TRCCommunityAtlasAutostart.ps1'
        $installedNode = Join-Path $installRoot 'runtime\node.exe'
        $enabledAutostart = (& $autostartManager `
            -Mode Enable `
            -ProjectRoot $installRoot `
            -NodePath $installedNode `
            -DataRoot $dataRoot `
            -TaskName $autostartTaskName `
            -Port $ReconfiguredPort `
            -BindAddress '127.0.0.1' `
            -Json | ConvertFrom-Json)
        if (-not $enabledAutostart.installed -or -not $enabledAutostart.enabled -or -not $enabledAutostart.hidden -or $enabledAutostart.trigger -notin @('startup', 'logon')) {
            throw 'La tache de demarrage Atlas n a pas ete configuree correctement.'
        }
        $disabledAutostart = (& $autostartManager `
            -Mode Disable `
            -ProjectRoot $installRoot `
            -NodePath $installedNode `
            -DataRoot $dataRoot `
            -TaskName $autostartTaskName `
            -Port $ReconfiguredPort `
            -BindAddress '127.0.0.1' `
            -Json | ConvertFrom-Json)
        if (-not $disabledAutostart.installed -or $disabledAutostart.enabled -or $disabledAutostart.state -ne 'Disabled') {
            throw 'La desactivation reversible de la tache Atlas a echoue.'
        }
        $autostartResult = 'PASS'
    }
    Stop-Process -Id ([int]$reconfiguredDeployment.processId)
    $deadline = (Get-Date).AddSeconds(10)
    do {
        Start-Sleep -Milliseconds 200
        $reconfiguredListener = netstat -ano -p tcp | Select-String -Pattern (':{0}\s+.*LISTENING\s+\d+\s*$' -f $ReconfiguredPort) | Select-Object -First 1
    } while ($reconfiguredListener -and (Get-Date) -lt $deadline)
    $databaseHashAfter = (Get-FileHash -LiteralPath $databasePath -Algorithm SHA256).Hash
    if ($databaseHashBefore -ne $databaseHashAfter) {
        throw 'La reconfiguration a modifie la base SQLite.'
    }

    [pscustomobject]@{
        Result = 'PASS'
        Version = $status.version
        Url = $deployment.url
        ReconfiguredUrl = $reconfiguredDeployment.url
        Reconfiguration = 'PASS'
        ConfiguratorReload = 'PASS'
        Autostart = $autostartResult
        DatabasePreserved = $true
        Initialized = [bool]$status.initialized
        Storage = $status.storage
        ProcessId = [int]$deployment.processId
        ProgramRoot = $installRoot
        DataRoot = $dataRoot
        TestEvidence = $TestRoot
    }
}
finally {
    if ($TestAutostart) {
        $qaTask = Get-ScheduledTask -TaskName $autostartTaskName -ErrorAction SilentlyContinue
        if ($qaTask) {
            Unregister-ScheduledTask -TaskName $autostartTaskName -Confirm:$false
        }
    }
    $processToStop = if ($reconfiguredDeployment -and $reconfiguredDeployment.processId) { $reconfiguredDeployment.processId } elseif ($runningDeployment -and $runningDeployment.processId) { $runningDeployment.processId } elseif ($deployment -and $deployment.processId) { $deployment.processId } else { $null }
    if ($processToStop) {
        Stop-Process -Id ([int]$processToStop) -ErrorAction SilentlyContinue
        $deadline = (Get-Date).AddSeconds(10)
        do {
            Start-Sleep -Milliseconds 200
            $listeners = @($Port, $ReconfiguredPort) | ForEach-Object {
                netstat -ano -p tcp | Select-String -Pattern (':{0}\s+.*LISTENING\s+\d+\s*$' -f $_) | Select-Object -First 1
            } | Where-Object { $_ }
        } while ($listeners -and (Get-Date) -lt $deadline)
    }
}
