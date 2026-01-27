# Notification Service - Azure Container Apps Deployment

## Overview

This guide covers deploying the Notification Service to Azure Container Apps (ACA) with Dapr integration for event-driven notifications via SendGrid and Twilio.

## Prerequisites

- Azure CLI installed and authenticated
- Docker installed
- Azure subscription with appropriate permissions
- Azure Container Registry (ACR) created
- SendGrid account (optional, for email)
- Twilio account (optional, for SMS)

## Quick Deployment

### Using the Deployment Script

**PowerShell (Windows):**

```powershell
cd scripts
.\aca.ps1
```

**Bash (macOS/Linux):**

```bash
cd scripts
./aca.sh
```

## Manual Deployment

### 1. Set Variables

```bash
RESOURCE_GROUP="rg-xshopai-aca"
LOCATION="swedencentral"
ACR_NAME="acrxshopaiaca"
ENVIRONMENT_NAME="cae-xshopai-aca"
APP_NAME="notification-service"
APP_PORT=1011
```

### 2. Build and Push Image

```bash
az acr login --name $ACR_NAME
docker build -t $ACR_NAME.azurecr.io/$APP_NAME:latest .
docker push $ACR_NAME.azurecr.io/$APP_NAME:latest
```

### 3. Deploy Container App

```bash
az containerapp create \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --environment $ENVIRONMENT_NAME \
  --image $ACR_NAME.azurecr.io/$APP_NAME:latest \
  --registry-server $ACR_NAME.azurecr.io \
  --target-port $APP_PORT \
  --ingress internal \
  --min-replicas 1 \
  --max-replicas 5 \
  --cpu 0.5 \
  --memory 1Gi \
  --enable-dapr \
  --dapr-app-id $APP_NAME \
  --dapr-app-port $APP_PORT \
  --secrets \
    "sendgrid-key=<your-sendgrid-key>" \
    "twilio-sid=<your-twilio-sid>" \
    "twilio-token=<your-twilio-token>" \
  --env-vars \
    "PORT=$APP_PORT" \
    "NODE_ENV=production" \
    "SENDGRID_API_KEY=secretref:sendgrid-key" \
    "TWILIO_ACCOUNT_SID=secretref:twilio-sid" \
    "TWILIO_AUTH_TOKEN=secretref:twilio-token" \
    "LOG_LEVEL=info"
```

## Event Subscriptions

The notification service subscribes to events via Dapr pub/sub:

- `user.created` - Send welcome email
- `order.created` - Send order confirmation
- `order.shipped` - Send shipping notification
- `password.reset.requested` - Send password reset email

## Configuration

### Environment Variables

| Variable              | Description                 |
| --------------------- | --------------------------- |
| `SENDGRID_API_KEY`    | SendGrid API key for emails |
| `TWILIO_ACCOUNT_SID`  | Twilio account SID          |
| `TWILIO_AUTH_TOKEN`   | Twilio auth token           |
| `TWILIO_PHONE_NUMBER` | Twilio sender phone number  |

## Monitoring

```bash
az containerapp logs show \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --follow
```
