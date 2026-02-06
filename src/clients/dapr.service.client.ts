/**
 * Service Client Helper
 * Provides utilities for service invocation and Dapr metadata
 * - When MESSAGING_PROVIDER=dapr: Uses Dapr service invocation
 * - Otherwise: Uses direct HTTP calls
 */
import config from '../core/config.js';
import logger from '../core/logger.js';

// Determine service invocation mode based on MESSAGING_PROVIDER
const MESSAGING_PROVIDER = process.env.MESSAGING_PROVIDER || 'rabbitmq';
const USE_DAPR = MESSAGING_PROVIDER === 'dapr';

// Dapr sidecar configuration (only used when MESSAGING_PROVIDER=dapr)
const DAPR_HOST = process.env.DAPR_HOST || 'localhost';
const DAPR_HTTP_PORT = process.env.DAPR_HTTP_PORT || '3500';

// Dapr App IDs for service discovery (used when MESSAGING_PROVIDER=dapr)
const DAPR_APP_IDS: Record<string, string> = {
  'user-service': process.env.DAPR_USER_SERVICE_APP_ID || 'user-service',
  'order-service': process.env.DAPR_ORDER_SERVICE_APP_ID || 'order-service',
  'product-service': process.env.DAPR_PRODUCT_SERVICE_APP_ID || 'product-service',
};

// Direct HTTP URLs for service discovery (used when MESSAGING_PROVIDER != dapr)
const SERVICE_URLS: Record<string, string> = {
  'user-service': process.env.USER_SERVICE_URL || 'http://xshopai-user-service:8002',
  'order-service': process.env.ORDER_SERVICE_URL || 'http://xshopai-order-service:8006',
  'product-service': process.env.PRODUCT_SERVICE_URL || 'http://xshopai-product-service:8001',
};

class DaprServiceClient {
  private daprModule: any = null;
  private client: any = null;

  /**
   * Lazily load Dapr SDK - only when actually needed (for metadata calls)
   */
  private async getDaprClient(): Promise<any> {
    if (!this.client) {
      try {
        if (!this.daprModule) {
          this.daprModule = await import('@dapr/dapr');
        }
        const { DaprClient, CommunicationProtocolEnum } = this.daprModule;
        this.client = new DaprClient({
          daprHost: config.dapr.host,
          daprPort: String(config.dapr.httpPort),
          communicationProtocol: CommunicationProtocolEnum.HTTP,
        });
        logger.info('Dapr client initialized', {
          host: config.dapr.host,
          port: config.dapr.httpPort,
        });
      } catch (error: any) {
        logger.warn('Failed to initialize Dapr client', { error: error.message });
        throw error;
      }
    }
    return this.client;
  }

  /**
   * Invoke another service
   * - When MESSAGING_PROVIDER=dapr: Uses Dapr service invocation
   * - Otherwise: Uses direct HTTP calls
   */
  async invokeService(
    serviceName: string,
    methodName: string,
    httpMethod: string = 'GET',
    data: any = null,
    metadata: Record<string, string> = {},
  ): Promise<any> {
    try {
      let url: string;
      const cleanMethodName = methodName.startsWith('/') ? methodName.slice(1) : methodName;

      if (USE_DAPR) {
        // Dapr service invocation: http://localhost:3500/v1.0/invoke/{appId}/method/{method}
        const appId = DAPR_APP_IDS[serviceName] || serviceName;
        url = `http://${DAPR_HOST}:${DAPR_HTTP_PORT}/v1.0/invoke/${appId}/method/${cleanMethodName}`;
        logger.debug('Invoking service via Dapr', { serviceName, appId, url, httpMethod });
      } else {
        // Direct HTTP call
        const baseUrl = SERVICE_URLS[serviceName] || `http://xshopai-${serviceName}:8000`;
        url = `${baseUrl}/${cleanMethodName}`;
        logger.debug('Invoking service via HTTP', { serviceName, url, httpMethod });
      }

      const options: RequestInit = {
        method: httpMethod.toUpperCase(),
        headers: {
          'Content-Type': 'application/json',
          ...metadata,
        },
      };

      if (data && httpMethod.toUpperCase() !== 'GET') {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      return null;
    } catch (error) {
      logger.error('Service invocation failed', { error, serviceName, methodName });
      throw error;
    }
  }

  /**
   * Get Dapr metadata (for health checks)
   * Returns null if Dapr is not available
   */
  async getMetadata(): Promise<any> {
    try {
      const client = await this.getDaprClient();
      const metadata = await client.metadata.get();
      return metadata;
    } catch (error) {
      logger.warn('Failed to get Dapr metadata (Dapr may not be running)', { error });
      return null;
    }
  }
}

// Export singleton instance
export const daprClient = new DaprServiceClient();
export default daprClient;
