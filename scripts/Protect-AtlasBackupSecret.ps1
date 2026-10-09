[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$OutputPath
)

$ErrorActionPreference = 'Stop'
$passphrase = [Console]::In.ReadLine()
if ([string]::IsNullOrWhiteSpace($passphrase) -or $passphrase.Length -lt 12) {
    throw 'La phrase secrète doit contenir au moins 12 caractères.'
}

$parent = Split-Path -Parent $OutputPath
if (-not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
}

$secure = ConvertTo-SecureString -String $passphrase -AsPlainText -Force
$temporary = "$OutputPath.$PID.tmp"
try {
    $secure | Export-Clixml -LiteralPath $temporary -Force
    Move-Item -LiteralPath $temporary -Destination $OutputPath -Force
    $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    & icacls.exe $OutputPath /inheritance:r /grant:r "${currentIdentity}:(R,W)" 'SYSTEM:(F)' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Impossible de restreindre les droits du secret planifié." }
    Write-Output '{"protected":true}'
} finally {
    $passphrase = $null
    if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
}

