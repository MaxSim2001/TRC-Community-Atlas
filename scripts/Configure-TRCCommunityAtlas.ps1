[CmdletBinding()]
param(
    [switch]$DefaultsOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$sourceRoot = Split-Path -Parent $PSScriptRoot
$installerPath = Join-Path $PSScriptRoot 'Install-TRCCommunityAtlas.ps1'
$localApplicationData = [Environment]::GetFolderPath('LocalApplicationData')
$defaultInstallRoot = Join-Path $localApplicationData 'Programs\TRC Community Atlas'
$defaultDataRoot = Join-Path $localApplicationData 'TRC Community Atlas\data'
$defaultConfigPath = Join-Path (Split-Path -Parent $defaultDataRoot) 'config\instance.json'
$configPathToLoad = $defaultConfigPath
$instancePointerPath = Join-Path $sourceRoot 'instance-location.json'
if (Test-Path -LiteralPath $instancePointerPath -PathType Leaf) {
    try {
        $instancePointer = Get-Content -LiteralPath $instancePointerPath -Raw | ConvertFrom-Json
        if ($instancePointer.configPath -and (Test-Path -LiteralPath ([string]$instancePointer.configPath) -PathType Leaf)) {
            $configPathToLoad = [string]$instancePointer.configPath
        }
    }
    catch {
        $configPathToLoad = $defaultConfigPath
    }
}
$package = Get-Content -LiteralPath (Join-Path $sourceRoot 'package.json') -Raw | ConvertFrom-Json

$defaults = [ordered]@{
    installRoot = $defaultInstallRoot
    dataRoot = $defaultDataRoot
    bindAddress = '127.0.0.1'
    port = 9092
    allowedOrigins = @()
    trustedProxies = @()
    channel = 'stable'
    autostart = $true
    shortcut = $true
}

if (Test-Path -LiteralPath $configPathToLoad -PathType Leaf) {
    try {
        $saved = Get-Content -LiteralPath $configPathToLoad -Raw | ConvertFrom-Json
        foreach ($name in @('installRoot', 'dataRoot', 'bindAddress', 'port', 'allowedOrigins', 'trustedProxies', 'channel', 'autostart', 'shortcut')) {
            if ($null -ne $saved.$name) {
                $defaults[$name] = $saved.$name
            }
        }
    }
    catch {
        # The installer will provide the detailed error if the user continues.
    }
}

if ($DefaultsOnly) {
    $defaults | ConvertTo-Json -Depth 4
    exit 0
}

$initialDataRoot = [IO.Path]::GetFullPath([string]$defaults.dataRoot)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[Windows.Forms.Application]::EnableVisualStyles()

function New-AtlasLabel {
    param(
        [string]$Text,
        [int]$X,
        [int]$Y,
        [int]$Width = 700,
        [int]$Height = 22,
        [float]$Size = 9,
        [Drawing.FontStyle]$Style = [Drawing.FontStyle]::Regular,
        [Drawing.Color]$Color = [Drawing.Color]::White
    )
    $label = [Windows.Forms.Label]::new()
    $label.Text = $Text
    $label.Location = [Drawing.Point]::new($X, $Y)
    $label.Size = [Drawing.Size]::new($Width, $Height)
    $label.Font = [Drawing.Font]::new('Segoe UI', $Size, $Style)
    $label.ForeColor = $Color
    $label.BackColor = [Drawing.Color]::Transparent
    return $label
}

function Set-AtlasTextBoxStyle {
    param([Windows.Forms.TextBox]$Control)
    $Control.BackColor = [Drawing.ColorTranslator]::FromHtml('#111d31')
    $Control.ForeColor = [Drawing.Color]::White
    $Control.BorderStyle = [Windows.Forms.BorderStyle]::FixedSingle
    $Control.Font = [Drawing.Font]::new('Segoe UI', 9)
}

function Get-ListenerProcessId {
    param([int]$Port)
    $match = netstat -ano -p tcp |
        Select-String -Pattern (':{0}\s+.*LISTENING\s+(\d+)\s*$' -f $Port) |
        Select-Object -First 1
    if (-not $match) {
        return $null
    }
    return [int]$match.Matches[0].Groups[1].Value
}

function Select-AtlasFolder {
    param(
        [Windows.Forms.TextBox]$Target,
        [string]$Description
    )
    $dialog = [Windows.Forms.FolderBrowserDialog]::new()
    $dialog.Description = $Description
    $dialog.ShowNewFolderButton = $true
    if (Test-Path -LiteralPath $Target.Text -PathType Container) {
        $dialog.SelectedPath = $Target.Text
    }
    if ($dialog.ShowDialog() -eq [Windows.Forms.DialogResult]::OK) {
        $Target.Text = $dialog.SelectedPath
    }
    $dialog.Dispose()
}

$form = [Windows.Forms.Form]::new()
$form.Text = "TRC Community Atlas $($package.version) - Configuration"
$form.StartPosition = [Windows.Forms.FormStartPosition]::CenterScreen
$form.ClientSize = [Drawing.Size]::new(820, 820)
$form.MinimumSize = [Drawing.Size]::new(836, 859)
$form.BackColor = [Drawing.ColorTranslator]::FromHtml('#080f1d')
$form.ForeColor = [Drawing.Color]::White
$form.Font = [Drawing.Font]::new('Segoe UI', 9)
$form.AutoScroll = $true

$form.Controls.Add((New-AtlasLabel -Text 'TRC COMMUNITY ATLAS' -X 32 -Y 20 -Width 500 -Height 24 -Size 9 -Style Bold -Color ([Drawing.ColorTranslator]::FromHtml('#43d7de'))))
$form.Controls.Add((New-AtlasLabel -Text 'Installer ou reconfigurer Atlas' -X 32 -Y 46 -Width 720 -Height 42 -Size 20 -Style Bold))
$form.Controls.Add((New-AtlasLabel -Text 'Tous les choix sont conserves localement. Aucun port de pare-feu, DNS ou routeur ne sera modifie.' -X 34 -Y 90 -Width 740 -Height 28 -Color ([Drawing.ColorTranslator]::FromHtml('#a9bad4'))))

$networkGroup = [Windows.Forms.GroupBox]::new()
$networkGroup.Text = ' Acces a Atlas '
$networkGroup.Location = [Drawing.Point]::new(30, 128)
$networkGroup.Size = [Drawing.Size]::new(760, 300)
$networkGroup.ForeColor = [Drawing.Color]::White
$networkGroup.BackColor = [Drawing.ColorTranslator]::FromHtml('#0d1729')
$form.Controls.Add($networkGroup)

$networkGroup.Controls.Add((New-AtlasLabel -Text 'Mode d acces' -X 20 -Y 28 -Width 210))
$accessMode = [Windows.Forms.ComboBox]::new()
$accessMode.Location = [Drawing.Point]::new(20, 52)
$accessMode.Size = [Drawing.Size]::new(350, 28)
$accessMode.DropDownStyle = [Windows.Forms.ComboBoxStyle]::DropDownList
$accessMode.Items.AddRange(@('Seulement cet ordinateur (recommande)', 'Reseau local ou proxy inverse (avance)'))
$accessMode.BackColor = [Drawing.ColorTranslator]::FromHtml('#111d31')
$accessMode.ForeColor = [Drawing.Color]::White
$networkGroup.Controls.Add($accessMode)

$networkGroup.Controls.Add((New-AtlasLabel -Text 'Adresse d ecoute' -X 390 -Y 28 -Width 170))
$bindAddressBox = [Windows.Forms.TextBox]::new()
$bindAddressBox.Location = [Drawing.Point]::new(390, 52)
$bindAddressBox.Size = [Drawing.Size]::new(180, 25)
$bindAddressBox.Text = [string]$defaults.bindAddress
Set-AtlasTextBoxStyle $bindAddressBox
$networkGroup.Controls.Add($bindAddressBox)

$networkGroup.Controls.Add((New-AtlasLabel -Text 'Port Atlas' -X 590 -Y 28 -Width 120))
$portBox = [Windows.Forms.NumericUpDown]::new()
$portBox.Location = [Drawing.Point]::new(590, 52)
$portBox.Size = [Drawing.Size]::new(130, 25)
$portBox.Minimum = 1024
$portBox.Maximum = 65535
$portBox.Value = [decimal][int]$defaults.port
$portBox.BackColor = [Drawing.ColorTranslator]::FromHtml('#111d31')
$portBox.ForeColor = [Drawing.Color]::White
$networkGroup.Controls.Add($portBox)

$testPortButton = [Windows.Forms.Button]::new()
$testPortButton.Text = 'Tester le port'
$testPortButton.Location = [Drawing.Point]::new(590, 86)
$testPortButton.Size = [Drawing.Size]::new(130, 30)
$testPortButton.FlatStyle = [Windows.Forms.FlatStyle]::Flat
$testPortButton.FlatAppearance.BorderColor = [Drawing.ColorTranslator]::FromHtml('#43d7de')
$testPortButton.ForeColor = [Drawing.ColorTranslator]::FromHtml('#43d7de')
$networkGroup.Controls.Add($testPortButton)

$portStatus = New-AtlasLabel -Text 'Un seul port sert a l interface et a l API.' -X 20 -Y 91 -Width 540 -Height 30 -Color ([Drawing.ColorTranslator]::FromHtml('#a9bad4'))
$networkGroup.Controls.Add($portStatus)

$networkGroup.Controls.Add((New-AtlasLabel -Text 'Origines HTTPS autorisees (une par ligne, optionnel)' -X 20 -Y 127 -Width 500))
$originsBox = [Windows.Forms.TextBox]::new()
$originsBox.Location = [Drawing.Point]::new(20, 151)
$originsBox.Size = [Drawing.Size]::new(700, 52)
$originsBox.Multiline = $true
$originsBox.ScrollBars = [Windows.Forms.ScrollBars]::Vertical
$originsBox.Text = (@($defaults.allowedOrigins) -join [Environment]::NewLine)
Set-AtlasTextBoxStyle $originsBox
$networkGroup.Controls.Add($originsBox)

$networkGroup.Controls.Add((New-AtlasLabel -Text 'Proxys de confiance (adresses IP, une par ligne, optionnel)' -X 20 -Y 211 -Width 560))
$trustedProxiesBox = [Windows.Forms.TextBox]::new()
$trustedProxiesBox.Location = [Drawing.Point]::new(20, 235)
$trustedProxiesBox.Size = [Drawing.Size]::new(700, 44)
$trustedProxiesBox.Multiline = $true
$trustedProxiesBox.ScrollBars = [Windows.Forms.ScrollBars]::Vertical
$trustedProxiesBox.Text = (@($defaults.trustedProxies) -join [Environment]::NewLine)
Set-AtlasTextBoxStyle $trustedProxiesBox
$networkGroup.Controls.Add($trustedProxiesBox)

$storageGroup = [Windows.Forms.GroupBox]::new()
$storageGroup.Text = ' Programme et donnees '
$storageGroup.Location = [Drawing.Point]::new(30, 442)
$storageGroup.Size = [Drawing.Size]::new(760, 176)
$storageGroup.ForeColor = [Drawing.Color]::White
$storageGroup.BackColor = [Drawing.ColorTranslator]::FromHtml('#0d1729')
$form.Controls.Add($storageGroup)

$storageGroup.Controls.Add((New-AtlasLabel -Text 'Dossier du programme' -X 20 -Y 27 -Width 250))
$installRootBox = [Windows.Forms.TextBox]::new()
$installRootBox.Location = [Drawing.Point]::new(20, 51)
$installRootBox.Size = [Drawing.Size]::new(610, 25)
$installRootBox.Text = [string]$defaults.installRoot
Set-AtlasTextBoxStyle $installRootBox
$storageGroup.Controls.Add($installRootBox)
$browseInstall = [Windows.Forms.Button]::new()
$browseInstall.Text = 'Parcourir'
$browseInstall.Location = [Drawing.Point]::new(640, 49)
$browseInstall.Size = [Drawing.Size]::new(80, 28)
$storageGroup.Controls.Add($browseInstall)

$storageGroup.Controls.Add((New-AtlasLabel -Text 'Dossier des donnees persistantes' -X 20 -Y 86 -Width 280))
$dataRootBox = [Windows.Forms.TextBox]::new()
$dataRootBox.Location = [Drawing.Point]::new(20, 110)
$dataRootBox.Size = [Drawing.Size]::new(610, 25)
$dataRootBox.Text = [string]$defaults.dataRoot
Set-AtlasTextBoxStyle $dataRootBox
$storageGroup.Controls.Add($dataRootBox)
$browseData = [Windows.Forms.Button]::new()
$browseData.Text = 'Parcourir'
$browseData.Location = [Drawing.Point]::new(640, 108)
$browseData.Size = [Drawing.Size]::new(80, 28)
$storageGroup.Controls.Add($browseData)
$storageGroup.Controls.Add((New-AtlasLabel -Text 'SQLite est un fichier local : aucun serveur ni port de base de donnees n est requis.' -X 20 -Y 142 -Width 700 -Height 24 -Color ([Drawing.ColorTranslator]::FromHtml('#6ee7b7'))))

$optionsGroup = [Windows.Forms.GroupBox]::new()
$optionsGroup.Text = ' Options '
$optionsGroup.Location = [Drawing.Point]::new(30, 632)
$optionsGroup.Size = [Drawing.Size]::new(760, 88)
$optionsGroup.ForeColor = [Drawing.Color]::White
$optionsGroup.BackColor = [Drawing.ColorTranslator]::FromHtml('#0d1729')
$form.Controls.Add($optionsGroup)

$autostartBox = [Windows.Forms.CheckBox]::new()
$autostartBox.Text = 'Demarrer Atlas automatiquement en arriere-plan'
$autostartBox.Location = [Drawing.Point]::new(20, 26)
$autostartBox.Size = [Drawing.Size]::new(330, 24)
$autostartBox.Checked = [bool]$defaults.autostart
$optionsGroup.Controls.Add($autostartBox)

$shortcutBox = [Windows.Forms.CheckBox]::new()
$shortcutBox.Text = 'Raccourci menu Demarrer'
$shortcutBox.Location = [Drawing.Point]::new(20, 54)
$shortcutBox.Size = [Drawing.Size]::new(230, 24)
$shortcutBox.Checked = [bool]$defaults.shortcut
$optionsGroup.Controls.Add($shortcutBox)

$openBrowserBox = [Windows.Forms.CheckBox]::new()
$openBrowserBox.Text = 'Ouvrir Atlas apres l installation'
$openBrowserBox.Location = [Drawing.Point]::new(370, 26)
$openBrowserBox.Size = [Drawing.Size]::new(260, 24)
$openBrowserBox.Checked = $true
$optionsGroup.Controls.Add($openBrowserBox)

$optionsGroup.Controls.Add((New-AtlasLabel -Text 'Canal' -X 370 -Y 54 -Width 55 -Height 24))
$channelBox = [Windows.Forms.ComboBox]::new()
$channelBox.Location = [Drawing.Point]::new(430, 52)
$channelBox.Size = [Drawing.Size]::new(135, 24)
$channelBox.DropDownStyle = [Windows.Forms.ComboBoxStyle]::DropDownList
$channelBox.Items.AddRange(@('stable', 'beta'))
$channelBox.SelectedItem = [string]$defaults.channel
if ($channelBox.SelectedIndex -lt 0) {
    $channelBox.SelectedItem = 'stable'
}
$optionsGroup.Controls.Add($channelBox)

$statusLabel = New-AtlasLabel -Text 'Pret a installer ou reconfigurer Atlas.' -X 32 -Y 736 -Width 520 -Height 36 -Color ([Drawing.ColorTranslator]::FromHtml('#a9bad4'))
$form.Controls.Add($statusLabel)

$cancelButton = [Windows.Forms.Button]::new()
$cancelButton.Text = 'Annuler'
$cancelButton.Location = [Drawing.Point]::new(580, 737)
$cancelButton.Size = [Drawing.Size]::new(92, 36)
$cancelButton.FlatStyle = [Windows.Forms.FlatStyle]::Flat
$cancelButton.DialogResult = [Windows.Forms.DialogResult]::Cancel
$form.Controls.Add($cancelButton)
$form.CancelButton = $cancelButton

$installButton = [Windows.Forms.Button]::new()
$installButton.Text = 'Installer Atlas'
$installButton.Location = [Drawing.Point]::new(682, 737)
$installButton.Size = [Drawing.Size]::new(108, 36)
$installButton.FlatStyle = [Windows.Forms.FlatStyle]::Flat
$installButton.BackColor = [Drawing.ColorTranslator]::FromHtml('#43d7de')
$installButton.ForeColor = [Drawing.ColorTranslator]::FromHtml('#07111f')
$installButton.Font = [Drawing.Font]::new('Segoe UI', 9, [Drawing.FontStyle]::Bold)
$form.Controls.Add($installButton)

$localMode = ([string]$defaults.bindAddress -eq '127.0.0.1' -or [string]$defaults.bindAddress -eq '::1')
$accessMode.SelectedIndex = if ($localMode) { 0 } else { 1 }
$bindAddressBox.Enabled = -not $localMode

$accessMode.Add_SelectedIndexChanged({
    $advanced = $accessMode.SelectedIndex -eq 1
    $bindAddressBox.Enabled = $advanced
    if (-not $advanced) {
        $bindAddressBox.Text = '127.0.0.1'
    }
    elseif ($bindAddressBox.Text -eq '127.0.0.1') {
        $bindAddressBox.Text = '0.0.0.0'
    }
})

$testPortButton.Add_Click({
    $selectedPort = [int]$portBox.Value
    $listener = Get-ListenerProcessId -Port $selectedPort
    if ($listener) {
        $portStatus.Text = "Port $selectedPort utilise par le processus $listener. Atlas pourra le reutiliser seulement s il lui appartient."
        $portStatus.ForeColor = [Drawing.ColorTranslator]::FromHtml('#fbbf24')
    }
    else {
        $portStatus.Text = "Port $selectedPort disponible sur cet ordinateur."
        $portStatus.ForeColor = [Drawing.ColorTranslator]::FromHtml('#6ee7b7')
    }
})

$browseInstall.Add_Click({ Select-AtlasFolder -Target $installRootBox -Description 'Choisir le dossier du programme Atlas' })
$browseData.Add_Click({ Select-AtlasFolder -Target $dataRootBox -Description 'Choisir le dossier local des donnees Atlas' })

$installButton.Add_Click({
    try {
        $bindAddress = $bindAddressBox.Text.Trim()
        $parsedAddress = $null
        if (-not [Net.IPAddress]::TryParse($bindAddress, [ref]$parsedAddress)) {
            throw 'Saisissez une adresse IP d ecoute valide.'
        }
        if (-not $installRootBox.Text.Trim() -or -not $dataRootBox.Text.Trim()) {
            throw 'Les dossiers du programme et des donnees sont requis.'
        }
        if ($dataRootBox.Text.Trim().StartsWith('\\')) {
            throw 'Le dossier de donnees SQLite doit etre local et ne peut pas etre un partage reseau.'
        }

        $selectedDataRoot = [IO.Path]::GetFullPath($dataRootBox.Text.Trim())
        if ($selectedDataRoot -ne $initialDataRoot) {
            $dataAnswer = [Windows.Forms.MessageBox]::Show(
                "Le dossier de donnees a change.`r`n`r`nAtlas utilisera les donnees presentes dans :`r`n$selectedDataRoot`r`n`r`nLes anciennes donnees ne seront ni deplacees ni supprimees. Continuer ?",
                'Changement du dossier de donnees',
                [Windows.Forms.MessageBoxButtons]::YesNo,
                [Windows.Forms.MessageBoxIcon]::Warning
            )
            if ($dataAnswer -ne [Windows.Forms.DialogResult]::Yes) {
                return
            }
        }

        $origins = @($originsBox.Text -split '[,;\r\n]+' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
        foreach ($origin in $origins) {
            $uri = $null
            if (-not [Uri]::TryCreate($origin, [UriKind]::Absolute, [ref]$uri) -or $uri.Scheme -ne 'https' -or $uri.PathAndQuery -ne '/') {
                throw "Origine invalide : $origin. Utilisez le format https://atlas.exemple.com"
            }
        }

        $trustedProxies = @($trustedProxiesBox.Text -split '[,;\r\n]+' | ForEach-Object { $_.Trim() } | Where-Object { $_ } | Select-Object -Unique)
        if ($trustedProxies.Count -gt 16) {
            throw 'Saisissez au maximum 16 adresses de proxy de confiance.'
        }
        foreach ($proxyAddress in $trustedProxies) {
            $parsedProxyAddress = $null
            if (-not [Net.IPAddress]::TryParse($proxyAddress, [ref]$parsedProxyAddress)) {
                throw "Adresse de proxy de confiance invalide : $proxyAddress"
            }
        }

        if ($bindAddress -ne '127.0.0.1' -and $bindAddress -ne '::1') {
            $answer = [Windows.Forms.MessageBox]::Show(
                "Atlas ecoutera sur $bindAddress. L installateur n ouvre aucun pare-feu. Configurez le proxy, TLS et le pare-feu separement. Continuer ?",
                'Ecoute reseau avancee',
                [Windows.Forms.MessageBoxButtons]::YesNo,
                [Windows.Forms.MessageBoxIcon]::Warning
            )
            if ($answer -ne [Windows.Forms.DialogResult]::Yes) {
                return
            }
        }

        $installButton.Enabled = $false
        $cancelButton.Enabled = $false
        $statusLabel.Text = 'Installation et verification de sante en cours...'
        $statusLabel.ForeColor = [Drawing.ColorTranslator]::FromHtml('#43d7de')
        [Windows.Forms.Application]::DoEvents()

        $arguments = @{
            InstallRoot = $installRootBox.Text.Trim()
            DataRoot = $selectedDataRoot
            Port = [int]$portBox.Value
            BindAddress = $bindAddress
            AllowedOrigin = $origins
            TrustedProxy = $trustedProxies
            Channel = [string]$channelBox.SelectedItem
        }
        if (-not $autostartBox.Checked) { $arguments.SkipAutostart = $true }
        if (-not $shortcutBox.Checked) { $arguments.SkipShortcuts = $true }
        if ($openBrowserBox.Checked) { $arguments.OpenBrowser = $true }

        $result = & $installerPath @arguments | Select-Object -Last 1
        $statusLabel.Text = "Atlas $($result.version) est pret sur $($result.url)"
        $statusLabel.ForeColor = [Drawing.ColorTranslator]::FromHtml('#6ee7b7')
        [Windows.Forms.MessageBox]::Show(
            "Atlas est installe et fonctionnel.`r`n`r`nAdresse : $($result.url)`r`nDonnees : $($result.dataRoot)`r`n`r`nLa base SQLite n utilise aucun port supplementaire.",
            'Installation Atlas terminee',
            [Windows.Forms.MessageBoxButtons]::OK,
            [Windows.Forms.MessageBoxIcon]::Information
        ) | Out-Null
        $form.DialogResult = [Windows.Forms.DialogResult]::OK
        $form.Close()
    }
    catch {
        $statusLabel.Text = 'Installation interrompue. Corrigez le point indique.'
        $statusLabel.ForeColor = [Drawing.ColorTranslator]::FromHtml('#fb7185')
        [Windows.Forms.MessageBox]::Show(
            $_.Exception.Message,
            'TRC Community Atlas',
            [Windows.Forms.MessageBoxButtons]::OK,
            [Windows.Forms.MessageBoxIcon]::Error
        ) | Out-Null
    }
    finally {
        $installButton.Enabled = $true
        $cancelButton.Enabled = $true
    }
})

[void]$form.ShowDialog()
$form.Dispose()
