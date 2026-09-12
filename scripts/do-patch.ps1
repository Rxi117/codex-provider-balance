# Developer helper: re-apply the menu patch to an existing patched copy.
#
# Restores app.asar from a pristine backup and runs the patcher again. All three
# paths are parameters so nothing is hard-coded to one machine.
#
#   -Res      folder that contains app.asar (the patched copy)
#   -Pristine a copy of the original, unpatched app.asar
#   -Runnable the executable name to stop before rewriting (default ChatGPT)

param(
  [string]$Res      = 'C:\CodexDeepSeekPatched\app\resources',
  [string]$Pristine = 'C:\CodexDeepSeekPatched-backup\app.asar.original',
  [string]$Runnable = 'ChatGPT'
)

$ErrorActionPreference = 'Stop'

if (!(Test-Path $Pristine)) { throw "missing pristine asar: $Pristine" }
$InstallRoot = Split-Path -Parent (Split-Path -Parent $Res)

# The patched copy must not be running while app.asar is rewritten.
Get-Process $Runnable -ErrorAction SilentlyContinue |
  Where-Object { $_.Path -like ($InstallRoot + '\*') } |
  ForEach-Object { try { Stop-Process -Id $_.Id -Force } catch {} }
Start-Sleep -Seconds 2

Copy-Item $Pristine (Join-Path $Res 'app.asar') -Force
Write-Output ('restored size: ' + (Get-Item (Join-Path $Res 'app.asar')).Length)

Push-Location $PSScriptRoot
try {
  node .\patch-asar.mjs (Join-Path $Res 'app.asar')
  if ($LASTEXITCODE -ne 0) { throw "patcher exited with code $LASTEXITCODE" }
  node .\verify-inject.mjs (Join-Path $Res 'app.asar.new')
} finally { Pop-Location }

Move-Item (Join-Path $Res 'app.asar.new') (Join-Path $Res 'app.asar') -Force
Write-Output ('installed size: ' + (Get-Item (Join-Path $Res 'app.asar')).Length)

