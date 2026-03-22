/**
 * Environment validation utilities
 * Validates required environment variables at startup
 */

import { logger } from "@/lib/logger";

interface EnvVarConfig {
  /** Name of the environment variable */
  name: string;
  /** Whether the variable is required */
  required: boolean;
  /** Default value if not provided (makes it optional) */
  default?: string;
  /** Description for documentation */
  description?: string;
  /** Validation function */
  validate?: (value: string) => boolean;
  /** Error message for validation failure */
  validateMessage?: string;
  /** Whether the value should be masked in logs */
  sensitive?: boolean;
}

/**
 * Environment variable configurations
 */
export const ENV_CONFIG: EnvVarConfig[] = [
  // Database
  {
    name: "DATABASE_URL",
    required: true,
    description: "PostgreSQL database connection string",
    sensitive: true,
    validate: (v) =>
      v.startsWith("postgresql://") || v.startsWith("postgres://"),
    validateMessage: "Must be a valid PostgreSQL connection string",
  },
  {
    name: "DATABASE_SSL",
    required: false,
    default: "false",
    description:
      "Enable SSL for database connection (auto-detected for Supabase)",
    validate: (v) => ["true", "false"].includes(v),
    validateMessage: "Must be 'true' or 'false'",
  },

  // BetterAuth
  {
    name: "BETTER_AUTH_URL",
    required: true,
    description: "Base URL of the application (e.g., http://localhost:3000)",
    validate: (v) => {
      try {
        new URL(v);
        return true;
      } catch {
        return false;
      }
    },
    validateMessage: "Must be a valid URL",
  },
  {
    name: "BETTER_AUTH_SECRET",
    required: true,
    description:
      "Secret key for session encryption (generate with: openssl rand -base64 32)",
    sensitive: true,
    validate: (v) => v.length >= 32,
    validateMessage: "Must be at least 32 characters long",
  },

  // Application
  {
    name: "NODE_ENV",
    required: false,
    default: "development",
    description: "Node.js environment (development, production, test)",
    validate: (v) => ["development", "production", "test"].includes(v),
    validateMessage: "Must be 'development', 'production', or 'test'",
  },
  {
    name: "DEMO_MODE",
    required: false,
    default: "false",
    description: "Enable demo mode with sample credentials",
    validate: (v) => ["true", "false"].includes(v),
    validateMessage: "Must be 'true' or 'false'",
  },

  // Rate Limiting (Optional - Upstash Redis)
  {
    name: "UPSTASH_REDIS_REST_URL",
    required: false,
    description: "Upstash Redis REST URL for distributed rate limiting",
    sensitive: true,
  },
  {
    name: "UPSTASH_REDIS_REST_TOKEN",
    required: false,
    description: "Upstash Redis REST token for authentication",
    sensitive: true,
  },

  // Cron (Required in production — all 7 cron jobs fail silently without it)
  {
    name: "CRON_SECRET",
    required: process.env.NODE_ENV === "production",
    description:
      "Secret for authenticating cron job requests (required in production)",
    sensitive: true,
    validate: (v) => v.length >= 16,
    validateMessage: "Must be at least 16 characters long",
  },

  // Email Provider (Optional)
  {
    name: "EMAIL_PROVIDER",
    required: false,
    description: "Email provider (brevo, sendgrid, mailgun, postmark, ses)",
    validate: (v) =>
      ["brevo", "sendgrid", "mailgun", "postmark", "ses"].includes(v),
    validateMessage: "Must be one of: brevo, sendgrid, mailgun, postmark, ses",
  },
  {
    name: "EMAIL_FROM",
    required: false,
    description: "Default sender email address",
    validate: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    validateMessage: "Must be a valid email address",
  },
  {
    name: "EMAIL_FROM_NAME",
    required: false,
    default: "Asset Tracker",
    description: "Default sender name for emails",
  },

  // Encryption
  {
    name: "ENCRYPTION_KEY",
    required: process.env.NODE_ENV === "production",
    description:
      "64-character hex string (32 bytes) for AES-256-GCM encryption of sensitive data at rest. Generate with: openssl rand -hex 32",
    sensitive: true,
    validate: (v) => /^[0-9a-fA-F]{64}$/.test(v),
    validateMessage: "Must be a 64-character hex string (32 bytes)",
  },

  // Feature Flags
  {
    name: "FEATURE_RATE_LIMITING",
    required: false,
    default: "true",
    description: "Enable rate limiting on API endpoints",
    validate: (v) => ["true", "false"].includes(v),
    validateMessage: "Must be 'true' or 'false'",
  },
  {
    name: "FEATURE_ACCOUNT_LOCKOUT",
    required: false,
    default: "true",
    description: "Enable account lockout after failed login attempts",
    validate: (v) => ["true", "false"].includes(v),
    validateMessage: "Must be 'true' or 'false'",
  },
  {
    name: "FEATURE_SESSION_TIMEOUT",
    required: false,
    default: "true",
    description: "Enable session timeout for inactivity",
    validate: (v) => ["true", "false"].includes(v),
    validateMessage: "Must be 'true' or 'false'",
  },
];

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  variables: Record<string, { value: string | undefined; masked?: boolean }>;
}

