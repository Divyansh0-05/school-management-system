import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { app } from '../../src/app.js';
import { seed } from '../../src/seed/index.js';
import { env } from '../../src/config/env.js';
import { setupTestDb, teardownTestDb } from '../helpers/testDb.js';
import { Class } from '../../src/models/Class.js';
import { Section } from '../../src/models/Section.js';
import { Teacher } from '../../src/models/Teacher.js';
import { Subject } from '../../src/models/Subject.js';
import { AcademicYear } from '../../src/models/AcademicYear.js';
import { AuditLog } from '../../src/models/AuditLog.js';

describe('Master data administration', () => {
  let adminCookie: string[];
  let teacherCookie: string[];
  let guardianCookie: string[];
  beforeAll(async () => {
    await setupTestDb();
    await seed(env.MONGODB_TEST_URI);
    await Class.init();
    adminCookie = (await request(app).post('/api/v1/auth/login').send({ email: 'admin@school.demo', password: 'Demo@12345' })).headers['set-cookie'];
    teacherCookie = (await request(app).post('/api/v1/auth/login').send({ email: 'teacher1@school.demo', password: 'Demo@12345' })).headers['set-cookie'];
    guardianCookie = (await request(app).post('/api/v1/auth/login').send({ email: 'guardian1@school.demo', password: 'Demo@12345' })).headers['set-cookie'];
  });
  afterAll(async () => {
    await AcademicYear.updateMany({}, { $set: { is_current: false } });
    await AcademicYear.updateOne({ name: '2026-2027' }, { $set: { is_current: true } });
    await Class.deleteMany({ name: /^Phase 1B/ });
    await teardownTestDb();
  });

  it('enforces the role matrix for an admin-only resource', async () => {
    expect((await request(app).get('/api/v1/classes')).status).toBe(401);
    expect((await request(app).get('/api/v1/classes').set('Cookie', teacherCookie)).status).toBe(403);
    expect((await request(app).get('/api/v1/classes').set('Cookie', guardianCookie)).status).toBe(403);
    expect((await request(app).get('/api/v1/classes').set('Cookie', adminCookie)).status).toBe(200);
  });

  it('validates, creates, paginates, audits, and rejects duplicate classes', async () => {
    const invalid = await request(app).post('/api/v1/classes').set('Cookie', adminCookie).send({ name: '', level: 0 });
    expect(invalid.status).toBe(422);
    const name = `Phase 1B ${Date.now()}`;
    const created = await request(app).post('/api/v1/classes').set('Cookie', adminCookie).send({ name, level: 12 });
    expect(created.status).toBe(201);
    expect(created.body.data.name).toBe(name);
    expect((await request(app).post('/api/v1/classes').set('Cookie', adminCookie).send({ name, level: 12 })).status).toBe(409);
    const listed = await request(app).get('/api/v1/classes?page=1&pageSize=1').set('Cookie', adminCookie);
    expect(listed.body.meta.pageSize).toBe(1);
    expect(await AuditLog.countDocuments({ entity_type: 'classes', entity_id: created.body.data._id })).toBe(1);
  });

  it('enforces class-subject compatibility and one class teacher per section', async () => {
    const section = await Section.findOne();
    const teacher = await Teacher.findOne();
    const subject = await Subject.findOne();
    const invalidSubject = new Types.ObjectId().toString();
    expect((await request(app).post('/api/v1/teacher-assignments').set('Cookie', adminCookie).send({ teacher_id: teacher!._id, section_id: section!._id, subject_id: invalidSubject })).status).toBe(409);
    const existing = await request(app).get('/api/v1/teacher-assignments').set('Cookie', adminCookie);
    expect(existing.status).toBe(200);
    expect((await request(app).post('/api/v1/teacher-assignments').set('Cookie', adminCookie).send({ teacher_id: teacher!._id, section_id: section!._id, subject_id: subject!._id, is_class_teacher: true })).status).toBe(409);
  });

  it('keeps only one current academic year and validates grading bands', async () => {
    const year = await AcademicYear.findOne({ is_current: true });
    const response = await request(app).post('/api/v1/academic-years').set('Cookie', adminCookie).send({ name: `2030-${Date.now()}`, start_date: '2030-04-01', end_date: '2031-03-31', is_current: true });
    expect(response.status).toBe(201);
    expect(await AcademicYear.countDocuments({ is_current: true })).toBe(1);
    expect((await request(app).post('/api/v1/grading-schemes').set('Cookie', adminCookie).send({ name: `Bad ${Date.now()}`, grading_bands: [{ min_percent: 50, grade: 'A', grade_point: 900, remark: 'A' }] })).status).toBe(409);
    expect(year?._id.toString()).not.toBe(response.body.data._id);
  });

  it('deactivates unreferenced records and blocks referenced records', async () => {
    const cls = await Class.findOne({ name: 'Grade 6' });
    const deleted = await request(app).delete(`/api/v1/classes/${cls!._id}`).set('Cookie', adminCookie);
    expect(deleted.status).toBe(409);
  });
});
