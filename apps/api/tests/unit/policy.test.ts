import { describe, it, expect } from 'vitest';
import { UserRole } from '@school/shared';
import { can, PolicyAction } from '../../src/authz/policy.js';
import { AuthTokenPayload } from '../../src/modules/auth/auth.tokens.js';

describe('AuthZ Policy Engine: can(user, action, resource)', () => {
  const adminUser: AuthTokenPayload = {
    sub: 'admin-id-1',
    email: 'admin@school.demo',
    role: UserRole.ADMIN,
    fullName: 'System Administrator',
  };

  const teacherUser: AuthTokenPayload = {
    sub: 'teacher-id-1',
    email: 'teacher1@school.demo',
    role: UserRole.TEACHER,
    fullName: 'Teacher One',
    teacherId: 'teacher-doc-id-1',
  };

  const guardianUser: AuthTokenPayload = {
    sub: 'guardian-id-1',
    email: 'guardian1@school.demo',
    role: UserRole.GUARDIAN,
    fullName: 'Guardian One',
    guardianId: 'guardian-doc-id-1',
  };

  it('rejects unauthenticated requests (undefined user)', () => {
    expect(can(undefined, PolicyAction.STUDENT_READ)).toBe(false);
    expect(can(undefined, PolicyAction.MASTER_DATA_MANAGE)).toBe(false);
  });

  describe('Admin Role', () => {
    it('allows all policy actions for Administrator', () => {
      Object.values(PolicyAction).forEach((action) => {
        expect(can(adminUser, action)).toBe(true);
      });
    });
  });

  describe('Teacher Role', () => {
    it('allows academic, attendance, and exam marks actions', () => {
      expect(can(teacherUser, PolicyAction.STUDENT_READ)).toBe(true);
      expect(can(teacherUser, PolicyAction.ATTENDANCE_READ)).toBe(true);
      expect(can(teacherUser, PolicyAction.ATTENDANCE_MARK)).toBe(true);
      expect(can(teacherUser, PolicyAction.EXAM_RESULTS_VIEW)).toBe(true);
      expect(can(teacherUser, PolicyAction.EXAM_MARKS_ENTER)).toBe(true);
    });

    it('denies master data, invoice, payment, and audit log management', () => {
      expect(can(teacherUser, PolicyAction.MASTER_DATA_MANAGE)).toBe(false);
      expect(can(teacherUser, PolicyAction.INVOICE_MANAGE)).toBe(false);
      expect(can(teacherUser, PolicyAction.PAYMENT_CREATE)).toBe(false);
      expect(can(teacherUser, PolicyAction.AUDIT_READ)).toBe(false);
    });
  });

  describe('Guardian Role', () => {
    it('allows reading student profile, published results, fee invoices, and creating payments', () => {
      expect(can(guardianUser, PolicyAction.STUDENT_READ)).toBe(true);
      expect(can(guardianUser, PolicyAction.ATTENDANCE_READ)).toBe(true);
      expect(can(guardianUser, PolicyAction.EXAM_RESULTS_VIEW)).toBe(true);
      expect(can(guardianUser, PolicyAction.INVOICE_READ)).toBe(true);
      expect(can(guardianUser, PolicyAction.PAYMENT_CREATE)).toBe(true);
    });

    it('denies master data management, attendance marking, and marks entry', () => {
      expect(can(guardianUser, PolicyAction.MASTER_DATA_MANAGE)).toBe(false);
      expect(can(guardianUser, PolicyAction.ATTENDANCE_MARK)).toBe(false);
      expect(can(guardianUser, PolicyAction.EXAM_MARKS_ENTER)).toBe(false);
      expect(can(guardianUser, PolicyAction.INVOICE_MANAGE)).toBe(false);
      expect(can(guardianUser, PolicyAction.AUDIT_READ)).toBe(false);
    });
  });
});

