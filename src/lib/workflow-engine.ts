/**
 * Workflow Execution Engine
 * Evaluates AutomationRule conditions and executes actions
 * based on triggers like warranty expiring, maintenance due, etc.
 */

import prisma from './prisma';
import { queueEmail } from './email';
import { triggerWebhook, WebhookEvent } from './webhooks';

// Trigger types that correspond to AutomationRule.trigger values
type WorkflowTrigger =
  | 'warranty_expiring'
  | 'maintenance_due'
  | 'asset_status_change'
  | 'license_expiring'
  | 'stock_low';

// Condition structure (stored as JSON in AutomationRule.conditions)
interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in';
  value: unknown;
}

// Action structure (stored as JSON in AutomationRule.actions)
interface WorkflowAction {
  type: 'send_email' | 'send_notification' | 'trigger_webhook' | 'update_status' | 'create_ticket';
  config: Record<string, unknown>;
}

/**
 * Get a nested value from an object using dot notation.
 * e.g. getNestedValue({ asset: { status: "active" } }, "asset.status") => "active"
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Evaluate a single condition against data
 */
function evaluateCondition(condition: WorkflowCondition, data: Record<string, unknown>): boolean {
  const fieldValue = getNestedValue(data, condition.field);

  switch (condition.operator) {
    case 'equals':
      return fieldValue === condition.value;
    case 'not_equals':
      return fieldValue !== condition.value;
    case 'contains':
      return String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase());
    case 'greater_than':
      return Number(fieldValue) > Number(condition.value);
    case 'less_than':
      return Number(fieldValue) < Number(condition.value);
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(fieldValue);
    default:
      return false;
  }
}

/**
 * Evaluate all conditions (AND logic).
 * If no conditions are provided, the rule matches unconditionally.
 */
function evaluateConditions(conditions: WorkflowCondition[], data: Record<string, unknown>): boolean {
  if (conditions.length === 0) return true;
  return conditions.every((c) => evaluateCondition(c, data));
}

/**
 * Replace {{variable}} placeholders in a template string with values from data.
 * Supports dot-notation paths like {{asset.name}}.
 */
function resolveTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, key) => {
    const val = getNestedValue(data, key);
    return val !== undefined && val !== null ? String(val) : '';
  });
}

/**
 * Execute a single workflow action
 */
async function executeAction(action: WorkflowAction, data: Record<string, unknown>): Promise<void> {
  switch (action.type) {
    case 'send_email': {
      // config: { to: string, subject: string, body: string } with {{variable}} template support
      const to = resolveTemplate(action.config.to as string, data);
      const subject = resolveTemplate(action.config.subject as string, data);
      const body = resolveTemplate(action.config.body as string, data);
      await queueEmail(null, 'workflow', to, subject, body);
      break;
    }
    case 'send_notification': {
      // config: { userId: string, message: string }
      const userId = action.config.userId as string;
      const user = await prisma.user.findUnique({ where: { userid: userId } });
      if (user?.email) {
        const message = resolveTemplate(action.config.message as string, data);
        await queueEmail(userId, 'workflow_notification', user.email, 'Workflow Notification', message);
      }
      break;
    }
    case 'trigger_webhook': {
      // config: { event: string }
      const event = (action.config.event || 'asset.updated') as WebhookEvent;
      await triggerWebhook(event, data);
      break;
    }
    case 'update_status': {
      // config: { assetId?: string, statusId: string } -- falls back to data.assetId
      const assetId = (action.config.assetId as string) || (data.assetId as string);
      const statusId = action.config.statusId as string;
      if (assetId && statusId) {
        await prisma.asset.update({
          where: { assetid: assetId },
          data: { statustypeid: statusId, change_date: new Date() },
        });
      }
      break;
    }
    case 'create_ticket': {
      // config: { title: string, description: string, priority: string, createdBy?: string }
      const title = resolveTemplate((action.config.title as string) || 'Automated Ticket', data);
      const description = resolveTemplate((action.config.description as string) || '', data);
      const createdBy = (data.userId as string) || (action.config.createdBy as string);

      if (!createdBy) {
        console.warn('Workflow create_ticket action skipped: no createdBy user ID available');
        break;
      }

      try {
        await prisma.tickets.create({
          data: {
            title,
            description,
            priority: (action.config.priority as string) || 'medium',
            status: 'new',
            createdBy,
            updatedAt: new Date(),
          },
        });
      } catch (err) {
        console.warn(
          'Workflow create_ticket action failed:',
          err instanceof Error ? err.message : String(err)
        );
      }
      break;
    }
  }
}

