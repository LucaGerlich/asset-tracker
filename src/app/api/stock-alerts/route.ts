import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { stockAlertSchema, updateStockAlertSchema } from '@/lib/validation-organization';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/audit-log';
import { triggerWebhook } from '@/lib/webhooks';
import { z } from 'zod';

// Get all stock alerts with optional low-stock filter
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const lowStockOnly = req.nextUrl.searchParams.get('lowStockOnly') === 'true';
    const critical = req.nextUrl.searchParams.get('critical') === 'true';

    const alerts = await prisma.stockAlert.findMany({
      include: {
        consumable: {
          select: { 
            consumableid: true, 
            consumablename: true, 
            quantity: true,
            minQuantity: true,
            organizationId: true,
          }
        }
      }
    });

    // Filter for low stock if requested
    let filteredAlerts = alerts;
    
    if (lowStockOnly || critical) {
      filteredAlerts = alerts.filter(alert => {
        const qty = alert.consumable.quantity;
        if (critical) {
          return qty <= alert.criticalThreshold;
        }
        return qty <= alert.minThreshold;
      });
    }

    return NextResponse.json(filteredAlerts);
  } catch (error) {
    console.error('Error fetching stock alerts:', error);
    return NextResponse.json({ error: 'Failed to fetch stock alerts' }, { status: 500 });
  }
}

// Create a stock alert for a consumable
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const validated = stockAlertSchema.parse(body);

    // Verify consumable exists
    const consumable = await prisma.consumable.findUnique({
      where: { consumableid: validated.consumableId }
    });

    if (!consumable) {
      return NextResponse.json({ error: 'Consumable not found' }, { status: 404 });
    }

    // Check if alert already exists
    const existing = await prisma.stockAlert.findUnique({
      where: { consumableId: validated.consumableId }
    });

    if (existing) {
      return NextResponse.json({ error: 'Stock alert already exists for this consumable' }, { status: 400 });
    }

    // Validate thresholds
    if (validated.criticalThreshold > validated.minThreshold) {
      return NextResponse.json({ 
        error: 'Critical threshold must be less than or equal to minimum threshold' 
      }, { status: 400 });
    }

    const alert = await prisma.stockAlert.create({
      data: {
        consumableId: validated.consumableId,
        minThreshold: validated.minThreshold,
        criticalThreshold: validated.criticalThreshold,
        emailNotify: validated.emailNotify,
        webhookNotify: validated.webhookNotify,
      },
      include: {
        consumable: {
          select: { consumablename: true, quantity: true }
        }
      }
    });

    await createAuditLog({
      userId: session.user.id!,
      action: AUDIT_ACTIONS.CREATE,
      entity: 'StockAlert',
      entityId: alert.id,
      details: { consumableId: validated.consumableId, minThreshold: validated.minThreshold },
    });

    return NextResponse.json(alert, { status: 201 });
  } catch (error) {
    console.error('Error creating stock alert:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create stock alert' }, { status: 500 });
  }
}

// Check all consumables for low stock and trigger alerts
export async function PUT() {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all stock alerts with consumable data
    const alerts = await prisma.stockAlert.findMany({
      include: {
        consumable: {
          select: { 
            consumableid: true, 
            consumablename: true, 
            quantity: true,
            organizationId: true
          }
        }
      }
    });

    const triggered: { consumableName: string; quantity: number; threshold: number; level: string }[] = [];

    for (const alert of alerts) {
      const qty = alert.consumable.quantity;
      
      if (qty <= alert.criticalThreshold) {
        if (alert.webhookNotify) {
          await triggerWebhook('consumable.critical_stock', {
            consumableId: alert.consumable.consumableid,
            consumableName: alert.consumable.consumablename,
            currentQuantity: qty,
            criticalThreshold: alert.criticalThreshold,
          }, alert.consumable.organizationId);
        }
        triggered.push({
          consumableName: alert.consumable.consumablename,
          quantity: qty,
          threshold: alert.criticalThreshold,
          level: 'critical'
        });

        await prisma.stockAlert.update({
          where: { id: alert.id },
          data: { lastAlertSentAt: new Date() }
        });
      } else if (qty <= alert.minThreshold) {
        if (alert.webhookNotify) {
          await triggerWebhook('consumable.low_stock', {
            consumableId: alert.consumable.consumableid,
            consumableName: alert.consumable.consumablename,
            currentQuantity: qty,
            minThreshold: alert.minThreshold,
          }, alert.consumable.organizationId);
        }
        triggered.push({
          consumableName: alert.consumable.consumablename,
          quantity: qty,
          threshold: alert.minThreshold,
          level: 'low'
        });

        await prisma.stockAlert.update({
          where: { id: alert.id },
          data: { lastAlertSentAt: new Date() }
        });
      }
    }

    return NextResponse.json({ 
      checked: alerts.length,
      triggered: triggered.length,
      alerts: triggered
    });
  } catch (error) {
    console.error('Error checking stock alerts:', error);
    return NextResponse.json({ error: 'Failed to check stock alerts' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
