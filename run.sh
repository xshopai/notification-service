#!/bin/bash

# Notification Service - Run with Dapr

echo "Starting Notification Service with Dapr..."
echo "Service will be available at: http://localhost:8011"
echo "Dapr HTTP endpoint: http://localhost:3511"
echo "Dapr gRPC endpoint: localhost:50011"
echo ""

dapr run \
  --app-id notification-service \
  --app-port 8011 \
  --dapr-http-port 3511 \
  --dapr-grpc-port 50011 \
  --log-level info \
  --config ./.dapr/config.yaml \
  --resources-path ./.dapr/components \
  -- npm run dev

