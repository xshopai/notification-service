/**
 * Dapr Messaging Provider
 * Implements messaging via Dapr pub/sub building block
 */

import { DaprClient, CommunicationProtocolEnum } from '@dapr/dapr';
import { MessagingProvider, buildCloudEvent } from './provider.js';
import config from '../core/config.js';
import logger from '../core/logger.js';

export class DaprMessagingProvider implements MessagingProvider {
  private client: DaprClient | null = null;
  private readonly pubsubName: string;
  private readonly serviceName: string;
  private readonly daprHost: string;
  private readonly daprPort: number;

  constructor() {
    this.pubsubName = config.dapr.pubsubName;
    this.serviceName = config.service.name;
    this.daprHost = config.dapr.host;
    this.daprPort = config.dapr.httpPort;
  }

  private getClient(): DaprClient {
    if (!this.client) {
      this.client = new DaprClient({
        daprHost: this.daprHost,
        daprPort: String(this.daprPort),
        communicationProtocol: CommunicationProtocolEnum.HTTP,
      });
      logger.info('Dapr messaging provider initialized', {
        operation: 'messaging_init',
        provider: 'dapr',
        host: this.daprHost,
        port: this.daprPort,
        pubsubName: this.pubsubName,
      });
    }
    return this.client;
  }

  async publishEvent(topic: string, eventData: Record<string, any>, correlationId?: string): Promise<boolean> {
    try {
      const event = buildCloudEvent(topic, this.serviceName, eventData, correlationId);

      logger.debug('Publishing event via Dapr', {
        operation: 'publish_event',
        provider: 'dapr',
        topic,
        correlationId,
        pubsubName: this.pubsubName,
      });

      const client = this.getClient();

      // Let Dapr handle CloudEvents wrapping/unwrapping natively
      // Do NOT use rawPayload - it causes deserialization issues with Azure Service Bus
      await client.pubsub.publish(this.pubsubName, topic, event);

      logger.info('Event published successfully via Dapr', {
        operation: 'publish_event',
        provider: 'dapr',
        topic,
        correlationId,
        businessEvent: 'EVENT_PUBLISHED',
      });

      return true;
    } catch (error) {
      logger.error('Failed to publish event via Dapr', {
        operation: 'publish_event',
        provider: 'dapr',
        topic,
        correlationId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return false;
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      logger.info('Closing Dapr messaging provider', {
        operation: 'messaging_close',
        provider: 'dapr',
      });
      // DaprClient doesn't have explicit close, but we null the reference
      this.client = null;
    }
  }
}
