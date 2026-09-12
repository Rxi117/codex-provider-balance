$ErrorActionPreference = 'SilentlyContinue'
$repo = Split-Path -Parent $PSScriptRoot
Get-NetTCPConnection -LocalPort 17561 -State Listen | ForEach-Object {
  try { Stop-Process -Id $_.OwningProcess -Force; Write-Host ("stopped " + $_.OwningProcess) } catch { Write-Host ("fail " + $_.OwningProcess) }
}
Start-Sleep -Milliseconds 900
$agent = Join-Path $repo 'scripts\deepseek-balance-agent.mjs'
Start-Process -FilePath 'node' -ArgumentList ('"' + $agent + '"') -WorkingDirectory $repo -WindowStyle Hidden
Start-Sleep -Seconds 2
$health = Invoke-RestMethod -Uri 'http://127.0.0.1:17561/health' -TimeoutSec 5
Write-Host ("health: " + ($health | ConvertTo-Json -Compress))
