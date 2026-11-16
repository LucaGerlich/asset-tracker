import { describe, it, expect } from "vitest";
import { isValidUsername, usernameSchema } from "@/lib/username";
import { createUserSchema, updateUserSchema } from "@/lib/validation";

describe("username policy", () => {
  it("rejects usernames containing @", () => {
    expect(isValidUsername("victim@example.com")).toBe(false);
    expect(isValidUsername("a@b")).toBe(false);
    expect(usernameSchema.safeParse("victim@example.com").success).toBe(false);
  });

  it("accepts plain usernames", () => {
    expect(isValidUsername("jane.doe_1")).toBe(true);
    expect(usernameSchema.safeParse("jane.doe").success).toBe(true);
  });

  it("keeps the 3 to 50 character bounds", () => {
    expect(usernameSchema.safeParse("ab").success).toBe(false);
    expect(usernameSchema.safeParse("a".repeat(51)).success).toBe(false);
  });

  it("is enforced by createUserSchema and updateUserSchema", () => {
    expect(
      createUserSchema.safeParse({
        username: "victim@example.com",
        firstname: "A",
        lastname: "B",
      }).success,
    ).toBe(false);
    expect(
      updateUserSchema.safeParse({ username: "victim@example.com" }).success,
    ).toBe(false);
    expect(updateUserSchema.safeParse({ username: "victim" }).success).toBe(
      true,
    );
  });
});
