/**
 * Dapr Client Helper
 * Provides utilities for Dapr service invocation and pub/sub
 */
import { DaprClient, CommunicationProtocolEnum } from '@dapr/dapr';
import config from '../core/config.js';
import logger from '../core/logger.js';

class DaprServiceClient {
  private client: DaprClient | null = null;

  getClient(): DaprClient {
    if (!this.client) {
      this.client = new DaprClient({
        daprHost: config.dapr.host,
        daprPort: String(config.dapr.httpPort),
        communicationProtocol: CommunicationProtocolEnum.HTTP,
      });
      logger.info('Dapr client initialized', {
        host: config.dapr.host,
        port: config.dapr.httpPort,
      });
    }
    return this.client;
  }

  /**
   * Publish event to Dapr pub/sub
   */
  async publishEvent(pubsubName: string, topic: string, data: any): Promise<void> {
    try {
      logger.debug('Publishing event via Dapr', { pubsubName, topic });

      const client = this.getClient();

      // CRITICAL: Tell Dapr the payload is already CloudEvents formatted
      // This prevents double-wrapping and ensures subscribers receive the data correctly
      const publishOptions = {
        metadata: {
          rawPayload: 'true',
        },
      };

      await client.pubsub.publish(pubsubName, topic, data, publishOptions);

      logger.info('Event published successfully', { pubsubName, topic });
    } catch (error) {
      logger.error('Failed to publish event', { error, pubsubName, topic });
      throw error;
    }
  }

  /**
   * Invoke another service using Dapr service invocation
   */
  async invokeService(
    appId: string,
    methodName: string,
    httpMethod: string = 'GET',
    data: any = null,
    metadata: Record<string, string> = {},
  ): Promise<any> {
    try {
      logger.debug('Invoking service via Dapr', { appId, methodName, httpMethod, ...metadata });

      const client = this.getClient();
      const response = await client.invoker.invoke(appId, methodName, httpMethod as any, data, metadata);

      logger.info('Service invocation successful', { appId, methodName });

      return response;
    } catch (error) {
      logger.error('Service invocation failed', { error, appId, methodName });
      throw error;
    }
  }

  /**
   * Get Dapr metadata
   */
  async getMetadata(): Promise<any> {
    try {
      const client = this.getClient();
      const metadata = await client.metadata.get();
      return metadata;
    } catch (error) {
      logger.error('Failed to get Dapr metadata', { error });
      throw error;
    }
  }
}

// Export singleton instance
export const daprClient = new DaprServiceClient();
export default daprClient;
