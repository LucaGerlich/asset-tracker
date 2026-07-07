import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/** A Prisma client or an interactive-transaction client. */
type PrismaClientOrTx = typeof prisma | Prisma.TransactionClient;

/**
 * Generate a unique PO number with format PO-YYYYMM-XXXX.
 * Sequential per organization per month.
 *
 * Pass the transaction client when calling from inside `prisma.$transaction`
 * so the "last PO" read participates in the same snapshot — otherwise two POs
 * created in the same transaction (or two concurrent requests) both read the
 * same max sequence and collide on the unique `poNumber` constraint.
 */
export async function generatePONumber(
  organizationId: string,
  client: PrismaClientOrTx = prisma,
): Promise<string> {
  const now = new Date();
  const prefix = `PO-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;

  const lastPO = await client.purchaseOrder.findFirst({
    where: {
      organizationId,
      poNumber: { startsWith: prefix },
    },
    orderBy: { poNumber: "desc" },
    select: { poNumber: true },
  });

  let nextSeq = 1;
  if (lastPO) {
    const parts = lastPO.poNumber.split("-");
    const lastSeq = parseInt(parts[2], 10);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  return `${prefix}-${String(nextSeq).padStart(4, "0")}`;
}
