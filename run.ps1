#!/usr/bin/env pwsh
# Run Notification Service with Dapr sidecar
# Usage: .\run.ps1

$Host.UI.RawUI.WindowTitle = "Notification Service"

Write-Host "Starting Notification Service with Dapr..." -ForegroundColor Green
Write-Host "Service will be available at: http://localhost:8011" -ForegroundColor Cyan
Write-Host "Dapr HTTP endpoint: http://localhost:3500" -ForegroundColor Cyan
Write-Host "Dapr gRPC endpoint: localhost:50001" -ForegroundColor Cyan
Write-Host ""

dapr run `
  --app-id notification-service `
  --app-port 8011 `
  --dapr-http-port 3500 `
  --dapr-grpc-port 50001 `
  --resources-path .dapr/components `
  --config .dapr/config.yaml `
  --log-level warn `
  -- npx tsx watch src/server.ts
