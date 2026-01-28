/**
 * Email Service Types
 */

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface EmailProviderConfig {
  provider: EmailProvider;
  apiKey?: string;
  domain?: string; // For Mailgun
  region?: string; // For SES
}

export type EmailProvider = 'brevo' | 'sendgrid' | 'mailgun' | 'postmark' | 'ses';

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailProviderInterface {
  send(options: EmailOptions): Promise<EmailSendResult>;
  testConnection(): Promise<boolean>;
}

export const EMAIL_PROVIDERS: { id: EmailProvider; name: string; description: string }[] = [
  {
    id: 'brevo',
    name: 'Brevo (Sendinblue)',
    description: 'Free tier: 300 emails/day. Great for small to medium businesses.',
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    description: 'Free tier: 100 emails/day. Reliable and well-documented.',
  },
  {
    id: 'mailgun',
    name: 'Mailgun',
    description: 'Pay as you go. Excellent deliverability and analytics.',
  },
  {
    id: 'postmark',
    name: 'Postmark',
    description: 'Free tier: 100 emails/month. Focus on transactional emails.',
  },
  {
    id: 'ses',
    name: 'Amazon SES',
    description: 'Pay as you go (very cheap). Best for high volume.',
  },
];
