/**
 * Zipkin OpenTelemetry instrumentation for Node.js services
 *
 * This module initializes OpenTelemetry with Zipkin exporter for distributed tracing.
 * It should be imported at the very beginning of the application, before any other imports.
 */

import process from 'process';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { ZipkinExporter } from '@opentelemetry/exporter-zipkin';

const serviceName = process.env.OTEL_SERVICE_NAME || process.env.SERVICE_NAME || 'unknown-service';
const zipkinEndpoint = process.env.OTEL_EXPORTER_ZIPKIN_ENDPOINT;

let sdk: NodeSDK | null = null;

function initializeTracing(): boolean {
  if (!zipkinEndpoint) {
    console.log('⚠️  Zipkin tracing not configured - OTEL_EXPORTER_ZIPKIN_ENDPOINT not set');
    return false;
  }

  try {
    const zipkinExporter = new ZipkinExporter({
      url: zipkinEndpoint,
      serviceName: serviceName,
    });

    sdk = new NodeSDK({
      serviceName: serviceName,
      traceExporter: zipkinExporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-http': { enabled: true },
          '@opentelemetry/instrumentation-express': { enabled: true },
          '@opentelemetry/instrumentation-mongodb': { enabled: true },
          '@opentelemetry/instrumentation-dns': { enabled: false },
          '@opentelemetry/instrumentation-net': { enabled: false },
        }),
      ],
    });

    sdk.start();
    console.log(`✅ Zipkin tracing initialized for ${serviceName} → ${zipkinEndpoint}`);

    // Graceful shutdown
    process.on('SIGTERM', () => {
      if (sdk) {
        sdk
          .shutdown()
          .then(() => console.log('Tracing terminated'))
          .catch((err: Error) => console.log('Error terminating tracing', err))
          .finally(() => process.exit(0));
      }
    });

    return true;
  } catch (error) {
    console.error(`❌ Failed to initialize Zipkin tracing: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

// Initialize tracing
const tracingEnabled = initializeTracing();

export { tracingEnabled, sdk };
