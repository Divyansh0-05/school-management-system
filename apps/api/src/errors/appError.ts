import type { FieldError } from '@school/shared';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly errors?: FieldError[];

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', errors?: FieldError[]) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', code = 'UNAUTHORIZED') {
    super(message, 401, code);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden action', code = 'FORBIDDEN') {
    super(message, 403, code);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', code = 'CONFLICT') {
    super(message, 409, code);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors?: FieldError[], code = 'VALIDATION_ERROR') {
    super(message, 422, code, errors);
  }
}

export class InvalidStateTransitionError extends AppError {
  constructor(fromState: string, toState: string, code = 'INVALID_STATE_TRANSITION') {
    super(`Cannot transition from state '${fromState}' to '${toState}'`, 409, code);
  }
}

