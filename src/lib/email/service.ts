/**
 * Email Service
 * Main service for sending emails through configured provider
 */

import prisma from '../prisma';
import { createEmailProvider } from './providers';
import type { EmailOptions, EmailProvider, EmailSendResult } from './types';

interface EmailConfig {
  provider: EmailProvider;
  apiKey: string;
  fromEmail: string;
  fromName: string;
  domain?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

/**
 * Get email configuration from database or environment
 */
async function getEmailConfig(): Promise<EmailConfig | null> {
  try {
    // Try to get configuration from database first
    const settings = await prisma.systemSettings.findMany({
      where: { category: 'email' },
    });

    const configMap = new Map(settings.map(s => [s.settingKey, s.settingValue]));

    const provider = configMap.get('email_provider') as EmailProvider | undefined;
    const apiKey = configMap.get('email_api_key');
    const fromEmail = configMap.get('email_from');
    const fromName = configMap.get('email_from_name');

    if (provider && apiKey && fromEmail) {
      return {
        provider,
        apiKey,
        fromEmail,
        fromName: fromName || 'Asset Tracker',
        domain: configMap.get('email_domain') || undefined,
        region: configMap.get('email_region') || undefined,
        accessKeyId: configMap.get('email_access_key_id') || undefined,
        secretAccessKey: configMap.get('email_secret_access_key') || undefined,
      };
    }

    // Fall back to environment variables
    const envProvider = process.env.EMAIL_PROVIDER as EmailProvider | undefined;
    const envFromEmail = process.env.EMAIL_FROM;

    if (envProvider && envFromEmail) {
      return {
        provider: envProvider,
        apiKey: getProviderApiKey(envProvider),
        fromEmail: envFromEmail,
        fromName: process.env.EMAIL_FROM_NAME || 'Asset Tracker',
        domain: process.env.MAILGUN_DOMAIN,
        region: process.env.AWS_REGION,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };
    }

    return null;
  } catch (error) {
    console.error('Failed to get email config:', error);
    return null;
  }
}

function getProviderApiKey(provider: EmailProvider): string {
  switch (provider) {
    case 'brevo':
      return process.env.BREVO_API_KEY || '';
    case 'sendgrid':
      return process.env.SENDGRID_API_KEY || '';
    case 'mailgun':
      return process.env.MAILGUN_API_KEY || '';
    case 'postmark':
      return process.env.POSTMARK_API_KEY || '';
    case 'ses':
      return ''; // SES uses access keys instead
    default:
      return '';
  }
}

/**
 * Send an email using the configured provider
 */
export async function sendEmail(options: EmailOptions): Promise<EmailSendResult> {
  const config = await getEmailConfig();

  if (!config) {
    return {
      success: false,
      error: 'Email is not configured. Please configure an email provider in Admin Settings.',
    };
  }

  try {
    const provider = createEmailProvider(config.provider, {
      apiKey: config.apiKey,
      fromEmail: config.fromEmail,
      fromName: config.fromName,
      domain: config.domain,
      region: config.region,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    });

    return await provider.send(options);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}

/**
 * Test email configuration
 */
export async function testEmailConnection(): Promise<{ success: boolean; error?: string }> {
  const config = await getEmailConfig();

  if (!config) {
    return {
      success: false,
      error: 'Email is not configured',
    };
  }

  try {
    const provider = createEmailProvider(config.provider, {
      apiKey: config.apiKey,
      fromEmail: config.fromEmail,
      fromName: config.fromName,
      domain: config.domain,
      region: config.region,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    });

    const connected = await provider.testConnection();
    return { success: connected, error: connected ? undefined : 'Connection test failed' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to test connection',
    };
  }
}

/**
 * Queue an email for sending
 */
export async function queueEmail(
  userId: string | null,
  type: string,
  recipient: string,
  subject: string,
  body: string,
  scheduledAt?: Date
): Promise<void> {
  await prisma.notificationQueue.create({
    data: {
      userId,
      type,
      recipient,
      subject,
      body,
      status: 'pending',
      scheduledAt: scheduledAt || new Date(),
    },
  });
}

/**
 * Process pending emails in the queue
 */
export async function processEmailQueue(batchSize: number = 10): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const pendingEmails = await prisma.notificationQueue.findMany({
    where: {
      status: 'pending',
      scheduledAt: { lte: new Date() },
      attempts: { lt: 3 }, // Max 3 attempts
    },
    take: batchSize,
    orderBy: { scheduledAt: 'asc' },
  });

  let succeeded = 0;
  let failed = 0;

  for (const email of pendingEmails) {
    const result = await sendEmail({
      to: email.recipient,
      subject: email.subject,
      html: email.body,
    });

    if (result.success) {
      await prisma.notificationQueue.update({
        where: { id: email.id },
        data: {
          status: 'sent',
          sentAt: new Date(),
        },
      });
      succeeded++;
    } else {
      await prisma.notificationQueue.update({
        where: { id: email.id },
        data: {
          attempts: email.attempts + 1,
          lastError: result.error,
          status: email.attempts + 1 >= 3 ? 'failed' : 'pending',
        },
      });
      failed++;
    }
  }

  return {
    processed: pendingEmails.length,
    succeeded,
    failed,
  };
}

/**
 * Check if email is configured
 */
export async function isEmailConfigured(): Promise<boolean> {
  const config = await getEmailConfig();
  return config !== null;
}
