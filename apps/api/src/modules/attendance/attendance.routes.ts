import { Router } from 'express';
import { AttendanceBulkBodySchema, AttendanceDateQuerySchema, AttendanceReportQuerySchema, IdParamsSchema, SingleAttendanceBodySchema, StudentAttendanceSummaryQuerySchema } from '@school/shared';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { attendanceController } from './attendance.controller.js';
import { UserRole } from '@school/shared';
import { ForbiddenError } from '../../errors/appError.js';

export const attendanceRouter = Router();
attendanceRouter.use(requireAuth);
const rejectGuardianWrite = (req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => {
  if (req.user?.role === UserRole.GUARDIAN) return next(new ForbiddenError('Guardians cannot record attendance', 'ROLE_NOT_PERMITTED'));
  next();
};
attendanceRouter.get('/attendance/sections', attendanceController.listSections);
attendanceRouter.get('/sections/:id/students', validate({ params: IdParamsSchema }), attendanceController.sectionStudents);
attendanceRouter.get('/sections/:id/attendance', validate({ params: IdParamsSchema, query: AttendanceDateQuerySchema }), attendanceController.getAttendance);
attendanceRouter.put('/sections/:id/attendance', rejectGuardianWrite, validate({ params: IdParamsSchema, body: AttendanceBulkBodySchema }), attendanceController.putAttendance);
attendanceRouter.post('/attendance', rejectGuardianWrite, validate({ body: SingleAttendanceBodySchema }), attendanceController.postAttendance);
attendanceRouter.get('/reports/attendance/section', validate({ query: AttendanceReportQuerySchema }), attendanceController.sectionReport);
attendanceRouter.get('/students/:id/attendance-summary', validate({ params: IdParamsSchema, query: StudentAttendanceSummaryQuerySchema }), attendanceController.studentSummary);
