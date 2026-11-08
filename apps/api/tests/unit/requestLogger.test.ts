import { describe, expect, it } from 'vitest';
import express from 'express';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import request from 'supertest';
import { LOG_REDACT_PATHS } from '../../src/utils/logger.js';

describe('request logger redaction', () => {
  it('does not serialize cookie, authorization, API key, password, token, or hash values', async () => {
    let output = '';
    const stream = {
      write: (chunk: string) => {
        output += chunk;
        return true;
      },
    };
    const testLogger = pino({ level: 'info', redact: LOG_REDACT_PATHS }, stream);
    const testApp = express();
    testApp.use(
      pinoHttp({
        logger: testLogger,
        redact: LOG_REDACT_PATHS,
        customLogLevel: (_req, res) => (res.statusCode === 404 ? 'info' : 'info'),
      })
    );
    testApp.get('/secret', (_req, res) => {
      res.setHeader('Set-Cookie', 'response-secret-cookie');
      res.status(404).json({
        password: 'response-password',
        token: 'response-token',
        hash: 'response-hash',
      });
    });

    await request(testApp)
      .get('/secret')
      .set('Cookie', 'request-secret-cookie')
      .set('Authorization', 'Bearer request-secret-token')
      .set('X-API-Key', 'request-secret-api-key')
      .send({
        password: 'request-password',
        token: 'request-token',
        hash: 'request-hash',
      });

    expect(output).not.toContain('request-secret-cookie');
    expect(output).not.toContain('request-secret-token');
    expect(output).not.toContain('request-secret-api-key');
    expect(output).not.toContain('response-secret-cookie');
    expect(output).not.toContain('response-password');
    expect(output).not.toContain('response-token');
    expect(output).not.toContain('response-hash');
    expect(output).toContain('"level":30');
    expect(output).toContain('"statusCode":404');
  });
});
