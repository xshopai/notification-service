/**
 * Dapr Routes
 * Endpoints for Dapr sidecar integration (ACA programmatic subscriptions)
 *
 * IMPORTANT: For Azure Container Apps (ACA) deployment, Dapr requires
 * programmatic subscriptions via /dapr/subscribe endpoint.
 * For local development, Dapr CLI uses .dapr/components/subscriptions.yaml
 *
 * Keep SUBSCRIPTIONS array in sync with subscriptions.yaml when adding/removing topics!
 */

import express, { Request, Response } from 'express';

const router = express.Router();

// =============================================================================
// DAPR SUBSCRIPTION DEFINITIONS
// Single source of truth for ACA programmatic subscriptions
// IMPORTANT: Keep in sync with .dapr/components/subscriptions.yaml
// =============================================================================

const SUBSCRIPTIONS = [
  // Auth events
  { pubsubname: 'pubsub', topic: 'auth.user.registered', route: '/events/auth.user.registered' },
  { pubsubname: 'pubsub', topic: 'auth.email.verification.requested', route: '/events/auth.email.verification.requested' },
  { pubsubname: 'pubsub', topic: 'auth.password.reset.requested', route: '/events/auth.password.reset.requested' },
  { pubsubname: 'pubsub', topic: 'auth.password.reset.completed', route: '/events/auth.password.reset.completed' },

  // User events
  { pubsubname: 'pubsub', topic: 'user.user.created', route: '/events/user.user.created' },
  { pubsubname: 'pubsub', topic: 'user.user.updated', route: '/events/user.user.updated' },
  { pubsubname: 'pubsub', topic: 'user.user.deleted', route: '/events/user.user.deleted' },
  { pubsubname: 'pubsub', topic: 'user.email.verified', route: '/events/user.email.verified' },
  { pubsubname: 'pubsub', topic: 'user.password.changed', route: '/events/user.password.changed' },

  // Order events
  { pubsubname: 'pubsub', topic: 'order.placed', route: '/events/order.placed' },
  { pubsubname: 'pubsub', topic: 'order.cancelled', route: '/events/order.cancelled' },
  { pubsubname: 'pubsub', topic: 'order.delivered', route: '/events/order.delivered' },

  // Payment events
  { pubsubname: 'pubsub', topic: 'payment.received', route: '/events/payment.received' },
  { pubsubname: 'pubsub', topic: 'payment.failed', route: '/events/payment.failed' },

  // Profile events
  { pubsubname: 'pubsub', topic: 'profile.password_changed', route: '/events/profile.password_changed' },
  { pubsubname: 'pubsub', topic: 'profile.notification_preferences_updated', route: '/events/profile.notification_preferences_updated' },
  { pubsubname: 'pubsub', topic: 'profile.bank_details_updated', route: '/events/profile.bank_details_updated' },
];

/**
 * GET /dapr/subscribe
 * Dapr subscription endpoint (programmatic)
 *
 * Required for Azure Container Apps - ACA doesn't support declarative
 * subscription YAML files, only this programmatic endpoint.
 * Dapr sidecar calls this at startup to register subscriptions.
 */
router.get('/dapr/subscribe', (_req: Request, res: Response) => {
  console.log(`[Dapr] Subscription list requested (count=${SUBSCRIPTIONS.length})`);
  res.json(SUBSCRIPTIONS);
});

/**
 * GET /dapr/config
 * Dapr config endpoint (optional)
 *
 * Called by Dapr sidecar on startup to get application-specific configuration.
 * Return empty object for default behavior.
 */
router.get('/dapr/config', (_req: Request, res: Response) => {
  res.json({});
});

export default router;
