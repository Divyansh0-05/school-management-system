import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb } from '../helpers/testDb.js';

describe('MongoDB $jsonSchema Collection Validators Negative Tests', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('rejects document with invalid string pattern (users: invalid email format)', async () => {
    const rawCollection = mongoose.connection.collection('users');

    await expect(
      rawCollection.insertOne({
        email: 'not-an-email',
        password_hash: 'hash',
        role: 'ADMIN',
        is_active: true,
        failed_logins: 0,
        locked_until: null,
      })
    ).rejects.toThrow(/Document failed validation/);
  });

  it('rejects document with invalid enum value (users: non-existent role)', async () => {
    const rawCollection = mongoose.connection.collection('users');

    await expect(
      rawCollection.insertOne({
        email: 'superadmin@school.demo',
        password_hash: 'hash',
        role: 'SUPER_ADMIN', // not in enum ['ADMIN', 'TEACHER', 'GUARDIAN']
        is_active: true,
        failed_logins: 0,
        locked_until: null,
      })
    ).rejects.toThrow(/Document failed validation/);
  });

  it('rejects document with numeric minimum violation (users: failed_logins < 0)', async () => {
    const rawCollection = mongoose.connection.collection('users');

    await expect(
      rawCollection.insertOne({
        email: 'negative@school.demo',
        password_hash: 'hash',
        role: 'ADMIN',
        is_active: true,
        failed_logins: -1, // minimum: 0
        locked_until: null,
      })
    ).rejects.toThrow(/Document failed validation/);
  });

  it('rejects document missing required field (students: missing admission_no)', async () => {
    const rawCollection = mongoose.connection.collection('students');

    await expect(
      rawCollection.insertOne({
        full_name: 'Incomplete Student',
        dob: new Date('2012-05-15'),
        gender: 'MALE',
        status: 'ACTIVE',
      })
    ).rejects.toThrow(/Document failed validation/);
  });

  it('rejects document with numeric minimum violation (payments: amount_paise <= 0)', async () => {
    const rawCollection = mongoose.connection.collection('payments');

    await expect(
      rawCollection.insertOne({
        invoice_id: new mongoose.Types.ObjectId(),
        amount_paise: 0, // minimum: 1
        method: 'CASH',
        status: 'SUCCEEDED',
        idempotency_key: 'test-key',
        request_hash: 'hash',
        receipt_no: 'REC-TEST-ZERO',
        paid_by_user_id: new mongoose.Types.ObjectId(),
      })
    ).rejects.toThrow(/Document failed validation/);
  });

  it('rejects document with numeric maximum violation (grading_schemes: min_percent > 10000)', async () => {
    const rawCollection = mongoose.connection.collection('grading_schemes');

    await expect(
      rawCollection.insertOne({
        name: 'Invalid Scheme',
        is_default: false,
        grading_bands: [
          {
            min_percent: 10500, // maximum: 10000 (100.00%)
            grade: 'S+',
            grade_point: 500,
            remark: 'Out of bounds',
          },
        ],
      })
    ).rejects.toThrow(/Document failed validation/);
  });

  it('rejects document with invalid string pattern (attendance_records: non YYYY-MM-DD date)', async () => {
    const rawCollection = mongoose.connection.collection('attendance_records');

    await expect(
      rawCollection.insertOne({
        student_id: new mongoose.Types.ObjectId(),
        section_id: new mongoose.Types.ObjectId(),
        date: '08-11-2026', // invalid pattern, requires YYYY-MM-DD
        session: 'MORNING',
        status: 'PRESENT',
        marked_by_user_id: new mongoose.Types.ObjectId(),
      })
    ).rejects.toThrow(/Document failed validation/);
  });
});

