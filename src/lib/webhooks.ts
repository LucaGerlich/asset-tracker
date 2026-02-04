import prisma from './prisma';
import crypto from 'crypto';

/**
 * Available webhook events
 */
export const WEBHOOK_EVENTS = {
  'asset.created': 'Asset created',
  'asset.updated': 'Asset updated',
  'asset.deleted': 'Asset deleted',
  'asset.assigned': 'Asset assigned to user',
  'asset.unassigned': 'Asset unassigned from user',
  'asset.reserved': 'Asset reservation created',
  'asset.reservation_approved': 'Asset reservation approved',
  'user.created': 'User created',
  'user.updated': 'User updated',
  'license.assigned': 'License assigned',
  'license.expiring': 'License expiring soon',
  'consumable.low_stock': 'Consumable stock low',
  'consumable.critical_stock': 'Consumable stock critical',
  'maintenance.due': 'Maintenance due',
  'import.completed': 'Bulk import completed',
  'import.failed': 'Bulk import failed',
} as const;

export type WebhookEvent = keyof typeof WEBHOOK_EVENTS;

interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
  organizationId?: string | null;
}

/**
 * Generate HMAC signature for webhook payload
 */
function generateSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Trigger webhooks for a specific event
 */
export async function triggerWebhook(
  event: WebhookEvent,
  data: Record<string, unknown>,
  organizationId?: string | null
): Promise<void> {
  try {
    // Find active webhooks subscribed to this event
    const webhooks = await prisma.webhook.findMany({
      where: {
        isActive: true,
        events: {
          has: event
        },
        OR: [
          { organizationId: organizationId || undefined },
          { organizationId: null } // Global webhooks
        ]
      }
    });

    if (webhooks.length === 0) {
      return;
    }

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
      organizationId
    };

    // Trigger webhooks in parallel
    const deliveries = webhooks.map(webhook =>
      deliverWebhook(webhook, payload)
    );

    await Promise.allSettled(deliveries);
  } catch (error) {
    console.error('Error triggering webhooks:', error);
  }
}

/**
 * Deliver webhook payload to a specific endpoint
 */
async function deliverWebhook(
  webhook: { id: string; url: string; secret: string | null; retryAttempts: number },
  payload: WebhookPayload,
  attempt = 1
): Promise<void> {
  const payloadString = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Event': payload.event,
    'X-Webhook-Timestamp': payload.timestamp,
    'X-Webhook-Delivery-Id': crypto.randomUUID(),
  };

  if (webhook.secret) {
    headers['X-Webhook-Signature'] = generateSignature(payloadString, webhook.secret);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await response.text().catch(() => '');

    // Log delivery
    await prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event: payload.event,
        payload: payload as object,
        statusCode: response.status,
        response: responseText.slice(0, 1000), // Limit response size
        attempt,
        success: response.ok
      }
    });

    // Retry on failure (5xx errors or network issues)
    if (!response.ok && response.status >= 500 && attempt < webhook.retryAttempts) {
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      setTimeout(() => deliverWebhook(webhook, payload, attempt + 1), delay);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Log failed delivery
    await prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event: payload.event,
        payload: payload as object,
        attempt,
        success: false,
        error: errorMessage
      }
    });

    // Retry on failure
    if (attempt < webhook.retryAttempts) {
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      setTimeout(() => deliverWebhook(webhook, payload, attempt + 1), delay);
    }
  }
}

/**
 * Verify webhook signature (for incoming webhooks from external systems)
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = generateSignature(payload, secret);
  
  // Use timing-safe comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Get list of all available webhook events
 */
export function getWebhookEvents(): { event: WebhookEvent; description: string }[] {
  return Object.entries(WEBHOOK_EVENTS).map(([event, description]) => ({
    event: event as WebhookEvent,
    description,
  }));
}
