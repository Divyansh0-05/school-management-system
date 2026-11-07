import { z } from 'zod';

export const HealthCheckResponseSchema = z.object({
  status: z.enum(['ok', 'degraded', 'down']),
  timestamp: z.string(),
  uptime: z.number(),
  service: z.string(),
  environment: z.string(),
  version: z.string(),
  database: z.object({
    status: z.enum(['connected', 'disconnected', 'connecting']),
    replicaSet: z.string().optional(),
  }),
});

export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

