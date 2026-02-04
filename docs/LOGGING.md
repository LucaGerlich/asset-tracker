# Logging and Monitoring

This document describes the structured logging and monitoring setup for the Asset Tracker application.

## Structured Logging

The application uses a custom structured logging utility (`src/lib/logger/index.ts`) that provides consistent, searchable logs across the application.

### Usage

```typescript
import { logger } from "@/lib/logger";

// Basic logging
logger.info("User logged in", { userId: "123", email: "user@example.com" });
logger.warn("Rate limit approaching", { requests: 95, limit: 100 });
logger.error("Database connection failed", { error, retries: 3 });

// API-specific logging
logger.apiRequest("GET", "/api/assets");
logger.apiResponse("GET", "/api/assets", 200, 145); // 145ms duration
logger.apiError("POST", "/api/assets", error, { assetId: "abc" });

// Database-specific logging
logger.dbQuery("findMany", "asset", 42); // 42ms duration
logger.dbError("update", "user", error, { userId: "123" });
```

### Log Levels

- **debug**: Detailed information for debugging (e.g., query details)
- **info**: General informational messages (e.g., successful operations)
- **warn**: Warning messages (e.g., validation errors, rate limits)
- **error**: Error messages (e.g., exceptions, failures)

### Environment-Specific Behavior

- **Development**: Colored console output with pretty formatting
- **Production**: JSON-formatted logs for log aggregation tools (e.g., CloudWatch, Datadog)

### Log Context

All logs include:
- `timestamp`: ISO 8601 timestamp
- `level`: Log level (debug, info, warn, error)
- `service`: Service name (default: "asset-tracker")
- `environment`: Current environment (development, production, etc.)
- `message`: Log message
- Additional context fields as needed

## Error Boundaries

React Error Boundaries catch rendering errors and provide user-friendly error UI.

### Usage

Wrap components with the ErrorBoundary:

```tsx
import { ErrorBoundary } from "@/components/error-boundary";

export default function Page() {
  return (
    <ErrorBoundary>
      <YourComponent />
    </ErrorBoundary>
  );
}
```

### Custom Fallback UI

```tsx
<ErrorBoundary
  fallback={
    <div>
      <h1>Oops! Something went wrong</h1>
      <button onClick={() => window.location.reload()}>Reload</button>
    </div>
  }
>
  <YourComponent />
</ErrorBoundary>
```

### Custom Error Handler

```tsx
<ErrorBoundary
  onError={(error, errorInfo) => {
    // Send to error tracking service
    sendToSentry(error, errorInfo);
  }}
>
  <YourComponent />
</ErrorBoundary>
```

## Health Check Endpoints

The application provides three health check endpoints for monitoring and orchestration.

### GET /api/health

Comprehensive health check including database connectivity, environment variables, and uptime.

**Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-28T12:00:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "version": "1.0.0",
  "checks": {
    "database": {
      "status": "healthy",
      "duration": 15
    },
    "environment": {
      "status": "healthy"
    }
  },
  "responsetime": 25
}
```

**Response (503 Service Unavailable):**
```json
{
  "status": "unhealthy",
  "timestamp": "2024-01-28T12:00:00.000Z",
  "checks": {
    "database": {
      "status": "unhealthy",
      "message": "Connection timeout",
      "duration": 5000
    }
  }
}
```

### GET /api/health/live

Liveness probe for Kubernetes/Docker orchestration. Returns 200 if the application is running.

**Response (200 OK):**
```json
{
  "status": "alive",
  "timestamp": "2024-01-28T12:00:00.000Z"
}
```

**Use case:** Kubernetes liveness probe to restart unhealthy pods.

### GET /api/health/ready

Readiness probe for Kubernetes/Docker orchestration. Returns 200 only when the application can accept traffic.

**Response (200 OK):**
```json
{
  "status": "ready",
  "timestamp": "2024-01-28T12:00:00.000Z"
}
```

**Response (503 Service Unavailable):**
```json
{
  "status": "not ready",
  "timestamp": "2024-01-28T12:00:00.000Z",
  "error": "Database connection failed"
}
```

**Use case:** Kubernetes readiness probe to control traffic routing.

## Kubernetes Configuration Example

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: asset-tracker
spec:
  containers:
  - name: app
    image: asset-tracker:latest
    livenessProbe:
      httpGet:
        path: /api/health/live
        port: 3000
      initialDelaySeconds: 30
      periodSeconds: 10
    readinessProbe:
      httpGet:
        path: /api/health/ready
        port: 3000
      initialDelaySeconds: 10
      periodSeconds: 5
```

## Migrating Existing Code

To migrate existing code to use structured logging:

**Before:**
```typescript
console.error("Error deleting asset:", error);
```

**After:**
```typescript
import { logger } from "@/lib/logger";

logger.apiError("DELETE", "/api/asset/deleteAsset", error, {
  assetId,
});
```

## Best Practices

1. **Include context**: Always provide relevant context in logs
   ```typescript
   logger.error("Failed to send email", { userId, emailType: "welcome", error });
   ```

2. **Use appropriate log levels**: Don't log everything as error
   - Use `debug` for development/troubleshooting
   - Use `info` for successful operations
   - Use `warn` for non-critical issues
   - Use `error` for failures that need attention

3. **Avoid logging sensitive data**: Never log passwords, tokens, or PII
   ```typescript
   // ❌ Bad
   logger.info("User login", { password: user.password });
   
   // ✅ Good
   logger.info("User login", { userId: user.id, email: user.email });
   ```

4. **Use structured data**: Provide structured context rather than string concatenation
   ```typescript
   // ❌ Bad
   logger.error(`Failed to update asset ${assetId} for user ${userId}`);
   
   // ✅ Good
   logger.error("Failed to update asset", { assetId, userId, error });
   ```

## Monitoring Integration

The structured JSON logs in production can be easily integrated with:

- **AWS CloudWatch**: Use CloudWatch Logs Insights to query JSON logs
- **Datadog**: Automatic parsing of JSON logs with custom facets
- **ELK Stack**: Elasticsearch index for log searching and Kibana dashboards
- **Grafana Loki**: Time-series log aggregation and querying

Example CloudWatch Insights query:
```
fields @timestamp, level, message, userId, error
| filter level = "error"
| sort @timestamp desc
| limit 100
```
