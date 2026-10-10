import { describe, it, expect } from "vitest";
import {
  UNASSIGNED_VALUE,
  toAssignedTo,
  toAssigneeSelectValue,
} from "@/lib/ticket-assignee";

describe("toAssignedTo", () => {
  it("maps the Unassigned option to null so the API unassigns the ticket", () => {
    expect(toAssignedTo(UNASSIGNED_VALUE)).toBeNull();
  });

  it("maps an empty value to null", () => {
    expect(toAssignedTo("")).toBeNull();
  });

  it("passes a user id through", () => {
    expect(toAssignedTo("11111111-1111-4111-8111-111111111111")).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
  });
});

describe("toAssigneeSelectValue", () => {
  it.each([null, undefined, ""])("shows Unassigned for %j", (assignedTo) => {
    expect(toAssigneeSelectValue(assignedTo)).toBe(UNASSIGNED_VALUE);
  });

  it("shows the assigned user", () => {
    expect(toAssigneeSelectValue("user-1")).toBe("user-1");
  });

  it("round-trips with toAssignedTo", () => {
    expect(toAssignedTo(toAssigneeSelectValue(null))).toBeNull();
    expect(toAssignedTo(toAssigneeSelectValue("user-1"))).toBe("user-1");
  });
});
