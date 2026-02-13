/**
 * Simplified Template Service (In-Memory)
 *
 * Uses in-memory templates instead of database storage.
 * Templates are defined in code for simplicity.
 */

import logger from '../core/logger.js';

export interface NotificationTemplate {
  event_type: string;
  channel: 'email' | 'sms' | 'push' | 'webhook';
  template_name: string;
  subject?: string;
  message_template: string;
  is_active: boolean;
}

export interface TemplateVariables {
  [key: string]: any;
}

export interface RenderedTemplate {
  subject?: string;
  message: string;
}

// In-memory template storage
const DEFAULT_TEMPLATES: NotificationTemplate[] = [
  // Auth events
  {
    event_type: 'auth.user.registered',
    channel: 'email',
    template_name: 'User Registration',
    subject: 'Welcome to xshopai!',
    message_template:
      'Hello {{name}},\n\nWelcome to xshopai! Your account has been successfully created.\n\nYou will receive a separate email to verify your email address.\n\nThank you for joining us!',
    is_active: true,
  },
  {
    event_type: 'auth.email.verification.requested',
    channel: 'email',
    template_name: 'Email Verification',
    subject: 'Verify your email address',
    message_template:
      'Hello {{username}},\n\nWelcome to xshopai! Please verify your email address by clicking the link below:\n\n{{verificationUrl}}\n\nThis link will expire in 24 hours.\n\nIf you did not create an account, please ignore this email.\n\nThank you!',
    is_active: true,
  },
  {
    event_type: 'auth.password.reset.requested',
    channel: 'email',
    template_name: 'Password Reset',
    subject: 'Reset your password',
    message_template:
      'Hello {{username}},\n\nYou requested a password reset. Click the link below to reset your password:\n\n{{resetUrl}}\n\nThis link will expire in 1 hour.\n\nIf you did not request this, please ignore this email.\n\nThank you!',
    is_active: true,
  },
  {
    event_type: 'auth.password.reset.completed',
    channel: 'email',
    template_name: 'Password Reset Confirmed',
    subject: 'Your password has been reset',
    message_template:
      'Hello {{username}},\n\nYour password has been successfully reset.\n\nIf you did not make this change, please contact support immediately.',
    is_active: true,
  },
  // Order events
  {
    event_type: 'order.placed',
    channel: 'email',
    template_name: 'Order Confirmation',
    subject: 'Order Confirmed - #{{orderNumber}}',
    message_template:
      'Hello,\n\nYour order #{{orderNumber}} has been placed successfully.\n\nOrder ID: {{orderId}}\nAmount: ${{totalAmount}}\n\nThank you for your purchase!',
    is_active: true,
  },
  {
    event_type: 'order.cancelled',
    channel: 'email',
    template_name: 'Order Cancelled',
    subject: 'Order Cancelled - #{{orderNumber}}',
    message_template:
      'Hello,\n\nYour order #{{orderNumber}} has been cancelled.\n\nOrder ID: {{orderId}}\nReason: {{cancellationReason}}\n\nIf you did not request this cancellation, please contact support.',
    is_active: true,
  },
  {
    event_type: 'order.delivered',
    channel: 'email',
    template_name: 'Order Delivered',
    subject: 'Your order has been delivered - #{{orderNumber}}',
    message_template:
      'Hello,\n\nGreat news! Your order #{{orderNumber}} has been delivered.\n\nOrder ID: {{orderId}}\n\nWe hope you enjoy your purchase!',
    is_active: true,
  },
  {
    event_type: 'order.shipped',
    channel: 'email',
    template_name: 'Order Shipped',
    subject: 'Your order is on its way! - #{{orderNumber}}',
    message_template:
      'Hello,\n\nGreat news! Your order #{{orderNumber}} has been shipped.\n\nOrder ID: {{orderId}}\nTracking Number: {{trackingNumber}}\n\nYou can track your order status in your account.\n\nThank you for shopping with us!',
    is_active: true,
  },
  // Payment events
  {
    event_type: 'payment.received',
    channel: 'email',
    template_name: 'Payment Received',
    subject: 'Payment Received',
    message_template:
      'Hello,\n\nWe have received your payment of ${{amount}} for order {{orderId}}.\n\nPayment ID: {{paymentId}}\n\nThank you!',
    is_active: true,
  },
  {
    event_type: 'payment.failed',
    channel: 'email',
    template_name: 'Payment Failed',
    subject: 'Payment Failed',
    message_template:
      'Hello,\n\nYour payment of ${{amount}} for order {{orderId}} has failed.\n\nReason: {{reason}}\n\nPlease try again or contact support.',
    is_active: true,
  },
];

class TemplateService {
  private templates: Map<string, NotificationTemplate>;

  constructor() {
    this.templates = new Map();
    this.loadDefaultTemplates();
  }

  private loadDefaultTemplates(): void {
    for (const template of DEFAULT_TEMPLATES) {
      const key = `${template.event_type}:${template.channel}`;
      this.templates.set(key, template);
    }
    logger.info(`📄 Loaded ${this.templates.size} default templates`);
  }

  async getTemplate(eventType: string, channel: string): Promise<NotificationTemplate | null> {
    const key = `${eventType}:${channel}`;
    const template = this.templates.get(key);

    if (!template) {
      logger.debug(`📄 No template found for event: ${eventType}, channel: ${channel}`);
      return null;
    }

    return template;
  }

  renderTemplate(template: NotificationTemplate, variables: TemplateVariables): RenderedTemplate {
    let subject = template.subject || '';
    let message = template.message_template;

    // Simple variable substitution - replace {{variableName}} with actual values
    Object.keys(variables).forEach((key) => {
      const value = variables[key] !== undefined && variables[key] !== null ? String(variables[key]) : '';
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      subject = subject.replace(regex, value);
      message = message.replace(regex, value);
    });

    return {
      subject,
      message,
    };
  }
}

export default TemplateService;
