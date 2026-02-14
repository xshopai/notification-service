# Copilot Instructions for Notification Service

**Service**: Event-driven notification microservice for xshopai platform  
**Stack**: Node.js 18+, Express 4.18, TypeScript, Nodemailer  
**Port**: 8011 | **Dapr HTTP**: 3500 | **Dapr gRPC**: 50001  
**Pattern**: Pure Consumer (Dapr Pub/Sub subscriptions) + Publisher (notification outcomes)

## Architecture at a Glance

```
src/
├── core/              # Config, logging, errors (centralized utilities)
├── events/            # Event types and publishers
│   └── publishers/    # DaprEventPublisher for notification outcomes
├── clients/           # External integrations (Dapr client, secret manager)
├── controllers/       # HTTP handlers (event handlers, operational)
├── services/          # Business logic (notification, email, template)
├── middlewares/       # Express middleware (trace context)
├── messaging/         # Multi-provider messaging (Dapr/RabbitMQ/ServiceBus)
├── routes/            # Route definitions (events, operational, home)
├── app.ts            # Express app configuration
└── server.ts         # Entry point (loads env → imports app)
```

**Critical flows**:

- Events IN: Dapr declarative subscriptions → `/events/*` routes → `events.controller.ts`
- Events OUT: `DaprEventPublisher` → `notification.sent` / `notification.failed`
- Email: `EmailService` → Nodemailer → SMTP (Mailpit for dev)
- Tracing: W3C Trace Context middleware → `req.traceId`/`req.spanId` → all logs/events

---

## Essential Patterns

### 1. Event Consumption (Dapr Subscriptions)

**Local Development**: Uses `.dapr/components/subscriptions.yaml` (declarative)
**Azure Container Apps**: Uses `/dapr/subscribe` endpoint (programmatic)

**IMPORTANT**: Keep both in sync when adding/removing subscriptions!

**Location for ACA**: `src/routes/dapr.routes.ts`

```typescript
const SUBSCRIPTIONS = [
  { pubsubname: 'pubsub', topic: 'auth.user.registered', route: '/events/auth.user.registered' },
  // ... more subscriptions
];

router.get('/dapr/subscribe', (_req, res) => {
  res.json(SUBSCRIPTIONS);
});
```

**Event Handler Pattern** (`src/controllers/events.controller.ts`):

```typescript
const handleEvent = (eventType: string) => {
  return async (req: Request, res: Response): Promise<void> => {
    const cloudEvent = req.body;

    try {
      await notificationService.processNotificationEvent(cloudEvent, eventType);
      res.status(200).json({ status: 'SUCCESS' });
    } catch (error) {
      res.status(500).json({ status: 'ERROR', message: error.message });
    }
  };
};
```

### 2. Event Publishing (Notification Outcomes)

**Location**: `src/events/publishers/publisher.ts`

Publish notification outcomes for audit-service consumption:

```typescript
import { daprPublisher } from '../events/publishers/index.js';

// After sending email successfully
await daprPublisher.publishNotificationSent(
  notificationId,
  originalEventType,
  userId,
  recipientEmail,
  subject,
  traceId,
  spanId,
);

// On failure
await daprPublisher.publishNotificationFailed(
  notificationId,
  originalEventType,
  userId,
  recipientEmail,
  subject,
  errorMessage,
  traceId,
  spanId,
);
```

### 3. Notification Processing Flow

```
CloudEvent → NotificationService.processNotificationEvent()
  → TemplateService.getTemplate()       # Get email template
  → TemplateService.renderTemplate()    # Render with variables
  → EmailService.sendEmail()            # Send via SMTP
  → DaprPublisher.publishNotificationSent/Failed()  # Publish outcome
```

### 4. Template Service

**Location**: `src/services/template.service.ts`

Templates are defined inline with Mustache-style placeholders:

```typescript
const template = await templateService.getTemplate('auth.user.registered', 'email');
const rendered = templateService.renderTemplate(template, {
  firstName: 'John',
  email: 'john@example.com',
  verificationLink: 'https://...',
});
```

### 5. Trace Context Propagation

**Location**: `src/middlewares/traceContext.middleware.ts`

W3C Trace Context is automatically extracted from CloudEvents:

```typescript
// In controller/service
const traceparent = cloudEvent.traceparent;
const traceId = traceparent?.split('-')[1];
const contextLogger = logger.withTraceContext(traceId, spanId);

contextLogger.info('Processing notification', { eventType });
```

---

## Configuration

### Environment Variables

