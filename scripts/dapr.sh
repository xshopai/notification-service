#!/bin/bash

# Notification Service - Run with Dapr Pub/Sub

echo "Starting Notification Service (Dapr Pub/Sub)..."
echo "Service will be available at: http://localhost:8011"
echo "Dapr HTTP endpoint: http://localhost:3511"
echo "Dapr gRPC endpoint: localhost:50011"
echo ""

# Kill any processes using required ports (prevents "address already in use" errors)
for PORT in 8011 3511 50011; do
    for pid in $(netstat -ano 2>/dev/null | grep ":$PORT" | grep LISTENING | awk '{print $5}' | sort -u); do
        echo "Killing process $pid on port $PORT..."
        taskkill //F //PID $pid 2>/dev/null
    done
done

dapr run \
  --app-id notification-service \
  --app-port 8011 \
  --dapr-http-port 3511 \
  --dapr-grpc-port 50011 \
  --log-level info \
  --config ./.dapr/config.yaml \
  --resources-path ./.dapr/components \
  -- npx tsx watch src/server.ts


