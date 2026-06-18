$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$env:NODE_ENV = "production"
npm run start --workspace apps/server