/**
 * Mask sensitive values for logging
 */
function maskValue(value: string): string {
  if (value.length <= 8) {
    return "********";
  }
  return value.substring(0, 4) + "****" + value.substring(value.length - 4);
}

/**
 * Validate all environment variables
 */
export function validateEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const variables: Record<
    string,
    { value: string | undefined; masked?: boolean }
  > = {};

  for (const config of ENV_CONFIG) {
    const value = process.env[config.name];
    const effectiveValue = value || config.default;

    // Track variable for reporting
    variables[config.name] = {
      value:
        config.sensitive && effectiveValue
          ? maskValue(effectiveValue)
          : effectiveValue,
      masked: config.sensitive,
    };

    // Check required
    if (config.required && !effectiveValue) {
      errors.push(
        `Missing required environment variable: ${config.name}${config.description ? ` (${config.description})` : ""}`,
      );
      continue;
    }

    // Skip validation if not provided and not required
    if (!effectiveValue) {
      continue;
    }

    // Run validation
    if (config.validate && !config.validate(effectiveValue)) {
      const message = config.validateMessage || "Invalid value";
      if (config.required) {
        errors.push(`Invalid value for ${config.name}: ${message}`);
      } else {
        warnings.push(`Invalid value for ${config.name}: ${message}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    variables,
  };
}

/**
 * Validate environment and log results
 */
export function validateAndLogEnvironment(): boolean {
  const result = validateEnvironment();

  if (result.errors.length > 0) {
    logger.error("Environment validation failed", {
      errors: result.errors,
    });
  }

  if (result.warnings.length > 0) {
    logger.warn("Environment validation warnings", {
      warnings: result.warnings,
    });
  }

  if (result.valid) {
    logger.info("Environment validation passed", {
      variables: Object.keys(result.variables).filter(
        (k) => result.variables[k].value !== undefined,
      ),
    });
  }

  return result.valid;
}

/**
 * Get the value of an environment variable with type safety
 */
export function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] || defaultValue;
  if (!value) {
    throw new Error(`Environment variable ${name} is not defined`);
  }
  return value;
}

/**
 * Get the value of an optional environment variable
 */
export function getOptionalEnvVar(
  name: string,
  defaultValue?: string,
): string | undefined {
  return process.env[name] || defaultValue;
}

/**
 * Get a boolean environment variable
 */
export function getBoolEnvVar(name: string, defaultValue = false): boolean {
  const value = process.env[name];
  if (!value) return defaultValue;
  return value.toLowerCase() === "true";
}

/**
 * Get an integer environment variable
 */
export function getIntEnvVar(name: string, defaultValue?: number): number {
  const value = process.env[name];
  if (!value) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Environment variable ${name} is not defined`);
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} is not a valid integer`);
  }
  return parsed;
}

/**
 * Generate documentation for all environment variables
 */
export function generateEnvDocs(): string {
  const lines: string[] = [
    "# Environment Variables",
    "",
    "## Required Variables",
    "",
  ];

  const required = ENV_CONFIG.filter((c) => c.required);
  const optional = ENV_CONFIG.filter((c) => !c.required);

  for (const config of required) {
    lines.push(`### ${config.name}`);
    if (config.description) {
      lines.push(`${config.description}`);
    }
    if (config.validateMessage) {
      lines.push(`**Validation:** ${config.validateMessage}`);
    }
    if (config.sensitive) {
      lines.push(
        `**Note:** This is a sensitive value and should be kept secret.`,
      );
    }
    lines.push("");
  }

  lines.push("## Optional Variables", "");

  for (const config of optional) {
    lines.push(`### ${config.name}`);
    if (config.description) {
      lines.push(`${config.description}`);
    }
    if (config.default) {
      lines.push(`**Default:** \`${config.default}\``);
    }
    if (config.validateMessage) {
      lines.push(`**Validation:** ${config.validateMessage}`);
    }
    if (config.sensitive) {
      lines.push(
        `**Note:** This is a sensitive value and should be kept secret.`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}
