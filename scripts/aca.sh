#!/bin/bash
# ============================================================================
# Azure Container Apps Deployment Script for Notification Service
# ============================================================================
# PREREQUISITE: Run infrastructure deployment first:
#   cd infrastructure/azure/aca/scripts && ./deploy.sh
# ============================================================================

set -e

# ============================================================================
# CONFIGURATION - Edit these variables as needed
# ============================================================================

# Service Configuration
SERVICE_NAME="notification-service"
APP_PORT=8011
PROJECT_NAME="xshopai"

# Container Resources (Production-level)
CPU="1.0"
MEMORY="2.0Gi"
MIN_REPLICAS=2
MAX_REPLICAS=10

# Dapr Configuration (fixed for Azure Container Apps)
DAPR_HTTP_PORT=3500
DAPR_GRPC_PORT=50001

# ============================================================================
# COLORS & HELPER FUNCTIONS
# ============================================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() { echo -e "\n${BLUE}=== $1 ===${NC}\n"; }
print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }
print_info() { echo -e "${CYAN}ℹ $1${NC}"; }

# ============================================================================
# PREREQUISITES CHECK
# ============================================================================
print_header "Checking Prerequisites"

command -v az &>/dev/null || { print_error "Azure CLI not installed"; exit 1; }
print_success "Azure CLI installed"

command -v docker &>/dev/null || { print_error "Docker not installed"; exit 1; }
print_success "Docker installed"

az account show &>/dev/null || az login
print_success "Logged into Azure"

# Get script and service directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$(dirname "$SCRIPT_DIR")"

# ============================================================================
# USER INPUT - Environment & Suffix
# ============================================================================
print_header "Environment Selection"

echo "Available environments: dev, prod"
read -p "Enter environment [dev]: " ENVIRONMENT
ENVIRONMENT="${ENVIRONMENT:-dev}"

[[ "$ENVIRONMENT" =~ ^(dev|prod)$ ]] || { print_error "Invalid environment (dev/prod only)"; exit 1; }
print_success "Environment: $ENVIRONMENT"

echo ""
echo "Find your suffix by running:"
echo -e "  ${BLUE}az group list --query \"[?starts_with(name, 'rg-xshopai-$ENVIRONMENT')].name\" -o tsv${NC}"
echo ""
read -p "Enter infrastructure suffix: " SUFFIX

[[ "$SUFFIX" =~ ^[a-z0-9]{3,6}$ ]] || { print_error "Invalid suffix (3-6 lowercase alphanumeric)"; exit 1; }
print_success "Suffix: $SUFFIX"

# ============================================================================
# DERIVED RESOURCE NAMES (must match infrastructure deployment)
# ============================================================================
RESOURCE_GROUP="rg-${PROJECT_NAME}-${ENVIRONMENT}-${SUFFIX}"
ACR_NAME="${PROJECT_NAME}${ENVIRONMENT}${SUFFIX}"
CONTAINER_ENV="cae-${PROJECT_NAME}-${ENVIRONMENT}-${SUFFIX}"
CONTAINER_APP_NAME="ca-${SERVICE_NAME}-${ENVIRONMENT}-${SUFFIX}"
KEY_VAULT="kv-${PROJECT_NAME}-${ENVIRONMENT}-${SUFFIX}"
MANAGED_IDENTITY="id-${PROJECT_NAME}-${ENVIRONMENT}-${SUFFIX}"

# ============================================================================
# VERIFY INFRASTRUCTURE EXISTS
# ============================================================================
print_header "Verifying Infrastructure"

az group show --name "$RESOURCE_GROUP" &>/dev/null || { print_error "Resource group not found: $RESOURCE_GROUP"; exit 1; }
print_success "Resource Group: $RESOURCE_GROUP"

ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv 2>/dev/null) || { print_error "ACR not found: $ACR_NAME"; exit 1; }
print_success "Container Registry: $ACR_LOGIN_SERVER"

az containerapp env show --name "$CONTAINER_ENV" --resource-group "$RESOURCE_GROUP" &>/dev/null || { print_error "Container Env not found: $CONTAINER_ENV"; exit 1; }
print_success "Container Environment: $CONTAINER_ENV"

