import { describe, it, expect } from "vitest";
import { parseUserInput } from "better-auth/db";
import { USER_ADDITIONAL_FIELDS } from "@/lib/auth-user-fields";

// BetterAuth copies any additional field without `input: false` from the
// request body of POST /api/auth/update-user, which only needs a session.
const options = { user: { additionalFields: USER_ADDITIONAL_FIELDS } };

const PRIVILEGED = [
  "isadmin",
  "canrequest",
  "organizationId",
  "departmentId",
  "authProvider",
  "isActive",
  "password",
] as const;

describe("user additional fields input policy", () => {
  it.each(PRIVILEGED)("rejects %s on update-user", (field) => {
    const value =
      USER_ADDITIONAL_FIELDS[field].type === "boolean"
        ? true
        : "00000000-0000-0000-0000-000000000000";

    expect(() => parseUserInput(options, { [field]: value }, "update")).toThrow(
      /not allowed to be set/,
    );
  });

  it("still lets users update their own username and lastname", () => {
    const parsed = parseUserInput(
      options,
      { username: "jdoe", lastname: "Doe" },
      "update",
    );

    expect(parsed).toMatchObject({ username: "jdoe", lastname: "Doe" });
  });

  it("applies defaults instead of caller values on create", () => {
    const parsed = parseUserInput(options, { name: "x" }, "create");

    expect(parsed).toMatchObject({
      isadmin: false,
      canrequest: true,
      isActive: true,
      authProvider: "local",
    });
  });
});
