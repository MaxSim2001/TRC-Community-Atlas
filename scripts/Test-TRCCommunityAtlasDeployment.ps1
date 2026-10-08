[CmdletBinding()]
param(
    [ValidateRange(1024, 65535)]
    [int]$Port = 9095,
    [string]$NodePath = '',
    [string]$TestRoot = ''
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

$existing = netstat -ano -p tcp | Select-String -Pattern (':{0}\s+.*LISTENING\s+\d+\s*$' -f $Port) | Select-Object -First 1
if ($existing) {
    throw "Le port de test $Port est deja occupe. Aucun deploiement n'a ete lance."
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
try {
    $deploymentJson = & $installerPath @arguments
    $deployment = $deploymentJson | ConvertFrom-Json
    $status = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/status" -TimeoutSec 5
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

    [pscustomobject]@{
        Result = 'PASS'
        Version = $status.version
        Url = $deployment.url
        Initialized = [bool]$status.initialized
        Storage = $status.storage
        ProcessId = [int]$deployment.processId
        ProgramRoot = $installRoot
        DataRoot = $dataRoot
        TestEvidence = $TestRoot
    }
}
finally {
    if ($deployment -and $deployment.processId) {
        Stop-Process -Id ([int]$deployment.processId) -ErrorAction SilentlyContinue
        $deadline = (Get-Date).AddSeconds(10)
        do {
            Start-Sleep -Milliseconds 200
            $listener = netstat -ano -p tcp | Select-String -Pattern (':{0}\s+.*LISTENING\s+\d+\s*$' -f $Port) | Select-Object -First 1
        } while ($listener -and (Get-Date) -lt $deadline)
    }
}
