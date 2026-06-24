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
  param([switch]$Force)

  $lastOpenAt = 0
  if (Test-Path -LiteralPath $LastOpenFile) {
    $raw = Get-Content -LiteralPath $LastOpenFile -Raw -ErrorAction SilentlyContinue
    [double]::TryParse($raw, [ref]$lastOpenAt) | Out-Null
  }

  $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  $cooldownSeconds = $OpenCooldownMinutes * 60
  if (-not $Force -and $lastOpenAt -gt 0 -and ($now - $lastOpenAt) -lt $cooldownSeconds) {
    $leftSeconds = [Math]::Max(0, $cooldownSeconds - ($now - $lastOpenAt))
    Write-GuardianLog "compass open skipped: cooldown ${leftSeconds}s left"
    return
  }

  Write-GuardianLog "opening compass capture page"
  $edgeProcess = Start-Process "msedge.exe" -ArgumentList @($CompassUrl) -PassThru
  Refresh-CompassPageAfterOpen $edgeProcess
  Set-Content -LiteralPath $LastOpenFile -Value $now
}

function Refresh-CompassPageAfterOpen {
  param($EdgeProcess)

  try {
    Start-Sleep -Seconds 8
    $shell = New-Object -ComObject WScript.Shell
    $activated = $false
    if ($EdgeProcess -and $EdgeProcess.Id) {
      $activated = [bool]$shell.AppActivate($EdgeProcess.Id)
    }
    if (-not $activated) {
      $activated = [bool]$shell.AppActivate("Microsoft Edge")
    }
    if (-not $activated) {
      Write-GuardianLog "compass refresh skipped: edge window not active"
      return
    }
    Start-Sleep -Milliseconds 500
    $shell.SendKeys("{F5}")
    Write-GuardianLog "compass page refreshed after open"
  } catch {
    Write-GuardianLog "compass refresh failed: $($_.Exception.Message)"
  }
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

  Write-GuardianLog "stopping edge before cache cleanup"
  $processes | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
}

function Prepare-CleanCompassOpen {
  param([string]$Reason)

  Write-GuardianLog "prepare clean compass open: $Reason"
  Stop-EdgeForCleanRestart
  Clear-EdgeRuntimeCache
  Reset-AutoCaptureToIdle
  Remove-Item -LiteralPath $LastOpenFile -Force -ErrorAction SilentlyContinue
  Open-Compass -Force
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
    "GraphiteDawnCache"
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
      Prepare-CleanCompassOpen "stale running heartbeat"
    }
  } elseif ($autoState.firstRunPending -eq $true -or [string]$autoState.firstRunPending -eq "True") {
    Prepare-CleanCompassOpen "first run pending"
  } elseif ($autoState.status -eq "error") {
    Prepare-CleanCompassOpen "auto capture error"
  } elseif ($autoState.shouldOpenBrowser) {
    Prepare-CleanCompassOpen "scheduled capture due"
  } elseif ($autoState.status -eq "completed") {
    Write-GuardianLog "capture completed, waiting for next scheduled round"
  } else {
    Write-GuardianLog "not due yet, skip opening compass"
  }
} else {
  Prepare-CleanCompassOpen "auto state unavailable"
}
Write-GuardianLog "guardian check finished"
