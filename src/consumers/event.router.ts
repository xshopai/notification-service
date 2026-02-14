/**
 * Event Router
 * Routes incoming events to appropriate handlers
 * Used by direct broker consumers (RabbitMQ, Azure Service Bus) for deployment without Dapr
 */

import logger from '../core/logger.js';
import { CloudEvent } from '../messaging/provider.js';
import * as eventsController from '../controllers/events.controller.js';

/**
 * Create a mock Express Response object for broker consumer context
 * Since we're not in HTTP context, we need to fake the response methods
 */
function createMockResponse() {
  return {
    status: function (code: number) {
      return this;
    },
    json: function (data: any) {
      return this;
    },
  } as any;
}

/**
 * Topic to handler mapping
 * Maps event topics to their respective event handlers
 *
 * Topic names MUST match what publishing services actually emit:
 * - auth-service: auth.user.registered, auth.email.verification.requested, etc.
 * - user-service: user.created, user.updated, user.deleted, etc.
 * - order-service: order.placed, order.cancelled, etc.
 * - payment-service: payment.received, payment.failed
 */
const TOPIC_HANDLERS: Record<string, (event: CloudEvent) => Promise<void>> = {
  // Auth events (from auth-service)
  'auth.user.registered': async (event) =>
    eventsController.handleAuthUserRegistered({ body: event } as any, createMockResponse()),
  'auth.email.verification.requested': async (event) =>
    eventsController.handleAuthEmailVerificationRequested({ body: event } as any, createMockResponse()),
  'auth.password.reset.requested': async (event) =>
    eventsController.handleAuthPasswordResetRequested({ body: event } as any, createMockResponse()),
  'auth.password.reset.completed': async (event) =>
    eventsController.handleAuthPasswordResetCompleted({ body: event } as any, createMockResponse()),

  // User events (from user-service) - topic format: user.{action}
  'user.created': async (event) => eventsController.handleUserCreated({ body: event } as any, createMockResponse()),
  'user.updated': async (event) => eventsController.handleUserUpdated({ body: event } as any, createMockResponse()),
  'user.deleted': async (event) => eventsController.handleUserDeleted({ body: event } as any, createMockResponse()),
  'user.email.verified': async (event) =>
    eventsController.handleUserEmailVerified({ body: event } as any, createMockResponse()),
  'user.password.changed': async (event) =>
    eventsController.handleUserPasswordChanged({ body: event } as any, createMockResponse()),

  // Order events (from order-service)
  'order.placed': async (event) => eventsController.handleOrderPlaced({ body: event } as any, createMockResponse()),
  'order.cancelled': async (event) =>
    eventsController.handleOrderCancelled({ body: event } as any, createMockResponse()),
  'order.delivered': async (event) =>
    eventsController.handleOrderDelivered({ body: event } as any, createMockResponse()),
  'order.shipped': async (event) => eventsController.handleOrderShipped({ body: event } as any, createMockResponse()),

  // Payment events (from payment-service)
  'payment.received': async (event) =>
    eventsController.handlePaymentReceived({ body: event } as any, createMockResponse()),
  'payment.failed': async (event) => eventsController.handlePaymentFailed({ body: event } as any, createMockResponse()),

  // Profile events (from user-service profile operations)
  'profile.password_changed': async (event) =>
    eventsController.handleProfilePasswordChanged({ body: event } as any, createMockResponse()),
  'profile.notification_preferences_updated': async (event) =>
    eventsController.handleProfileNotificationPreferencesUpdated({ body: event } as any, createMockResponse()),
  'profile.bank_details_updated': async (event) =>
    eventsController.handleProfileBankDetailsUpdated({ body: event } as any, createMockResponse()),
};

/**
 * Get list of topics to subscribe to
 */
export function getSubscriptionTopics(): string[] {
  return Object.keys(TOPIC_HANDLERS);
}

/**
 * Route incoming CloudEvent to appropriate handler
 */
export async function routeEventToHandler(event: CloudEvent): Promise<void> {
  let topic = event.type;

  // Info logging to see what we're actually receiving (debug level may not show)
  logger.info('🔍 Received event for routing', {
    operation: 'route_event_received',
    eventType: event.type,
    hasType: !!event.type,
    eventKeys: Object.keys(event).join(','),
    correlationId: event.correlationId,
  });

  // Handle full CloudEvent format: 'com.xshopai.auth.user.registered' → 'auth.user.registered'
  if (topic && topic.startsWith('com.xshopai.')) {
    const originalTopic = topic;
    topic = topic.replace('com.xshopai.', '');
    logger.info('🔄 Converted CloudEvent type to topic', {
      operation: 'route_event_convert',
      originalType: originalTopic,
      convertedTopic: topic,
    });
  }

  const handler = TOPIC_HANDLERS[topic];

  if (!handler) {
    logger.warn('❌ No handler found for event type', {
      operation: 'route_event_failed',
      eventType: topic,
      originalType: event.type,
      availableHandlers: Object.keys(TOPIC_HANDLERS).slice(0, 5),
      totalHandlers: Object.keys(TOPIC_HANDLERS).length,
      correlationId: event.correlationId,
    });
    return;
  }

  logger.info('✅ Routing event to handler', {
    operation: 'route_event_success',
    eventType: topic,
    correlationId: event.correlationId,
  });

  try {
    await handler(event);

    logger.info('Event processed successfully', {
      operation: 'route_event',
      eventType: topic,
      correlationId: event.correlationId,
      businessEvent: 'EVENT_PROCESSED',
    });
  } catch (error) {
    logger.error('Error processing event', {
      operation: 'route_event',
      eventType: topic,
      correlationId: event.correlationId,
      error: error instanceof Error ? error : new Error(String(error)),
    });
    throw error; // Re-throw so RabbitMQ consumer can nack and requeue
  }
}