# Get Managed Identity (optional)
IDENTITY_ID=$(MSYS_NO_PATHCONV=1 az identity show --name "$MANAGED_IDENTITY" --resource-group "$RESOURCE_GROUP" --query id -o tsv 2>/dev/null || echo "")
[ -n "$IDENTITY_ID" ] && print_success "Managed Identity: $MANAGED_IDENTITY" || print_warning "Managed Identity not found (optional)"

# ============================================================================
# CONFIRMATION
# ============================================================================
print_header "Deployment Summary"

echo "Environment:        $ENVIRONMENT"
echo "Resource Group:     $RESOURCE_GROUP"
echo "Container App:      $CONTAINER_APP_NAME"
echo "Container Name:     $SERVICE_NAME"
echo "Image:              $ACR_LOGIN_SERVER/$SERVICE_NAME:latest"
echo "Ingress:            internal (event-driven service)"
echo "CPU/Memory:         $CPU / $MEMORY"
echo "Replicas:           $MIN_REPLICAS - $MAX_REPLICAS"
echo ""

# ============================================================================
# BUILD & PUSH IMAGE
# ============================================================================
print_header "Building and Pushing Image"

az acr login --name "$ACR_NAME"
cd "$SERVICE_DIR"

IMAGE_TAG="$ACR_LOGIN_SERVER/$SERVICE_NAME:latest"
docker build -t "$SERVICE_NAME:latest" .
docker tag "$SERVICE_NAME:latest" "$IMAGE_TAG"
docker push "$IMAGE_TAG"
print_success "Image pushed: $IMAGE_TAG"

# ============================================================================
# DEPLOY CONTAINER APP
# ============================================================================
print_header "Deploying Container App"

ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" -o tsv)

# Map environment to NODE_ENV (dev->development, prod->production)
NODE_ENV="development"
LOG_LEVEL="debug"
[ "$ENVIRONMENT" = "prod" ] && NODE_ENV="production" && LOG_LEVEL="warn"

# Retrieve secrets from Key Vault
print_info "Retrieving secrets from Key Vault..."

# Per-service Application Insights (each service has its own App Insights resource)
APP_INSIGHTS_CONN=$(az keyvault secret show --vault-name "$KEY_VAULT" --name "appinsights-notification-service" --query "value" -o tsv 2>/dev/null || echo "")
[ -n "$APP_INSIGHTS_CONN" ] && print_success "  appinsights-notification-service: retrieved" || print_warning "  appinsights-notification-service: not configured (telemetry disabled)"

# JWT secret
JWT_SECRET=$(az keyvault secret show --vault-name "$KEY_VAULT" --name "jwt-secret" --query "value" -o tsv 2>/dev/null || echo "")
[ -n "$JWT_SECRET" ] && print_success "  jwt-secret: retrieved" || print_warning "  jwt-secret: not configured"

# Service tokens
SVC_AUTH_TOKEN=$(az keyvault secret show --vault-name "$KEY_VAULT" --name "service-auth-token" --query "value" -o tsv 2>/dev/null || echo "")
SVC_ADMIN_TOKEN=$(az keyvault secret show --vault-name "$KEY_VAULT" --name "service-admin-token" --query "value" -o tsv 2>/dev/null || echo "")
SVC_ORDER_TOKEN=$(az keyvault secret show --vault-name "$KEY_VAULT" --name "service-order-token" --query "value" -o tsv 2>/dev/null || echo "")
SVC_WEBBFF_TOKEN=$(az keyvault secret show --vault-name "$KEY_VAULT" --name "service-webbff-token" --query "value" -o tsv 2>/dev/null || echo "")
print_success "  service-*-token: retrieved"

# Azure Communication Services (for email sending in cloud)
ACS_CONNECTION_STRING=$(az keyvault secret show --vault-name "$KEY_VAULT" --name "acs-connection-string" --query "value" -o tsv 2>/dev/null || echo "")
ACS_SENDER_ADDRESS=$(az keyvault secret show --vault-name "$KEY_VAULT" --name "acs-sender-address" --query "value" -o tsv 2>/dev/null || echo "")
if [ -n "$ACS_CONNECTION_STRING" ] && [ -n "$ACS_SENDER_ADDRESS" ]; then
    print_success "  acs-connection-string: retrieved"
    print_success "  acs-sender-address: $ACS_SENDER_ADDRESS"
    EMAIL_PROVIDER="acs"
