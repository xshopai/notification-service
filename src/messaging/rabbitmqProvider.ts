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

  /**
   * Subscribe to topics and consume messages directly from RabbitMQ
   * Creates a queue for this service and binds it to specified topics
   */
  async subscribe(
    topics: string[],
    handler: (event: import('./provider.js').CloudEvent) => Promise<void>,
  ): Promise<void> {
    try {
      const channel = (await this.getChannel()) as any; // Cast to any for missing type definitions
      const queueName = `${this.serviceName}-queue`;

      logger.info('Setting up RabbitMQ consumer', {
        operation: 'subscribe',
        provider: 'rabbitmq',
        queueName,
        topics,
        exchange: this.exchange,
      });

      // Assert queue (durable, survives broker restart)
      await channel.assertQueue(queueName, {
        durable: true,
        autoDelete: false,
      });

      // Bind queue to topics
      for (const topic of topics) {
        await channel.bindQueue(queueName, this.exchange, topic);
        logger.info(`Bound queue to topic: ${topic}`, {
          operation: 'subscribe',
          provider: 'rabbitmq',
          queue: queueName,
          topic,
        });
      }

      // Set prefetch to process one message at a time
      await channel.prefetch(1);

      // Start consuming
      await channel.consume(
        queueName,
        async (msg: any) => {
          if (!msg) return;

          const correlationId = msg.properties.correlationId || 'unknown';

          try {
            const eventData = JSON.parse(msg.content.toString());

            logger.debug('Received RabbitMQ message', {
              operation: 'consume',
              provider: 'rabbitmq',
              topic: msg.fields.routingKey,
              correlationId,
            });

            // Add type field from routing key (required by event router)
            // Auth-service publishes with topic as routing key but doesn't include type in body
            eventData.type = msg.fields.routingKey;

            // Call the handler
            await handler(eventData);

            // Acknowledge message
            channel.ack(msg);

            logger.debug('Message processed successfully', {
              operation: 'consume',
              provider: 'rabbitmq',
              topic: msg.fields.routingKey,
              correlationId,
            });
          } catch (error) {
            logger.error('Error processing RabbitMQ message', {
              operation: 'consume',
              provider: 'rabbitmq',
              topic: msg.fields.routingKey,
              correlationId,
              error: error instanceof Error ? error : new Error(String(error)),
            });

            // Reject and requeue message (will retry)
            channel.nack(msg, false, true);
          }
        },
        {
          noAck: false, // Manual acknowledgment
        },
      );

      logger.info('RabbitMQ consumer started successfully', {
        operation: 'subscribe',
        provider: 'rabbitmq',
        queueName,
        topicCount: topics.length,
      });
    } catch (error) {
      logger.error('Failed to start RabbitMQ consumer', {
        operation: 'subscribe',
        provider: 'rabbitmq',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
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
