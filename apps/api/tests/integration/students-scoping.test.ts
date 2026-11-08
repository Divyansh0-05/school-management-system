import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { Student } from '../../src/models/Student.js';
import { setupTestDb, teardownTestDb } from '../helpers/testDb.js';
import { seed } from '../../src/seed/index.js';
import { env } from '../../src/config/env.js';

describe('Student Tenancy Scoping & Repository-Level Isolation', () => {
  let adminCookie: string[];
  let teacher1Cookie: string[];
  let teacher2Cookie: string[];
  let guardian1Cookie: string[];
  let guardian2Cookie: string[];

  let child1Id: string; // Leo Davis (child of guardian 1)
  let _child2Id: string; // Maya Davis (child of guardian 1)
  let child3Id: string; // Rohan Patel (child of guardian 2)
  let grade7StudentId: string; // student in Grade 7 (assigned to teacher 3 & 4, NOT teacher 2)

  beforeAll(async () => {
    await setupTestDb();
    await seed(env.MONGODB_TEST_URI);

    // Login each persona to capture auth cookies
    const [adm, t1, t2, g1, g2] = await Promise.all([
      request(app).post('/api/v1/auth/login').send({ email: 'admin@school.demo', password: 'Demo@12345' }),
      request(app).post('/api/v1/auth/login').send({ email: 'teacher1@school.demo', password: 'Demo@12345' }),
      request(app).post('/api/v1/auth/login').send({ email: 'teacher2@school.demo', password: 'Demo@12345' }),
      request(app).post('/api/v1/auth/login').send({ email: 'guardian1@school.demo', password: 'Demo@12345' }),
      request(app).post('/api/v1/auth/login').send({ email: 'guardian2@school.demo', password: 'Demo@12345' }),
    ]);

    adminCookie = adm.headers['set-cookie'];
    teacher1Cookie = t1.headers['set-cookie'];
    teacher2Cookie = t2.headers['set-cookie'];
    guardian1Cookie = g1.headers['set-cookie'];
    guardian2Cookie = g2.headers['set-cookie'];

    // Identify target student IDs from DB
    const [c1, c2, c3, g7] = await Promise.all([
      Student.findOne({ admission_no: 'ADM001' }),
      Student.findOne({ admission_no: 'ADM002' }),
      Student.findOne({ admission_no: 'ADM003' }),
      Student.findOne({ admission_no: 'ADM025' }), // Grade 7 student
    ]);

    child1Id = c1!._id.toString();
    _child2Id = c2!._id.toString();
    child3Id = c3!._id.toString();
    grade7StudentId = g7!._id.toString();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('GET /api/v1/students (List Scoping)', () => {
    it('Admin views all 60 students without tenant filter', async () => {
      const res = await request(app)
        .get('/api/v1/students?pageSize=100')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.meta.total).toBe(60);
      expect(res.body.data.length).toBe(60);
    });

    it('Teacher 1 (assigned 6A and 6B) views only students in assigned sections (20 total)', async () => {
      const res = await request(app)
        .get('/api/v1/students?pageSize=100')
        .set('Cookie', teacher1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.meta.total).toBe(20);
      expect(res.body.data.length).toBe(20);
    });

    it('Teacher 2 (assigned only 6A) views strictly students in 6A (10 total)', async () => {
      const res = await request(app)
        .get('/api/v1/students?pageSize=100')
        .set('Cookie', teacher2Cookie);

      expect(res.status).toBe(200);
      expect(res.body.meta.total).toBe(10);
      expect(res.body.data.length).toBe(10);
    });

    it('Guardian 1 views strictly their 2 linked children (siblings case)', async () => {
      const res = await request(app)
        .get('/api/v1/students')
        .set('Cookie', guardian1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.meta.total).toBe(2);
      expect(res.body.data.map((s: { fullName: string }) => s.fullName).sort()).toEqual([
        'Leo Davis',
        'Maya Davis',
      ]);
    });

    it('Guardian 2 views strictly their 1 linked child (Rohan Patel)', async () => {
      const res = await request(app)
        .get('/api/v1/students')
        .set('Cookie', guardian2Cookie);

      expect(res.status).toBe(200);
      expect(res.body.meta.total).toBe(1);
      expect(res.body.data[0].fullName).toBe('Rohan Patel');
    });

    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/v1/students');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/students/:id (Information Leak Prevention: 404 on out-of-scope)', () => {
    it('Admin can view any student profile by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/students/${child1Id}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.fullName).toBe('Leo Davis');
      expect(res.body.data.guardians.length).toBeGreaterThan(0);
    });

    it('Guardian 1 can view own linked child (Leo Davis)', async () => {
      const res = await request(app)
        .get(`/api/v1/students/${child1Id}`)
        .set('Cookie', guardian1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.fullName).toBe('Leo Davis');
    });

    it('Guardian 1 querying another family child (Rohan Patel) returns 404 NOT FOUND (No Existence Leak)', async () => {
      const res = await request(app)
        .get(`/api/v1/students/${child3Id}`)
        .set('Cookie', guardian1Cookie);

      // Crucial requirement: must return 404 Not Found, NOT 403 Forbidden!
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('Teacher 2 querying a student in an unassigned section (Grade 7) returns 404 NOT FOUND', async () => {
      const res = await request(app)
        .get(`/api/v1/students/${grade7StudentId}`)
        .set('Cookie', teacher2Cookie);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('Non-existent ObjectId format returns 404', async () => {
      const res = await request(app)
        .get('/api/v1/students/507f1f77bcf86cd799439011')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });
});

