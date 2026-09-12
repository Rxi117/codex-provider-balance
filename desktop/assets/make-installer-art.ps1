param(
  [string]$Source = (Join-Path $PSScriptRoot 'icon-source.png'),
  [string]$OutDir = (Join-Path $PSScriptRoot '.')
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

function New-Background([int]$w, [int]$h) {
  $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.Color]::FromArgb(255, 255, 246, 250),
    [System.Drawing.Color]::FromArgb(255, 255, 214, 231),
    90.0
  )
  $g.FillRectangle($brush, $rect)
  $brush.Dispose()
  return @{ Bitmap = $bmp; Graphics = $g }
}

$src = [System.Drawing.Image]::FromFile($Source)

# Installer header banner: 150x57
$header = New-Background 150 57
$gh = $header.Graphics
$gh.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$hi = 34
$gh.DrawImage($src, 8, [int]((57 - $hi) / 2), $hi, $hi)
$fg = New-Object System.Drawing.Font('Segoe UI', 9, [System.Drawing.FontStyle]::Bold)
$br = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 224, 79, 139))
$gh.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$gh.DrawString('Provider Balance', $fg, $br, 47, 21)
$fg.Dispose(); $br.Dispose(); $gh.Dispose()
$header.Bitmap.Save((Join-Path $OutDir 'installerHeader.bmp'), [System.Drawing.Imaging.ImageFormat]::Bmp)
$header.Bitmap.Dispose()

# Installer sidebar: 164x314
$side = New-Background 164 314
$gs = $side.Graphics
$gs.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$si = 120
$gs.DrawImage($src, [int]((164 - $si) / 2), 60, $si, $si)
$fs = New-Object System.Drawing.Font('Segoe UI', 12, [System.Drawing.FontStyle]::Bold)
$bs = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 224, 79, 139))
$fmt = New-Object System.Drawing.StringFormat
$fmt.Alignment = [System.Drawing.StringAlignment]::Center
$rectText = New-Object System.Drawing.RectangleF(0, 194, 164, 26)
$gs.DrawString('Provider Balance', $fs, $bs, $rectText, $fmt)
$fs.Dispose(); $bs.Dispose(); $fmt.Dispose(); $gs.Dispose()
$side.Bitmap.Save((Join-Path $OutDir 'installerSidebar.bmp'), [System.Drawing.Imaging.ImageFormat]::Bmp)
$side.Bitmap.Dispose()

$src.Dispose()
Write-Host 'installerHeader.bmp and installerSidebar.bmp written.'
