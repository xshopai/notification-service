/**
 * Azure Service Bus Messaging Provider
 * Implements messaging via Azure Service Bus
 *
 * NOTE: This provider requires the '@azure/service-bus' package to be installed.
 * Run: npm install @azure/service-bus
 */

import { MessagingProvider, buildCloudEvent } from './provider.js';
import config from '../core/config.js';
import logger from '../core/logger.js';

// Dynamic import for @azure/service-bus (optional dependency)
let serviceBusModule: typeof import('@azure/service-bus') | null = null;

async function getServiceBusModule(): Promise<typeof import('@azure/service-bus')> {
  if (!serviceBusModule) {
    try {
      serviceBusModule = await import('@azure/service-bus');
    } catch {
      throw new Error(
        'Azure Service Bus provider requires @azure/service-bus package. Install with: npm install @azure/service-bus',
      );
    }
  }
  return serviceBusModule;
}

export class ServiceBusMessagingProvider implements MessagingProvider {
  private client: import('@azure/service-bus').ServiceBusClient | null = null;
  private senders: Map<string, import('@azure/service-bus').ServiceBusSender> = new Map();
  private readonly serviceName: string;
  private readonly connectionString: string;

  constructor() {
    this.serviceName = config.service.name;
    this.connectionString = config.messageBroker.azureServiceBus?.connectionString || '';

    if (!this.connectionString) {
      logger.warn('Azure Service Bus connection string not configured', {
        operation: 'messaging_init',
        provider: 'servicebus',
      });
    }
  }

  private async getClient(): Promise<import('@azure/service-bus').ServiceBusClient> {
    if (!this.client) {
      if (!this.connectionString) {
        throw new Error('Azure Service Bus connection string is required');
      }

      const { ServiceBusClient } = await getServiceBusModule();
      this.client = new ServiceBusClient(this.connectionString);

      logger.info('Azure Service Bus messaging provider initialized', {
        operation: 'messaging_init',
        provider: 'servicebus',
      });
    }
    return this.client;
  }

  private async getSender(topicOrQueue: string): Promise<import('@azure/service-bus').ServiceBusSender> {
    let sender = this.senders.get(topicOrQueue);
    if (!sender) {
      const client = await this.getClient();
      sender = client.createSender(topicOrQueue);
      this.senders.set(topicOrQueue, sender);
    }
    return sender;
  }

  async publishEvent(topic: string, eventData: Record<string, any>, correlationId?: string): Promise<boolean> {
    try {
      const event = buildCloudEvent(topic, this.serviceName, eventData, correlationId);
      const sender = await this.getSender(topic);

      logger.debug('Publishing event via Azure Service Bus', {
        operation: 'publish_event',
        provider: 'servicebus',
        topic,
        correlationId,
      });

      await sender.sendMessages({
        body: event,
        contentType: 'application/json',
        correlationId: correlationId,
        applicationProperties: {
          eventType: topic,
          source: this.serviceName,
        },
      });

      logger.info('Event published successfully via Azure Service Bus', {
        operation: 'publish_event',
        provider: 'servicebus',
        topic,
        correlationId,
        businessEvent: 'EVENT_PUBLISHED',
      });

      return true;
    } catch (error) {
      logger.error('Failed to publish event via Azure Service Bus', {
        operation: 'publish_event',
        provider: 'servicebus',
        topic,
        correlationId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return false;
    }
  }

  async close(): Promise<void> {
    try {
      // Close all senders
      for (const [topic, sender] of this.senders) {
        await sender.close();
        logger.debug(`Closed sender for topic: ${topic}`, {
          operation: 'messaging_close',
          provider: 'servicebus',
        });
      }
      this.senders.clear();

      // Close client
      if (this.client) {
        await this.client.close();
        this.client = null;
      }

      logger.info('Azure Service Bus messaging provider closed', {
        operation: 'messaging_close',
        provider: 'servicebus',
      });
    } catch (error) {
      logger.error('Error closing Azure Service Bus provider', {
        operation: 'messaging_close',
        provider: 'servicebus',
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
}