| Variable             | Default             | Description                         |
| -------------------- | ------------------- | ----------------------------------- |
| `PORT`               | 1011                | Service port                        |
| `NODE_ENV`           | development         | Environment                         |
| `LOG_LEVEL`          | debug               | Logging level                       |
| `MESSAGING_PROVIDER` | dapr                | `dapr`, `rabbitmq`, or `servicebus` |
| `SMTP_HOST`          | localhost           | SMTP server host                    |
| `SMTP_PORT`          | 1025                | SMTP server port (Mailpit default)  |
| `EMAIL_FROM`         | noreply@xshopai.com | Default sender                      |

### Dapr Configuration

- **App ID**: `notification-service`
- **Components**: `.dapr/components/`
  - `event-bus.yaml` - RabbitMQ pubsub
  - `subscriptions.yaml` - Event subscriptions
  - `secret-store.yaml` - Local secrets

---

## Subscribed Events

| Topic                               | Handler Route                               | Description          |
| ----------------------------------- | ------------------------------------------- | -------------------- |
| `auth.user.registered`              | `/events/auth.user.registered`              | Welcome email        |
| `auth.email.verification.requested` | `/events/auth.email.verification.requested` | Verification email   |
| `auth.password.reset.requested`     | `/events/auth.password.reset.requested`     | Password reset email |
| `order.created`                     | `/events/order.created`                     | Order confirmation   |
| `order.cancelled`                   | `/events/order.cancelled`                   | Cancellation notice  |
| `payment.received`                  | `/events/payment.received`                  | Payment confirmation |

---

## Published Events

| Event Type            | Description                         |
| --------------------- | ----------------------------------- |
| `notification.sent`   | Notification delivered successfully |
| `notification.failed` | Notification delivery failed        |

---

## Development Workflow

### Local Development (with Mailpit)

```bash
# Start Mailpit for email testing
docker run -d -p 1025:1025 -p 8025:8025 axllent/mailpit

# Start with Dapr
npm run dev

# View emails at http://localhost:8025
```

### VS Code Tasks

- **Start Dapr Sidecar**: Starts Dapr with all components
- **Stop Dapr Sidecar**: Stops Dapr processes

### Testing

```bash
npm test              # All tests
npm run test:unit     # Unit tests only
npm run test:coverage # With coverage report
```

---

## Common Tasks

### Add New Event Subscription

1. Add subscription to `.dapr/components/subscriptions.yaml`
2. Add route in `src/routes/events.routes.ts`
3. Add handler export in `src/controllers/events.controller.ts`
4. Add template in `src/services/template.service.ts`

### Add New Email Template

```typescript
// In template.service.ts templates array
{
  event_type: 'order.shipped',
  channel: 'email',
  template_name: 'order_shipped',
  subject_template: 'Your order {{orderId}} has shipped!',
  body_template: `
    <h1>Hi {{firstName}},</h1>
    <p>Your order {{orderId}} is on its way!</p>
    <p>Tracking: {{trackingNumber}}</p>
  `
}
```

---

## Health Endpoints

| Endpoint            | Purpose                   |
| ------------------- | ------------------------- |
| `GET /health`       | Basic health check        |
| `GET /health/ready` | Readiness (includes Dapr) |
| `GET /health/live`  | Liveness check            |
| `GET /metrics`      | System metrics            |

---

## Troubleshooting

### Events not being received

1. Check Dapr sidecar is running: `dapr list`
2. Verify subscriptions: `curl http://localhost:3500/dapr/subscribe`
3. Check RabbitMQ queues in management UI

### Emails not sending

1. Check SMTP config in `.env`
2. For local dev, ensure Mailpit is running
3. Check `EmailService.isConfigured()` logs

### Template not found

1. Check `template.service.ts` for event_type match
2. Fallback creates basic notification if no template

---

## Dependencies

### Runtime

- `@dapr/dapr` - Dapr SDK
- `express` - HTTP server
- `nodemailer` - Email sending
- `winston` - Logging
- `uuid` - ID generation

### Development

- `typescript` - Type checking
- `ts-jest` - Testing
- `tsx` - TypeScript execution

---

## Quick Reference

```typescript
// Logger with trace context
const contextLogger = logger.withTraceContext(traceId, spanId);
contextLogger.info('Message', { key: 'value' });

// Publish notification outcome
await daprPublisher.publishNotificationSent(id, eventType, userId, email, subject, traceId);

// Get config
import config from './core/config.js';
const port = config.service.port;
```
