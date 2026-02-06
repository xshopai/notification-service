/**
 * External Clients
 * Exports clients for external service communication
 */

export { default as daprClient } from './dapr.service.client.js';
export { secretManager, getEmailConfig, getMessageBrokerConfig } from './secret.manager.js';
