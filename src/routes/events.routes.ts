/**
 * Events Routes
 * Routes for handling Dapr pub/sub events
 */

import express from 'express';
import * as eventsController from '../controllers/events.controller.js';

const router = express.Router();

// Auth events
router.post('/events/auth.user.registered', eventsController.handleAuthUserRegistered);
router.post('/events/auth.email.verification.requested', eventsController.handleAuthEmailVerificationRequested);
router.post('/events/auth.password.reset.requested', eventsController.handleAuthPasswordResetRequested);
router.post('/events/auth.password.reset.completed', eventsController.handleAuthPasswordResetCompleted);

// User events
router.post('/events/user.created', eventsController.handleUserCreated);
router.post('/events/user.updated', eventsController.handleUserUpdated);
router.post('/events/user.deleted', eventsController.handleUserDeleted);
router.post('/events/user.email.verified', eventsController.handleUserEmailVerified);
router.post('/events/user.password.changed', eventsController.handleUserPasswordChanged);

// Order events
router.post('/events/order.created', eventsController.handleOrderCreated);
router.post('/events/order.cancelled', eventsController.handleOrderCancelled);
router.post('/events/order.delivered', eventsController.handleOrderDelivered);
router.post('/events/order.shipped', eventsController.handleOrderShipped);

// Payment events
router.post('/events/payment.received', eventsController.handlePaymentReceived);
router.post('/events/payment.failed', eventsController.handlePaymentFailed);

// Profile events
router.post('/events/profile.password_changed', eventsController.handleProfilePasswordChanged);
router.post(
  '/events/profile.notification_preferences_updated',
  eventsController.handleProfileNotificationPreferencesUpdated,
);
router.post('/events/profile.bank_details_updated', eventsController.handleProfileBankDetailsUpdated);

export default router;
