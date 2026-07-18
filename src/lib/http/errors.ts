/**
 * What this file does:
 * Defines typed application errors so route handlers can map business failures to stable HTTP responses.
 * What calls it:
 * Service files under `src/services/**` and `src/lib/http/route.ts`.
 * What it calls:
 * Native `Error`.
 * One thing a junior engineer would likely get wrong when writing something similar:
 * Throwing plain strings or generic errors, which makes status-code mapping inconsistent.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication is required.") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action.") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "The requested resource was not found.") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message = "The request conflicts with the current resource state.") {
    super(message, 409, "CONFLICT");
  }
}

export class ValidationBoundaryError extends AppError {
  constructor(message = "The request body is invalid.") {
    super(message, 400, "VALIDATION_ERROR");
  }
}

// ⚠️ SENIOR NOTE: Permission failures should stay distinct from missing-resource failures; collapsing both into 404s or
// 403s indiscriminately makes auditability and incident analysis much harder.
