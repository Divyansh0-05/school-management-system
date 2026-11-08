import { UserRole } from '@school/shared';
import { AuthTokenPayload } from '../modules/auth/auth.tokens.js';

export const PolicyAction = {
  // Master data
  MASTER_DATA_MANAGE: 'MASTER_DATA_MANAGE',
  STUDENT_READ: 'STUDENT_READ',
  STUDENT_MANAGE: 'STUDENT_MANAGE',

  // Attendance
  ATTENDANCE_READ: 'ATTENDANCE_READ',
  ATTENDANCE_MARK: 'ATTENDANCE_MARK',

  // Exams
  EXAM_MANAGE: 'EXAM_MANAGE',
  EXAM_MARKS_ENTER: 'EXAM_MARKS_ENTER',
  EXAM_RESULTS_VIEW: 'EXAM_RESULTS_VIEW',

  // Fees
  INVOICE_MANAGE: 'INVOICE_MANAGE',
  INVOICE_READ: 'INVOICE_READ',
  PAYMENT_CREATE: 'PAYMENT_CREATE',

  // Audit
  AUDIT_READ: 'AUDIT_READ',
} as const;

export type PolicyAction = (typeof PolicyAction)[keyof typeof PolicyAction];

export interface PolicyContext {
  sectionId?: string;
  studentId?: string;
  isPublished?: boolean;
}

export function can(
  user: AuthTokenPayload | undefined,
  action: PolicyAction,
  _resource?: string,
  _context?: PolicyContext
): boolean {
  if (!user) return false;

  switch (user.role) {
    case UserRole.ADMIN:
      // Administrators have full access across the system
      return true;

    case UserRole.TEACHER:
      switch (action) {
        case PolicyAction.STUDENT_READ:
        case PolicyAction.ATTENDANCE_READ:
        case PolicyAction.ATTENDANCE_MARK:
        case PolicyAction.EXAM_RESULTS_VIEW:
        case PolicyAction.EXAM_MARKS_ENTER:
          return true;
        default:
          return false;
      }

    case UserRole.GUARDIAN:
      switch (action) {
        case PolicyAction.STUDENT_READ:
        case PolicyAction.ATTENDANCE_READ:
        case PolicyAction.EXAM_RESULTS_VIEW:
        case PolicyAction.INVOICE_READ:
        case PolicyAction.PAYMENT_CREATE:
          return true;
        default:
          return false;
      }

    default:
      return false;
  }
}

