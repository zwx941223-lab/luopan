$ErrorActionPreference = "Stop"

$TaskName = "DY Monitor Guardian"

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Host "Uninstalled scheduled task: $TaskName"
