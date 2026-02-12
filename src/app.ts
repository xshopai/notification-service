/**
 * Notification Service Application
 * Main application logic for consuming and processing notification events via Dapr
 */

import express from 'express';
import logger from './core/logger.js';
import config from './core/config.js';
import { traceContextMiddleware } from './middlewares/traceContext.middleware.js';
import homeRoutes from './routes/home.routes.js';
import operationalRoutes from './routes/operational.routes.js';
import eventsRoutes from './routes/events.routes.js';
import daprRoutes from './routes/dapr.routes.js';
import { getMessagingProvider } from './messaging/index.js';
import { getSubscriptionTopics, routeEventToHandler } from './consumers/rabbitmq.consumer.js';

const app = express();
let isShuttingDown = false;
let messagingProvider: any = null;

// Middleware
app.use(express.json());
app.use(traceContextMiddleware as express.RequestHandler); // W3C Trace Context

// Register routes
app.use(daprRoutes); // Dapr subscription endpoints (must be first for ACA)
app.use(homeRoutes); // Home and version info
app.use(operationalRoutes); // Health, readiness, liveness, metrics
app.use(eventsRoutes); // Event handling routes

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('HTTP Server Error', { error: err });
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
  });
});

/**
 * Start the notification consumer
 */
export const startConsumer = async (): Promise<void> => {
  try {
    logger.info('Starting Notification Consumer', {
      service: config.service.name,
      version: config.service.version,
      environment: config.service.nodeEnv,
      messagingProvider: config.messageBroker.type,
    });

    // Start HTTP server (required for Dapr subscriptions and health checks)
    const PORT = config.service.port;
    const HOST = config.service.host;
    const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;

    app.listen(PORT, HOST, () => {
      logger.info(`Notification service running on ${displayHost}:${PORT} in ${config.service.nodeEnv} mode`, {
        service: config.service.name,
        version: config.service.version,
        messagingProvider: config.messageBroker.type,
      });
    });

    // Start message consumer based on provider
    const provider = config.messageBroker.type.toLowerCase();

    if (provider === 'rabbitmq') {
      // Direct RabbitMQ consumer (for local deployment without Dapr)
      logger.info('Starting direct RabbitMQ consumer');

      messagingProvider = await getMessagingProvider();

      if (messagingProvider.subscribe) {
        const topics = getSubscriptionTopics();

        logger.info('Subscribing to RabbitMQ topics', {
          topicCount: topics.length,
          topics,
        });

        await messagingProvider.subscribe(topics, routeEventToHandler);

        logger.info('✅ RabbitMQ consumer started - processing events directly from RabbitMQ');
      } else {
        logger.warn('⚠️ RabbitMQ provider does not support direct consumption - falling back to Dapr mode');
        logger.info('Consumer ready - processing events via Dapr declarative subscriptions');
      }
    } else {
      // Dapr or other providers - use HTTP endpoints
      logger.info('Consumer ready - processing events via Dapr declarative subscriptions', {
        provider,
      });
    }
  } catch (error) {
    logger.error('Failed to start notification consumer', { error });
    process.exit(1);
  }
};

/**
 * Graceful shutdown handler
 */
const gracefulShutdown = async (signal: string): Promise<void> => {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress - forcing exit');
    process.exit(1);
  }

  isShuttingDown = true;
  logger.info('Starting graceful shutdown', { signal });

  try {
    // Close messaging provider connection
    if (messagingProvider) {
      logger.info('Closing messaging provider connection');
      await messagingProvider.close();
    }

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Start the consumer (only if this module is the entry point)
if (import.meta.url === `file://${process.argv[1]}`) {
  startConsumer();
}
