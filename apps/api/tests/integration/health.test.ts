import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { setupTestDb, teardownTestDb } from '../helpers/testDb.js';

describe('Health & Observability Endpoints', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('GET /health returns 200 with service metadata and X-Request-ID', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.headers).toHaveProperty('x-request-id');
    expect(res.body).toMatchObject({
      service: 'school-management-api',
      version: '0.1.0',
    });
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('database');
  });

  it('GET /api/health preserves custom incoming X-Request-ID', async () => {
    const customRequestId = 'custom-trace-id-12345';
    const res = await request(app)
      .get('/api/health')
      .set('X-Request-ID', customRequestId);

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBe(customRequestId);
  });

  it('GET /api/nonexistent returns RFC 7807 404 error envelope', async () => {
    const res = await request(app).get('/api/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      type: 'https://school.demo/errors/NOT_FOUND',
      title: 'NotFoundError',
      status: 404,
      code: 'NOT_FOUND',
    });
    expect(res.body).toHaveProperty('detail');
    expect(res.body).toHaveProperty('requestId');
  });
});

