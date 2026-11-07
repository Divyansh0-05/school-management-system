import { z } from 'zod';

export const FieldErrorSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export type FieldError = z.infer<typeof FieldErrorSchema>;

export const ApiErrorResponseSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number(),
  code: z.string(),
  detail: z.string(),
  errors: z.array(FieldErrorSchema).optional(),
  requestId: z.string(),
});

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

