import pino from 'pino';
import { env } from '../config/env.js';

export const LOG_REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers.x-api-key',
  'res.headers.set-cookie',
  'req.body.password',
  'req.body.password_hash',
  'req.body.token',
  'req.body.access_token',
  'req.body.refresh_token',
  'req.body.hash',
  'res.body.password',
  'res.body.password_hash',
  'res.body.token',
  'res.body.access_token',
  'res.body.refresh_token',
  'res.body.hash',
  '*.password',
  '*.password_hash',
  '*.token',
  '*.access_token',
  '*.refresh_token',
  '*.hash',
];

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: LOG_REDACT_PATHS,
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});
