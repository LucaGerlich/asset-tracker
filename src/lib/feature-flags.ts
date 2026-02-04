/**
 * Feature flags system
 * Simple feature flags for enabling/disabling functionality
 */

import { logger } from "@/lib/logger";
import { getBoolEnvVar } from "@/lib/env-validation";

/**
 * Feature flag definitions
 */
export interface FeatureFlags {
  /** Enable rate limiting on API endpoints */
  rateLimiting: boolean;
  /** Enable account lockout after failed login attempts */
  accountLockout: boolean;
  /** Enable session timeout for inactivity */
  sessionTimeout: boolean;
  /** Enable demo mode features */
  demoMode: boolean;
  /** Enable audit logging */
  auditLogging: boolean;
  /** Enable email notifications */
  emailNotifications: boolean;
  /** Enable advanced search */
  advancedSearch: boolean;
  /** Enable maintenance mode */
  maintenanceMode: boolean;
}

/**
 * Default feature flag values
 */
const DEFAULT_FLAGS: FeatureFlags = {
  rateLimiting: true,
  accountLockout: true,
  sessionTimeout: true,
  demoMode: false,
  auditLogging: true,
  emailNotifications: false,
  advancedSearch: true,
  maintenanceMode: false,
};

/**
 * In-memory cache for feature flags
 * In production, this could be backed by a database or configuration service
 */
let cachedFlags: FeatureFlags | null = null;
let cacheTime: number = 0;
const CACHE_TTL = 60000; // 1 minute

/**
 * Load feature flags from environment variables
 */
function loadFromEnvironment(): Partial<FeatureFlags> {
  return {
    rateLimiting: getBoolEnvVar("FEATURE_RATE_LIMITING", DEFAULT_FLAGS.rateLimiting),
    accountLockout: getBoolEnvVar("FEATURE_ACCOUNT_LOCKOUT", DEFAULT_FLAGS.accountLockout),
    sessionTimeout: getBoolEnvVar("FEATURE_SESSION_TIMEOUT", DEFAULT_FLAGS.sessionTimeout),
    demoMode: getBoolEnvVar("DEMO_MODE", DEFAULT_FLAGS.demoMode),
    auditLogging: getBoolEnvVar("FEATURE_AUDIT_LOGGING", DEFAULT_FLAGS.auditLogging),
    emailNotifications: getBoolEnvVar("FEATURE_EMAIL_NOTIFICATIONS", DEFAULT_FLAGS.emailNotifications),
    advancedSearch: getBoolEnvVar("FEATURE_ADVANCED_SEARCH", DEFAULT_FLAGS.advancedSearch),
    maintenanceMode: getBoolEnvVar("MAINTENANCE_MODE", DEFAULT_FLAGS.maintenanceMode),
  };
}

/**
 * Get all feature flags
 */
export function getFeatureFlags(): FeatureFlags {
  const now = Date.now();
  
  // Return cached flags if still valid
  if (cachedFlags && now - cacheTime < CACHE_TTL) {
    return cachedFlags;
  }

  // Load and cache new flags
  const envFlags = loadFromEnvironment();
  cachedFlags = {
    ...DEFAULT_FLAGS,
    ...envFlags,
  };
  cacheTime = now;

  return cachedFlags;
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  const flags = getFeatureFlags();
  return flags[feature];
}

/**
 * Override a feature flag at runtime (useful for testing)
 */
export function setFeatureFlag(feature: keyof FeatureFlags, enabled: boolean): void {
  const flags = getFeatureFlags();
  flags[feature] = enabled;
  cachedFlags = flags;
  cacheTime = Date.now();
  
  logger.info(`Feature flag updated: ${feature} = ${enabled}`, {
    type: "feature_flag_change",
    feature,
    enabled,
  });
}

/**
 * Reset feature flags to defaults
 */
export function resetFeatureFlags(): void {
  cachedFlags = null;
  cacheTime = 0;
}

/**
 * Get feature flags as a summary for logging/debugging
 */
export function getFeatureFlagsSummary(): Record<string, boolean> {
  const flags = getFeatureFlags();
  return { ...flags };
}

/**
 * Higher-order function to wrap a function with a feature flag check
 */
export function withFeatureFlag<T extends (...args: unknown[]) => unknown>(
  feature: keyof FeatureFlags,
  fn: T,
  fallback?: T
): T {
  return ((...args: Parameters<T>) => {
    if (isFeatureEnabled(feature)) {
      return fn(...args);
    }
    if (fallback) {
      return fallback(...args);
    }
    logger.debug(`Feature ${feature} is disabled, skipping operation`, {
      type: "feature_flag_skip",
      feature,
    });
    return undefined;
  }) as T;
}

/**
 * React hook style feature flag checker (for use in components)
 * Returns the feature flag value
 */
export function useFeatureFlag(feature: keyof FeatureFlags): boolean {
  // In a real implementation, this could use React state and refresh periodically
  return isFeatureEnabled(feature);
}

/**
 * Decorator-style feature flag for class methods
 */
export function featureFlagGuard(feature: keyof FeatureFlags) {
  return function <T>(
    _target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>
  ): TypedPropertyDescriptor<T> {
    const originalMethod = descriptor.value;
    
    descriptor.value = function (this: unknown, ...args: unknown[]) {
      if (!isFeatureEnabled(feature)) {
        logger.debug(`Feature ${feature} is disabled, skipping ${String(propertyKey)}`, {
          type: "feature_flag_skip",
          feature,
          method: String(propertyKey),
        });
        return undefined;
      }
      return (originalMethod as unknown as (...args: unknown[]) => unknown).apply(this, args);
    } as T;
    
    return descriptor;
  };
}

/**
 * Feature flag middleware for API routes
 */
export function requireFeature(feature: keyof FeatureFlags, message?: string) {
  return async function middleware(
    _request: Request,
    next: () => Promise<Response>
  ): Promise<Response> {
    if (!isFeatureEnabled(feature)) {
      return new Response(
        JSON.stringify({
          error: message || `Feature '${feature}' is not available`,
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    return next();
  };
}
