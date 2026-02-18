/**
 * Secrets management utilities
 *
 * Thin helpers for safely retrieving and displaying environment-variable
 * secrets at runtime.
 */

/**
 * Retrieve a required secret from the environment.
 *
 * @throws {Error} If the environment variable is not set or is empty.
 */
export function getRequiredSecret(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Required secret "${name}" is not set. ` +
        "Please add it to your environment variables."
    );
  }
  return value;
}

/**
 * Retrieve an optional secret from the environment.
 *
 * @returns The value of the environment variable, the provided fallback, or an
 *          empty string if neither is available.
 */
export function getOptionalSecret(
  name: string,
  fallback?: string
): string {
  return process.env[name] ?? fallback ?? "";
}

/**
 * Mask a secret for safe display in UI or logs.
 *
 * Shows the first 4 characters followed by asterisks. Values shorter than 5
 * characters are fully masked.
 */
export function maskSecret(value: string): string {
  if (value.length <= 4) {
    return "****";
  }
  return value.substring(0, 4) + "****";
}
