import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import type { HealthCheckResponse } from '@school/shared';
import { env } from './config/env.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { getDbStatus } from './db/connection.js';
import { NotFoundError } from './errors/appError.js';

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: [env.WEB_URL, 'http://localhost:3000'],
    credentials: true,
  })
);
app.use(cookieParser(env.COOKIE_SECRET));
app.use(express.json());
app.use(requestIdMiddleware);
app.use(requestLogger);

const handleHealth = (_req: Request, res: Response) => {
  const dbStatus = getDbStatus();
  const response: HealthCheckResponse = {
    status: dbStatus.status === 'connected' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'school-management-api',
    environment: env.NODE_ENV,
    version: '0.1.0',
    database: dbStatus,
  };

  res.status(response.status === 'ok' ? 200 : 200).json(response);
};

const handleReady = (_req: Request, res: Response) => {
  const dbStatus = getDbStatus();
  if (dbStatus.status === 'connected') {
    res.status(200).json({ status: 'ready', database: 'connected' });
  } else {
    res.status(503).json({ status: 'not_ready', database: dbStatus.status });
  }
};

// Root health & ready probes
app.get('/health', handleHealth);
app.get('/ready', handleReady);

// Prefixed API routes
app.get('/api/health', handleHealth);
app.get('/api/ready', handleReady);

// 404 handler for unmatched routes
app.use((req, _res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
});

// Central RFC 7807 error handler
app.use(errorHandler);

