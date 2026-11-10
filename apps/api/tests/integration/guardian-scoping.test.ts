import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { seed } from '../../src/seed/index.js';
import { setupTestDb, teardownTestDb } from '../helpers/testDb.js';
import { env } from '../../src/config/env.js';
import { Exam, Guardian, Invoice, StudentGuardian, User } from '../../src/models/index.js';

describe('guardian scoping across modules', () => {
  let guardian1: string[]; let admin: string[];
  let ownStudent: string; let otherStudent: string; let invoiceId: string; let publishedExamId: string; let openExamId: string;
  beforeAll(async () => {
    await setupTestDb(); await seed(env.MONGODB_TEST_URI);
    const login = async (email: string) => (await request(app).post('/api/v1/auth/login').send({ email, password: 'Demo@12345' })).headers['set-cookie'] as string[];
    [guardian1, admin] = await Promise.all([login('guardian1@school.demo'), login('admin@school.demo')]);
    const g1 = await Guardian.findOne({ user_id: (await User.findOne({ email: 'guardian1@school.demo' }))!._id }).lean();
    const g2 = await Guardian.findOne({ user_id: (await User.findOne({ email: 'guardian2@school.demo' }))!._id }).lean();
    ownStudent = (await StudentGuardian.findOne({ guardian_id: g1!._id }).lean())!.student_id.toString();
    otherStudent = (await StudentGuardian.findOne({ guardian_id: g2!._id }).lean())!.student_id.toString();
    invoiceId = (await Invoice.findOne({ student_id: ownStudent }).lean())!._id.toString();
    publishedExamId = (await Exam.findOne({ status: 'PUBLISHED' }).lean())!._id.toString();
    openExamId = (await Exam.findOne({ status: 'MARKS_OPEN' }).lean())!._id.toString();
  }, 120000);
  afterAll(async () => teardownTestDb());

  it('guardian1 reads linked child resources and guardian2 gets 404 for the other family', async () => {
    const own = [
      request(app).get(`/api/v1/students/${ownStudent}`).set('Cookie', guardian1),
      request(app).get(`/api/v1/students/${ownStudent}/attendance-summary?from=2026-01-01&to=2027-01-01`).set('Cookie', guardian1),
      request(app).get(`/api/v1/students/${ownStudent}/exams/${publishedExamId}/report-card`).set('Cookie', guardian1),
      request(app).get('/api/v1/invoices').query({ studentId: ownStudent }).set('Cookie', guardian1),
      request(app).get('/api/v1/payments').set('Cookie', guardian1),
      request(app).get(`/api/v1/students/${ownStudent}/ledger`).set('Cookie', guardian1),
    ];
    expect((await Promise.all(own)).map((response) => response.status)).toEqual([200, 200, 200, 200, 200, 200]);
    const other = await Promise.all([
      request(app).get(`/api/v1/students/${otherStudent}`).set('Cookie', guardian1),
      request(app).get(`/api/v1/students/${otherStudent}/attendance-summary?from=2026-01-01&to=2027-01-01`).set('Cookie', guardian1),
      request(app).get(`/api/v1/students/${otherStudent}/exams/${publishedExamId}/report-card`).set('Cookie', guardian1),
      request(app).get(`/api/v1/students/${otherStudent}/ledger`).set('Cookie', guardian1),
    ]);
    expect(other.map((response) => response.status)).toEqual([404, 404, 404, 404]);
  });

  it('blocks unpublished report cards, admin routes for guardians, and anonymous access', async () => {
    expect((await request(app).get(`/api/v1/students/${ownStudent}/exams/${openExamId}/report-card`).set('Cookie', guardian1)).status).toBe(404);
    expect((await request(app).get('/api/v1/dashboard/admin').set('Cookie', guardian1)).status).toBe(403);
    expect((await request(app).get('/api/v1/audit-logs').set('Cookie', guardian1)).status).toBe(403);
    expect((await request(app).get('/api/v1/dashboard/admin')).status).toBe(401);
    expect((await request(app).get('/api/v1/audit-logs')).status).toBe(401);
    expect((await request(app).get(`/api/v1/invoices/${invoiceId}`).set('Cookie', admin)).status).toBe(200);
  });
});
