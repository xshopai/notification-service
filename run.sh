#!/usr/bin/env bash
# Run Notification Service with Dapr sidecar
# Usage: ./run.sh

echo -e "\033[0;32mStarting Notification Service with Dapr...\033[0m"
echo -e "\033[0;36mService will be available at: http://localhost:8011\033[0m"
echo -e "\033[0;36mDapr HTTP endpoint: http://localhost:3511\033[0m"
echo -e "\033[0;36mDapr gRPC endpoint: localhost:50011\033[0m"
echo ""

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

dapr run \
  --app-id notification-service \
  --app-port 8011 \
  --dapr-http-port 3511 \
  --dapr-grpc-port 50011 \
  --resources-path "$SCRIPT_DIR/.dapr/components" \
  --config "$SCRIPT_DIR/.dapr/config.yaml" \
  --log-level warn \
  -- npx tsx watch src/server.ts
