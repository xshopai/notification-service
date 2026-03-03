# Copilot Instructions — notification-service

## Service Identity

- **Name**: notification-service
- **Purpose**: Event-driven notification delivery — email (SMTP/Azure Communication Services), multi-channel
- **Port**: 8011
- **Language**: Node.js 20+ (TypeScript)
- **Framework**: Express with TypeScript
- **Database**: Stateless — no own database
- **Dapr App ID**: `notification-service`

## Architecture

- **Pattern**: Event consumer — subscribes to Dapr pub/sub topics, sends notifications
- **API Style**: RESTful (health/info endpoints) + Dapr subscription endpoints
- **Authentication**: Service-to-service only (no end-user auth)
- **Messaging**: Dapr pub/sub consumer (RabbitMQ backend)
- **Event Format**: CloudEvents 1.0 specification
- **Email**: Nodemailer (SMTP/Mailpit for dev) + Azure Communication Services (production)

## Project Structure

```
notification-service/
├── src/
│   ├── controllers/     # Subscription handlers
│   ├── services/        # Notification sending logic
│   ├── templates/       # Email templates
│   ├── middlewares/      # Logging, tracing
│   ├── routes/          # Route + subscription definitions
│   └── core/            # Config, logger
├── tests/
│   └── unit/
├── .dapr/components/
└── package.json
```

## Code Conventions

- **TypeScript** with strict mode
- **ESM modules** via TypeScript compilation
- Use `interface` for all data shapes
- Structured logging via Winston
- Event handlers are idempotent

## Event Subscriptions

Consumes these events from Dapr pub/sub:

| Event                  | Action                    |
| :--------------------- | :------------------------ |
| `auth.register`        | Send welcome email        |
| `auth.login`           | Send login notification   |
| `user.updated`         | Send profile update email |
| `order.created`        | Send order confirmation   |
| `order.status.changed` | Send order status update  |
| `payment.completed`    | Send payment receipt      |

## Security Rules

- Dapr subscription endpoints are authenticated by the Dapr sidecar — no additional JWT required
- Never trust caller-provided user data — derive identifiers from validated event payloads
- Validate all incoming event payloads before processing
- Never log email content, user PII, or secrets
- Rate limiting is handled upstream (BFF/gateway) — not required here

## Error Handling Contract

All errors MUST follow this JSON structure:

```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human readable message",
    "correlationId": "uuid"
  }
}
```

- Never expose stack traces in production
- Use centralized error middleware only

## Logging Rules

- Use structured JSON logging only
- Include:
  - timestamp
  - level
  - serviceName
  - correlationId
  - message
- Never log JWT tokens
- Never log secrets or email body content

## Testing Requirements

- All new subscription handlers MUST have unit tests
- Use **Jest** with **ts-jest** as the test framework
- Mock email transport (Nodemailer/SMTP) in unit tests
- Do NOT call real SMTP servers in unit tests
- Test idempotent event handling (duplicate events must not send duplicate emails)
- Run: `npm test`
- Coverage: `npm run test:coverage`

## Non-Goals

- This service does NOT publish business events — it only reacts to them
- This service does NOT manage user profiles or authentication
- This service does NOT store notification history in a database
- This service does NOT provide real-time push notifications

## Environment Variables

```
PORT=8011
NODE_ENV=development
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=noreply@xshopai.com
DAPR_HTTP_PORT=3500
```

## Dev Tip

- Use **Mailpit** (port 8025 web UI, port 1025 SMTP) to view sent emails during development