/**
 * Process a single workflow trigger with context data.
 * Finds all active automation rules matching the trigger, evaluates conditions,
 * and executes actions for matching rules.
 */
export async function processWorkflowTrigger(
  trigger: WorkflowTrigger,
  data: Record<string, unknown>
): Promise<{ executed: number; errors: string[] }> {
  const rules = await prisma.automationRule.findMany({
    where: { trigger, isActive: true },
  });

  let executed = 0;
  const errors: string[] = [];

  for (const rule of rules) {
    try {
      const conditions: WorkflowCondition[] = JSON.parse(rule.conditions || '[]');
      const actions: WorkflowAction[] = JSON.parse(rule.actions || '[]');

      if (!evaluateConditions(conditions, data)) continue;

      for (const action of actions) {
        await executeAction(action, data);
      }

      // Update rule metadata
      await prisma.automationRule.update({
        where: { id: rule.id },
        data: { lastRunAt: new Date(), runCount: rule.runCount + 1 },
      });

      executed++;
    } catch (err) {
      const msg = `Rule "${rule.name}" (${rule.id}): ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
      console.error('Workflow execution error:', msg);
    }
  }

  return { executed, errors };
}

/**
 * Run all scheduled workflow checks.
 * Called by the cron endpoint to evaluate time-based triggers.
 */
export async function runScheduledWorkflows(): Promise<
  { trigger: string; executed: number; errors: string[] }[]
> {
  const results: { trigger: string; executed: number; errors: string[] }[] = [];

  // 1. Check warranty expiring (within next 30 days)
  const warrantyAssets = await prisma.asset.findMany({
    where: {
      warrantyExpires: {
        gte: new Date(),
        lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    },
  });
  for (const asset of warrantyAssets) {
    const r = await processWorkflowTrigger('warranty_expiring', {
      assetId: asset.assetid,
      assetName: asset.assetname,
      assetTag: asset.assettag,
      warrantyExpires: asset.warrantyExpires?.toISOString(),
    });
    results.push({ trigger: 'warranty_expiring', ...r });
  }

  // 2. Check maintenance due (within next 7 days)
  const dueMaintenance = await prisma.maintenance_schedules.findMany({
    where: {
      isActive: true,
      nextDueDate: {
        gte: new Date(),
        lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    },
    include: { asset: true },
  });
  for (const m of dueMaintenance) {
    const r = await processWorkflowTrigger('maintenance_due', {
      maintenanceId: m.id,
      maintenanceTitle: m.title,
      assetId: m.assetId,
      assetName: m.asset.assetname,
      nextDueDate: m.nextDueDate.toISOString(),
    });
    results.push({ trigger: 'maintenance_due', ...r });
  }

  // 3. Check expiring licenses (within next 30 days)
  const expiringLicenses = await prisma.licence.findMany({
    where: {
      expirationdate: {
        gte: new Date(),
        lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    },
    include: { licenceCategoryType: true },
  });
  for (const lic of expiringLicenses) {
    const r = await processWorkflowTrigger('license_expiring', {
      licenseId: lic.licenceid,
      licenseName: lic.licenceCategoryType.licencecategorytypename,
      licenseKey: lic.licencekey,
      expirationDate: lic.expirationdate?.toISOString(),
    });
    results.push({ trigger: 'license_expiring', ...r });
  }

  // 4. Check low stock consumables
  const allConsumables = await prisma.consumable.findMany({
    where: { minQuantity: { gt: 0 } },
  });
  const lowStock = allConsumables.filter((c) => c.quantity <= c.minQuantity);
  for (const item of lowStock) {
    const r = await processWorkflowTrigger('stock_low', {
      consumableId: item.consumableid,
      consumableName: item.consumablename,
      quantity: item.quantity,
      minQuantity: item.minQuantity,
    });
    results.push({ trigger: 'stock_low', ...r });
  }

  return results;
}
