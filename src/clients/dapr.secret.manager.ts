/**
 * Dapr Secret Management Service
 * Provides secret management using Dapr's secret store building block.
 *
 * NOTE: Environment variables are loaded in server.ts before this module is imported
 */

import { DaprClient } from '@dapr/dapr';
import logger from '../core/logger.js';
import config from '../core/config.js';

class DaprSecretManager {
  private environment: string;
  private daprHost: string;
  private daprPort: string;
  private secretStoreName: string;
  private client: DaprClient;

  constructor() {
    this.environment = config.service.nodeEnv;
    this.daprHost = process.env.DAPR_HOST || '127.0.0.1';
    this.daprPort = process.env.DAPR_HTTP_PORT || '3500';

    this.secretStoreName = 'secretstore';

    this.client = new DaprClient({
      daprHost: this.daprHost,
      daprPort: this.daprPort,
    });

    logger.info('Secret manager initialized', {
      event: 'secret_manager_init',
      daprEnabled: true,
      environment: this.environment,
      secretStore: this.secretStoreName,
    });
  }

  /**
   * Get a secret value from Dapr secret store
   * @param secretName - Name of the secret to retrieve
   * @returns Secret value
   */
  async getSecret(secretName: string): Promise<string> {
    try {
      const response = await this.client.secret.get(this.secretStoreName, secretName);

      // Handle different response types
      if (response && typeof response === 'object') {
        // Response is typically an object like { secretName: 'value' }
        const value = response[secretName];
        if (value !== undefined && value !== null) {
          logger.debug('Retrieved secret from Dapr', {
            event: 'secret_retrieved',
            secretName,
            source: 'dapr',
            store: this.secretStoreName,
          });
          return String(value);
        }

        // If not found by key, try getting first value
        const values = Object.values(response);
        if (values.length > 0 && values[0] !== undefined) {
          logger.debug('Retrieved secret from Dapr (first value)', {
            event: 'secret_retrieved',
            secretName,
            source: 'dapr',
            store: this.secretStoreName,
          });
          return String(values[0]);
        }
      }

      throw new Error(`Secret '${secretName}' not found in Dapr store`);
    } catch (error) {
      logger.error(`Failed to get secret from Dapr: ${(error as Error).message}`, {
        event: 'secret_retrieval_error',
        secretName,
        error: (error as Error).message,
        store: this.secretStoreName,
      });
      throw error;
    }
  }

  /**
   * Get a secret with Dapr first, ENV fallback
   * @param secretName - Name of the secret
   * @returns Secret value
   */
  async getSecretWithFallback(secretName: string): Promise<string> {
    // Priority 1: Try Dapr secret store first
    try {
      const value = await this.getSecret(secretName);
      logger.debug(`${secretName} retrieved from Dapr secret store`);
      return value;
    } catch (error) {
      logger.debug(`${secretName} not in Dapr store, trying ENV variable`);

      // Priority 2: Fallback to environment variable (from .env file)
      const envValue = process.env[secretName];
      if (envValue) {
        logger.debug(`${secretName} retrieved from ENV variable`);
        return envValue;
      }

      throw new Error(`${secretName} not found in Dapr secret store or ENV variables`);
    }
  }

  /**
   * Get email configuration from Dapr secret store (preferred) or ENV variables (fallback)
   * @returns Email configuration parameters
   */
  async getEmailConfig(): Promise<{
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string;
    smtpPass: string;
  }> {
    const [host, port, secure, user, pass] = await Promise.all([
      this.getSecretWithFallback('SMTP_HOST'),
      this.getSecretWithFallback('SMTP_PORT'),
      this.getSecretWithFallback('SMTP_SECURE'),
      this.getSecretWithFallback('SMTP_USER'),
      this.getSecretWithFallback('SMTP_PASS'),
    ]);

    if (!host || !port || !user || !pass) {
      throw new Error('Missing required SMTP configuration');
    }

    return {
      smtpHost: host,
      smtpPort: parseInt(port, 10),
      smtpSecure: secure === 'true',
      smtpUser: user,
      smtpPass: pass,
    };
  }

  /**
   * Get message broker configuration from Dapr secret store (preferred) or ENV variables (fallback)
   * @returns Message broker configuration parameters
   */
  async getMessageBrokerConfig(): Promise<{
    rabbitmqUrl: string;
    azureServiceBusConnectionString: string;
  }> {
    const [rabbitmqUrl, azureConnectionString] = await Promise.all([
      this.getSecretWithFallback('RABBITMQ_URL'),
      this.getSecretWithFallback('AZURE_SERVICEBUS_CONNECTION_STRING').catch(() => ''),
    ]);

    if (!rabbitmqUrl) {
      throw new Error('RABBITMQ_URL not found in Dapr secret store or ENV variables');
    }

    return {
      rabbitmqUrl,
      azureServiceBusConnectionString: azureConnectionString || '',
    };
  }
}

// Global instance
export const secretManager = new DaprSecretManager();

// Helper functions for easy access
export const getEmailConfig = () => secretManager.getEmailConfig();
export const getMessageBrokerConfig = () => secretManager.getMessageBrokerConfig();
