import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorResponse, FieldError } from '@school/shared';
import { AppError } from '../errors/appError.js';
import { logger } from '../utils/logger.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId: string =
    typeof req.id === 'string' && req.id.trim() ? req.id : String(req.id || 'unknown');

  if (err instanceof AppError) {
    const response: ApiErrorResponse = {
      type: `https://school.demo/errors/${err.code}`,
      title: err.name,
      status: err.statusCode,
      code: err.code,
      detail: err.message,
      errors: err.errors,
      requestId,
    };
    res.status(err.statusCode).json(response);
    return;
  }

  if (err instanceof ZodError || (err as { name?: string }).name === 'ZodError') {
    const zodErrors = (err as { errors?: Array<{ path: (string | number)[]; message: string }> }).errors || [];
    const errors: FieldError[] = zodErrors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    const response: ApiErrorResponse = {
      type: 'https://school.demo/errors/VALIDATION_ERROR',
      title: 'ValidationError',
      status: 422,
      code: 'VALIDATION_ERROR',
      detail: 'The provided request payload failed validation checks',
      errors,
      requestId,
    };
    res.status(422).json(response);
    return;
  }

  logger.error({ err, requestId }, 'Unhandled application exception');

  const response: ApiErrorResponse = {
    type: 'https://school.demo/errors/INTERNAL_ERROR',
    title: 'InternalServerError',
    status: 500,
    code: 'INTERNAL_ERROR',
    detail: 'An unexpected internal server error occurred',
    requestId,
  };

  res.status(500).json(response);
}
