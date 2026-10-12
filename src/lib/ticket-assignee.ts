/**
 * Value of the "Unassigned" option in the ticket assignee select. A select
 * item cannot have an empty value, so the option needs a sentinel that must
 * never be sent to the API as a user id.
 */
export const UNASSIGNED_VALUE = "unassigned";

/** The `assignedTo` to send to the API for a selected option (null unassigns). */
export function toAssignedTo(selectValue: string): string | null {
  return selectValue === "" || selectValue === UNASSIGNED_VALUE
    ? null
    : selectValue;
}

/** The select option that represents a ticket's current assignee. */
export function toAssigneeSelectValue(
  assignedTo: string | null | undefined,
): string {
  return assignedTo || UNASSIGNED_VALUE;
}
