# ============================================================================
# Azure Container Apps Deployment Script for Notification Service (PowerShell)
# ============================================================================

$ErrorActionPreference = "Stop"

function Write-Header { param([string]$Message); Write-Host "`n============================================================================" -ForegroundColor Blue; Write-Host $Message -ForegroundColor Blue; Write-Host "============================================================================`n" -ForegroundColor Blue }
function Write-Success { param([string]$Message); Write-Host "✓ $Message" -ForegroundColor Green }
function Write-Info { param([string]$Message); Write-Host "ℹ $Message" -ForegroundColor Blue }

function Read-HostWithDefault { param([string]$Prompt, [string]$Default); $input = Read-Host "$Prompt [$Default]"; if ([string]::IsNullOrWhiteSpace($input)) { return $Default }; return $input }

Write-Header "Checking Prerequisites"
try { az version | Out-Null; Write-Success "Azure CLI installed" } catch { Write-Error "Azure CLI not installed"; exit 1 }
try { docker version | Out-Null; Write-Success "Docker installed" } catch { Write-Error "Docker not installed"; exit 1 }
try { az account show | Out-Null } catch { az login }

Write-Header "Azure Configuration"
$ResourceGroup = Read-HostWithDefault -Prompt "Enter Resource Group name" -Default "rg-xshopai-aca"
$Location = Read-HostWithDefault -Prompt "Enter Azure Location" -Default "swedencentral"
$AcrName = Read-HostWithDefault -Prompt "Enter Azure Container Registry name" -Default "acrxshopaiaca"
$EnvironmentName = Read-HostWithDefault -Prompt "Enter Container Apps Environment name" -Default "cae-xshopai-aca"
$SendGridKey = Read-Host "Enter SendGrid API key (optional, press Enter to skip)"
$TwilioSid = Read-Host "Enter Twilio Account SID (optional, press Enter to skip)"
$TwilioToken = Read-Host "Enter Twilio Auth Token (optional, press Enter to skip)" -AsSecureString
$TwilioPhone = Read-HostWithDefault -Prompt "Enter Twilio phone number (optional)" -Default ""

$AppName = "notification-service"
$AppPort = 1011

$Confirm = Read-Host "Proceed with deployment? (y/N)"
if ($Confirm -notmatch '^[Yy]$') { exit 0 }

Write-Header "Building and Deploying"
$AcrLoginServer = az acr show --name $AcrName --query loginServer -o tsv
az acr login --name $AcrName

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServiceDir = Split-Path -Parent $ScriptDir
Push-Location $ServiceDir

try {
    $ImageTag = "${AcrLoginServer}/${AppName}:latest"
    docker build -t $ImageTag .
    docker push $ImageTag
    Write-Success "Image pushed"
} finally { Pop-Location }

az containerapp env show --name $EnvironmentName --resource-group $ResourceGroup | Out-Null 2>$null
if ($LASTEXITCODE -ne 0) {
    az containerapp env create --name $EnvironmentName --resource-group $ResourceGroup --location $Location --output none
}

$Secrets = @()
$EnvVars = @(
    "PORT=$AppPort",
    "NODE_ENV=production",
    "LOG_LEVEL=info"
)

if (-not [string]::IsNullOrWhiteSpace($SendGridKey)) {
    $Secrets += "sendgrid-key=$SendGridKey"
    $EnvVars += "SENDGRID_API_KEY=secretref:sendgrid-key"
}

if (-not [string]::IsNullOrWhiteSpace($TwilioSid)) {
    $TwilioTokenPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($TwilioToken))
    $Secrets += "twilio-sid=$TwilioSid"
    $Secrets += "twilio-token=$TwilioTokenPlain"
    $EnvVars += "TWILIO_ACCOUNT_SID=secretref:twilio-sid"
    $EnvVars += "TWILIO_AUTH_TOKEN=secretref:twilio-token"
    if (-not [string]::IsNullOrWhiteSpace($TwilioPhone)) {
        $EnvVars += "TWILIO_PHONE_NUMBER=$TwilioPhone"
    }
}

$SecretsParam = if ($Secrets.Count -gt 0) { $Secrets -join " " } else { "" }

try {
    az containerapp show --name $AppName --resource-group $ResourceGroup | Out-Null
    az containerapp update --name $AppName --resource-group $ResourceGroup --image $ImageTag --output none
    Write-Success "Container app updated"
} catch {
    $CreateCmd = @"
az containerapp create --name $AppName --resource-group $ResourceGroup --environment $EnvironmentName --image $ImageTag --registry-server $AcrLoginServer --target-port $AppPort --ingress internal --min-replicas 1 --max-replicas 5 --cpu 0.5 --memory 1Gi --enable-dapr --dapr-app-id $AppName --dapr-app-port $AppPort
"@
    
    if ($Secrets.Count -gt 0) {
        $CreateCmd += " --secrets $SecretsParam"
    }
    
    $CreateCmd += " --env-vars $($EnvVars -join ' ') --output none"
    
    Invoke-Expression $CreateCmd
    Write-Success "Container app created"
}

Write-Header "Deployment Complete!"
Write-Host "Notification Service deployed! Dapr App ID: $AppName" -ForegroundColor Green
