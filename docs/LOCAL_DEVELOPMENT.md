# Notification Service - Local Development Guide

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+
- SendGrid account (for email)
- Twilio account (for SMS) - optional

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env` file:

```env
NODE_ENV=development
PORT=1011
HOST=0.0.0.0

# Email Provider (SendGrid)
SENDGRID_API_KEY=SG.your-api-key
SENDGRID_FROM_EMAIL=noreply@xshopai.com
SENDGRID_FROM_NAME=xshopai

# SMS Provider (Twilio) - Optional
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Dapr Configuration
DAPR_HTTP_PORT=3500
PUBSUB_NAME=xshopai-pubsub
```

### 3. Start the Service

Without Dapr (limited functionality):

```bash
npm run dev
```

With Dapr (for event subscriptions):

```bash
./run.sh
```

## Event Subscriptions

Notification Service subscribes to events via Dapr pub/sub:

| Event                               | Action                     |
| ----------------------------------- | -------------------------- |
| `auth.email.verification.requested` | Send verification email    |
| `auth.password.reset.requested`     | Send password reset email  |
| `order.created`                     | Send order confirmation    |
| `order.shipped`                     | Send shipping notification |
| `order.delivered`                   | Send delivery confirmation |

## API Endpoints

| Method | Endpoint                     | Description              |
| ------ | ---------------------------- | ------------------------ |
| GET    | `/health`                    | Health check             |
| POST   | `/api/notifications/email`   | Send email directly      |
| POST   | `/api/notifications/sms`     | Send SMS directly        |
| GET    | `/api/notifications/:userId` | Get notification history |

## Testing Email Locally

### Using SendGrid Sandbox

For testing without sending real emails, use SendGrid's sandbox mode:

```env
SENDGRID_SANDBOX_MODE=true
```

### Manual Email Test

```bash
curl -X POST http://localhost:1011/api/notifications/email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Test Email",
    "template": "welcome",
    "data": {"firstName": "John"}
  }'
```

## Email Templates

Templates are located in `src/templates/`:

- `welcome.html` - Welcome email
- `verification.html` - Email verification
- `password-reset.html` - Password reset
- `order-confirmation.html` - Order confirmation
- `shipping-notification.html` - Shipping updates

## Troubleshooting

### Emails Not Sending

1. Verify SendGrid API key is correct
2. Check sender email is verified in SendGrid
3. Review SendGrid activity logs

### Events Not Received

1. Ensure Dapr sidecar is running
2. Verify pub/sub component configuration
3. Check subscription endpoints
