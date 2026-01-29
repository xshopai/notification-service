/**
 * Type declarations for optional messaging dependencies.
 * These modules are dynamically imported at runtime only when needed.
 */

// Declare amqplib as optional module
declare module 'amqplib' {
  export interface Connection {
    createChannel(): Promise<Channel>;
    close(): Promise<void>;
    on(event: 'close' | 'error', listener: (err?: Error) => void): void;
  }

  export interface Channel {
    assertExchange(exchange: string, type: string, options?: { durable?: boolean }): Promise<void>;
    publish(exchange: string, routingKey: string, content: Buffer, options?: Record<string, unknown>): boolean;
    close(): Promise<void>;
  }

  export function connect(url: string): Promise<Connection>;
}

// Declare @azure/service-bus as optional module
declare module '@azure/service-bus' {
  export interface ServiceBusSender {
    sendMessages(message: ServiceBusMessage): Promise<void>;
    close(): Promise<void>;
  }

  export interface ServiceBusMessage {
    body: unknown;
    contentType?: string;
    correlationId?: string;
    applicationProperties?: Record<string, unknown>;
  }

  export class ServiceBusClient {
    constructor(connectionString: string);
    createSender(topicName: string): ServiceBusSender;
    close(): Promise<void>;
  }
}
