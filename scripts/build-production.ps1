$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

npm install
npm run build

Write-Host "Build completed. Start the server with scripts/start-server.ps1"
