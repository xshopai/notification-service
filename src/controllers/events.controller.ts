/**
 * Events Controller
 * HTTP endpoints for handling events via Dapr declarative subscriptions
 */

import { Request, Response } from 'express';
import logger from '../core/logger.js';
import NotificationService from '../services/notification.service.js';

const notificationService = new NotificationService();

/**
 * Generic event handler wrapper
 */
const handleEvent = (eventType: string) => {
  return async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const cloudEvent = req.body;

    try {
      // DEBUG: Log raw incoming request body for troubleshooting Azure Service Bus event format
      logger.info(`RAW EVENT RECEIVED: ${eventType}`, {
        eventType,
        rawBody: JSON.stringify(cloudEvent).substring(0, 1000),
        hasData: !!cloudEvent.data,
        dataType: typeof cloudEvent.data,
        topLevelKeys: Object.keys(cloudEvent || {}),
      });

      logger.info(`Processing event: ${eventType}`, {
        eventType,
        cloudEventId: cloudEvent.id,
        traceId: cloudEvent.traceparent?.split('-')[1],
      });

      await notificationService.processNotificationEvent(cloudEvent, eventType);

      const duration = Date.now() - startTime;
      logger.info(`Event processed successfully: ${eventType}`, {
        eventType,
        duration: `${duration}ms`,
      });

      res.status(200).json({ status: 'SUCCESS' });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Failed to process event: ${eventType}`, {
        eventType,
        error: error instanceof Error ? error : new Error(String(error)),
        duration: `${duration}ms`,
      });

      res.status(500).json({
        status: 'ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
};

// Auth events
export const handleAuthUserRegistered = handleEvent('auth.user.registered');
export const handleAuthEmailVerificationRequested = handleEvent('auth.email.verification.requested');
export const handleAuthPasswordResetRequested = handleEvent('auth.password.reset.requested');
export const handleAuthPasswordResetCompleted = handleEvent('auth.password.reset.completed');

// User events
export const handleUserCreated = handleEvent('user.created');
export const handleUserUpdated = handleEvent('user.updated');
export const handleUserDeleted = handleEvent('user.deleted');
export const handleUserEmailVerified = handleEvent('user.email.verified');
export const handleUserPasswordChanged = handleEvent('user.password.changed');

// Order events
export const handleOrderCreated = handleEvent('order.created');
export const handleOrderCancelled = handleEvent('order.cancelled');
export const handleOrderDelivered = handleEvent('order.delivered');
export const handleOrderShipped = handleEvent('order.shipped');

// Payment events
export const handlePaymentReceived = handleEvent('payment.received');
export const handlePaymentFailed = handleEvent('payment.failed');

// Profile events
export const handleProfilePasswordChanged = handleEvent('profile.password_changed');
export const handleProfileNotificationPreferencesUpdated = handleEvent('profile.notification_preferences_updated');
export const handleProfileBankDetailsUpdated = handleEvent('profile.bank_details_updated');
