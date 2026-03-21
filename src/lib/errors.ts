/**
 * Typed application errors.
 *
 * Use these instead of throwing plain Error with magic string messages.
 * Catch blocks can use `instanceof` instead of string matching:
 *
 *   try { ... }
 *   catch (e) {
 *     if (e instanceof UnauthorizedError) return json({ error: "Unauthorized" }, { status: 401 });
 *     if (e instanceof ForbiddenError) return json({ error: e.message }, { status: 403 });
 *   }
 */

export class AppError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
  }
}

/** 401 — No valid session or API key */
export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401);
  }
}

/** 403 — Authenticated but lacks permission */
export class ForbiddenError extends AppError {
  constructor(permission?: string) {
    super(
      permission ? `Forbidden: missing permission ${permission}` : "Forbidden",
      403,
    );
  }
}

/** 404 — Resource not found */
export class NotFoundError extends AppError {
  constructor(resource?: string, id?: string) {
    super(
      resource && id ? `${resource} with ID ${id} not found` : "Not found",
      404,
    );
  }
}

/** 422 — Validation failed */
export class ValidationError extends AppError {
  constructor(message = "Validation failed") {
    super(message, 422);
  }
}

/** 429 — Rate limited */
export class RateLimitError extends AppError {
  constructor(message = "Too many requests") {
    super(message, 429);
  }
}
