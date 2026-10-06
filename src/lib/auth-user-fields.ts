/**
 * BetterAuth `user.additionalFields` for the app's user table.
 *
 * Kept in its own module (no prisma or auth-server imports) so the input
 * policy can be tested against BetterAuth's real `parseUserInput`.
 *
 * Every field that grants access or tenancy has `input: false`. Without it,
 * BetterAuth copies the field from the body of POST /api/auth/update-user,
 * which needs only a session, so any user could make themselves admin or
 * move into another organization. These fields are written only by the
 * app's own routes and hooks, never through BetterAuth's input parsing.
 */

import type { BetterAuthOptions } from "better-auth";

type UserAdditionalFields = NonNullable<
  NonNullable<BetterAuthOptions["user"]>["additionalFields"]
>;

export const USER_ADDITIONAL_FIELDS = {
  username: {
    type: "string",
    required: false,
    input: true,
  },
  lastname: {
    type: "string",
    required: false,
    defaultValue: "",
    input: true,
  },
  isadmin: {
    type: "boolean",
    required: false,
    defaultValue: false,
    input: false,
  },
  canrequest: {
    type: "boolean",
    required: false,
    defaultValue: true,
    input: false,
  },
  organizationId: {
    type: "string",
    required: false,
    input: false,
  },
  departmentId: {
    type: "string",
    required: false,
    input: false,
  },
  authProvider: {
    type: "string",
    required: false,
    defaultValue: "local",
    input: false,
  },
  isActive: {
    type: "boolean",
    required: false,
    defaultValue: true,
    input: false,
  },
  password: {
    type: "string",
    required: false,
    input: false,
  },
} satisfies UserAdditionalFields;
