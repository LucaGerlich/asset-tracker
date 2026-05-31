/**
 * Structured logging utility
 * Provides consistent logging across the application with context
 * Includes correlation ID support for request tracing
 */

import { AsyncLocalStorage } from "async_hooks";

type LogLevel = "debug" | "info" | "warn" | "error";

const SENSITIVE_FIELD_NAMES = new Set([
  "password",
  "secret",
  "token",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "credit_card",
  "creditcard",
  "ssn",
  "cvv",
  "pin",
]);

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const BEARER_REGEX = /^Bearer\s+.+/i;
const JWT_REGEX = /^eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/;

const MASK = "***REDACTED***";
const MAX_DEPTH = 20;

function maskEmailAddress(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return MASK;
  const visible = local.charAt(0);
  return `${visible}***@${domain}`;
}

function maskStringValue(value: string): string {
  if (JWT_REGEX.test(value)) {
    return value.substring(0, 10) + "...";
  }
  if (BEARER_REGEX.test(value)) {
    // Show "Bearer " prefix plus first 3 chars of the token
    return value.substring(0, 10) + "...";
  }
  if (EMAIL_REGEX.test(value)) {
    return maskEmailAddress(value);
  }
  return value;
}

function isSensitiveFieldName(key: string): boolean {
  return SENSITIVE_FIELD_NAMES.has(key.toLowerCase());
}

/**
 * Recursively masks sensitive fields in an object.
 * - Fields whose names match known sensitive names are fully redacted.
 * - String values matching email / Bearer / JWT patterns are partially masked.
 */
export function maskSensitiveData<T>(data: T, depth = 0): T {
  if (depth > MAX_DEPTH || data === null || data === undefined) {
    return data;
  }

  // Internal implementation works on `unknown` and returns the masked value.
  // The generic preserves the caller's type, so a single cast at the end is safe.
  const result = maskValue(data, depth);
  return result as T;
}

function maskValue(data: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH || data === null || data === undefined) {
    return data;
  }

  if (typeof data === "string") {
    return maskStringValue(data);
  }

  if (Array.isArray(data)) {
    return data.map((item) => maskValue(item, depth + 1));
  }

  if (typeof data === "object" && !(data instanceof Error)) {
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      data as Record<string, unknown>,
    )) {
      if (isSensitiveFieldName(key)) {
        masked[key] = MASK;
      } else if (typeof value === "string") {
        masked[key] = maskStringValue(value);
      } else if (
        typeof value === "object" &&
        value !== null &&
        !(value instanceof Error)
      ) {
        masked[key] = maskValue(value, depth + 1);
      } else {
        masked[key] = value;
      }
    }
    return masked;
  }

  return data;
}

interface LogContext {
  [key: string]: unknown;
  timestamp?: string;
  level?: LogLevel;
  message?: string;
  error?: Error | unknown;
  stack?: string;
  correlationId?: string;
}

// AsyncLocalStorage for correlation ID propagation
const correlationIdStorage = new AsyncLocalStorage<string>();

/**
 * Generate a unique correlation ID
 */
export function generateCorrelationId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Get the current correlation ID from async context
 */
export function getCorrelationId(): string | undefined {
  return correlationIdStorage.getStore();
}

/**
 * Run a function with a correlation ID in context
 */
export function withCorrelationId<T>(correlationId: string, fn: () => T): T {
  return correlationIdStorage.run(correlationId, fn);
}

/**
 * Run an async function with a correlation ID in context
 */
export async function withCorrelationIdAsync<T>(
  correlationId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return correlationIdStorage.run(correlationId, fn);
}

class Logger {
  private serviceName: string;
  private environment: string;

  constructor(serviceName = "asset-tracker") {
    this.serviceName = serviceName;
    this.environment = process.env.NODE_ENV || "development";
  }

  private formatLog(
    level: LogLevel,
    message: string,
    context?: LogContext,
  ): LogContext {
    const correlationId = getCorrelationId();
    const log: LogContext = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      environment: this.environment,
      message,
      ...(correlationId && { correlationId }),
      ...context,
    };

