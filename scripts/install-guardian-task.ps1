$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$GuardianScript = Join-Path $Root "scripts\guardian.ps1"
$TaskName = "DY Monitor Guardian"

if (-not (Test-Path -LiteralPath $GuardianScript)) {
  throw "Guardian script not found: $GuardianScript"
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$GuardianScript`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null

Write-Host "Installed scheduled task: $TaskName"
Write-Host "It runs every 5 minutes while this Windows user session is available."
