/**
 * Email Provider Factory
 * Creates email provider instances based on configuration
 */

import type { EmailProvider, EmailProviderInterface, EmailOptions, EmailSendResult } from './types';

/**
 * Base class for email providers
 */
abstract class BaseEmailProvider implements EmailProviderInterface {
  protected apiKey: string;
  protected fromEmail: string;
  protected fromName: string;

  constructor(apiKey: string, fromEmail: string, fromName: string = 'Asset Tracker') {
    this.apiKey = apiKey;
    this.fromEmail = fromEmail;
    this.fromName = fromName;
  }

  abstract send(options: EmailOptions): Promise<EmailSendResult>;
  abstract testConnection(): Promise<boolean>;
}

/**
 * Brevo (Sendinblue) Provider
 */
class BrevoProvider extends BaseEmailProvider {
  private baseUrl = 'https://api.brevo.com/v3';

  async send(options: EmailOptions): Promise<EmailSendResult> {
    try {
      const response = await fetch(`${this.baseUrl}/smtp/email`, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': this.apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: this.fromName, email: options.from || this.fromEmail },
          to: Array.isArray(options.to) 
            ? options.to.map(email => ({ email }))
            : [{ email: options.to }],
          subject: options.subject,
          htmlContent: options.html,
          textContent: options.text,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.message || 'Failed to send email' };
      }

      const result = await response.json();
      return { success: true, messageId: result.messageId };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/account`, {
        headers: { 'api-key': this.apiKey },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * SendGrid Provider
 */
class SendGridProvider extends BaseEmailProvider {
  private baseUrl = 'https://api.sendgrid.com/v3';

  async send(options: EmailOptions): Promise<EmailSendResult> {
    try {
      const response = await fetch(`${this.baseUrl}/mail/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{
            to: Array.isArray(options.to)
              ? options.to.map(email => ({ email }))
              : [{ email: options.to }],
          }],
          from: { email: options.from || this.fromEmail, name: this.fromName },
          subject: options.subject,
          content: [
            { type: 'text/html', value: options.html },
            ...(options.text ? [{ type: 'text/plain', value: options.text }] : []),
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return { success: false, error: error.errors?.[0]?.message || 'Failed to send email' };
      }

      const messageId = response.headers.get('x-message-id');
      return { success: true, messageId: messageId || undefined };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/user/profile`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Mailgun Provider
 */
class MailgunProvider extends BaseEmailProvider {
  private domain: string;
  private baseUrl: string;

  constructor(apiKey: string, fromEmail: string, fromName: string, domain: string) {
    super(apiKey, fromEmail, fromName);
    this.domain = domain;
    this.baseUrl = `https://api.mailgun.net/v3/${domain}`;
  }

  async send(options: EmailOptions): Promise<EmailSendResult> {
    try {
      const formData = new FormData();
      formData.append('from', `${this.fromName} <${options.from || this.fromEmail}>`);
      
      const recipients = Array.isArray(options.to) ? options.to : [options.to];
      recipients.forEach(email => formData.append('to', email));
      
      formData.append('subject', options.subject);
      formData.append('html', options.html);
      if (options.text) formData.append('text', options.text);

      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`api:${this.apiKey}`).toString('base64')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return { success: false, error: error.message || 'Failed to send email' };
      }

      const result = await response.json();
      return { success: true, messageId: result.id };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`https://api.mailgun.net/v3/domains/${this.domain}`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`api:${this.apiKey}`).toString('base64')}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Postmark Provider
 */
class PostmarkProvider extends BaseEmailProvider {
  private baseUrl = 'https://api.postmarkapp.com';

  async send(options: EmailOptions): Promise<EmailSendResult> {
    try {
      const response = await fetch(`${this.baseUrl}/email`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Postmark-Server-Token': this.apiKey,
        },
        body: JSON.stringify({
          From: `${this.fromName} <${options.from || this.fromEmail}>`,
          To: Array.isArray(options.to) ? options.to.join(',') : options.to,
          Subject: options.subject,
          HtmlBody: options.html,
          TextBody: options.text,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return { success: false, error: error.Message || 'Failed to send email' };
      }

      const result = await response.json();
      return { success: true, messageId: result.MessageID };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/server`, {
        headers: { 'X-Postmark-Server-Token': this.apiKey },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Amazon SES Provider
 */
class SESProvider extends BaseEmailProvider {
  private region: string;
  private accessKeyId: string;
  private secretAccessKey: string;

  constructor(
    accessKeyId: string,
    secretAccessKey: string,
    fromEmail: string,
    fromName: string,
    region: string = 'us-east-1'
  ) {
    super('', fromEmail, fromName);
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.region = region;
  }

  async send(options: EmailOptions): Promise<EmailSendResult> {
    // AWS SES requires AWS SDK v4 signing
    // For simplicity, we use the AWS SDK approach via environment
    // In production, use @aws-sdk/client-ses package
    
    try {
      // Note: This is a simplified implementation
      // In production, use the AWS SDK properly
      const endpoint = `https://email.${this.region}.amazonaws.com`;
      
      const recipients = Array.isArray(options.to) ? options.to : [options.to];
      
      const params = new URLSearchParams();
      params.append('Action', 'SendEmail');
      params.append('Source', `${this.fromName} <${options.from || this.fromEmail}>`);
      recipients.forEach((email, i) => {
        params.append(`Destination.ToAddresses.member.${i + 1}`, email);
      });
      params.append('Message.Subject.Data', options.subject);
      params.append('Message.Body.Html.Data', options.html);
      if (options.text) {
        params.append('Message.Body.Text.Data', options.text);
      }
      params.append('Version', '2010-12-01');

      // Note: Proper AWS v4 signing would be needed here
      // This is a placeholder - use AWS SDK in production
      return { 
        success: false, 
        error: 'SES requires AWS SDK. Please install @aws-sdk/client-ses for production use.' 
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async testConnection(): Promise<boolean> {
    // Would need proper AWS SDK implementation
    return false;
  }
}

/**
 * Create an email provider instance
 */
export function createEmailProvider(
  provider: EmailProvider,
  config: {
    apiKey?: string;
    fromEmail: string;
    fromName?: string;
    domain?: string; // For Mailgun
    region?: string; // For SES
    accessKeyId?: string; // For SES
    secretAccessKey?: string; // For SES
  }
): EmailProviderInterface {
  const fromName = config.fromName || 'Asset Tracker';

  switch (provider) {
    case 'brevo':
      if (!config.apiKey) throw new Error('Brevo requires an API key');
      return new BrevoProvider(config.apiKey, config.fromEmail, fromName);

    case 'sendgrid':
      if (!config.apiKey) throw new Error('SendGrid requires an API key');
      return new SendGridProvider(config.apiKey, config.fromEmail, fromName);

    case 'mailgun':
      if (!config.apiKey || !config.domain) {
        throw new Error('Mailgun requires an API key and domain');
      }
      return new MailgunProvider(config.apiKey, config.fromEmail, fromName, config.domain);

    case 'postmark':
      if (!config.apiKey) throw new Error('Postmark requires an API key');
      return new PostmarkProvider(config.apiKey, config.fromEmail, fromName);

    case 'ses':
      if (!config.accessKeyId || !config.secretAccessKey) {
        throw new Error('Amazon SES requires access key ID and secret access key');
      }
      return new SESProvider(
        config.accessKeyId,
        config.secretAccessKey,
        config.fromEmail,
        fromName,
        config.region
      );

    default:
      throw new Error(`Unknown email provider: ${provider}`);
  }
}
