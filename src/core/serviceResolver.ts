/**
 * Service Resolver — Service discovery for direct mode.
 *
 * Resolution order:
 *   1. Azure App Service: SERVICE_BASE_URL template (when set)
 *   2. Consul: query the service catalog via HTTP API (when CONSUL_URL is set)
 *   3. Convention fallback: static PORT_REGISTRY (localhost:{port})
 *
 * This module is only used when PLATFORM_MODE=direct.
 * In Dapr mode, the Dapr sidecar handles service discovery natively.
 */

import logger from './logger.js';

/**
 * Static port registry for local development.
 * Maps service app-id → localhost port.
 */
const PORT_REGISTRY: Record<string, number> = {
  'product-service': 8001,
  'user-service': 8002,
  'admin-service': 8003,
  'auth-service': 8004,
  'inventory-service': 8005,
  'order-service': 8006,
  'cart-service': 8008,
  'payment-service': 8009,
  'review-service': 8010,
  'notification-service': 8011,
  'audit-service': 8012,
  'chat-service': 8013,
  'web-bff': 8014,
  'order-processor-service': 8007,
};

/**
 * SERVICE_BASE_URL — convention-based URL template for Azure App Service.
 * When set, replaces {name} with the service app-id.
 * When not set (local dev), falls through to Consul / port registry.
 */
const SERVICE_BASE_URL = process.env.SERVICE_BASE_URL || '';

/** CONSUL_URL — base URL of the Consul HTTP API (e.g. http://localhost:8500). */
const CONSUL_URL = process.env.CONSUL_URL || '';

/** In-memory cache for Consul lookups (TTL-based). */
const consulCache: Map<string, { url: string; expiresAt: number }> = new Map();
const CACHE_TTL_MS = 30_000;

async function queryConsul(appId: string): Promise<string | null> {
  if (!CONSUL_URL) return null;

  const cached = consulCache.get(appId);
  if (cached && Date.now() < cached.expiresAt) {
    logger.debug(`[ServiceResolver] Consul cache hit: ${appId} → ${cached.url}`);
    return cached.url;
  }

  try {
    const res = await fetch(`${CONSUL_URL}/v1/health/service/${appId}?passing=true`);
    if (!res.ok) {
      logger.debug(`[ServiceResolver] Consul HTTP ${res.status} for ${appId}`);
      return null;
    }

    const entries = (await res.json()) as Array<{
      Service: { Address: string; Port: number };
    }>;
    if (!entries || entries.length === 0) {
      logger.debug(`[ServiceResolver] Consul has no healthy instances for ${appId}`);
      return null;
    }

    const svc = entries[0].Service;
    const address = svc.Address || 'localhost';
    const url = `http://${address}:${svc.Port}`;

    logger.info(`[ServiceResolver] Consul resolved ${appId} → ${url}`);
    consulCache.set(appId, { url, expiresAt: Date.now() + CACHE_TTL_MS });
    return url;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.debug(`[ServiceResolver] Consul unavailable for ${appId}: ${msg}`);
    return null;
  }
}

/** Resolve a service URL (async — queries Consul when available). */
export async function resolveAsync(appId: string): Promise<string> {
  if (SERVICE_BASE_URL) {
    const url = SERVICE_BASE_URL.replace('{name}', appId);
    logger.debug(`[ServiceResolver] SERVICE_BASE_URL resolved ${appId} → ${url}`);
    return url;
  }

  const consulUrl = await queryConsul(appId);
  if (consulUrl) return consulUrl;

  const port = PORT_REGISTRY[appId];
  if (port) {
    const url = `http://localhost:${port}`;
    logger.info(`[ServiceResolver] PORT_REGISTRY fallback: ${appId} → ${url}`);
    return url;
  }

  throw new Error(
    `[ServiceResolver] Unknown service: '${appId}'. Add it to PORT_REGISTRY or set SERVICE_BASE_URL.`,
  );
}

/** Resolve a service URL (sync — convention-based only, reads Consul cache). */
export function resolve(appId: string): string {
  if (SERVICE_BASE_URL) return SERVICE_BASE_URL.replace('{name}', appId);

  const cached = consulCache.get(appId);
  if (cached && Date.now() < cached.expiresAt) return cached.url;

  const port = PORT_REGISTRY[appId];
  if (port) return `http://localhost:${port}`;

  throw new Error(
    `[ServiceResolver] Unknown service: '${appId}'. Add it to PORT_REGISTRY or set SERVICE_BASE_URL.`,
  );
}

export default { resolve, resolveAsync, PORT_REGISTRY };
