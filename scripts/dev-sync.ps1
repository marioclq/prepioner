# Dev loop: copy sources into Spicetify's folders, restart Spotify with the configured flags,
# wait until the extension reports "mounted". (Reloading the page over CDP breaks Spotify's React tree.)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$spice = Join-Path $env:APPDATA "spicetify"
Copy-Item -Force (Join-Path $root "Themes\PioneerVFDClaude\user.css") (Join-Path $spice "Themes\PioneerVFDClaude")
Copy-Item -Force (Join-Path $root "Themes\PioneerVFDClaude\color.ini") (Join-Path $spice "Themes\PioneerVFDClaude")
Copy-Item -Force (Join-Path $root "Extensions\pioneerVFDClaude.js") (Join-Path $spice "Extensions")
spicetify -q -n -e refresh
if ($LASTEXITCODE -ne 0) { throw "dev-sync: spicetify refresh failed with exit code $LASTEXITCODE" }
spicetify -q restart

$cdp = Join-Path $PSScriptRoot "cdp.js"
$deadline = (Get-Date).AddSeconds(45)
do {
    Start-Sleep -Seconds 2
    $marker = node $cdp eval "document.documentElement.dataset.pvc" 2>$null
} while ($marker -ne '"mounted"' -and (Get-Date) -lt $deadline)
if ($marker -ne '"mounted"') { throw "dev-sync: extension did not report mounted within 45 s (last marker: $marker)" }
"mounted"
