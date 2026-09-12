# Keep the provider-balance agent listening on 127.0.0.1:17561.
#
# The patched profile menu and the balance console both read from this agent.
# If it is not running, the console page reports a refused connection and the
# menu row falls back to a placeholder, so a watchdog restarts it on demand.

$ErrorActionPreference = 'Continue'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$Agent    = Join-Path $PSScriptRoot 'deepseek-balance-agent.mjs'
$Node     = 'C:\Program Files\nodejs\node.exe'
if (!(Test-Path $Node)) { $Node = (Get-Command node).Source }

$port = 17561
$listening = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($null -ne $listening) { exit 0 }

$logDir = Join-Path $RepoRoot 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

Start-Process -FilePath $Node -ArgumentList ('"' + $Agent + '"') `
  -WorkingDirectory $RepoRoot -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $logDir 'balance-agent.out.log') `
  -RedirectStandardError (Join-Path $logDir 'balance-agent.err.log')

Start-Sleep -Seconds 2
exit 0
