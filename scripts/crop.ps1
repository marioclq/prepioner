param([Parameter(Mandatory)][string]$In, [Parameter(Mandatory)][string]$Out, [Parameter(Mandatory)][int]$X, [Parameter(Mandatory)][int]$Y, [Parameter(Mandatory)][int]$W, [Parameter(Mandatory)][int]$H)
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile($In)
try {
    if ($X + $W -gt $src.Width -or $Y + $H -gt $src.Height) { throw "crop: ${W}x${H} at ($X,$Y) exceeds image $($src.Width)x$($src.Height)" }
    $bmp = New-Object System.Drawing.Bitmap $W, $H
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.DrawImage($src, [System.Drawing.Rectangle]::new(0, 0, $W, $H), [System.Drawing.Rectangle]::new($X, $Y, $W, $H), [System.Drawing.GraphicsUnit]::Pixel)
    $bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
} finally { $src.Dispose() }
"saved $Out"
