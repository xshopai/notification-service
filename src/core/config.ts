/**
 * Configuration module for notification-service
 * Centralizes all environment-based configuration (non-sensitive only)
 *
 * For sensitive secrets (SMTP credentials, message broker credentials), use:
 * - import { getEmailConfig, getMessageBrokerConfig } from '../clients/index.js'
 */
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface Config {
  service: {
    name: string;
    version: string;
    port: number;
    host: string;
    nodeEnv: string;
  };
  serviceInvocationMode: 'http' | 'dapr';
  cors: {
    origins: string[];
  };
  logging: {
    level: string;
    format: string;
    toConsole: boolean;
    toFile: boolean;
    filePath: string;
  };
  observability: {
    enableTracing: boolean;
    otlpEndpoint: string;
  };
  dapr: {
    httpPort: number;
    grpcPort: number;
    appPort: number;
    host: string;
    pubsubName: string;
    appId: string;
  };
  messageBroker: {
    type: 'rabbitmq' | 'kafka' | 'azure-servicebus';
    rabbitmq?: {
      url: string;
      exchange: string;
      queues: {
        notifications: string;
        email: string;
        sms: string;
        push: string;
      };
    };
    kafka?: {
      brokers: string[];
      clientId: string;
      groupId: string;
      topics: {
        notifications: string;
        email: string;
        sms: string;
        push: string;
      };
    };
    azureServiceBus?: {
      connectionString: string;
      queues: {
        notifications: string;
        email: string;
        sms: string;
        push: string;
      };
    };
  };
  email: {
    provider: string;
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
    acs: {
      connectionString: string;
      senderAddress: string;
    };
    from: {
      name: string;
      address: string;
    };
    enabled: boolean;
  };
}

const brokerType = (process.env.MESSAGING_PROVIDER || 'rabbitmq') as
  | 'rabbitmq'
  | 'kafka'
  | 'azure-servicebus';

const config: Config = {
  service: {
    name: process.env.NAME || 'notification-service',
    version: process.env.VERSION || '1.0.0',
    port: parseInt(process.env.PORT || '3003', 10),
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  serviceInvocationMode: (process.env.SERVICE_INVOCATION_MODE || 'http') as 'http' | 'dapr',

  cors: {
    origins: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3010'],
  },

  logging: {
    level: process.env.LOG_LEVEL || 'debug',
    format: process.env.LOG_FORMAT || 'console',
    toConsole: process.env.LOG_TO_CONSOLE !== 'false',
    toFile: process.env.LOG_TO_FILE === 'true',
    filePath: process.env.LOG_FILE_PATH || './logs/notification-service.log',
  },

  observability: {
    enableTracing: process.env.ENABLE_TRACING === 'true',
    otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
  },

  dapr: {
    httpPort: parseInt(process.env.DAPR_HTTP_PORT || '3500', 10),
    grpcPort: parseInt(process.env.DAPR_GRPC_PORT || '50001', 10),
    appPort: parseInt(process.env.PORT || '3003', 10),
    host: process.env.DAPR_HOST || 'localhost',
    pubsubName: 'pubsub',
    appId: process.env.DAPR_APP_ID || 'notification-service',
  },

  messageBroker: {
    type: brokerType,
    ...(brokerType === 'rabbitmq' && {
      rabbitmq: {
        url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
        exchange: process.env.RABBITMQ_EXCHANGE || 'xshopai.events',
        queues: {
          notifications: process.env.RABBITMQ_QUEUE_NOTIFICATIONS || 'notifications',
          email: process.env.RABBITMQ_QUEUE_EMAIL || 'notifications.email',
          sms: process.env.RABBITMQ_QUEUE_SMS || 'notifications.sms',
          push: process.env.RABBITMQ_QUEUE_PUSH || 'notifications.push',
        },
      },
    }),
    ...(brokerType === 'kafka' && {
      kafka: {
        brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
        clientId: process.env.KAFKA_CLIENT_ID || 'notification-service',
        groupId: process.env.KAFKA_GROUP_ID || 'notification-service-group',
        topics: {
          notifications: process.env.KAFKA_TOPIC_NOTIFICATIONS || 'notifications',
          email: process.env.KAFKA_TOPIC_EMAIL || 'notifications.email',
          sms: process.env.KAFKA_TOPIC_SMS || 'notifications.sms',
          push: process.env.KAFKA_TOPIC_PUSH || 'notifications.push',
        },
      },
    }),
    ...(brokerType === 'azure-servicebus' && {
      azureServiceBus: {
        connectionString: process.env.AZURE_SERVICEBUS_CONNECTION_STRING || '',
        queues: {
          notifications: process.env.AZURE_SERVICEBUS_QUEUE_NOTIFICATIONS || 'notifications',
          email: process.env.AZURE_SERVICEBUS_QUEUE_EMAIL || 'notifications-email',
          sms: process.env.AZURE_SERVICEBUS_QUEUE_SMS || 'notifications-sms',
          push: process.env.AZURE_SERVICEBUS_QUEUE_PUSH || 'notifications-push',
        },
      },
    }),
  },

  email: {
    provider: process.env.EMAIL_PROVIDER || 'smtp',
    smtp: {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '1025', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    },
    acs: {
      connectionString: process.env.ACS_CONNECTION_STRING || '',
      senderAddress: process.env.ACS_SENDER_ADDRESS || '',
    },
    from: {
      name: process.env.EMAIL_FROM_NAME || 'xshopai Notifications',
      address: process.env.EMAIL_FROM_ADDRESS || 'noreply@xshopai.local',
    },
    enabled: process.env.EMAIL_ENABLED !== 'false',
  },
};

export default config;
