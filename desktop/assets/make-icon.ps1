param(
  [string]$Source = (Join-Path $PSScriptRoot 'icon-source.png'),
  [string]$OutDir = (Join-Path $PSScriptRoot '.')
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$sizes = 16,32,48,64,128,256
$src = [System.Drawing.Image]::FromFile($Source)
$pngs = @()
foreach($s in $sizes){
  $bmp = New-Object System.Drawing.Bitmap($s,$s)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($src, 0, 0, $s, $s)
  $g.Dispose()
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $pngs += ,$ms.ToArray()
  $bmp.Dispose()
  $ms.Dispose()
}
$src.Dispose()
[System.IO.File]::WriteAllBytes((Join-Path $OutDir 'icon.png'), $pngs[$pngs.Count-1])
$icoMs = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($icoMs)
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for($i = 0; $i -lt $sizes.Count; $i++){
  $s = $sizes[$i]; $data = $pngs[$i]
  $wb = [byte]([int]($s % 256))
  $bw.Write($wb); $bw.Write($wb)
  $bw.Write([byte]0); $bw.Write([byte]0)
  $bw.Write([UInt16]1); $bw.Write([UInt16]32)
  $bw.Write([UInt32]$data.Length); $bw.Write([UInt32]$offset)
  $offset += $data.Length
}
foreach($d in $pngs){ $bw.Write($d) }
$bw.Flush()
[System.IO.File]::WriteAllBytes((Join-Path $OutDir 'icon.ico'), $icoMs.ToArray())
$bw.Dispose(); $icoMs.Dispose()
Write-Host ("icon.png {0} bytes, icon.ico {1} bytes" -f (Get-Item (Join-Path $OutDir 'icon.png')).Length, (Get-Item (Join-Path $OutDir 'icon.ico')).Length)
