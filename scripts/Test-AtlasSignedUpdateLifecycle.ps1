[CmdletBinding()]
param(
    [ValidateRange(1024,65535)][int]$Port = 9095,
    [string]$NodePath = '',
    [string]$SigningRoot = "$env:ProgramData\TRC\AtlasReleaseSigning",
    [string]$TestRoot = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Wait-Status {
    param([string]$Version, [int]$Seconds = 35)
    $deadline = (Get-Date).AddSeconds($Seconds)
    do {
        Start-Sleep -Milliseconds 500
        try { $status = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/status/details" -TimeoutSec 2 } catch { $status = $null }
        if ($status -and [string]$status.version -eq $Version -and [string]$status.storage -eq 'sqlite') { return $status }
    } while ((Get-Date) -lt $deadline)
    throw "Atlas $Version ne repond pas correctement sur le port QA $Port."
}

function New-CandidateRelease {
    param([string]$Version, [string]$FromVersion, [string]$Destination)
    $candidateSource = Join-Path $Destination 'source'
    $releaseRoot = Join-Path $Destination 'release'
    New-Item -ItemType Directory -Path $candidateSource -Force | Out-Null
    foreach ($file in @('server.mjs','package.json','README.md','LICENSE.txt','NOTICE.txt','Start-TRCCommunityAtlas.ps1','Install-Atlas.cmd')) {
        Copy-Item -LiteralPath (Join-Path $sourceRoot $file) -Destination (Join-Path $candidateSource $file) -Force
    }
    foreach ($directory in @('public','lib','scripts','docs','resources')) {
        Copy-Item -LiteralPath (Join-Path $sourceRoot $directory) -Destination (Join-Path $candidateSource $directory) -Recurse -Force
    }
    $packagePath = Join-Path $candidateSource 'package.json'
    $package = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json
    $package.version = $Version
    $package | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $packagePath -Encoding UTF8
    foreach ($relative in @('server.mjs','public\assets\app.js','public\index.html','public\service-worker.js')) {
        $target = Join-Path $candidateSource $relative
        $content = Get-Content -LiteralPath $target -Raw
        $content.Replace($FromVersion, $Version) | Set-Content -LiteralPath $target -Encoding UTF8
    }
    return & (Join-Path $candidateSource 'scripts\New-AtlasSignedRelease.ps1') -OutputDirectory $releaseRoot -SigningRoot $SigningRoot -NodePath $NodePath -CurrentVersion $FromVersion
}

if (-not $NodePath) { $NodePath = (Get-Command node -ErrorAction Stop).Source }
$sourceRoot = Split-Path -Parent $PSScriptRoot
$baselineVersion = [string](Get-Content -LiteralPath (Join-Path $sourceRoot 'package.json') -Raw | ConvertFrom-Json).version
if ($baselineVersion -ne '0.15.4') { throw "Ce scénario QA attend Atlas 0.15.4 comme base; version trouvée : $baselineVersion." }
if (netstat -ano -p tcp | Select-String -Pattern (':{0}\s+.*LISTENING\s+\d+\s*$' -f $Port) | Select-Object -First 1) {
    throw "Le port QA $Port est déjà occupé; aucun test n’a été lancé."
}
if (-not $TestRoot) { $TestRoot = Join-Path ([IO.Path]::GetTempPath()) "TRCAtlas-Signed-Update-QA-$(Get-Date -Format 'yyyy-MM-dd_HH-mm-ss')" }
$TestRoot = [IO.Path]::GetFullPath($TestRoot)
$installRoot = Join-Path $TestRoot 'program'
$instanceRoot = Join-Path $TestRoot 'instance'
$dataRoot = Join-Path $instanceRoot 'data'
$updateRoot = Join-Path $instanceRoot 'updates'
$taskName = "TRC Community Atlas Signed Update QA $([Guid]::NewGuid().ToString('N'))"
$resultPath = Join-Path $TestRoot 'signed-update-result.json'
$successRelease = $null
$rollbackRelease = $null

try {
    New-Item -ItemType Directory -Path $TestRoot -Force | Out-Null
    & (Join-Path $sourceRoot 'scripts\Install-TRCCommunityAtlas.ps1') -InstallRoot $installRoot -DataRoot $dataRoot -Port $Port -BindAddress '127.0.0.1' -NodePath $NodePath -TaskName $taskName -SkipShortcuts -SkipStart -Json | Out-Null
    Start-ScheduledTask -TaskName $taskName
    $deadline = (Get-Date).AddSeconds(30)
    do {
        Start-Sleep -Milliseconds 500
        try { $initial = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/status/details" -TimeoutSec 2 } catch { $initial = $null }
    } while ((-not $initial) -and (Get-Date) -lt $deadline)
    if (-not $initial -or [string]$initial.version -ne $baselineVersion) { throw 'L instance Atlas QA initiale ne repond pas.' }
    & $NodePath (Join-Path $sourceRoot 'scripts\atlas-update-qa-seed.mjs') "http://127.0.0.1:$Port/" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'La preparation des donnees QA a echoue.' }
    $before = (& (Join-Path $installRoot 'runtime\node.exe') (Join-Path $installRoot 'scripts\atlas-update-inventory.mjs') $dataRoot | ConvertFrom-Json)

    $successRelease = New-CandidateRelease -Version '0.15.5' -FromVersion $baselineVersion -Destination (Join-Path $TestRoot 'candidate-0.15.5')
    $successJob = 'qa-success'
    $successArgs = @('-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',(Join-Path $installRoot 'scripts\Invoke-AtlasReleaseUpdate.ps1'),'-JobId',$successJob,'-InstallRoot',$installRoot,'-DataRoot',$dataRoot,'-UpdateRoot',$updateRoot,'-PackagePath',[string]$successRelease.Archive,'-ManifestPath',[string]$successRelease.Manifest,'-SignaturePath',[string]$successRelease.Signature,'-PublicKeyPath',(Join-Path $installRoot 'resources\atlas-release-public-key.pem'),'-ExpectedVersion','0.15.5','-TaskName',$taskName,'-Port',[string]$Port,'-BindAddress','127.0.0.1')
    & "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" @successArgs
    $successExitCode = $LASTEXITCODE
    if ($successExitCode -ne 0) { throw "Le scénario de mise à jour a échoué avec le code $successExitCode." }
    Wait-Status '0.15.5' | Out-Null
    $successState = Get-Content -LiteralPath (Join-Path $updateRoot "jobs\$successJob.json") -Raw | ConvertFrom-Json
    if ($successState.status -ne 'succeeded') { throw "État de mise à jour inattendu : $($successState.status)" }
    $afterSuccess = (& (Join-Path $installRoot 'runtime\node.exe') (Join-Path $installRoot 'scripts\atlas-update-inventory.mjs') $dataRoot | ConvertFrom-Json)

    $rollbackRelease = New-CandidateRelease -Version '0.15.6' -FromVersion '0.15.5' -Destination (Join-Path $TestRoot 'candidate-0.15.6')
    $rollbackJob = 'qa-rollback'
    $rollbackArgs = @('-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',(Join-Path $installRoot 'scripts\Invoke-AtlasReleaseUpdate.ps1'),'-JobId',$rollbackJob,'-InstallRoot',$installRoot,'-DataRoot',$dataRoot,'-UpdateRoot',$updateRoot,'-PackagePath',[string]$rollbackRelease.Archive,'-ManifestPath',[string]$rollbackRelease.Manifest,'-SignaturePath',[string]$rollbackRelease.Signature,'-PublicKeyPath',(Join-Path $installRoot 'resources\atlas-release-public-key.pem'),'-ExpectedVersion','0.15.6','-TaskName',$taskName,'-Port',[string]$Port,'-BindAddress','127.0.0.1','-SimulateHealthFailure')
    & "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" @rollbackArgs
    $rollbackExitCode = $LASTEXITCODE
    if ($rollbackExitCode -eq 0) { throw 'Le scénario de retour arrière devait simuler un échec.' }
    Wait-Status '0.15.5' | Out-Null
    $rollbackState = Get-Content -LiteralPath (Join-Path $updateRoot "jobs\$rollbackJob.json") -Raw | ConvertFrom-Json
    if ($rollbackState.status -ne 'rolled-back') { throw "État de retour arrière inattendu : $($rollbackState.status)" }
    $afterRollback = (& (Join-Path $installRoot 'runtime\node.exe') (Join-Path $installRoot 'scripts\atlas-update-inventory.mjs') $dataRoot | ConvertFrom-Json)
    foreach ($field in @('organizations','configurations','moduleRecords','procedures','users','vaultItems','attachments')) {
        if ($afterSuccess.$field -ne $before.$field -or $afterRollback.$field -ne $before.$field) { throw "Les données QA ont changé pendant le test : $field." }
    }
    if ($afterRollback.quickCheck -ne 'ok' -or -not $afterRollback.vaultWitness) { throw 'Le coffre ou SQLite ne survit pas au retour arrière.' }
    $report = [ordered]@{
        Result = 'PASS'
        BaselineVersion = $baselineVersion
        UpdatedVersion = '0.15.5'
        SuccessfulUpdate = $successState.status
        SimulatedFailure = '0.15.6'
        Rollback = $rollbackState.status
        RestoredVersion = '0.15.5'
        Sqlite = $afterRollback.quickCheck
        VaultWitness = [bool]$afterRollback.vaultWitness
        BusinessCountsPreserved = $true
        Port = $Port
        TaskName = $taskName
        EvidenceRoot = $TestRoot
    }
    $report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $resultPath -Encoding UTF8
    [pscustomobject]$report
}
finally {
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    $listener = netstat -ano -p tcp | Select-String -Pattern (':{0}\s+.*LISTENING\s+(\d+)\s*$' -f $Port) | Select-Object -First 1
    if ($listener) { Stop-Process -Id ([int]$listener.Matches[0].Groups[1].Value) -ErrorAction SilentlyContinue }
    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) { Unregister-ScheduledTask -TaskName $taskName -Confirm:$false }
}
