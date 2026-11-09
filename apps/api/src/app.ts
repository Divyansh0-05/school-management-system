import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import type { HealthCheckResponse } from '@school/shared';
import { env } from './config/env.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { getDbStatus } from './db/connection.js';
import { NotFoundError } from './errors/appError.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { studentRouter } from './modules/students/student.routes.js';
import { masterDataRouter } from './modules/master-data/master-data.routes.js';
import { generateOpenApiDocument } from './docs/openapi.js';
import { attendanceRouter } from './modules/attendance/attendance.routes.js';
import { examsRouter } from './modules/exams/exams.routes.js';

export const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false, // Allows Swagger UI to load internal stylesheets and scripts
  })
);
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

  res.status(200).json(response);
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

// OpenAPI Documentation & Swagger UI
const openApiDoc = generateOpenApiDocument();
app.get('/api/docs/openapi.json', (_req: Request, res: Response) => {
  res.status(200).json(openApiDoc);
});
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDoc));

// API v1 Modules
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/students', studentRouter);
app.use('/api/v1', attendanceRouter);
app.use('/api/v1', examsRouter);
app.use('/api/v1', masterDataRouter);

// 404 handler for unmatched routes
app.use((req, _res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
});

// Central RFC 7807 error handler
app.use(errorHandler);
