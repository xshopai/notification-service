import nodemailer from 'nodemailer';
import { EmailClient, KnownEmailSendStatus } from '@azure/communication-email';
import config from '../core/config.js';
import logger from '../core/logger.js';

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: {
    name: string;
    address: string;
  };
}

export interface EmailProvider {
  sendEmail(options: EmailOptions): Promise<boolean>;
  isConfigured(): boolean;
}

class SMTPEmailProvider implements EmailProvider {
  private transporter: nodemailer.Transporter | null = null;
  private configured: boolean = false;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    try {
      // For Mailpit and other local SMTP servers, credentials might be optional
      const hasCredentials = config.email.smtp.auth.user && config.email.smtp.auth.pass;

      if (!hasCredentials) {
        logger.warn('⚠️ SMTP credentials not configured. Using anonymous SMTP (suitable for Mailpit/testing).');
      }

      const transportConfig: any = {
        host: config.email.smtp.host,
        port: config.email.smtp.port,
        secure: config.email.smtp.secure,
        // Add some additional options for better compatibility
        tls: {
          rejectUnauthorized: false, // Accept self-signed certificates (for development)
        },
      };

      // Only add auth if credentials are provided
      if (hasCredentials) {
        transportConfig.auth = {
          user: config.email.smtp.auth.user,
          pass: config.email.smtp.auth.pass,
        };
      }

      this.transporter = nodemailer.createTransport(transportConfig);

      this.configured = true;
      logger.info('✅ SMTP email provider initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize SMTP transporter:', error);
      this.configured = false;
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    const startTime = Date.now();

    if (!this.configured || !this.transporter) {
      logger.error('❌ SMTP provider not configured. Cannot send email.');
      return false;
    }

    try {
      const fromAddress = options.from || config.email.from;

      const mailOptions = {
        from: `"${fromAddress.name}" <${fromAddress.address}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html || options.text, // Use HTML if provided, otherwise fallback to text
      };

      const info = await this.transporter.sendMail(mailOptions);
      const duration = Date.now() - startTime;

      logger.info('📧 Email sent successfully:', {
        to: options.to,
        subject: options.subject,
        messageId: info.messageId,
        duration: `${duration}ms`,
      });

      return true;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('❌ Failed to send email:', {
        to: options.to,
        subject: options.subject,
        error: error instanceof Error ? error.message : error,
        duration: `${duration}ms`,
      });
      return false;
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async testConnection(): Promise<boolean> {
    if (!this.configured || !this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      logger.info('✅ SMTP connection test successful');
      return true;
    } catch (error) {
      logger.error('❌ SMTP connection test failed:', error);
      return false;
    }
  }
}

/**
 * Azure Communication Services Email Provider
 * Uses ACS SDK for sending emails in production/cloud environments
 */
class ACSEmailProvider implements EmailProvider {
  private client: EmailClient | null = null;
  private configured: boolean = false;
  private senderAddress: string;

  constructor() {
    this.senderAddress = config.email.acs.senderAddress;
    this.initializeClient();
  }

  private initializeClient(): void {
    try {
      const connectionString = config.email.acs.connectionString;

      if (!connectionString) {
        logger.warn('⚠️ ACS connection string not configured');
        this.configured = false;
        return;
      }

      if (!this.senderAddress) {
        logger.warn('⚠️ ACS sender address not configured');
        this.configured = false;
        return;
      }

      this.client = new EmailClient(connectionString);
      this.configured = true;
      logger.info('✅ Azure Communication Services email provider initialized');
      logger.info(`📧 Sender address: ${this.senderAddress}`);
    } catch (error) {
      logger.error('❌ Failed to initialize ACS email client:', error);
      this.configured = false;
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    const startTime = Date.now();

    if (!this.configured || !this.client) {
      logger.error('❌ ACS provider not configured. Cannot send email.');
      return false;
    }

    try {
      const fromAddress = options.from?.address || this.senderAddress;
      const displayName = options.from?.name || config.email.from.name;

      const message = {
        senderAddress: fromAddress,
        content: {
          subject: options.subject,
          plainText: options.text,
          html: options.html,
        },
        recipients: {
          to: [{ address: options.to, displayName: options.to }],
        },
      };

      // Send email using ACS (polling for completion)
      const poller = await this.client.beginSend(message);
      const result = await poller.pollUntilDone();

      const duration = Date.now() - startTime;

      if (result.status === KnownEmailSendStatus.Succeeded) {
        logger.info('📧 Email sent successfully via ACS:', {
          to: options.to,
          subject: options.subject,
          messageId: result.id,
          duration: `${duration}ms`,
        });
        return true;
      } else {
        logger.error('❌ ACS email send failed:', {
          to: options.to,
          subject: options.subject,
          status: result.status,
          error: result.error,
          duration: `${duration}ms`,
        });
        return false;
      }
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('❌ Failed to send email via ACS:', {
        to: options.to,
        subject: options.subject,
        error: error instanceof Error ? error.message : error,
        duration: `${duration}ms`,
      });
      return false;
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }
}

// Factory class to create different email providers
class EmailServiceFactory {
  static createProvider(providerType: string = 'smtp'): EmailProvider {
    switch (providerType.toLowerCase()) {
      case 'smtp':
        return new SMTPEmailProvider();
      case 'acs':
      case 'azure':
      case 'azure-communication-services':
        return new ACSEmailProvider();
      default:
        logger.warn(`⚠️ Unknown email provider: ${providerType}. Falling back to SMTP.`);
        return new SMTPEmailProvider();
    }
  }
}

class EmailService {
  private provider: EmailProvider;
  private enabled: boolean;

  constructor() {
    this.enabled = config.email.enabled;
    this.provider = EmailServiceFactory.createProvider(config.email.provider);

    if (!this.enabled) {
      logger.info('📧 Email service is disabled via configuration');
    } else if (!this.provider.isConfigured()) {
      logger.warn('⚠️ Email service is enabled but provider is not properly configured');
      this.enabled = false;
    }
  }

  async sendNotificationEmail(
    recipientEmail: string,
    subject: string,
    message: string,
    eventType: string,
    eventData?: any,
  ): Promise<boolean> {
    if (!this.enabled) {
      logger.debug('📧 Email sending skipped (service disabled)');
      return false;
    }

    try {
      // Generate HTML email content
      const htmlContent = this.generateEmailHTML(message, eventType, eventData);

      logger.debug('📧 Generated email HTML:', {
        recipientEmail,
        subject,
        hasHtml: !!htmlContent,
        htmlLength: htmlContent.length,
        textLength: message.length,
      });

      const emailOptions: EmailOptions = {
        to: recipientEmail,
        subject,
        text: message,
        html: htmlContent,
      };

      return await this.provider.sendEmail(emailOptions);
    } catch (error) {
      logger.error('❌ Failed to send notification email:', error);
      return false;
    }
  }

  private generateEmailHTML(message: string, eventType: string, _eventData?: any): string {
    // Convert plain text message to HTML with clickable links
    const htmlMessage = this.convertTextToHTML(message);

    // Basic HTML template
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Notification from xshopai</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; word-wrap: break-word; overflow-wrap: break-word; }
        .footer { background-color: #333; color: white; padding: 10px; text-align: center; font-size: 12px; border-radius: 0 0 5px 5px; }
        .event-type { background-color: #e7f3ff; padding: 5px 10px; border-radius: 3px; font-size: 12px; display: inline-block; margin-bottom: 10px; }
        .btn { display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 15px 0; font-weight: bold; }
        .btn:hover { background-color: #45a049; }
        a { color: #4CAF50; text-decoration: none; word-wrap: break-word; overflow-wrap: break-word; display: inline-block; max-width: 100%; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔔 xshopai Notification</h1>
    </div>
    <div class="content">
        <div class="event-type">Event: ${eventType}</div>
        <div style="font-size: 16px; margin: 20px 0;">
            ${htmlMessage}
        </div>
    </div>
    <div class="footer">
        <p>This is an automated notification from xshopai. Please do not reply to this email.</p>
        <p style="margin: 5px 0;">Generated at ${new Date().toISOString()}</p>
    </div>
</body>
</html>
    `.trim();
  }

  /**
   * Convert plain text to HTML with clickable links
   * - Converts URLs to <a> tags
   * - Converts newlines to <br> tags
   * - Escapes HTML special characters (except for URLs)
   */
  private convertTextToHTML(text: string): string {
    // First, convert URLs to clickable links BEFORE escaping HTML
    // This regex matches http:// and https:// URLs
    let html = text.replace(/(https?:\/\/[^\s]+)/gi, (url) => {
      // Create a placeholder that won't be escaped
      return `<a href="${url}" style="color: #4CAF50; text-decoration: none; font-weight: bold;">${url}</a>`;
    });

    // Now escape HTML special characters in the text between links
    // We need to be careful not to escape the <a> tags we just created
    // Split by <a> tags and only escape the text parts
    const parts = html.split(/(<a[^>]*>.*?<\/a>)/g);
    html = parts
      .map((part) => {
        // Don't escape the link tags (odd indices)
        if (part.startsWith('<a')) {
          return part;
        }
        // Escape HTML in text parts (even indices)
        return part
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      })
      .join('');

    // Convert newlines to <br> tags
    html = html.replace(/\n/g, '<br>');

    return html;
  }

  async testEmailService(): Promise<boolean> {
    if (!this.enabled) {
      logger.info('📧 Email service test skipped (service disabled)');
      return false;
    }

    if (this.provider instanceof SMTPEmailProvider) {
      return await this.provider.testConnection();
    }

    return this.provider.isConfigured();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getProviderInfo(): { provider: string; configured: boolean; enabled: boolean } {
    return {
      provider: config.email.provider,
      configured: this.provider.isConfigured(),
      enabled: this.enabled,
    };
  }
}

export default EmailService;
