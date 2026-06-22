$ErrorActionPreference = "Continue"

$Root = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $Root "logs"
$LogFile = Join-Path $LogDir "guardian.log"
$LastOpenFile = Join-Path $LogDir "guardian-last-open.txt"
$OpenCooldownMinutes = 80
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

function Test-CaptureLooksActive {
  param($State)
  if (-not $State) {
    return $false
  }

  $done = 0
  $total = 0
  if ($null -ne $State.categoryDone) {
    $done = [int]$State.categoryDone
  }
  if ($null -ne $State.categoryTotal) {
    $total = [int]$State.categoryTotal
  }
  if ($total -le 0 -or $done -ge $total) {
    return $false
  }

  $lastStartedAt = [DateTimeOffset]::MinValue
  $lastHeartbeatAt = [DateTimeOffset]::MinValue
  [DateTimeOffset]::TryParse([string]$State.lastStartedAt, [ref]$lastStartedAt) | Out-Null
  [DateTimeOffset]::TryParse([string]$State.lastHeartbeatAt, [ref]$lastHeartbeatAt) | Out-Null

  $now = [DateTimeOffset]::UtcNow
  $startedRecently = $lastStartedAt -gt [DateTimeOffset]::MinValue -and ($now - $lastStartedAt).TotalHours -lt 3
  $heartbeatRecently = $lastHeartbeatAt -gt [DateTimeOffset]::MinValue -and ($now - $lastHeartbeatAt).TotalHours -lt 2

  return $startedRecently -or $heartbeatRecently
}

function Stop-EdgeIfCaptureCompleted {
  param($State)
  if (-not $State) {
    return
  }

  if ($State.status -eq "completed") {
    Write-GuardianLog "capture completed, edge kept open"
    Clear-EdgeRuntimeCache
    try {
      Invoke-RestMethod -Uri "$ApiBaseUrl/monitor/capture/auto-state" -Method Post -Headers @{
        "x-extension-token" = $ExtensionToken
      } -ContentType "application/json" -Body '{"action":"idle"}' -TimeoutSec 8 | Out-Null
      Write-GuardianLog "auto status reset to idle"
    } catch {
      Write-GuardianLog "auto idle reset failed: $($_.Exception.Message)"
    }
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
    Write-GuardianLog "capture already running, skip opening compass"
  } elseif (Test-CaptureLooksActive $autoState) {
    Write-GuardianLog "capture progress incomplete and still recent, skip opening compass"
  } elseif ($autoState.shouldOpenBrowser) {
    Open-Compass
  } else {
    Stop-EdgeIfCaptureCompleted $autoState
  }
} else {
  Open-Compass
}
Write-GuardianLog "guardian check finished"
