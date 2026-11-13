import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { seed } from '../../src/seed/index.js';
import { env } from '../../src/config/env.js';
import { setupTestDb, teardownTestDb } from '../helpers/testDb.js';
import { Section } from '../../src/models/Section.js';
import { Enrollment } from '../../src/models/Enrollment.js';
import { AttendanceRecord } from '../../src/models/AttendanceRecord.js';
import { AuditLog } from '../../src/models/AuditLog.js';
import { StudentGuardian } from '../../src/models/StudentGuardian.js';
import { auditService } from '../../src/audit/audit.service.js';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: env.SCHOOL_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dayBefore = (days: number) => {
  const date = new Date(`${today()}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
};

describe('attendance API', () => {
  let admin: string[];
  let teacher1: string[];
  let teacher2: string[];
  let guardian1: string[];
  let guardian2: string[];
  let assignedSection: string;
  let otherSection: string;
  let studentIds: string[];

  beforeAll(async () => {
    await setupTestDb();
    await seed(env.MONGODB_TEST_URI);
    await AttendanceRecord.deleteMany({});
    await AuditLog.collection.deleteMany({});
    const [a, t1, t2, g1, g2] = await Promise.all([
      request(app).post('/api/v1/auth/login').send({ email: 'admin@school.demo', password: 'Demo@12345' }),
      request(app).post('/api/v1/auth/login').send({ email: 'teacher1@school.demo', password: 'Demo@12345' }),
      request(app).post('/api/v1/auth/login').send({ email: 'teacher2@school.demo', password: 'Demo@12345' }),
      request(app).post('/api/v1/auth/login').send({ email: 'guardian1@school.demo', password: 'Demo@12345' }),
      request(app).post('/api/v1/auth/login').send({ email: 'guardian2@school.demo', password: 'Demo@12345' }),
    ]);
    admin = a.headers['set-cookie']; teacher1 = t1.headers['set-cookie']; teacher2 = t2.headers['set-cookie']; guardian1 = g1.headers['set-cookie']; guardian2 = g2.headers['set-cookie'];
    const sections = await request(app).get('/api/v1/attendance/sections').set('Cookie', teacher2);
    assignedSection = sections.body.data[0]._id;
    const allSections = await Section.find({}).lean();
    otherSection = allSections.find((section) => section._id.toString() !== assignedSection)!._id.toString();
    const enrollments = await Enrollment.find({ section_id: assignedSection }).sort({ roll_no: 1 }).lean();
    studentIds = enrollments.slice(0, 3).map((enrollment) => enrollment.student_id.toString());
  }, 120000);

  afterAll(async () => teardownTestDb());

  it('enforces assigned-section, guardian-write, and anonymous rules', async () => {
    expect((await request(app).get('/api/v1/attendance/sections').set('Cookie', teacher1)).status).toBe(200);
    expect((await request(app).get(`/api/v1/sections/${otherSection}/students`).set('Cookie', teacher2)).status).toBe(404);
    expect((await request(app).put(`/api/v1/sections/${assignedSection}/attendance`).set('Cookie', guardian1).send({ date: today(), session: 'MORNING', records: [] })).status).toBe(403);
    expect((await request(app).get('/api/v1/attendance/sections')).status).toBe(401);
  });

  it('bulk PUT is idempotent and only audits status changes', async () => {
    const date = today();
    const body = { date, session: 'MORNING', records: studentIds.map((studentId) => ({ studentId, status: 'PRESENT' })) };
    expect((await request(app).put(`/api/v1/sections/${assignedSection}/attendance`).set('Cookie', teacher2).send(body)).status).toBe(200);
    const firstAuditCount = await AuditLog.countDocuments({ entity_type: 'attendance', action: 'CREATE' });
    expect((await request(app).put(`/api/v1/sections/${assignedSection}/attendance`).set('Cookie', teacher2).send(body)).status).toBe(200);
    expect(await AttendanceRecord.countDocuments({ section_id: assignedSection, date, session: 'MORNING' })).toBe(studentIds.length);
    expect(await AuditLog.countDocuments({ entity_type: 'attendance', action: 'CREATE' })).toBe(firstAuditCount);
    const changed = { ...body, records: [{ studentId: studentIds[0], status: 'ABSENT' }, ...body.records.slice(1)] };
    await request(app).put(`/api/v1/sections/${assignedSection}/attendance`).set('Cookie', teacher2).send(changed);
    expect(await AuditLog.countDocuments({ entity_type: 'attendance', action: 'UPDATE' })).toBeGreaterThanOrEqual(1);
  });

  it('rejects duplicate single attendance and validates all records atomically', async () => {
    const date = today();
    const single = { studentId: studentIds[0], sectionId: assignedSection, date, session: 'AFTERNOON', status: 'PRESENT' };
    expect((await request(app).post('/api/v1/attendance').set('Cookie', teacher2).send(single)).status).toBe(201);
    expect((await request(app).post('/api/v1/attendance').set('Cookie', teacher2).send(single)).body.code).toBe('ATTENDANCE_ALREADY_RECORDED');
    const invalid = await request(app).put(`/api/v1/sections/${assignedSection}/attendance`).set('Cookie', teacher2).send({ date: dayBefore(1), session: 'MORNING', records: [{ studentId: studentIds[0], status: 'PRESENT' }, { studentId: studentIds[0], status: 'ABSENT' }] });
    expect(invalid.status).toBe(422);
  });

  it('rejects future, cross-section, and invalid enum records, and handles 50 idempotent requests', async () => {
    const otherEnrollment = await Enrollment.findOne({ section_id: otherSection }).lean();
    expect((await request(app).put(`/api/v1/sections/${assignedSection}/attendance`).set('Cookie', teacher2).send({ date: '2999-01-01', session: 'MORNING', records: [{ studentId: studentIds[0], status: 'PRESENT' }] })).status).toBe(422);
    expect((await request(app).put(`/api/v1/sections/${assignedSection}/attendance`).set('Cookie', teacher2).send({ date: today(), session: 'MORNING', records: [{ studentId: otherEnrollment!.student_id.toString(), status: 'PRESENT' }] })).status).toBe(422);
    expect((await request(app).put(`/api/v1/sections/${assignedSection}/attendance`).set('Cookie', teacher2).send({ date: today(), session: 'MORNING', records: [{ studentId: studentIds[0], status: 'UNKNOWN' }] })).status).toBe(422);
    const body = { date: today(), session: 'AFTERNOON', records: studentIds.map((studentId) => ({ studentId, status: 'LATE' })) };
    const responses = await Promise.all(Array.from({ length: 50 }, () => request(app).put(`/api/v1/sections/${assignedSection}/attendance`).set('Cookie', teacher2).send(body)));
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(await AttendanceRecord.countDocuments({ section_id: assignedSection, date: today(), session: 'AFTERNOON' })).toBe(studentIds.length);
  });

  it('allows admin outside the teacher edit window and rolls back on audit failure', async () => {
    const date = dayBefore(env.ATTENDANCE_EDIT_WINDOW_DAYS + 2);
    const body = { date, session: 'MORNING', records: [{ studentId: studentIds[1], status: 'PRESENT' }] };
    expect((await request(app).put(`/api/v1/sections/${assignedSection}/attendance`).set('Cookie', teacher2).send(body)).body.code).toBe('EDIT_WINDOW_CLOSED');
    expect((await request(app).put(`/api/v1/sections/${assignedSection}/attendance`).set('Cookie', admin).send(body)).status).toBe(200);
    const spy = vi.spyOn(auditService, 'record').mockRejectedValueOnce(new Error('audit unavailable'));
    const rollbackDate = dayBefore(40);
    const response = await request(app).put(`/api/v1/sections/${assignedSection}/attendance`).set('Cookie', admin).send({ date: rollbackDate, session: 'AFTERNOON', records: [{ studentId: studentIds[2], status: 'ABSENT' }] });
    spy.mockRestore();
    expect(response.status).toBe(500);
    expect(await AttendanceRecord.countDocuments({ section_id: assignedSection, date: rollbackDate, session: 'AFTERNOON', student_id: studentIds[2] })).toBe(0);
  });

  it('scopes guardian summaries to linked students', async () => {
    const own = await StudentGuardian.findOne({ guardian_id: (await request(app).get('/api/v1/auth/me').set('Cookie', guardian1)).body.user.guardianId }).lean();
    const other = await StudentGuardian.findOne({ guardian_id: (await request(app).get('/api/v1/auth/me').set('Cookie', guardian2)).body.user.guardianId }).lean();
    expect((await request(app).get(`/api/v1/students/${own!.student_id}/attendance-summary?from=${dayBefore(20)}&to=${today()}`).set('Cookie', guardian1)).status).toBe(200);
    expect((await request(app).get(`/api/v1/students/${other!.student_id}/attendance-summary?from=${dayBefore(20)}&to=${today()}`).set('Cookie', guardian1)).status).toBe(404);
  });
});
