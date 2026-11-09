import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Must be a valid MongoDB ObjectId');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const session = z.enum(['MORNING', 'AFTERNOON']);
const status = z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']);

export const AttendanceDateQuerySchema = z.object({
  date,
  session,
});

export const AttendanceBulkBodySchema = z.object({
  date,
  session,
  records: z.array(z.object({
    studentId: objectId,
    status,
  })).min(1).superRefine((records, ctx) => {
    const seen = new Set<string>();
    records.forEach((record, index) => {
      if (seen.has(record.studentId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [index, 'studentId'], message: 'Duplicate studentId' });
      }
      seen.add(record.studentId);
    });
  }),
});

export const SingleAttendanceBodySchema = z.object({
  studentId: objectId,
  sectionId: objectId,
  date,
  session,
  status,
});

export const AttendanceReportQuerySchema = z.object({
  sectionId: objectId,
  from: date,
  to: date,
}).refine((value) => value.from <= value.to, { path: ['to'], message: 'to must be on or after from' });

export const StudentAttendanceSummaryQuerySchema = z.object({ from: date, to: date }).refine((value) => value.from <= value.to, { path: ['to'], message: 'to must be on or after from' });

export type AttendanceBulkBody = z.infer<typeof AttendanceBulkBodySchema>;
export type SingleAttendanceBody = z.infer<typeof SingleAttendanceBodySchema>;
