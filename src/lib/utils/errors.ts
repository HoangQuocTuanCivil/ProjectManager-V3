/**
 * Application error base class with structured error codes and HTTP status.
 * Used in hooks and API routes for consistent error handling.
 * Components catch these and display user-facing messages via toast/i18n.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string = 'UNKNOWN',
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class AuthError extends AppError {
  constructor(message = 'Not authenticated') {
    super(message, 'AUTH_ERROR', 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 'NOT_FOUND', 404);
  }
}
