/**
 * Checkout statuses that mean the asset is still out. A checkout moves to
 * "returned" on check-in; "overdue" is an active checkout past its due date.
 */
export const ACTIVE_CHECKOUT_STATUSES = ["checked_out", "overdue"];

/** Thrown inside a checkout transaction when the asset is already out. */
export const ALREADY_CHECKED_OUT = "ASSET_ALREADY_CHECKED_OUT";

/** Prisma error codes meaning a concurrent writer won: no row / serialization abort. */
export function isCheckoutConflict(error: unknown): boolean {
  if (error instanceof Error && error.message === ALREADY_CHECKED_OUT) {
    return true;
  }
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
  return code === "P2034";
}