else
    print_warning "  acs-*: not configured (email disabled)"
    EMAIL_PROVIDER="smtp"  # Falls back to SMTP but won't work without config
fi

# Environment variables for the container (sorted alphabetically)
ENV_VARS=(
    "ACS_CONNECTION_STRING=$ACS_CONNECTION_STRING"
    "ACS_SENDER_ADDRESS=$ACS_SENDER_ADDRESS"
    "APPLICATIONINSIGHTS_CONNECTION_STRING=$APP_INSIGHTS_CONN"
    "DAPR_GRPC_PORT=50001"
    "DAPR_HTTP_PORT=3500"
    "EMAIL_FROM_ADDRESS=$ACS_SENDER_ADDRESS"
    "EMAIL_FROM_NAME=xshopai Notifications"
    "EMAIL_PROVIDER=$EMAIL_PROVIDER"
    "JWT_SECRET=$JWT_SECRET"
    "LOG_LEVEL=$LOG_LEVEL"
    "MESSAGING_PROVIDER=dapr"
    "NODE_ENV=$NODE_ENV"
    "OTEL_RESOURCE_ATTRIBUTES=service.version=1.0.0"
    "OTEL_SERVICE_NAME=$SERVICE_NAME"
    "PORT=$APP_PORT"
    "SERVICE_ADMIN_TOKEN=$SVC_ADMIN_TOKEN"
    "SERVICE_AUTH_TOKEN=$SVC_AUTH_TOKEN"
    "SERVICE_NAME=$SERVICE_NAME"
    "SERVICE_ORDER_TOKEN=$SVC_ORDER_TOKEN"
    "SERVICE_WEBBFF_TOKEN=$SVC_WEBBFF_TOKEN"
    "VERSION=1.0.0"
)

if az containerapp show --name "$CONTAINER_APP_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
    print_info "Updating existing container app..."
    az containerapp update \
        --name "$CONTAINER_APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --image "$IMAGE_TAG" \
        --set-env-vars "${ENV_VARS[@]}" \
        --output none
else
    print_info "Creating new container app..."
    MSYS_NO_PATHCONV=1 az containerapp create \
        --name "$CONTAINER_APP_NAME" \
        --container-name "$SERVICE_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --environment "$CONTAINER_ENV" \
        --image "$IMAGE_TAG" \
        --registry-server "$ACR_LOGIN_SERVER" \
        --registry-username "$ACR_NAME" \
        --registry-password "$ACR_PASSWORD" \
        --target-port "$APP_PORT" \
        --ingress external \
        --min-replicas "$MIN_REPLICAS" \
        --max-replicas "$MAX_REPLICAS" \
        --cpu "$CPU" \
        --memory "$MEMORY" \
        --enable-dapr \
        --dapr-app-id "$SERVICE_NAME" \
        --dapr-app-port "$APP_PORT" \
        --env-vars "${ENV_VARS[@]}" \
        ${IDENTITY_ID:+--user-assigned "$IDENTITY_ID"} \
        --tags "project=$PROJECT_NAME" "environment=$ENVIRONMENT" "suffix=$SUFFIX" "service=$SERVICE_NAME" \
        --output none
fi
print_success "Container app deployed"

# ============================================================================
# VERIFY DEPLOYMENT
# ============================================================================
print_header "Verifying Deployment"

APP_URL=$(az containerapp show --name "$CONTAINER_APP_NAME" --resource-group "$RESOURCE_GROUP" --query properties.configuration.ingress.fqdn -o tsv)

echo ""
echo -e "${GREEN}✅ DEPLOYMENT SUCCESSFUL${NC}"
echo ""
echo "Application URL:  https://$APP_URL (internal)"
echo "Health Check:     https://$APP_URL/health"
echo ""
echo -e "${CYAN}Subscribed Events:${NC}"
echo "   - auth.user.registered"
echo "   - auth.email.verification.requested"
echo "   - auth.password.reset.requested"
echo "   - order.created, order.cancelled"
echo "   - payment.received"
echo ""
echo "Useful commands:"
echo -e "  Logs:      ${BLUE}az containerapp logs show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --follow${NC}"
echo -e "  Dapr logs: ${BLUE}az containerapp logs show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --container daprd --follow${NC}"
echo -e "  Delete:    ${BLUE}az containerapp delete --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --yes${NC}"
echo ""
