/**
 * Event Publisher for Notification Service
 * Publishes notification outcome events via configurable messaging provider
 *
 * Uses MESSAGING_PROVIDER environment variable:
 * - 'dapr' (default) - Uses Dapr pub/sub
 * - 'rabbitmq' - Direct RabbitMQ connection
 * - 'servicebus' - Azure Service Bus
 */

import { getMessagingProvider } from '../../messaging/index.js';
import logger from '../../core/logger.js';
import config from '../../core/config.js';
import { EventTypes } from '../event-types.js';

export class DaprEventPublisher {
  private readonly serviceName: string;

  constructor() {
    this.serviceName = config.service.name;
  }

  /**
   * Publish event via configured messaging provider
   */
  async publishEvent(
    eventType: EventTypes.NOTIFICATION_SENT | EventTypes.NOTIFICATION_FAILED,
    data: any,
    traceId: string,
    spanId?: string,
  ): Promise<boolean> {
    try {
      const contextLogger = logger.withTraceContext(traceId, spanId);

      contextLogger.info(`Publishing event: ${eventType}`, {
        operation: 'publish_event',
        eventType,
        notificationId: data.data?.notificationId,
      });

      // Build event data with trace context
      const eventData = {
        ...data,
        traceparent: spanId ? `00-${traceId}-${spanId}-01` : `00-${traceId}-${'0'.repeat(16)}-01`,
      };

      const provider = await getMessagingProvider();
      const success = await provider.publishEvent(eventType, eventData, traceId);

      if (success) {
        contextLogger.info(`Event published successfully: ${eventType}`, {
          operation: 'publish_event',
          eventType,
          businessEvent: 'EVENT_PUBLISHED',
        });
      }

      return success;
    } catch (error) {
      const contextLogger = logger.withTraceContext(traceId, spanId);
      contextLogger.error(`Failed to publish event: ${eventType}`, {
        operation: 'publish_event',
        eventType,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return false;
    }
  }

  /**
   * Publish notification.sent event
   */
  async publishNotificationSent(
    notificationId: string,
    originalEventType: string,
    userId: string,
    recipientEmail: string,
    subject: string,
    traceId: string,
    spanId?: string,
  ): Promise<boolean> {
    return this.publishEvent(
      EventTypes.NOTIFICATION_SENT,
      {
        eventType: EventTypes.NOTIFICATION_SENT,
        userId,
        userEmail: recipientEmail,
        timestamp: new Date(),
        data: {
          notificationId,
          originalEventType,
          channel: 'email',
          recipientEmail,
          subject,
          attemptNumber: 1,
        },
      },
      traceId,
      spanId,
    );
  }

  /**
   * Publish notification.failed event
   */
  async publishNotificationFailed(
    notificationId: string,
    originalEventType: string,
    userId: string,
    recipientEmail: string | undefined,
    subject: string,
    errorMessage: string,
    traceId: string,
    spanId?: string,
  ): Promise<boolean> {
    return this.publishEvent(
      EventTypes.NOTIFICATION_FAILED,
      {
        eventType: EventTypes.NOTIFICATION_FAILED,
        userId,
        userEmail: recipientEmail,
        timestamp: new Date(),
        data: {
          notificationId,
          originalEventType,
          channel: 'email',
          recipientEmail,
          subject,
          errorMessage,
          attemptNumber: 1,
        },
      },
      traceId,
      spanId,
    );
  }
}

export const daprPublisher = new DaprEventPublisher();
