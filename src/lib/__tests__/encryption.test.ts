import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const TEST_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

/**
 * Helper: reset the cached module so `_warnedMissingKey` and the env snapshot
 * are re-evaluated on the next import.
 */
async function freshImport() {
  vi.resetModules();
  return import("@/lib/encryption");
}

// ---------------------------------------------------------------------------
// Tests that do NOT depend on key state
// ---------------------------------------------------------------------------

describe("isEncrypted", () => {
  it("returns false for an empty string", async () => {
    const { isEncrypted } = await freshImport();
    expect(isEncrypted("")).toBe(false);
  });

  it("returns false for a plain string", async () => {
    const { isEncrypted } = await freshImport();
    expect(isEncrypted("hello world")).toBe(false);
  });

  it("returns false when there are not exactly three colon-separated parts", async () => {
    const { isEncrypted } = await freshImport();
    expect(isEncrypted("a:b")).toBe(false);
    expect(isEncrypted("a:b:c:d")).toBe(false);
  });

  it("returns true for a value matching the encrypted format", async () => {
    const { isEncrypted } = await freshImport();
    // Manually construct a value that matches the structural heuristic:
    // IV = 16 base64 chars, authTag = 24 base64 chars, ciphertext >= 1 char
    const fakeIv = "AAAAAAAAAAAAAAAA"; // 16 chars
    const fakeTag = "AAAAAAAAAAAAAAAAAAAAAAAA"; // 24 chars
    const fakeCipher = "AAAA"; // 4 chars
    expect(isEncrypted(`${fakeIv}:${fakeTag}:${fakeCipher}`)).toBe(true);
  });
});

describe("hashSensitive", () => {
  it("produces a 64-character hex SHA-256 digest", async () => {
    const { hashSensitive } = await freshImport();
    const hash = hashSensitive("secret-value");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns the same hash for the same input", async () => {
    const { hashSensitive } = await freshImport();
    const a = hashSensitive("deterministic");
    const b = hashSensitive("deterministic");
    expect(a).toBe(b);
  });

  it("returns different hashes for different inputs", async () => {
    const { hashSensitive } = await freshImport();
    const a = hashSensitive("value-one");
    const b = hashSensitive("value-two");
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Without ENCRYPTION_KEY -- passthrough mode
// ---------------------------------------------------------------------------

describe("encryption without ENCRYPTION_KEY (passthrough)", () => {
  beforeEach(() => {
    vi.stubEnv("ENCRYPTION_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("encrypt returns plaintext unchanged", async () => {
    const { encrypt } = await freshImport();
    expect(encrypt("hello")).toBe("hello");
  });

  it("decrypt returns its input unchanged", async () => {
    const { decrypt } = await freshImport();
    expect(decrypt("hello")).toBe("hello");
  });
});

// ---------------------------------------------------------------------------
// With ENCRYPTION_KEY -- real encryption
// ---------------------------------------------------------------------------

describe("encryption with ENCRYPTION_KEY set", () => {
  beforeEach(() => {
    vi.stubEnv("ENCRYPTION_KEY", TEST_KEY);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("encrypt produces a value in iv:authTag:ciphertext format", async () => {
    const { encrypt, isEncrypted } = await freshImport();
    const ciphertext = encrypt("sensitive data");
    expect(isEncrypted(ciphertext)).toBe(true);
  });

  it("decrypt recovers the original plaintext", async () => {
    const { encrypt, decrypt } = await freshImport();
    const original = "round-trip test";
    const ciphertext = encrypt(original);
    expect(decrypt(ciphertext)).toBe(original);
  });

  it("encrypt produces different ciphertexts for the same input (random IV)", async () => {
    const { encrypt } = await freshImport();
    const a = encrypt("same-value");
    const b = encrypt("same-value");
    expect(a).not.toBe(b);
  });

  it("decrypt passes through a non-encrypted string without error", async () => {
    const { decrypt } = await freshImport();
    expect(decrypt("plain-legacy-value")).toBe("plain-legacy-value");
  });
});
