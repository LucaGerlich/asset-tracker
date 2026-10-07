/**
 * Workflow Execution Engine
 * Evaluates AutomationRule conditions and executes actions
 * based on triggers like warranty expiring, maintenance due, etc.
 *
 * Everything runs per organization: a rule only ever sees triggers raised for
 * its own organization, and its actions may only touch that organization's
 * data.
 */

import { z } from "zod";
import prisma from "./prisma";
import { queueEmail } from "./email";
import { triggerWebhook, WEBHOOK_EVENTS, WebhookEvent } from "./webhooks";
import { logger } from "@/lib/logger";
import { getOrgSuspensionStatus, type OrgStatus } from "@/lib/org-suspension";

// Trigger types that correspond to AutomationRule.trigger values
type WorkflowTrigger =
  | "warranty_expiring"
  | "maintenance_due"
  | "asset_status_change"
  | "license_expiring"
  | "stock_low";

// Condition structure (stored as JSON in AutomationRule.conditions)
interface WorkflowCondition {
  field: string;
  operator:
    "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "in";
  value: unknown;
}

// Action structure (stored as JSON in AutomationRule.actions)
interface WorkflowAction {
  type:
    | "send_email"
    | "send_notification"
    | "trigger_webhook"
    | "update_status"
    | "create_ticket";
  config: Record<string, unknown>;
}

/**
 * Get a nested value from an object using dot notation.
 * e.g. getNestedValue({ asset: { status: "active" } }, "asset.status") => "active"
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== "object"
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Evaluate a single condition against data
 */
function evaluateCondition(
  condition: WorkflowCondition,
  data: Record<string, unknown>,
): boolean {
  const fieldValue = getNestedValue(data, condition.field);

  switch (condition.operator) {
    case "equals":
      return fieldValue === condition.value;
    case "not_equals":
      return fieldValue !== condition.value;
    case "contains":
      return String(fieldValue)
        .toLowerCase()
        .includes(String(condition.value).toLowerCase());
    case "greater_than":
      return Number(fieldValue) > Number(condition.value);
    case "less_than":
      return Number(fieldValue) < Number(condition.value);
    case "in":
      return (
        Array.isArray(condition.value) && condition.value.includes(fieldValue)
      );
    default:
      return false;
  }
}

/**
 * Evaluate all conditions (AND logic).
 * If no conditions are provided, the rule matches unconditionally.
 */
function evaluateConditions(
  conditions: WorkflowCondition[],
  data: Record<string, unknown>,
): boolean {
  if (conditions.length === 0) return true;
  return conditions.every((c) => evaluateCondition(c, data));
}

/**
 * Replace {{variable}} placeholders in a template string with values from data.
 * Supports dot-notation paths like {{asset.name}}.
 */
function resolveTemplate(
  template: string,
  data: Record<string, unknown>,
): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, key) => {
    const val = getNestedValue(data, key);
    return val !== undefined && val !== null ? String(val) : "";
  });
}

const ACTION_NOT_ALLOWED_MESSAGE = "Action not allowed for this organization";

const recipientSchema = z.string().email();

/** Org status lookups memoised for the duration of one run. */
type OrgStatusCache = Map<string, OrgStatus>;

/**
 * Build the error for an action that would reach outside the rule's
 * organization. The reason only goes to the server log; the message that ends
 * up in the run result stays generic so it cannot confirm that a record exists
 * in another organization.
 */
function actionNotAllowed(reason: string): Error {
  logger.warn("Workflow action rejected", { reason });
  return new Error(ACTION_NOT_ALLOWED_MESSAGE);
}

/**
 * Only plain, non-empty strings are accepted as record IDs. Anything else
 * (undefined, objects such as { not: "x" }) would turn the lookup into a
 * different query than the one the organization constraint was written for.
 */
