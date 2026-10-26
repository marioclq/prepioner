param([switch]$DebugPort)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$spice = Join-Path $env:APPDATA "spicetify"
$themeDest = Join-Path $spice "Themes\PioneerVFDClaude"
$extDest = Join-Path $spice "Extensions"
$backup = Join-Path $spice "pvc-backup.json"
$myExt = "pioneerVFDClaude.js"
# Other builds that mount the same Now Playing bar: disabled (not deleted) so only one chassis exists.
$rivalExt = "pioneerVFDLite.js"

if (-not (Get-Command spicetify -ErrorAction SilentlyContinue)) { throw "install: spicetify not found in PATH" }
foreach ($f in "Themes\PioneerVFDClaude\user.css", "Themes\PioneerVFDClaude\color.ini", "Extensions\$myExt") {
    if (-not (Test-Path (Join-Path $root $f))) { throw "install: missing source file $f" }
}

function Get-Cfg([string]$key) { (spicetify config $key | Out-String).Trim() }
# `spicetify config extensions` prints one entry per line; the ini stores them joined by "|".
function Get-ExtList { @((Get-Cfg extensions) -split '[\r\n|]+' | Where-Object { $_ }) }

# `spicetify config spotify_launch_flags --x=y` is silently ignored (the value looks like a CLI flag),
# so that one key is written straight into config-xpui.ini (format: spicetify.app/docs/customization/config-file).
function Set-IniValue([string]$key, [string]$value) {
    $ini = Join-Path $spice "config-xpui.ini"
    $text = [IO.File]::ReadAllText($ini)
    $pattern = "(?m)^($key\s*=)[^\r\n]*"
    if ($text -notmatch $pattern) { throw "install: key '$key' not found in $ini" }
    $new = [regex]::Replace($text, $pattern, { param($m) "$($m.Groups[1].Value) $value" })
    [IO.File]::WriteAllText($ini, $new, [Text.UTF8Encoding]::new($false))
}

# Back up the config as it is right now, once; re-running must not overwrite the original values.
if (-not (Test-Path $backup)) {
    [ordered]@{
        current_theme        = Get-Cfg current_theme
        color_scheme         = Get-Cfg color_scheme
        extensions           = ((Get-ExtList) -join '|')
        inject_css           = Get-Cfg inject_css
        inject_theme_js      = Get-Cfg inject_theme_js
        replace_colors       = Get-Cfg replace_colors
        overwrite_assets     = Get-Cfg overwrite_assets
        expose_apis          = Get-Cfg expose_apis
        spotify_launch_flags = Get-Cfg spotify_launch_flags
    } | ConvertTo-Json | Set-Content $backup -Encoding utf8
    Write-Host "Backup written: $backup"
}
$b = Get-Content $backup -Raw | ConvertFrom-Json

New-Item -ItemType Directory -Force $themeDest, $extDest | Out-Null
Copy-Item -Force (Join-Path $root "Themes\PioneerVFDClaude\user.css") $themeDest
Copy-Item -Force (Join-Path $root "Themes\PioneerVFDClaude\color.ini") $themeDest
Copy-Item -Force (Join-Path $root "Extensions\$myExt") $extDest

spicetify config current_theme PioneerVFDClaude color_scheme PioneerVFDClaude inject_css 1 inject_theme_js 0 replace_colors 1 overwrite_assets 0 expose_apis 1

# `config extensions X` adds X; `X-` removes it.
if ((Get-ExtList) -contains $rivalExt) { spicetify config extensions "$rivalExt-" }
if ((Get-ExtList) -notcontains $myExt) { spicetify config extensions $myExt }

Set-IniValue spotify_launch_flags $(if ($DebugPort) { "--remote-debugging-port=9222" } else { $b.spotify_launch_flags })

Write-Host "Applying (Spotify will restart)..."
spicetify apply
Write-Host "RESULT theme=$(Get-Cfg current_theme) extensions=$((Get-ExtList) -join ',') flags=[$(Get-Cfg spotify_launch_flags)]"
