/**
 * Username policy. Login accepts an email address or a username in the same
 * field, so a username must never look like an email: otherwise one user could
 * register another user's address as a username and compete for their login.
 */

import { z } from "zod";

export const USERNAME_AT_SIGN_MESSAGE = "Username must not contain '@'";

export function isValidUsername(username: string): boolean {
  return !username.includes("@");
}

export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(50, "Username too long")
  .refine(isValidUsername, { message: USERNAME_AT_SIGN_MESSAGE });
