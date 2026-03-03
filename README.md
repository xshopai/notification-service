<div align="center">

# 📧 Notification Service

**Event-driven notification microservice for the xshopai e-commerce platform**

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-FF6600?style=for-the-badge&logo=rabbitmq&logoColor=white)](https://rabbitmq.com)
[![Dapr](https://img.shields.io/badge/Dapr-Enabled-0D597F?style=for-the-badge&logo=dapr&logoColor=white)](https://dapr.io)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

[Getting Started](#-getting-started) •
[Documentation](#-documentation) •
[Event Types](#event-handling) •
[Contributing](#-contributing)

</div>

---

## 🎯 Overview

The **Notification Service** is a stateless event consumer that sends email notifications in response to platform events. It subscribes to auth, user, order, and payment events via RabbitMQ/Dapr pub/sub, renders in-memory email templates, and delivers via SMTP (Nodemailer) or Azure Communication Services. Notification outcomes are published back to the event bus for audit trail consumption.

---

## ✨ Key Features

<table>
<tr>
<td width="50%">

### 📧 Multi-Channel Notifications

- Email via SMTP (Nodemailer)
- Azure Communication Services email
- 9 built-in notification templates
- `{{variable}}` template rendering engine

</td>
<td width="50%">

### 📡 Event-Driven Architecture

- Consumes events from all platform services
- RabbitMQ + Dapr pub/sub integration
- Publishes outcome events (sent/failed)
- Correlation ID tracking across services

</td>
</tr>
<tr>
<td width="50%">

### ⚡ Stateless & Scalable

- No database — pure event consumer
- Horizontally scalable (round-robin)
- In-memory template rendering
- Graceful shutdown handling

</td>
<td width="50%">

### 🛡️ Enterprise Ready

- OpenTelemetry distributed tracing
- Azure Monitor integration
- Winston structured logging
- Comprehensive health checks

</td>
</tr>
</table>

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- RabbitMQ (or Docker for infrastructure)
- SMTP server (or Mailpit for local development)
- Dapr CLI (for production-like setup)

### Quick Start with Docker Compose

```bash
# Clone the repository
git clone https://github.com/xshopai/notification-service.git
cd notification-service

# Start the service
docker-compose up -d

# Verify the service is healthy
curl http://localhost:8011/health
```

### Local Development Setup

<details>
<summary><b>🔧 Without Dapr (Simple Setup)</b></summary>

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env — configure SMTP and RabbitMQ

# Build TypeScript
npm run build

# Start the service
npm run dev
```

📖 See [Local Development Guide](docs/LOCAL_DEVELOPMENT.md) for detailed instructions.

</details>

<details>
<summary><b>⚡ With Dapr (Production-like)</b></summary>

```bash
# Ensure Dapr is initialized
dapr init

# Start with Dapr sidecar
./run.sh       # Linux/Mac
.\run.ps1      # Windows

# Or use Dapr-specific npm scripts
npm run dev:dapr
```

> **Note:** All services now use the standard Dapr ports (3500 for HTTP, 50001 for gRPC).

</details>

---

## 📚 Documentation

| Document                                          | Description                                        |
| :------------------------------------------------ | :------------------------------------------------- |
| 📘 [Local Development](docs/LOCAL_DEVELOPMENT.md) | Step-by-step local setup and development workflows |
| ☁️ [Azure Container Apps](docs/ACA_DEPLOYMENT.md) | Deploy to serverless containers with built-in Dapr |

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run tests in watch mode
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run in CI mode
npm run test:ci
```

### Test Coverage

| Metric      | Status    |
| :---------- | :-------- |
| Unit Tests  | ✅ Jest   |
| Integration | ✅ Jest   |
| E2E Tests   | ✅ Jest   |
| Linting     | ✅ ESLint |

---

## Event Handling

The service subscribes to events from across the platform:

| Source      | Event Types                                                                                                                                   |
| :---------- | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auth**    | `auth.user.registered`, `auth.email.verification.requested`, `auth.password.reset.requested/completed`, `auth.account.reactivation.requested` |
| **User**    | `user.user.created/updated`, `user.email.verified`, `user.password.changed`                                                                   |
| **Order**   | `order.created`, `order.cancelled`, `order.delivered`                                                                                         |
| **Payment** | `payment.received`, `payment.failed`                                                                                                          |
| **Profile** | `profile.password_changed`, `profile.notification_preferences_updated`, `profile.bank_details_updated`                                        |

---

## 🏗️ Project Structure

```
notification-service/
├── 📁 src/                       # Application source code
│   ├── 📁 consumer/              # Event consumer entry point
│   │   └── 📁 handlers/          # Event type handlers
│   └── 📁 shared/                # Shared modules
│       ├── 📁 config/            # Configuration
│       ├── 📁 events/            # Event type definitions
│       ├── 📁 messaging/         # RabbitMQ broker (IMessageBroker)
│       ├── 📁 observability/     # Logging + OpenTelemetry tracing
│       └── 📁 services/          # Email, notification, template services
├── 📁 tests/                     # Test suite
├── 📁 dist/                      # Compiled JavaScript output
├── 📁 scripts/                   # Utility scripts
├── 📁 docs/                      # Documentation
├── 📁 .dapr/                     # Dapr configuration
│   ├── 📁 components/            # Pub/sub configs
│   └── 📄 config.yaml            # Dapr runtime configuration
├── 📄 docker-compose.yml         # Local containerized environment
├── 📄 Dockerfile                 # Production container image
└── 📄 package.json               # Dependencies and scripts
```

---

## 🔧 Technology Stack

| Category         | Technology                                |
| :--------------- | :---------------------------------------- |
| 🟢 Runtime       | Node.js 20+ with TypeScript               |
| 📧 Email         | Nodemailer + Azure Communication Services |
| 📨 Messaging     | Dapr Pub/Sub (RabbitMQ) + amqplib         |
| 📋 Templates     | In-memory `{{variable}}` rendering engine |
| 🧪 Testing       | Jest with unit, integration & E2E tests   |
| 📊 Observability | OpenTelemetry + Azure Monitor + Winston   |

---

## ⚡ Quick Reference

```bash
# 🐳 Docker Compose
docker-compose up -d              # Start service
docker-compose down               # Stop service

# 🔧 Local Development
npm run dev                       # Start with hot reload
npm run build                     # Compile TypeScript
npm start                         # Production mode

# ⚡ Dapr Development
npm run dev:dapr                  # Start with Dapr
./run.sh                          # Linux/Mac
.\run.ps1                         # Windows

# 🧪 Testing
npm test                          # Run all tests
npm run test:coverage             # With coverage report

# 🔍 Health Check
curl http://localhost:8011/health
```

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Write** tests for your changes
4. **Run** the test suite
   ```bash
   npm test && npm run lint
   ```
5. **Commit** your changes
   ```bash
   git commit -m 'feat: add amazing feature'
   ```
6. **Push** to your branch
   ```bash
   git push origin feature/amazing-feature
   ```
7. **Open** a Pull Request

Please ensure your PR:

- ✅ Passes all existing tests
- ✅ Includes tests for new functionality
- ✅ Follows the existing code style
- ✅ Updates documentation as needed

---

## 🆘 Support

| Resource         | Link                                                                              |
| :--------------- | :-------------------------------------------------------------------------------- |
| 🐛 Bug Reports   | [GitHub Issues](https://github.com/xshopai/notification-service/issues)           |
| 📖 Documentation | [docs/](docs/)                                                                    |
| 💬 Discussions   | [GitHub Discussions](https://github.com/xshopai/notification-service/discussions) |

---

## 📄 License

This project is part of the **xshopai** e-commerce platform.
Licensed under the MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">

**[⬆ Back to Top](#-notification-service)**

Made with ❤️ by the xshopai team

</div>
