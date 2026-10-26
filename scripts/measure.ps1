param([string]$Root = (Split-Path -Parent $PSScriptRoot))
$files = @(
    "Themes\PioneerVFDClaude\user.css",
    "Themes\PioneerVFDClaude\color.ini",
    "Extensions\pioneerVFDClaude.js"
)
$total = 0
foreach ($f in $files) {
    $path = Join-Path $Root $f
    if (-not (Test-Path $path)) { throw "measure: missing file $path" }
    $len = (Get-Item $path).Length
    $total += $len
    "{0,9} B  {1}" -f $len, $f
}
"{0,9} B  TOTAL" -f $total
"Original (verified 2026-10-26): user.css 736143 B + pioneerVFD.js 566583 B + ~50 MB of .webm"

$css = [IO.File]::ReadAllText((Join-Path $Root "Themes\PioneerVFDClaude\user.css"))
"backdrop-filter : " + ([regex]::Matches($css, 'backdrop-filter')).Count
"blur(           : " + ([regex]::Matches($css, 'blur\(')).Count
"!important      : " + ([regex]::Matches($css, '!important')).Count
"text-shadow     : " + ([regex]::Matches($css, 'text-shadow')).Count
"@keyframes      : " + ([regex]::Matches($css, '@keyframes')).Count
