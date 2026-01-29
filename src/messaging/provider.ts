/**
 * Messaging Provider Interface
 * Defines the contract for all messaging providers (Dapr, RabbitMQ, Azure Service Bus)
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * CloudEvents-compliant event envelope
 */
export interface CloudEvent {
  specversion: string;
  type: string;
  source: string;
  id: string;
  time: string;
  datacontenttype: string;
  data: Record<string, any>;
  traceparent?: string;
  correlationId?: string;
}

/**
 * Base interface for messaging providers
 */
export interface MessagingProvider {
  /**
   * Publish an event to a topic
   * @param topic - The topic/queue to publish to
   * @param eventData - The event data payload
   * @param correlationId - Optional correlation ID for tracing
   * @returns Promise<boolean> - true if successful, false otherwise
   */
  publishEvent(topic: string, eventData: Record<string, any>, correlationId?: string): Promise<boolean>;

  /**
   * Close the provider connection gracefully
   */
  close(): Promise<void>;
}

/**
 * Build a CloudEvents-compliant event envelope
 */
export function buildCloudEvent(
  eventType: string,
  source: string,
  data: Record<string, any>,
  correlationId?: string,
): CloudEvent {
  return {
    specversion: '1.0',
    type: eventType,
    source,
    id: correlationId || uuidv4(),
    time: new Date().toISOString(),
    datacontenttype: 'application/json',
    data,
    correlationId,
  };
}

/**
 * Supported messaging providers
 */
export type MessagingProviderType = 'dapr' | 'rabbitmq' | 'servicebus';
