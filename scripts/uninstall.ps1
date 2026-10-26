$ErrorActionPreference = "Stop"
$spice = Join-Path $env:APPDATA "spicetify"
$backup = Join-Path $spice "pvc-backup.json"
$myExt = "pioneerVFDClaude.js"
if (-not (Test-Path $backup)) { throw "uninstall: backup not found at $backup; nothing to restore" }
$b = Get-Content $backup -Raw | ConvertFrom-Json

function Get-Cfg([string]$key) { (spicetify config $key | Out-String).Trim() }
function Get-ExtList { @((Get-Cfg extensions) -split '[\r\n|]+' | Where-Object { $_ }) }
function Set-IniValue([string]$key, [string]$value) {
    $ini = Join-Path $spice "config-xpui.ini"
    $text = [IO.File]::ReadAllText($ini)
    $pattern = "(?m)^($key\s*=)[^\r\n]*"
    if ($text -notmatch $pattern) { throw "uninstall: key '$key' not found in $ini" }
    $new = [regex]::Replace($text, $pattern, { param($m) "$($m.Groups[1].Value) $value" })
    [IO.File]::WriteAllText($ini, $new, [Text.UTF8Encoding]::new($false))
}

# `config extensions X` adds X; `X-` removes it.
if ((Get-ExtList) -contains $myExt) { spicetify config extensions "$myExt-" }
foreach ($e in @($b.extensions -split '\|' | Where-Object { $_ })) {
    if ((Get-ExtList) -notcontains $e) { spicetify config extensions $e }
}

spicetify config current_theme $b.current_theme color_scheme $b.color_scheme inject_css $b.inject_css inject_theme_js $b.inject_theme_js replace_colors $b.replace_colors overwrite_assets $b.overwrite_assets expose_apis $b.expose_apis
Set-IniValue spotify_launch_flags $b.spotify_launch_flags

Remove-Item -Recurse -Force (Join-Path $spice "Themes\PioneerVFDClaude")
Remove-Item -Force (Join-Path $spice "Extensions\$myExt")
Write-Host "Applying (Spotify will restart)..."
spicetify apply
Remove-Item -Force $backup
Write-Host "RESULT theme=$(Get-Cfg current_theme) scheme=$(Get-Cfg color_scheme) extensions=$((Get-ExtList) -join ',') flags=[$(Get-Cfg spotify_launch_flags)]"
