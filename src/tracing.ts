/**
 * Unified OpenTelemetry tracing for Node.js/TypeScript services
 *
 * Supports multiple exporters based on OTEL_TRACES_EXPORTER environment variable:
 * - zipkin: Uses OTEL_EXPORTER_ZIPKIN_ENDPOINT
 * - otlp: Uses OTEL_EXPORTER_OTLP_ENDPOINT
 * - azure: Uses APPLICATIONINSIGHTS_CONNECTION_STRING
 * - none: Disables tracing
 *
 * This module should be imported at the very beginning of the application, before any other imports.
 */

import process from 'process';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import type { SpanExporter } from '@opentelemetry/sdk-trace-base';

const serviceName = process.env.OTEL_SERVICE_NAME || process.env.SERVICE_NAME || 'unknown-service';
const exporterType = (process.env.OTEL_TRACES_EXPORTER || 'none').toLowerCase();

let sdk: NodeSDK | null = null;
let tracingEnabled = false;

async function getExporter(): Promise<SpanExporter | 'azure' | null> {
  switch (exporterType) {
    case 'zipkin': {
      const endpoint = process.env.OTEL_EXPORTER_ZIPKIN_ENDPOINT;
      if (!endpoint) {
        console.log('⚠️  Zipkin exporter selected but OTEL_EXPORTER_ZIPKIN_ENDPOINT not set');
        return null;
      }
      const { ZipkinExporter } = await import('@opentelemetry/exporter-zipkin');
      console.log(`✅ Tracing: Zipkin exporter → ${endpoint}`);
      return new ZipkinExporter({ url: endpoint, serviceName }) as unknown as SpanExporter;
    }

    case 'otlp': {
      const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
      if (!endpoint) {
        console.log('⚠️  OTLP exporter selected but OTEL_EXPORTER_OTLP_ENDPOINT not set');
        return null;
      }
      const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
      console.log(`✅ Tracing: OTLP exporter → ${endpoint}`);
      return new OTLPTraceExporter({ url: endpoint }) as unknown as SpanExporter;
    }

    case 'azure': {
      const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
      if (!connectionString) {
        console.log('⚠️  Azure exporter selected but APPLICATIONINSIGHTS_CONNECTION_STRING not set');
        return null;
      }
      const { useAzureMonitor } = await import('@azure/monitor-opentelemetry');
      useAzureMonitor({
        azureMonitorExporterOptions: { connectionString },
      });
      console.log(`✅ Tracing: Azure Monitor configured for ${serviceName}`);
      return 'azure';
    }

    case 'none':
    default:
      console.log(`ℹ️  Tracing disabled (OTEL_TRACES_EXPORTER=${exporterType})`);
      return null;
  }
}

async function initializeTracing(): Promise<boolean> {
  try {
    const exporter = await getExporter();

    if (exporter === null) {
      return false;
    }

    if (exporter === 'azure') {
      return true;
    }

    sdk = new NodeSDK({
      serviceName: serviceName,
      traceExporter: exporter as any,
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
    console.error(`❌ Failed to initialize tracing: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

tracingEnabled = await initializeTracing();

export { tracingEnabled, sdk };
