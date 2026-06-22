$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\Users\dy-monitor"
$UpdateRoot = Split-Path -Parent $PSScriptRoot
$BackupRoot = "C:\Users\dy-monitor-data-backup"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$DataBackup = Join-Path $BackupRoot "data-$Stamp"

Write-Host "DY Monitor keep-data update started."
Write-Host "ProjectRoot: $ProjectRoot"
Write-Host "UpdateRoot:  $UpdateRoot"

if (!(Test-Path -LiteralPath $ProjectRoot)) {
  New-Item -ItemType Directory -Force -Path $ProjectRoot | Out-Null
}

New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null

$CurrentData = Join-Path $ProjectRoot "apps\server\data"
if (Test-Path -LiteralPath $CurrentData) {
  Write-Host "Backing up server data..."
  Copy-Item -LiteralPath $CurrentData -Destination $DataBackup -Recurse -Force
} else {
  Write-Host "No existing server data directory found."
}

Write-Host "Stopping old service processes..."
$portProcs = Get-NetTCPConnection -LocalPort 4318 -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique
foreach ($pidToStop in $portProcs) {
  Stop-Process -Id $pidToStop -Force -ErrorAction SilentlyContinue
}
Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -like "*dy-monitor*" -and $_.CommandLine -like "*dist/index.js*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2

Write-Host "Replacing program files while preserving data..."
foreach ($name in @("apps", "dy-monitor-extension", "scripts", "package.json", "package-lock.json")) {
  $target = Join-Path $ProjectRoot $name
  if (Test-Path -LiteralPath $target) {
    Remove-Item -LiteralPath $target -Recurse -Force
  }
}

foreach ($name in @("apps", "dy-monitor-extension", "scripts", "package.json", "package-lock.json")) {
  $source = Join-Path $UpdateRoot $name
  if (Test-Path -LiteralPath $source) {
    Copy-Item -LiteralPath $source -Destination $ProjectRoot -Recurse -Force
  }
}

if (Test-Path -LiteralPath $DataBackup) {
  $RestoredData = Join-Path $ProjectRoot "apps\server\data"
  if (Test-Path -LiteralPath $RestoredData) {
    Remove-Item -LiteralPath $RestoredData -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $RestoredData) | Out-Null
  Copy-Item -LiteralPath $DataBackup -Destination $RestoredData -Recurse -Force
  Write-Host "Server data restored from backup: $DataBackup"
}

Write-Host "Installing production dependencies if needed..."
Set-Location $ProjectRoot
npm install --omit=dev

Write-Host "Starting server..."
Start-Process powershell.exe -WindowStyle Hidden -WorkingDirectory $ProjectRoot -ArgumentList @(
  "-ExecutionPolicy", "Bypass",
  "-Command", "cd '$ProjectRoot'; `$env:NODE_ENV='production'; npm run start --workspace apps/server"
)

Start-Sleep -Seconds 5
$response = Invoke-WebRequest -UseBasicParsing "http://localhost:4318" -TimeoutSec 10
Write-Host "Update complete. HTTP status: $($response.StatusCode)"
Write-Host "Data backup kept at: $DataBackup"
