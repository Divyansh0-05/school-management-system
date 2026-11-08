import type { IncomingMessage, ServerResponse } from 'node:http';
import { pinoHttp } from 'pino-http';
import { LOG_REDACT_PATHS, logger } from '../utils/logger.js';

export const requestLogger = pinoHttp({
  logger,
  redact: LOG_REDACT_PATHS,
  genReqId: (req: IncomingMessage) => (req.headers['x-request-id'] as string) || 'unknown',
  customLogLevel: (_req: IncomingMessage, res: ServerResponse, err?: Error) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode === 404) return 'info';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  autoLogging: {
    ignore: (req: IncomingMessage) =>
      req.url === '/health' || req.url === '/ready' || req.url === '/api/health',
  },
});