    if (context?.error) {
      const error = context.error as Error;
      log.errorMessage = error.message;
      log.errorName = error.name;
      log.stack = error.stack;

      // Include any custom error properties
      if (error && typeof error === "object") {
        Object.keys(error).forEach((key) => {
          if (!["message", "name", "stack"].includes(key)) {
            log[`error_${key}`] = error[key as keyof Error];
          }
        });
      }
    }

    return log;
  }

  private write(level: LogLevel, message: string, context?: LogContext) {
    const log = this.formatLog(level, message, context);
    const maskedLog = maskSensitiveData(log);

    // In production, output JSON for log aggregation tools
    if (this.environment === "production") {
      console.log(JSON.stringify(maskedLog));
    } else {
      // In development, use colored console output
      const colorMap = {
        debug: "\x1b[36m", // Cyan
        info: "\x1b[32m", // Green
        warn: "\x1b[33m", // Yellow
        error: "\x1b[31m", // Red
      };
      const _reset = "\x1b[0m";
      const _color = colorMap[level];

      const _maskedContext = context ? maskSensitiveData(context) : "";

      if (context?.error) {
        console.error(context.error);
      }
    }
  }

  debug(message: string, context?: LogContext) {
    this.write("debug", message, context);
  }

  info(message: string, context?: LogContext) {
    this.write("info", message, context);
  }

  warn(message: string, context?: LogContext) {
    this.write("warn", message, context);
  }

  error(message: string, context?: LogContext) {
    this.write("error", message, context);
  }

  // API-specific logging helpers
  apiRequest(method: string, path: string, context?: LogContext) {
    this.info(`API Request: ${method} ${path}`, {
      type: "api_request",
      method,
      path,
      ...context,
    });
  }

  apiResponse(
    method: string,
    path: string,
    status: number,
    duration?: number,
    context?: LogContext,
  ) {
    const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
    this.write(level, `API Response: ${method} ${path} - ${status}`, {
      type: "api_response",
      method,
      path,
      status,
      duration,
      ...context,
    });
  }

  apiError(
    method: string,
    path: string,
    error: Error | unknown,
    context?: LogContext,
  ) {
    this.error(`API Error: ${method} ${path}`, {
      type: "api_error",
      method,
      path,
      error,
      ...context,
    });
  }

  dbQuery(
    operation: string,
    model: string,
    duration?: number,
    context?: LogContext,
  ) {
    this.debug(`DB Query: ${operation} on ${model}`, {
      type: "db_query",
      operation,
      model,
      duration,
      ...context,
    });
  }

  dbError(
    operation: string,
    model: string,
    error: Error | unknown,
    context?: LogContext,
  ) {
    this.error(`DB Error: ${operation} on ${model}`, {
      type: "db_error",
      operation,
      model,
      error,
      ...context,
    });
  }

  // Security-related logging
  securityEvent(event: string, context?: LogContext) {
    this.warn(`Security Event: ${event}`, {
      type: "security_event",
      event,
      ...context,
    });
  }

  rateLimitExceeded(
    identifier: string,
    endpoint: string,
    context?: LogContext,
  ) {
    this.warn(`Rate limit exceeded`, {
      type: "rate_limit",
      identifier,
      endpoint,
      ...context,
    });
  }
}

// Export singleton instance
export const logger = new Logger();

// Export class for custom instances
export { Logger };

/**
 * Returns a catch handler that logs the error as a warning.
 * Use in fire-and-forget promise chains instead of silent `.catch(() => {})`.
 *
 * @example
 * createAuditLog({ ... }).catch(logCatchError("Audit log failed"));
 * notifyIntegrations("asset.created", { ... }).catch(logCatchError("Integration notification failed"));
 */
export function logCatchError(context: string) {
  return (err: unknown) => {
    logger.warn(context, { error: err });
  };
}
