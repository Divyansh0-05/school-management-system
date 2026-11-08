import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { setupTestDb, teardownTestDb } from '../helpers/testDb.js';
import { seed } from '../../src/seed/index.js';
import { env } from '../../src/config/env.js';
import { Student } from '../../src/models/Student.js';

interface RouteRoleTestCase {
  method: 'get' | 'post' | 'put' | 'delete';
  path: string;
  role: 'ANONYMOUS' | 'ADMIN' | 'TEACHER' | 'GUARDIAN';
  expectedStatus: number;
  body?: Record<string, unknown>;
}

describe('Route × Role Security Matrix Harness', () => {
  let adminCookie: string[];
  let teacherCookie: string[];
  let guardianCookie: string[];
  let studentId: string;

  beforeAll(async () => {
    await setupTestDb();
    await seed(env.MONGODB_TEST_URI);

    const [adm, t, g] = await Promise.all([
      request(app).post('/api/v1/auth/login').send({ email: 'admin@school.demo', password: 'Demo@12345' }),
      request(app).post('/api/v1/auth/login').send({ email: 'teacher1@school.demo', password: 'Demo@12345' }),
      request(app).post('/api/v1/auth/login').send({ email: 'guardian1@school.demo', password: 'Demo@12345' }),
    ]);

    adminCookie = adm.headers['set-cookie'];
    teacherCookie = t.headers['set-cookie'];
    guardianCookie = g.headers['set-cookie'];

    const student = await Student.findOne({ admission_no: 'ADM001' });
    studentId = student!._id.toString();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  // Table of route x role combinations
  const testCases: RouteRoleTestCase[] = [
    // Observability (Public)
    { method: 'get', path: '/api/health', role: 'ANONYMOUS', expectedStatus: 200 },
    { method: 'get', path: '/api/ready', role: 'ANONYMOUS', expectedStatus: 200 },
    { method: 'get', path: '/api/docs/openapi.json', role: 'ANONYMOUS', expectedStatus: 200 },

    // Auth endpoints
    { method: 'post', path: '/api/v1/auth/logout', role: 'ANONYMOUS', expectedStatus: 200 },
    { method: 'get', path: '/api/v1/auth/me', role: 'ANONYMOUS', expectedStatus: 401 },
    { method: 'get', path: '/api/v1/auth/me', role: 'ADMIN', expectedStatus: 200 },
    { method: 'get', path: '/api/v1/auth/me', role: 'TEACHER', expectedStatus: 200 },
    { method: 'get', path: '/api/v1/auth/me', role: 'GUARDIAN', expectedStatus: 200 },

    // Students listing
    { method: 'get', path: '/api/v1/students', role: 'ANONYMOUS', expectedStatus: 401 },
    { method: 'get', path: '/api/v1/students', role: 'ADMIN', expectedStatus: 200 },
    { method: 'get', path: '/api/v1/students', role: 'TEACHER', expectedStatus: 200 },
    { method: 'get', path: '/api/v1/students', role: 'GUARDIAN', expectedStatus: 200 },

    // Students detail
    { method: 'get', path: '/api/v1/students/__ID__', role: 'ANONYMOUS', expectedStatus: 401 },
    { method: 'get', path: '/api/v1/students/__ID__', role: 'ADMIN', expectedStatus: 200 },
    { method: 'get', path: '/api/v1/students/__ID__', role: 'TEACHER', expectedStatus: 200 },
    { method: 'get', path: '/api/v1/students/__ID__', role: 'GUARDIAN', expectedStatus: 200 },
  ];

  testCases.forEach(({ method, path, role, expectedStatus, body }) => {
    it(`[${role}] ${method.toUpperCase()} ${path} -> ${expectedStatus}`, async () => {
      const resolvedPath = path.replace('__ID__', studentId);
      const req = request(app)[method](resolvedPath);

      if (role === 'ADMIN') req.set('Cookie', adminCookie);
      if (role === 'TEACHER') req.set('Cookie', teacherCookie);
      if (role === 'GUARDIAN') req.set('Cookie', guardianCookie);

      if (body) req.send(body);

      const res = await req;
      expect(res.status).toBe(expectedStatus);
    });
  });
});

