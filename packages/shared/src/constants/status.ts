export const AttendanceStatus = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  LATE: 'LATE',
  EXCUSED: 'EXCUSED',
} as const;
export type AttendanceStatus = (typeof AttendanceStatus)[keyof typeof AttendanceStatus];

export const AttendanceSession = {
  MORNING: 'MORNING',
  AFTERNOON: 'AFTERNOON',
} as const;
export type AttendanceSession = (typeof AttendanceSession)[keyof typeof AttendanceSession];

export const ExamStatus = {
  DRAFT: 'DRAFT',
  MARKS_OPEN: 'MARKS_OPEN',
  LOCKED: 'LOCKED',
  PUBLISHED: 'PUBLISHED',
} as const;
export type ExamStatus = (typeof ExamStatus)[keyof typeof ExamStatus];

export const InvoiceStatus = {
  DRAFT: 'DRAFT',
  ISSUED: 'ISSUED',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  VOID: 'VOID',
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const PaymentMethod = {
  SIMULATED_CARD: 'SIMULATED_CARD',
  SIMULATED_UPI: 'SIMULATED_UPI',
  CASH: 'CASH',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PaymentStatus = {
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const LedgerEntryType = {
  INVOICE_ISSUED: 'INVOICE_ISSUED',
  PAYMENT: 'PAYMENT',
  REVERSAL: 'REVERSAL',
  INVOICE_VOID: 'INVOICE_VOID',
} as const;
export type LedgerEntryType = (typeof LedgerEntryType)[keyof typeof LedgerEntryType];

