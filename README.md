# 📧 Notification Service

Stateless notification microservice for xshopai - consumes events from message broker and sends notifications via email, SMS, and push channels.

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **RabbitMQ** ([Install Guide](https://www.rabbitmq.com/download.html))
- **SMTP Server** (Gmail, SendGrid, or custom)
- **Dapr CLI** 1.16+ ([Install Guide](https://docs.dapr.io/getting-started/install-dapr-cli/))

### Setup

**1. Clone & Install**

```bash
git clone https://github.com/xshopai/notification-service.git
cd notification-service
npm install
```

**2. Configure Environment**

```bash
# Copy environment template
cp .env.example .env

# Edit .env - update these values:
# SMTP_HOST=smtp.gmail.com
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password
# RABBITMQ_URL=amqp://guest:guest@localhost:5672
```

**3. Run Service**

```bash
# Start with Dapr (recommended)
npm run dev

# Or use platform-specific scripts
./run.sh       # Linux/Mac
.\run.ps1      # Windows
```

**4. Verify**

```bash
# Check health
curl http://localhost:1006/health

# Should return: {"status":"UP","service":"notification-service"...}
```

### Common Commands

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Lint code
npm run lint

# Build for production
npm run build

# Production mode
npm start
```

## 📚 Documentation

| Document                                      | Description                             |
| --------------------------------------------- | --------------------------------------- |
| [📖 Developer Guide](docs/DEVELOPER_GUIDE.md) | Local setup, debugging, daily workflows |
| [📘 Technical Reference](docs/TECHNICAL.md)   | Architecture, security, monitoring      |
| [🤝 Contributing](docs/CONTRIBUTING.md)       | Contribution guidelines and workflow    |

## ⚙️ Configuration

### Required Environment Variables

### Environment Variables

```bash
# Service
NODE_ENV=development              # Environment: development, production, test
NAME=notification-service
VERSION=1.0.0
PORT=1006                         # HTTP server port

# Message Broker
MESSAGE_BROKER_TYPE=rabbitmq
RABBITMQ_URL=amqp://guest:guest@localhost:5672
RABBITMQ_EXCHANGE=xshopai.events
RABBITMQ_QUEUE_NOTIFICATIONS=notification-service.queue

# Email
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM_NAME=xshopai Notifications
EMAIL_FROM_ADDRESS=noreply@xshopai.com
EMAIL_ENABLED=true

# Dapr
DAPR_HTTP_PORT=3500              # Dapr sidecar HTTP port
DAPR_GRPC_PORT=50001             # Dapr sidecar gRPC port
```

See [.env.example](.env.example) for complete configuration options.

## ✨ Key Features

- Stateless event-driven architecture (no database)
- In-memory template rendering (9 default templates)
- Email notifications via SMTP
- Publishes notification outcomes for audit trail
- Correlation ID tracking for distributed tracing
- Graceful shutdown handling
- Horizontally scalable (add more consumer instances)

## 🏗️ Architecture

**Simple Consumer Pattern:**

```
Message Broker → Notification Service → Email/SMS/Push
                         ↓
                 Publish Outcome Events → Audit Service
```

**Key Principles:**

- **Stateless**: No database, no state management
- **Event-Driven**: Consumes events, sends notifications, publishes outcomes
- **Simple**: Just a consumer - no API layer needed
- **Scalable**: Horizontally scalable by adding more consumer instances

### Installation

```bash
npm install
```

### Running

```bash
# Development (with hot reload)
npm run dev

# Production
npm run build
npm start
```

## Event Handling

The service listens for these event types:

### Auth Events

- `auth.user.registered`
- `auth.email.verification.requested`
- `auth.password.reset.requested`
- `auth.password.reset.completed`
- `auth.account.reactivation.requested`

### User Events

- `user.user.created`
- `user.user.updated`
- `user.email.verified`
- `user.password.changed`

### Order Events

- `order.placed`
- `order.cancelled`
- `order.delivered`

### Payment Events

- `payment.received`
- `payment.failed`

### Profile Events

- `profile.password_changed`
- `profile.notification_preferences_updated`
- `profile.bank_details_updated`

## Templates

Templates are stored in-memory and defined in `src/shared/services/template.service.ts`.

**Template Variables:**
Use `{{variableName}}` syntax in templates. Common variables:

- `{{username}}` - User's name
- `{{email}}` - User's email
- `{{verificationToken}}` - Email verification token
- `{{resetToken}}` - Password reset token
- `{{orderId}}` - Order ID
- `{{orderNumber}}` - Order number
- `{{amount}}` - Payment amount

**Adding New Templates:**
Edit `DEFAULT_TEMPLATES` array in `template.service.ts` and redeploy.

## Notification Outcomes

After sending a notification, the service publishes an outcome event:

### NOTIFICATION_SENT

```json
{
  "eventType": "notification.sent",
  "userId": "user-123",
  "userEmail": "user@example.com",
  "timestamp": "2024-01-15T10:00:00Z",
  "data": {
    "notificationId": "uuid",
    "originalEventType": "auth.user.registered",
    "channel": "email",
    "recipientEmail": "user@example.com",
    "subject": "Welcome to xshopai!",
    "attemptNumber": 1
  }
}
```

### NOTIFICATION_FAILED

```json
{
  "eventType": "notification.failed",
  "userId": "user-123",
  "userEmail": "user@example.com",
  "timestamp": "2024-01-15T10:00:00Z",
  "data": {
    "notificationId": "uuid",
    "originalEventType": "auth.user.registered",
    "channel": "email",
    "recipientEmail": "user@example.com",
    "errorMessage": "SMTP connection failed",
    "attemptNumber": 1
  }
}
```

These events are consumed by **audit-service** for compliance and monitoring.

## Monitoring

The service uses structured logging with correlation IDs for distributed tracing.

**Log Events:**

- `📨 Received notification event`
- `📤 Processing notification`
- `✅ Email notification sent successfully`
- `❌ Failed to send email notification`

## Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

### Manual Testing

Publish a test event to RabbitMQ:

```json
{
  "eventType": "auth.user.registered",
  "userId": "test-user-123",
  "userEmail": "test@example.com",
  "username": "testuser",
  "timestamp": "2024-01-15T10:00:00Z",
  "data": {
    "username": "testuser",
    "email": "test@example.com"
  }
}
```

## Scaling

To scale horizontally, simply run multiple instances:

```bash
# Instance 1
PORT=3003 npm start

# Instance 2
PORT=3004 npm start

# Instance 3
PORT=3005 npm start
```

All instances consume from the same RabbitMQ queue with round-robin distribution.

## Project Structure

```
notification-service/
├── src/
│   ├── consumer/
│   │   ├── consumer.ts              # Main entry point
│   │   └── handlers/
│   │       └── index.ts             # Event handlers
│   └── shared/
│       ├── config/
│       │   └── index.ts             # Configuration
│       ├── events/
│       │   └── event-types.ts       # Event type definitions
│       ├── messaging/
│       │   ├── IMessageBroker.ts    # Broker interface
│       │   ├── MessageBrokerFactory.ts
│       │   └── brokers/
│       │       └── RabbitMQBroker.ts
│       ├── observability/
│       │   ├── logging/             # Structured logging
│       │   └── tracing/             # OpenTelemetry tracing
│       └── services/
│           ├── email.service.ts     # Email sending
│           ├── notification.service.ts  # Template rendering
│           └── template.service.ts  # In-memory templates
├── tests/
├── package.json
└── README.md
```

## Dependencies

**Core:**

- `amqplib` - RabbitMQ client
- `nodemailer` - Email sending
- `uuid` - Unique ID generation

**Observability:**

- `winston` - Structured logging
- `@opentelemetry/*` - Distributed tracing

**Security:**

- `jsonwebtoken` - JWT verification (for future admin endpoints)

## Design Decisions

### Why No API?

A notification service should be **event-driven**, not request-driven. Services publish events, notification-service consumes and sends. No need for HTTP endpoints.

### Why No Database?

- **Stateless = Scalable**: No shared state means easy horizontal scaling
- **Separation of Concerns**: Audit-service handles notification history
- **Simplicity**: Fewer dependencies, easier to maintain

### Why In-Memory Templates?

- **Fast**: No database queries for every notification
- **Simple**: Templates defined in code, version controlled
- **Sufficient**: Most notification templates rarely change

For dynamic templates, consider:

- Moving to config files
- Using ConfigMaps in Kubernetes
- External template service (future enhancement)

## Related Services

- **audit-service**: Consumes notification outcome events, stores audit trail
- **auth-service**: Publishes auth events (registration, password reset, etc.)
- **order-service**: Publishes order events (placed, cancelled, delivered)
- **payment-service**: Publishes payment events (received, failed)

## Migration from Stateful Version

See [STATELESS_REFACTORING.md](./STATELESS_REFACTORING.md) for details on the stateless refactoring.

## License

MIT

```

```
