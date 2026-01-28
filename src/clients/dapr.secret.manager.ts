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

   * Get email configuration from Dapr secrets
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
      this.getSecret('SMTP_HOST'),
      this.getSecret('SMTP_PORT'),
      this.getSecret('SMTP_SECURE'),
      this.getSecret('SMTP_USER'),
      this.getSecret('SMTP_PASS'),
    ]);

    if (!host || !port || !user || !pass) {
      throw new Error('Missing required SMTP secrets from Dapr');
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
   * Get message broker configuration from Dapr secrets
   * @returns Message broker configuration parameters
   */
  async getMessageBrokerConfig(): Promise<{
    rabbitmqUrl: string;
    azureServiceBusConnectionString: string;
  }> {
    const [rabbitmqUrl, azureConnectionString] = await Promise.all([
      this.getSecret('RABBITMQ_URL'),
      this.getSecret('AZURE_SERVICEBUS_CONNECTION_STRING'),
    ]);

    if (!rabbitmqUrl) {
      throw new Error('RABBITMQ_URL not found in Dapr secret store');
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
