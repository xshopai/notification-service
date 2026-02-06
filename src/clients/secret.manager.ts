/**
 * Secret Manager
 * Provides configuration from environment variables
 */

import logger from '../core/logger.js';

class SecretManager {
  constructor() {
    logger.info('Secret manager initialized (using environment variables)', {
      event: 'secret_manager_init',
    });
  }

  /**
   * Get a secret value from environment variables
   */
  getSecret(secretName: string): string {
    const value = process.env[secretName];
    if (!value) {
      throw new Error(`${secretName} not found in environment variables`);
    }
    return value;
  }

  /**
   * Get a secret with fallback to empty string
   */
  getSecretOrDefault(secretName: string, defaultValue: string = ''): string {
    return process.env[secretName] || defaultValue;
  }

  /**
   * Get email configuration from environment variables
   */
  async getEmailConfig(): Promise<{
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string;
    smtpPass: string;
  }> {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const secure = process.env.SMTP_SECURE;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

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
   * Get message broker configuration from environment variables
   */
  async getMessageBrokerConfig(): Promise<{
    rabbitmqUrl: string;
    azureServiceBusConnectionString: string;
  }> {
    const rabbitmqUrl = process.env.RABBITMQ_URL;

    if (!rabbitmqUrl) {
      throw new Error('RABBITMQ_URL not found in environment variables');
    }

    return {
      rabbitmqUrl,
      azureServiceBusConnectionString: process.env.AZURE_SERVICEBUS_CONNECTION_STRING || '',
    };
  }
}

// Global instance
export const secretManager = new SecretManager();

// Helper functions for easy access
export const getEmailConfig = () => secretManager.getEmailConfig();
export const getMessageBrokerConfig = () => secretManager.getMessageBrokerConfig();
