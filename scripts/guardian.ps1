$ErrorActionPreference = "Continue"

$Root = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $Root "logs"
$LogFile = Join-Path $LogDir "guardian.log"
$ServerUrl = $env:DY_MONITOR_SERVER_URL
$CompassUrl = $env:DY_MONITOR_COMPASS_URL

if (-not $ServerUrl) {
  $ServerUrl = "http://localhost:4318/api/health"
}

if (-not $CompassUrl) {
  $CompassUrl = "https://compass.douyin.com/"
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Write-GuardianLog {
  param([string]$Message)
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
  Add-Content -LiteralPath $LogFile -Value $line
  Write-Host $line
}

function Test-Backend {
  try {
    $response = Invoke-RestMethod -Uri $ServerUrl -TimeoutSec 8
    return [bool]$response.ok
  } catch {
    return $false
  }
}

function Start-Backend {
  $script = Join-Path $Root "scripts\start-server.ps1"
  if (-not (Test-Path -LiteralPath $script)) {
    Write-GuardianLog "backend start skipped: missing $script"
    return
  }

  Write-GuardianLog "backend unhealthy, starting server"
  Start-Process powershell.exe -ArgumentList @(
    "-ExecutionPolicy", "Bypass",
    "-File", $script
  ) -WorkingDirectory $Root -WindowStyle Hidden | Out-Null
}

function Start-EdgeIfMissing {
  $edge = Get-Process msedge -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($edge) {
    return
  }

  Write-GuardianLog "edge missing, opening compass"
  Start-Process "msedge.exe" -ArgumentList @($CompassUrl) -WindowStyle Hidden | Out-Null
}

Write-GuardianLog "guardian check started"

if (-not (Test-Backend)) {
  Start-Backend
  Start-Sleep -Seconds 8
  if (Test-Backend) {
    Write-GuardianLog "backend recovered"
  } else {
    Write-GuardianLog "backend still unhealthy after restart attempt"
  }
} else {
  Write-GuardianLog "backend ok"
}

Start-EdgeIfMissing
Write-GuardianLog "guardian check finished"
