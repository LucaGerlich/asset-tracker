/**
 * Typed application errors.
 *
 * Use these instead of throwing plain Error with magic string messages.
 * Catch blocks can use `instanceof` instead of string matching:
 *
 *   } catch (error) {
 *     const denied = apiErrorResponse(error);
 *     if (denied) return denied;
 *     ...
 */

import { NextResponse } from "next/server";

export type ForbiddenCode =
  | "org_locked"
  | "org_read_only"
  | "not_admin"
  | "not_super_admin"
  | "insufficient_permission"
  | "api_key_scope"
  | "request_permission"
  | "feature_not_entitled";

export class AppError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
  }
}

/** 401: no valid session or API key */
export class UnauthorizedError extends AppError {
  readonly code = "unauthorized";

  constructor(message = "Unauthorized") {
    super(message, 401);
  }
}

/**
 * 403: authenticated but not allowed. The message keeps the historic
 * "Forbidden: " prefix so existing `message.startsWith("Forbidden")`
 * catch blocks keep mapping it to 403.
 */
export class ForbiddenError extends AppError {
  readonly code: ForbiddenCode;

  constructor(code: ForbiddenCode, message: string) {
    super(`Forbidden: ${message}`, 403);
    this.code = code;
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

/**
 * Map guard errors to a JSON response. Returns null for anything else, so the
 * caller keeps its own 404/409/500 handling:
 *
 *   } catch (error) {
 *     const denied = apiErrorResponse(error);
 *     if (denied) return denied;
 *     ...
 */
export function apiErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode },
    );
  }
  return null;
}
