/**
 * Operational/Infrastructure endpoints
 * These endpoints are used by monitoring systems, load balancers, and DevOps tools
 */

import { Request, Response } from 'express';
import logger from '../core/logger.js';
import { daprClient } from '../clients/index.js';
import config from '../core/config.js';

/**
 * Get system metrics for monitoring
 */
function getSystemMetrics() {
  const memoryUsage = process.memoryUsage();
  return {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external,
    },
    nodeVersion: process.version,
    platform: process.platform,
  };
}

/**
 * Perform readiness check including Dapr connectivity
 */
async function performReadinessCheck() {
  const startTime = Date.now();
  const checks: Record<string, any> = {};

  try {
    // Check Dapr sidecar health (optional - service works without Dapr)
    try {
      const metadata = await daprClient.getMetadata();
      if (metadata) {
        checks.dapr = { status: 'healthy' };
      } else {
        checks.dapr = { status: 'unavailable', message: 'Dapr sidecar not running (optional)' };
      }
    } catch (error: any) {
      logger.warn('Dapr health check failed', { error: error.message });
      checks.dapr = { status: 'unavailable', message: error.message };
    }

    // Service is ready even without Dapr (uses messaging provider fallback)
    const status = 'ready';

    return {
      status,
      timestamp: new Date().toISOString(),
      totalCheckTime: Date.now() - startTime,
      checks,
    };
  } catch (error: any) {
    return {
      status: 'not ready',
      timestamp: new Date().toISOString(),
      totalCheckTime: Date.now() - startTime,
      checks,
      error: error.message,
    };
  }
}

/**
 * Perform liveness check - basic application health
 */
async function performLivenessCheck() {
  const checks = {
    server: { status: 'alive' },
    timestamp: new Date().toISOString(),
  };

  return {
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks,
  };
}

/**
 * Health check endpoint
 */
export const health = (req: Request, res: Response): void => {
  res.json({
    status: 'healthy',
    service: config.service.name,
    version: config.service.version,
    environment: config.service.nodeEnv,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    dapr: {
      enabled: true,
      appId: config.dapr.appId,
      httpPort: config.dapr.httpPort,
    },
  });
};

/**
 * Readiness check endpoint
 */
export const readiness = async (req: Request, res: Response): Promise<void> => {
  try {
    const readinessResult = await performReadinessCheck();

    // Log readiness check results for monitoring
    logger.info('Readiness check performed', {
      status: readinessResult.status,
      totalCheckTime: readinessResult.totalCheckTime,
      checks: Object.keys(readinessResult.checks).reduce((acc: Record<string, string>, key) => {
        acc[key] = readinessResult.checks[key].status;
        return acc;
      }, {}),
    });

    const statusCode = readinessResult.status === 'ready' ? 200 : 503;

    res.status(statusCode).json({
      status: readinessResult.status,
      service: config.service.name,
      timestamp: readinessResult.timestamp,
      totalCheckTime: readinessResult.totalCheckTime,
      checks: readinessResult.checks,
      ...(readinessResult.error && { error: readinessResult.error }),
    });
  } catch (error: any) {
    logger.error('Readiness check failed', { error: error.message });
    res.status(503).json({
      status: 'not ready',
      service: config.service.name,
      timestamp: new Date().toISOString(),
      error: 'Readiness check failed',
      details: error.message,
    });
  }
};

/**
 * Liveness check endpoint
 */
export const liveness = async (req: Request, res: Response): Promise<void> => {
  try {
    const livenessResult = await performLivenessCheck();

    // Log liveness issues for monitoring
    if (livenessResult.status !== 'alive') {
      logger.warn('Liveness check failed', {
        status: livenessResult.status,
        checks: livenessResult.checks,
      });
    }

    const statusCode = livenessResult.status === 'alive' ? 200 : 503;

    res.status(statusCode).json({
      status: livenessResult.status,
      service: config.service.name,
      timestamp: livenessResult.timestamp,
      uptime: livenessResult.uptime,
      checks: livenessResult.checks,
    });
  } catch (error: any) {
    logger.error('Liveness check failed', { error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      service: config.service.name,
      timestamp: new Date().toISOString(),
      error: 'Liveness check failed',
      details: error.message,
    });
  }
};

/**
 * Metrics endpoint
 */
export const metrics = (req: Request, res: Response): void => {
  try {
    const systemMetrics = getSystemMetrics();

    res.json({
      service: config.service.name,
      ...systemMetrics,
    });
  } catch (error: any) {
    logger.error('Metrics collection failed', { error: error.message });
    res.status(500).json({
      service: config.service.name,
      timestamp: new Date().toISOString(),
      error: 'Metrics collection failed',
      details: error.message,
    });
  }
};
