/**
 * Database resilience utilities
 * Provides retry logic for transient database failures
 */

import { logger } from "@/lib/logger";

interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Initial delay in milliseconds */
  initialDelayMs?: number;
  /** Maximum delay in milliseconds */
  maxDelayMs?: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier?: number;
  /** Function to determine if error is retryable */
  isRetryable?: (error: unknown) => boolean;
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  isRetryable: isTransientError,
};

/**
 * Determine if an error is a transient database error that should be retried
 */
export function isTransientError(error: unknown): boolean {
  if (!error) return false;

  // Check for common transient error codes
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorCode =
    (error as { code?: string }).code ||
    (error as { cause?: { code?: string } }).cause?.code;

  // PostgreSQL transient errors
  const transientCodes = [
    "ECONNRESET", // Connection reset
    "ECONNREFUSED", // Connection refused
    "ETIMEDOUT", // Connection timeout
    "ENOTFOUND", // DNS lookup failed
    "EPIPE", // Broken pipe
    "40001", // Serialization failure
    "40P01", // Deadlock detected
    "53000", // Insufficient resources
    "53100", // Disk full
    "53200", // Out of memory
    "53300", // Too many connections
    "57P01", // Admin shutdown
    "57P02", // Crash shutdown
    "57P03", // Cannot connect now
    "08000", // Connection exception
    "08003", // Connection does not exist
    "08006", // Connection failure
    "08001", // SQL client unable to establish connection
    "08004", // SQL server rejected connection
  ];

  if (errorCode && transientCodes.includes(errorCode)) {
    return true;
  }

  // Check for transient error messages
  const transientMessages = [
    "connection",
    "timeout",
    "ECONNRESET",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "deadlock",
    "too many connections",
    "Connection terminated unexpectedly",
    "Cannot acquire a connection from the pool",
    "Connection pool exhausted",
  ];

  const lowerMessage = errorMessage.toLowerCase();
  return transientMessages.some((msg) =>
    lowerMessage.includes(msg.toLowerCase())
  );
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  multiplier: number
): number {
  // Exponential backoff
  const exponentialDelay = initialDelayMs * Math.pow(multiplier, attempt);
  // Add jitter (±25%)
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  // Clamp to max delay
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a database operation with retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config?: RetryConfig,
  operationName = "database operation"
): Promise<T> {
  const {
    maxRetries,
    initialDelayMs,
    maxDelayMs,
    backoffMultiplier,
    isRetryable,
  } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  let lastError: unknown;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      attempt++;

      // Check if error is retryable
      if (!isRetryable(error)) {
        logger.dbError(operationName, "unknown", error, {
          attempt,
          retryable: false,
        });
        throw error;
      }

      // Check if we've exhausted retries
      if (attempt > maxRetries) {
        logger.dbError(operationName, "unknown", error, {
          attempt,
          maxRetries,
          exhausted: true,
        });
        break;
      }

      // Calculate delay for next attempt
      const delay = calculateDelay(
        attempt - 1,
        initialDelayMs,
        maxDelayMs,
        backoffMultiplier
      );

      logger.warn(`Retrying ${operationName}`, {
        attempt,
        maxRetries,
        delayMs: Math.round(delay),
        error: error instanceof Error ? error.message : String(error),
      });

      await sleep(delay);
    }
  }

  // All retries exhausted
  const error = new Error(
    `${operationName} failed after ${maxRetries} retries: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
  (error as { cause?: unknown }).cause = lastError;
  throw error;
}

/**
 * Create a retry-enabled wrapper for a Prisma client operation
 */
export function createRetryableOperation<TArgs extends unknown[], TResult>(
  operation: (...args: TArgs) => Promise<TResult>,
  operationName: string,
  config?: RetryConfig
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    return withRetry(() => operation(...args), config, operationName);
  };
}

/**
 * Check database connectivity with retry
 */
export async function checkDatabaseConnectivity(
  queryFn: () => Promise<unknown>,
  config?: RetryConfig
): Promise<{ connected: boolean; latencyMs: number; error?: string }> {
  const startTime = Date.now();

  try {
    await withRetry(queryFn, config, "database connectivity check");
    return {
      connected: true,
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      connected: false,
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Wrapper class for retryable database operations
 */
export class RetryableDatabase<T extends object> {
  private db: T;
  private config: Required<RetryConfig>;

  constructor(db: T, config?: RetryConfig) {
    this.db = db;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute a query with retry logic
   */
  async query<TResult>(
    operation: (db: T) => Promise<TResult>,
    operationName = "query"
  ): Promise<TResult> {
    return withRetry(() => operation(this.db), this.config, operationName);
  }

  /**
   * Execute a transaction with retry logic
   * Note: Only retries if the entire transaction fails, not individual operations
   */
  async transaction<TResult>(
    operation: (db: T) => Promise<TResult>,
    operationName = "transaction"
  ): Promise<TResult> {
    return withRetry(
      () => operation(this.db),
      {
        ...this.config,
        // Transactions might have longer timeouts
        maxDelayMs: Math.max(this.config.maxDelayMs, 10000),
      },
      operationName
    );
  }
}
