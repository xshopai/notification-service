/**
 * RabbitMQ Messaging Provider
 * Implements direct RabbitMQ messaging (bypassing Dapr)
 *
 * NOTE: This provider requires the 'amqplib' package to be installed.
 * Run: npm install amqplib @types/amqplib
 */

import { MessagingProvider, buildCloudEvent } from './provider.js';
import config from '../core/config.js';
import logger from '../core/logger.js';

// Dynamic import for amqplib (optional dependency)
let amqplib: typeof import('amqplib') | null = null;

async function getAmqpLib(): Promise<typeof import('amqplib')> {
  if (!amqplib) {
    try {
      amqplib = await import('amqplib');
    } catch {
      throw new Error('RabbitMQ provider requires amqplib package. Install with: npm install amqplib @types/amqplib');
    }
  }
  return amqplib;
}

export class RabbitMQMessagingProvider implements MessagingProvider {
  private connection: import('amqplib').Connection | null = null;
  private channel: import('amqplib').Channel | null = null;
  private readonly serviceName: string;
  private readonly url: string;
  private readonly exchange: string;

  constructor() {
    this.serviceName = config.service.name;
    this.url = config.messageBroker.rabbitmq?.url || 'amqp://guest:guest@localhost:5672';
    this.exchange = config.messageBroker.rabbitmq?.exchange || 'xshopai.events';
  }

  private async getChannel(): Promise<import('amqplib').Channel> {
    if (!this.channel || !this.connection) {
      const amqp = await getAmqpLib();

      this.connection = await amqp.connect(this.url);
      this.channel = await this.connection.createChannel();

      // Ensure exchange exists
      await this.channel.assertExchange(this.exchange, 'topic', { durable: true });

      logger.info('RabbitMQ messaging provider initialized', {
        operation: 'messaging_init',
        provider: 'rabbitmq',
        exchange: this.exchange,
      });

      // Handle connection close
      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed', {
          operation: 'messaging_connection',
          provider: 'rabbitmq',
        });
        this.connection = null;
        this.channel = null;
      });

      this.connection.on('error', (err) => {
        logger.error('RabbitMQ connection error', {
          operation: 'messaging_connection',
          provider: 'rabbitmq',
          error: err,
        });
      });
    }
    return this.channel;
  }

  async publishEvent(topic: string, eventData: Record<string, any>, correlationId?: string): Promise<boolean> {
    try {
      const event = buildCloudEvent(topic, this.serviceName, eventData, correlationId);
      const channel = await this.getChannel();

      logger.debug('Publishing event via RabbitMQ', {
        operation: 'publish_event',
        provider: 'rabbitmq',
        topic,
        correlationId,
        exchange: this.exchange,
      });

      // Publish to exchange with topic as routing key
      const published = channel.publish(this.exchange, topic, Buffer.from(JSON.stringify(event)), {
        persistent: true,
        contentType: 'application/json',
        correlationId: correlationId,
        timestamp: Date.now(),
        appId: this.serviceName,
      });

      if (published) {
        logger.info('Event published successfully via RabbitMQ', {
          operation: 'publish_event',
          provider: 'rabbitmq',
          topic,
          correlationId,
          businessEvent: 'EVENT_PUBLISHED',
        });
      }

      return published;
    } catch (error) {
      logger.error('Failed to publish event via RabbitMQ', {
        operation: 'publish_event',
        provider: 'rabbitmq',
        topic,
        correlationId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return false;
    }
  }

  async close(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      logger.info('RabbitMQ messaging provider closed', {
        operation: 'messaging_close',
        provider: 'rabbitmq',
      });
    } catch (error) {
      logger.error('Error closing RabbitMQ provider', {
        operation: 'messaging_close',
        provider: 'rabbitmq',
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
}
