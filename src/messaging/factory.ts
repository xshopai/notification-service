/**
 * Messaging Provider Factory
 * Creates the appropriate messaging provider based on MESSAGING_PROVIDER environment variable
 */

import { MessagingProvider, MessagingProviderType } from './provider.js';
import logger from '../core/logger.js';

// Singleton instance
let messagingProviderInstance: MessagingProvider | null = null;

/**
 * Get the configured messaging provider type from environment
 */
function getProviderType(): MessagingProviderType {
  const provider = (process.env.MESSAGING_PROVIDER || 'dapr').toLowerCase();

  if (!['dapr', 'rabbitmq', 'servicebus'].includes(provider)) {
    logger.warn(`Unknown messaging provider: ${provider}, defaulting to 'dapr'`, {
      operation: 'messaging_factory',
      configuredProvider: provider,
    });
    return 'dapr';
  }

  return provider as MessagingProviderType;
}

/**
 * Create a messaging provider instance based on type
 */
async function createProvider(providerType: MessagingProviderType): Promise<MessagingProvider> {
  // Lazy import providers - only loads the SDK that's actually needed
  switch (providerType) {
    case 'dapr': {
      const { DaprMessagingProvider } = await import('./daprProvider.js');
      return new DaprMessagingProvider();
    }
    case 'rabbitmq': {
      const { RabbitMQMessagingProvider } = await import('./rabbitmqProvider.js');
      return new RabbitMQMessagingProvider();
    }
    case 'servicebus': {
      const { ServiceBusMessagingProvider } = await import('./servicebusProvider.js');
      return new ServiceBusMessagingProvider();
    }
    default:
      // This shouldn't happen due to getProviderType validation
      logger.error(`Unknown provider type: ${providerType}, using Dapr`, {
        operation: 'messaging_factory',
      });
      const { DaprMessagingProvider } = await import('./daprProvider.js');
      return new DaprMessagingProvider();
  }
}

/**
 * Get the messaging provider singleton instance
 * Creates the provider on first call based on MESSAGING_PROVIDER env var
 */
export async function getMessagingProvider(): Promise<MessagingProvider> {
  if (!messagingProviderInstance) {
    const providerType = getProviderType();

    logger.info(`Creating messaging provider: ${providerType}`, {
      operation: 'messaging_factory',
      provider: providerType,
    });

    messagingProviderInstance = await createProvider(providerType);
  }

  return messagingProviderInstance;
}

/**
 * Close the messaging provider and clear the singleton
 * Should be called during graceful shutdown
 */
export async function closeMessagingProvider(): Promise<void> {
  if (messagingProviderInstance) {
    logger.info('Closing messaging provider', {
      operation: 'messaging_factory',
    });

    await messagingProviderInstance.close();
    messagingProviderInstance = null;
  }
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetMessagingProvider(): void {
  messagingProviderInstance = null;
}