function asRecordId(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isWebhookEvent(value: unknown): value is WebhookEvent {
  return typeof value === "string" && Object.hasOwn(WEBHOOK_EVENTS, value);
}

/**
 * Resolve a user that belongs to the organization, or reject the action.
 */
async function requireOrganizationUser(
  userId: unknown,
  organizationId: string,
): Promise<{ userid: string; email: string | null }> {
  const id = asRecordId(userId);
  if (!id) {
    throw actionNotAllowed("action has no valid user id");
  }
  const user = await prisma.user.findFirst({
    where: { userid: id, organizationId },
    select: { userid: true, email: true },
  });
  if (!user) {
    throw actionNotAllowed("user is not a member of the organization");
  }
  return user;
}

/**
 * Execute a single workflow action on behalf of an organization.
 * Throws when the action would touch data of another organization.
 */
async function executeAction(
  action: WorkflowAction,
  data: Record<string, unknown>,
  organizationId: string,
): Promise<void> {
  switch (action.type) {
    case "send_email": {
      // config: { to: string, subject: string, body: string } with {{variable}} template support
      const to = resolveTemplate(String(action.config.to ?? ""), data);
      if (!recipientSchema.safeParse(to).success) {
        throw new Error("send_email recipient is not a valid email address");
      }
      const subject = resolveTemplate(action.config.subject as string, data);
      const body = resolveTemplate(action.config.body as string, data);
      await queueEmail(null, "workflow", to, subject, body);
      break;
    }
    case "send_notification": {
      // config: { userId: string, message: string }
      const user = await requireOrganizationUser(
        action.config.userId,
        organizationId,
      );
      if (user.email) {
        const message = resolveTemplate(action.config.message as string, data);
        await queueEmail(
          user.userid,
          "workflow_notification",
          user.email,
          "Workflow Notification",
          message,
        );
      }
      break;
    }
    case "trigger_webhook": {
      // config: { event: string }
      const event = action.config.event || "asset.updated";
      if (!isWebhookEvent(event)) {
        throw actionNotAllowed("unknown webhook event");
      }
      await triggerWebhook(event, data, organizationId);
      break;
    }
    case "update_status": {
      // config: { assetId?: string, statusId: string } -- falls back to data.assetId
      const assetId =
        asRecordId(action.config.assetId) ?? asRecordId(data.assetId);
      const statusId = asRecordId(action.config.statusId);
      if (!assetId || !statusId) break;

      const [asset, status] = await Promise.all([
        prisma.asset.findFirst({ where: { assetid: assetId, organizationId } }),
        prisma.statusType.findFirst({
          where: { statustypeid: statusId, organizationId },
        }),
      ]);
      if (!asset || !status) {
        throw actionNotAllowed(
          "asset or status is not part of the organization",
        );
      }

      await prisma.asset.updateMany({
        where: { assetid: assetId, organizationId },
        data: { statustypeid: statusId, change_date: new Date() },
      });
      break;
    }
    case "create_ticket": {
      // config: { title: string, description: string, priority: string, createdBy?: string }
      const title = resolveTemplate(
        (action.config.title as string) || "Automated Ticket",
        data,
      );
      const description = resolveTemplate(
        (action.config.description as string) || "",
        data,
      );
      const createdBy = data.userId || action.config.createdBy;

      if (!createdBy) {
        logger.warn(
          "Workflow create_ticket action skipped: no createdBy user ID available",
        );
        break;
      }

      // Tickets carry no organization column, so the creator is what ties the
      // ticket to a tenant.
      const creator = await requireOrganizationUser(createdBy, organizationId);

      try {
        await prisma.tickets.create({
          data: {
            title,
            description,
            priority: (action.config.priority as string) || "medium",
            status: "new",
            createdBy: creator.userid,
            updatedAt: new Date(),
          },
        });
      } catch (err) {
        logger.warn("Workflow create_ticket action failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      break;
    }
  }
}

async function getCachedOrgStatus(
  organizationId: string,
  cache: OrgStatusCache,
): Promise<OrgStatus> {
  const cached = cache.get(organizationId);
  if (cached) return cached;
  const status = await getOrgSuspensionStatus(organizationId);
  cache.set(organizationId, status);
  return status;
}

/**
 * Process a single workflow trigger with context data.
 * Finds the organization's active automation rules matching the trigger,
 * evaluates conditions, and executes actions for matching rules.
 *
 * Locked-out organizations run no rules. Pass a shared `orgStatusCache` when
 * calling repeatedly within one run to look each organization up only once.
 */
export async function processWorkflowTrigger(
  trigger: WorkflowTrigger,
  data: Record<string, unknown>,
  organizationId: string,
  orgStatusCache: OrgStatusCache = new Map(),
): Promise<{ executed: number; errors: string[] }> {
  // Prisma drops an undefined filter, which would load every organization's rules.
  if (!organizationId) {
    const msg = "Workflow trigger requires an organization";
    logger.error("Workflow execution error", { error: msg, trigger });
    return { executed: 0, errors: [msg] };
  }

  if (
    (await getCachedOrgStatus(organizationId, orgStatusCache)) === "locked_out"
  ) {
    return { executed: 0, errors: [] };
  }

  const rules = await prisma.automationRule.findMany({
    where: { trigger, isActive: true, organizationId },
  });

  let executed = 0;
  const errors: string[] = [];

  for (const rule of rules) {
    try {
      const conditions: WorkflowCondition[] = JSON.parse(
        rule.conditions || "[]",
      );
      const actions: WorkflowAction[] = JSON.parse(rule.actions || "[]");

      if (!evaluateConditions(conditions, data)) continue;

      for (const action of actions) {
        await executeAction(action, data, organizationId);
      }

      await prisma.automationRule.update({
        where: { id: rule.id },
        data: { lastRunAt: new Date(), runCount: { increment: 1 } },
      });

      executed++;
    } catch (err) {
      const msg = `Rule "${rule.name}" (${rule.id}): ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
      logger.error("Workflow execution error", { error: msg });
    }
  }

  return { executed, errors };
}

/**
 * Run all scheduled workflow checks.
 * Called by the cron endpoint to evaluate time-based triggers.
 *
 * Every matching record is handed to the rules of the organization that owns
 * it. Records without an organization are skipped.
 */
export async function runScheduledWorkflows(): Promise<
  { trigger: string; executed: number; errors: string[] }[]
> {
  const results: { trigger: string; executed: number; errors: string[] }[] = [];
  const orgStatusCache: OrgStatusCache = new Map();
  let skippedWithoutOrganization = 0;

  const runForOrganization = async (
    trigger: WorkflowTrigger,
    organizationId: string | null,
    data: Record<string, unknown>,
  ): Promise<void> => {
    if (!organizationId) {
      skippedWithoutOrganization++;
      return;
    }
    const r = await processWorkflowTrigger(
      trigger,
      data,
      organizationId,
      orgStatusCache,
    );
    results.push({ trigger, ...r });
  };

  // 1. Check warranty expiring (within next 30 days)
  const warrantyAssets = await prisma.asset.findMany({
    where: {
      warrantyExpires: {
        gte: new Date(),
        lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    },
    select: {
      assetid: true,
      assetname: true,
      assettag: true,
      warrantyExpires: true,
      organizationId: true,
    },
  });
  for (const asset of warrantyAssets) {
    await runForOrganization("warranty_expiring", asset.organizationId, {
      assetId: asset.assetid,
      assetName: asset.assetname,
      assetTag: asset.assettag,
      warrantyExpires: asset.warrantyExpires?.toISOString(),
    });
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
    select: {
      id: true,
      title: true,
      assetId: true,
      nextDueDate: true,
      // Schedules have no organization column; the asset carries it.
      asset: { select: { assetname: true, organizationId: true } },
    },
  });
  for (const m of dueMaintenance) {
    await runForOrganization("maintenance_due", m.asset.organizationId, {
      maintenanceId: m.id,
      maintenanceTitle: m.title,
      assetId: m.assetId,
      assetName: m.asset.assetname,
      nextDueDate: m.nextDueDate.toISOString(),
    });
  }

  // 3. Check expiring licenses (within next 30 days)
  const expiringLicenses = await prisma.licence.findMany({
    where: {
      expirationdate: {
        gte: new Date(),
        lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    },
    select: {
      licenceid: true,
      licencekey: true,
      expirationdate: true,
      organizationId: true,
      licenceCategoryType: { select: { licencecategorytypename: true } },
    },
  });
  for (const lic of expiringLicenses) {
    await runForOrganization("license_expiring", lic.organizationId, {
      licenseId: lic.licenceid,
      licenseName: lic.licenceCategoryType.licencecategorytypename,
      licenseKey: lic.licencekey,
      expirationDate: lic.expirationdate?.toISOString(),
    });
  }

  // 4. Check low stock consumables
  const allConsumables = await prisma.consumable.findMany({
    where: { minQuantity: { gt: 0 } },
    select: {
      consumableid: true,
      consumablename: true,
      quantity: true,
      minQuantity: true,
      organizationId: true,
    },
  });
  const lowStock = allConsumables.filter((c) => c.quantity <= c.minQuantity);
  for (const item of lowStock) {
    await runForOrganization("stock_low", item.organizationId, {
      consumableId: item.consumableid,
      consumableName: item.consumablename,
      quantity: item.quantity,
      minQuantity: item.minQuantity,
    });
  }

  if (skippedWithoutOrganization > 0) {
    logger.warn("Workflow scan skipped records without an organization", {
      count: skippedWithoutOrganization,
    });
  }

  return results;
}
