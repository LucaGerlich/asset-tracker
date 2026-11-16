interface ReturnableRequest {
  status: string;
  entityType: string;
  entityId?: string | null;
}

/**
 * A "Return item" action is only valid for approved, non-consumable requests
 * that carry the entity id, because POST /api/requests needs it to unassign.
 */
export function canRequestReturn(request: ReturnableRequest): boolean {
  return (
    request.status === "approved" &&
    request.entityType !== "consumable" &&
    Boolean(request.entityId)
  );
}
