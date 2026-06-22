$ErrorActionPreference = "Continue"

$Root = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $Root "logs"
$LogFile = Join-Path $LogDir "guardian.log"
$LastOpenFile = Join-Path $LogDir "guardian-last-open.txt"
$OpenCooldownMinutes = 80
$CloseEdgeOnComplete = $env:DY_MONITOR_CLOSE_EDGE_ON_COMPLETE
$ServerUrl = $env:DY_MONITOR_SERVER_URL
$CompassUrl = $env:DY_MONITOR_COMPASS_URL
$ApiBaseUrl = $env:DY_MONITOR_API_BASE_URL
$ExtensionToken = $env:DY_MONITOR_EXTENSION_TOKEN

if (-not $ServerUrl) {
  $ServerUrl = "http://localhost:4318/api/health"
}

if (-not $CompassUrl) {
  $CompassUrl = "https://compass.jinritemai.com/shop/chance/product-rank?from_page=%2Fshop%2Fcommodity%2Fproduct-list&btm_ppre=a6187.b901354.c0.d0&btm_pre=a6187.b904798.c0.d0"
}

if (-not $ApiBaseUrl) {
  $ApiBaseUrl = "http://localhost:4318/api"
}

if (-not $ExtensionToken) {
  $ExtensionToken = "dy-monitor-extension-token"
}

if (-not $CloseEdgeOnComplete) {
  $CloseEdgeOnComplete = "1"
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

function Open-Compass {
  $lastOpenAt = 0
  if (Test-Path -LiteralPath $LastOpenFile) {
    $raw = Get-Content -LiteralPath $LastOpenFile -Raw -ErrorAction SilentlyContinue
    [double]::TryParse($raw, [ref]$lastOpenAt) | Out-Null
  }

  $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  $cooldownSeconds = $OpenCooldownMinutes * 60
  if ($lastOpenAt -gt 0 -and ($now - $lastOpenAt) -lt $cooldownSeconds) {
    $leftSeconds = [Math]::Max(0, $cooldownSeconds - ($now - $lastOpenAt))
    Write-GuardianLog "compass open skipped: cooldown ${leftSeconds}s left"
    return
  }

  Write-GuardianLog "opening compass capture page"
  Start-Process "msedge.exe" -ArgumentList @($CompassUrl) | Out-Null
  Set-Content -LiteralPath $LastOpenFile -Value $now
}

function Stop-EdgeForCleanRestart {
  if ($CloseEdgeOnComplete -eq "0" -or $CloseEdgeOnComplete -eq "false") {
    Write-GuardianLog "edge restart skipped: DY_MONITOR_CLOSE_EDGE_ON_COMPLETE=$CloseEdgeOnComplete"
    return
  }

  $processes = Get-Process msedge -ErrorAction SilentlyContinue
  if (-not $processes) {
    Write-GuardianLog "edge restart skipped: msedge not running"
    return
  }

  Write-GuardianLog "capture completed, stopping edge before cache cleanup"
  $processes | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
}

function Clear-EdgeRuntimeCache {
  $edgeUserData = Join-Path $env:LOCALAPPDATA "Microsoft\Edge\User Data"
  if (-not (Test-Path -LiteralPath $edgeUserData)) {
    Write-GuardianLog "edge cache cleanup skipped: user data not found"
    return
  }

  $profileDirs = Get-ChildItem -LiteralPath $edgeUserData -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -eq "Default" -or $_.Name -like "Profile *" }
  $relativeTargets = @(
    "Cache",
    "Code Cache",
    "GPUCache",
    "DawnCache",
    "ShaderCache",
    "GrShaderCache",
    "GraphiteDawnCache",
    "Service Worker\CacheStorage",
    "Service Worker\ScriptCache"
  )

  foreach ($profile in $profileDirs) {
    foreach ($relative in $relativeTargets) {
      $target = Join-Path $profile.FullName $relative
      if (Test-Path -LiteralPath $target) {
        try {
          Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction Stop
          Write-GuardianLog "edge cache removed: $($profile.Name)\$relative"
        } catch {
          Write-GuardianLog "edge cache remove failed: $($profile.Name)\$relative - $($_.Exception.Message)"
        }
      }
    }
  }
}

function Get-AutoCaptureState {
  try {
    return Invoke-RestMethod -Uri "$ApiBaseUrl/monitor/capture/auto-state" -Headers @{
      "x-extension-token" = $ExtensionToken
    } -TimeoutSec 8
  } catch {
    Write-GuardianLog "auto state unavailable: $($_.Exception.Message)"
    return $null
  }
}

function Test-CaptureHasRecentHeartbeat {
  param($State)
  if (-not $State) {
    return $false
  }

  $lastHeartbeatAt = [DateTimeOffset]::MinValue
  [DateTimeOffset]::TryParse([string]$State.lastHeartbeatAt, [ref]$lastHeartbeatAt) | Out-Null

  $now = [DateTimeOffset]::UtcNow
  return $lastHeartbeatAt -gt [DateTimeOffset]::MinValue -and ($now - $lastHeartbeatAt).TotalMinutes -lt 10
}

function Reset-AutoCaptureToIdle {
  try {
    Invoke-RestMethod -Uri "$ApiBaseUrl/monitor/capture/auto-state" -Method Post -Headers @{
      "x-extension-token" = $ExtensionToken
    } -ContentType "application/json" -Body '{"action":"idle"}' -TimeoutSec 8 | Out-Null
    Write-GuardianLog "auto status reset to idle"
  } catch {
    Write-GuardianLog "auto idle reset failed: $($_.Exception.Message)"
  }
}

function Complete-CaptureCleanup {
  param($State)
  if (-not $State) {
    return
  }

  if ($State.status -eq "completed") {
    Stop-EdgeForCleanRestart
    Clear-EdgeRuntimeCache
    Reset-AutoCaptureToIdle
  }
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

$autoState = Get-AutoCaptureState
if ($autoState) {
  Write-GuardianLog "auto status=$($autoState.status), firstRunPending=$($autoState.firstRunPending), shouldOpen=$($autoState.shouldOpenBrowser), dueAt=$($autoState.dueAt), done=$($autoState.categoryDone)/$($autoState.categoryTotal)"
  if ($autoState.status -eq "running") {
    if (Test-CaptureHasRecentHeartbeat $autoState) {
      Write-GuardianLog "capture running with recent heartbeat, skip opening compass"
    } else {
      Write-GuardianLog "capture running but heartbeat stale, restart capture page"
      Stop-EdgeForCleanRestart
      Clear-EdgeRuntimeCache
      Reset-AutoCaptureToIdle
      Remove-Item -LiteralPath $LastOpenFile -Force -ErrorAction SilentlyContinue
      Open-Compass
    }
  } elseif ($autoState.status -eq "completed") {
    Complete-CaptureCleanup $autoState
  } elseif ($autoState.shouldOpenBrowser) {
    Open-Compass
  } else {
    Write-GuardianLog "not due yet, skip opening compass"
  }
} else {
  Open-Compass
}
Write-GuardianLog "guardian check finished"
