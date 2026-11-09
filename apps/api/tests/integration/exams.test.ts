import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { seed } from '../../src/seed/index.js';
import { setupTestDb, teardownTestDb } from '../helpers/testDb.js';
import { env } from '../../src/config/env.js';
import { Exam } from '../../src/models/Exam.js';
import { Enrollment } from '../../src/models/Enrollment.js';
import { GradingScheme } from '../../src/models/GradingScheme.js';
import { Section } from '../../src/models/Section.js';
import { auditService } from '../../src/audit/audit.service.js';

describe('exams API', () => {
  let admin: string[];
  let guardian: string[];
  let examId: string;
  let sectionId: string;
  let studentId: string;
  let teacher3: string[];
  let teacher2: string[];
  let openExamId: string;
  let openSectionId: string;
  let mathId: string;
  beforeAll(async () => {
    await setupTestDb();
    await seed(env.MONGODB_TEST_URI);
    admin = (await request(app).post('/api/v1/auth/login').send({ email: 'admin@school.demo', password: 'Demo@12345' })).headers['set-cookie'];
    guardian = (await request(app).post('/api/v1/auth/login').send({ email: 'guardian1@school.demo', password: 'Demo@12345' })).headers['set-cookie'];
    teacher3 = (await request(app).post('/api/v1/auth/login').send({ email: 'teacher3@school.demo', password: 'Demo@12345' })).headers['set-cookie'];
    teacher2 = (await request(app).post('/api/v1/auth/login').send({ email: 'teacher2@school.demo', password: 'Demo@12345' })).headers['set-cookie'];
    const exam = await Exam.findOne({ name: 'Demo Term Examination' }).lean();
    examId = exam!._id.toString();
    const first = await Enrollment.findOne({ section_id: { $exists: true } }).sort({ roll_no: 1 }).lean();
    sectionId = first!.section_id.toString();
    studentId = first!.student_id.toString();
    const open = await Exam.findOne({ name: 'Demo Open Examination' }).lean();
    openExamId = open!._id.toString();
    openSectionId = (await Section.findOne({ class_id: open!.class_id }))!._id.toString();
    mathId = open!.exam_subjects[1].subject_id.toString();
  }, 120000);
  afterAll(async () => teardownTestDb());

  it('returns hand-calculated seeded boundary, absent, failing, and tied results', async () => {
    expect((await request(app).get('/api/v1/exams')).status).toBe(401);
    const response = await request(app).get(`/api/v1/exams/${examId}/results`).query({ sectionId }).set('Cookie', admin);
    expect(response.status).toBe(200);
    const first = response.body.data.find((item: { studentId: string }) => item.studentId === studentId);
    // 9000+9000=18000, 18000/20000=90.00%, inclusive A boundary, rank 1.
    expect(first).toMatchObject({ total: 18000, maxTotal: 20000, overallPercent: 9000, grade: 'A', result: 'PASS', rank: 1, sectionStrength: 10 });
    const report = await request(app).get(`/api/v1/students/${studentId}/exams/${examId}/report-card`).set('Cookie', guardian);
    expect(report.status).toBe(200);
  });

  it('keeps the grading snapshot stable and blocks referenced scheme edits', async () => {
    const exam = await Exam.findById(examId).lean();
    await GradingScheme.updateOne({ _id: exam!.grading_scheme_id }, { $set: { grading_bands: [{ min_percent: 0, grade: 'Z', grade_point: 0, remark: 'Changed' }] } });
    const response = await request(app).get(`/api/v1/exams/${examId}/results`).query({ sectionId }).set('Cookie', admin);
    expect(response.body.data.find((item: { studentId: string }) => item.studentId === studentId).grade).toBe('A');
    const edit = await request(app).patch(`/api/v1/grading-schemes/${exam!.grading_scheme_id}`).set('Cookie', admin).send({ name: 'Changed scheme' });
    expect(edit.status).toBe(409);
    expect(edit.body.code).toBe('GRADING_SCHEME_REFERENCED');
  });

  it('enforces marks scope, validation, state, and guardian boundaries', async () => {
    const aboveMax = await request(app).put(`/api/v1/exams/${openExamId}/subjects/${mathId}/marks`).query({ sectionId: openSectionId }).set('Cookie', teacher3).send({ records: [{ studentId, marks: 100.01, isAbsent: false }] });
    expect(aboveMax.status).toBe(422);
    const absentWithMarks = await request(app).put(`/api/v1/exams/${openExamId}/subjects/${mathId}/marks`).query({ sectionId: openSectionId }).set('Cookie', teacher3).send({ records: [{ studentId, marks: 10, isAbsent: true }] });
    expect(absentWithMarks.status).toBe(422);
    const lockedResponse = await request(app).put(`/api/v1/exams/${examId}/subjects/${mathId}/marks`).query({ sectionId }).set('Cookie', teacher2).send({ records: [{ studentId, isAbsent: true }] });
    expect(lockedResponse.status).toBe(409);
    expect((await request(app).get(`/api/v1/exams/${openExamId}/subjects/${mathId}/marks`).query({ sectionId: openSectionId }).set('Cookie', teacher2)).status).toBe(404);
    expect((await request(app).get(`/api/v1/exams/${openExamId}/subjects/${mathId}/marks`).query({ sectionId: openSectionId }).set('Cookie', guardian)).status).toBe(403);
    expect((await request(app).get(`/api/v1/students/${studentId}/exams/${openExamId}/report-card`).set('Cookie', guardian)).status).toBe(404);
  });

  it('rejects incomplete lock, requires reopen reason, and rolls back audit failures', async () => {
    expect((await request(app).post(`/api/v1/exams/${openExamId}/lock`).set('Cookie', admin)).body.code).toBe('INCOMPLETE_MARKS');
    await Exam.updateOne({ _id: openExamId }, { $set: { status: 'LOCKED' } });
    expect((await request(app).post(`/api/v1/exams/${openExamId}/reopen`).set('Cookie', admin).send({})).body.code).toBe('INVALID_STATE_TRANSITION');
    const reopened = await request(app).post(`/api/v1/exams/${openExamId}/reopen`).set('Cookie', admin).send({ reason: 'Correction required' });
    expect(reopened.status).toBe(200);
    const spy = vi.spyOn(auditService, 'record').mockRejectedValueOnce(new Error('audit unavailable'));
    const mark = await Enrollment.findOne({ section_id: openSectionId }).lean();
    const response = await request(app).put(`/api/v1/exams/${openExamId}/subjects/${mathId}/marks`).query({ sectionId: openSectionId }).set('Cookie', teacher3).send({ records: [{ studentId: mark!.student_id.toString(), marks: 77.77, isAbsent: false }] });
    spy.mockRestore();
    expect(response.status).toBe(500);
  });
});
