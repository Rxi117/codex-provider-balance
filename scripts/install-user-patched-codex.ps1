# Refresh the patched Codex copy at C:\CodexDeepSeekPatched after a Codex update.
#
# The installed MSIX package under Program Files\WindowsApps is read-only and
# signature-checked, so the provider-balance menu item is injected into a
# user-writable copy instead. The copy lives outside AppData on purpose:
# launching ChatGPT.exe from under %LOCALAPPDATA%/%APPDATA% trips a
# side-by-side configuration error on this machine.

param(
  [string]$Target   = $(if ($env:CODEX_PATCH_TARGET)   { $env:CODEX_PATCH_TARGET }   else { 'C:\CodexDeepSeekPatched' }),
  [string]$UserData = $(if ($env:CODEX_PATCH_USERDATA) { $env:CODEX_PATCH_USERDATA } else { 'C:\CodexPatchedUserData' }),
  [string]$ShortcutName = 'Codex Provider Balance Patched'
)

$ErrorActionPreference = 'Stop'

$RepoRoot   = Split-Path -Parent $PSScriptRoot
$Node       = (Get-Command node).Source
$Agent      = Join-Path $PSScriptRoot 'deepseek-balance-agent.mjs'
$AsarFixer  = Join-Path $PSScriptRoot 'patch-asar.mjs'

$Package = Get-AppxPackage OpenAI.Codex
if ($null -eq $Package) { throw 'OpenAI.Codex package was not found.' }

$Source      = $Package.InstallLocation
$Version     = $Package.Version.ToString()
$TargetAsar  = Join-Path $Target 'app\resources\app.asar'
$StateFile   = Join-Path $Target 'installed-version.txt'
$Marker      = 'provider-balance-menu-patch-v2'

function Test-Patched {
  param([string]$Path)
  if (!(Test-Path $Path)) { return $false }
  $fs = [System.IO.File]::OpenRead($Path)
  try {
    $buf = New-Object byte[] 4
    $null = $fs.Read($buf, 0, 4)
    $size = [BitConverter]::ToUInt32($buf, 0)
    if ($size -le 0 -or $size -gt 32MB) { return $false }
    $json = New-Object byte[] $size
    $fs.Position = 16
    $null = $fs.Read($json, 0, $size)
    $text = [System.Text.Encoding]::UTF8.GetString($json)
    return $text.Contains($Marker)
  } finally { $fs.Close() }
}

$upToDate = (Test-Path $StateFile) -and
            ((Get-Content $StateFile -Raw).Trim() -eq $Version) -and
            (Test-Patched $TargetAsar)

if (-not $upToDate) {
  Write-Output ('syncing Codex ' + $Version + ' -> ' + $Target)

  Get-Process ChatGPT -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -like ($Target + '\*') } |
    ForEach-Object { try { Stop-Process -Id $_.Id -Force } catch {} }
  Start-Sleep -Seconds 2

  $robocopy = Start-Process -FilePath robocopy.exe -ArgumentList @(
    "`"$Source`"", "`"$Target`"", '/MIR', '/R:2', '/W:1', '/NFL', '/NDL', '/NJH', '/NJS'
  ) -Wait -PassThru -NoNewWindow
  if ($robocopy.ExitCode -ge 8) { throw "robocopy failed with exit code $($robocopy.ExitCode)" }

  Push-Location $PSScriptRoot
  try {
    & $Node $AsarFixer $TargetAsar
    if ($LASTEXITCODE -ne 0) { throw "patcher exited with code $LASTEXITCODE" }
  } finally { Pop-Location }

  $fresh = $TargetAsar + '.new'
  if (!(Test-Path $fresh)) { throw 'patcher did not produce app.asar.new' }
  Move-Item $fresh $TargetAsar -Force
  Set-Content -Path $StateFile -Value $Version -Encoding UTF8
  Write-Output 'patch applied'
} else {
  Write-Output ('already patched for Codex ' + $Version)
}

New-Item -ItemType Directory -Force -Path $UserData | Out-Null

# Keep the COM server registration file's executable name in sync with the
# packaged application entry point.
$exe = Join-Path $Target 'app\ChatGPT.exe'
if (!(Test-Path $exe)) { throw ("missing " + $exe) }

$shell = New-Object -ComObject WScript.Shell

$shortcut = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) ($ShortcutName + '.lnk')))
$shortcut.TargetPath = $exe
$shortcut.Arguments = '--user-data-dir=' + $UserData
$shortcut.WorkingDirectory = Split-Path -Parent $exe
$shortcut.Description = 'Codex with provider balance menu patch'
$shortcut.IconLocation = $exe + ',0'
$shortcut.Save()

$startup = [Environment]::GetFolderPath('Startup')

$agentLink = $shell.CreateShortcut((Join-Path $startup 'Codex Provider Balance Agent.lnk'))
$agentLink.TargetPath = $Node
$agentLink.Arguments = '"' + $Agent + '"'
$agentLink.WorkingDirectory = $RepoRoot
$agentLink.WindowStyle = 7
$agentLink.Description = 'Serve provider balances for the patched Codex menu'
$agentLink.Save()

$selfLink = $shell.CreateShortcut((Join-Path $startup 'Codex Provider Balance Auto Update.lnk'))
$selfLink.TargetPath = 'powershell.exe'
$selfLink.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $PSCommandPath + '"'
$selfLink.WorkingDirectory = $RepoRoot
$selfLink.WindowStyle = 7
$selfLink.Description = 'Refresh the patched Codex copy after Codex updates'
$selfLink.Save()

$listening = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 17561 -State Listen -ErrorAction SilentlyContinue
if ($null -eq $listening) {
  Start-Process -FilePath $Node -ArgumentList ('"' + $Agent + '"') -WorkingDirectory $RepoRoot -WindowStyle Hidden | Out-Null
}

Write-Output 'done'
