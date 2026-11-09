import { Types } from 'mongoose';
import { UserRole } from '@school/shared';
import type { AttendanceBulkBody, SingleAttendanceBody } from '@school/shared';
import { withTransaction } from '../../db/connection.js';
import { recordAuditLog } from '../../audit/audit.service.js';
import { AcademicYear } from '../../models/AcademicYear.js';
import { Enrollment } from '../../models/Enrollment.js';
import { Section } from '../../models/Section.js';
import { TeacherAssignment } from '../../models/TeacherAssignment.js';
import { StudentGuardian } from '../../models/StudentGuardian.js';
import { ForbiddenError, ConflictError, NotFoundError, ValidationError } from '../../errors/appError.js';
import type { AuthTokenPayload } from '../auth/auth.tokens.js';
import { attendanceRepository } from './attendance.repository.js';
import { summarizeByDate } from './attendance.summary.js';
import { env } from '../../config/env.js';

const localDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: env.SCHOOL_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const ensureDate = (date: string) => {
  if (!validDate(date) || date > localDate()) throw new ValidationError('Attendance date must not be in the future', [{ path: 'date', message: 'Date must be a valid non-future calendar date' }]);
};

export class AttendanceService {
  private async ensureSection(actor: AuthTokenPayload, sectionId: string) {
    const section = await attendanceRepository.findSectionForActor(actor, sectionId);
    if (!section) throw new NotFoundError('Section was not found');
    return section;
  }

  private async ensureWindow(actor: AuthTokenPayload, date: string) {
    if (actor.role !== UserRole.TEACHER) return;
    const today = Date.parse(`${localDate()}T00:00:00Z`);
    const target = Date.parse(`${date}T00:00:00Z`);
    if (target < today - env.ATTENDANCE_EDIT_WINDOW_DAYS * 86400000) throw new ForbiddenError('Teacher attendance edit window is closed', 'EDIT_WINDOW_CLOSED');
  }

  private async enrolledIds(sectionId: string, ids: string[], session?: import('mongoose').ClientSession) {
    const { enrollments } = await attendanceRepository.currentEnrollments(sectionId, session);
    const active = new Set(enrollments.map((item) => item.student_id.toString()));
    const invalid = ids.filter((id) => !active.has(id));
    if (invalid.length) throw new ValidationError('All students must be actively enrolled in this section for the current academic year', invalid.map((id) => ({ path: 'records.studentId', message: `${id} is not enrolled in this section` })));
    return enrollments;
  }

  async listSections(actor: AuthTokenPayload) {
    if (actor.role === UserRole.ADMIN) return Section.find({}).sort({ name: 1 }).lean();
    if (actor.role === UserRole.TEACHER && actor.teacherId) {
      const assignments = await TeacherAssignment.find({ teacher_id: actor.teacherId }).select('section_id').lean();
      return Section.find({ _id: { $in: assignments.map((item) => item.section_id) } }).sort({ name: 1 }).lean();
    }
    if (actor.role === UserRole.GUARDIAN && actor.guardianId) {
      const links = await StudentGuardian.find({ guardian_id: actor.guardianId }).select('student_id').lean();
      const year = await AcademicYear.findOne({ is_current: true }).lean();
      const enrollments = year ? await Enrollment.find({ academic_year_id: year._id, student_id: { $in: links.map((item) => item.student_id) } }).select('section_id').lean() : [];
      return Section.find({ _id: { $in: enrollments.map((item) => item.section_id) } }).sort({ name: 1 }).lean();
    }
    return [];
  }

  async sectionStudents(actor: AuthTokenPayload, sectionId: string): Promise<unknown> {
    await this.ensureSection(actor, sectionId);
    return attendanceRepository.studentsForSection(actor, sectionId);
  }

  async getAttendance(actor: AuthTokenPayload, sectionId: string, date: string, session: string): Promise<unknown> {
    ensureDate(date);
    await this.ensureSection(actor, sectionId);
    return attendanceRepository.attendanceForSection(sectionId, date, session, actor);
  }

  private async bulkAttempt(actor: AuthTokenPayload, sectionId: string, body: AttendanceBulkBody, requestId: string, ip: string) {
    return withTransaction(async (session) => {
      await this.ensureSection(actor, sectionId);
      await this.enrolledIds(sectionId, body.records.map((record) => record.studentId), session);
      const results = [];
      for (const record of body.records) {
        const previous = await attendanceRepository.findOne(record.studentId, body.date, body.session, session);
        const saved = await attendanceRepository.upsert({
          student_id: new Types.ObjectId(record.studentId),
          section_id: new Types.ObjectId(sectionId),
          date: body.date,
          session: body.session,
          status: record.status,
          marked_by_user_id: new Types.ObjectId(actor.sub),
          marked_at: new Date(),
        }, session);
        const value = saved;
        if (!previous || previous.status !== record.status) {
          await recordAuditLog({ actor, action: previous ? 'UPDATE' : 'CREATE', entityType: 'attendance', entityId: String(value._id), before: previous as unknown as Record<string, unknown> || null, after: value as unknown as Record<string, unknown>, requestId, ip, session });
        }
        results.push(value);
      }
      return results;
    });
  }

  async putAttendance(actor: AuthTokenPayload, sectionId: string, body: AttendanceBulkBody, requestId: string, ip: string) {
    if (actor.role === UserRole.GUARDIAN) throw new ForbiddenError('Guardians cannot record attendance', 'ROLE_NOT_PERMITTED');
    ensureDate(body.date);
    await this.ensureWindow(actor, body.date);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.bulkAttempt(actor, sectionId, body, requestId, ip);
      } catch (error: unknown) {
        if ((error as { code?: number }).code !== 11000 || attempt === 2) throw error;
      }
    }
    throw new ConflictError('Attendance could not be recorded safely', 'ATTENDANCE_CONFLICT');
  }

  async postAttendance(actor: AuthTokenPayload, body: SingleAttendanceBody, requestId: string, ip: string) {
    if (actor.role === UserRole.GUARDIAN) throw new ForbiddenError('Guardians cannot record attendance', 'ROLE_NOT_PERMITTED');
    ensureDate(body.date);
    await this.ensureWindow(actor, body.date);
    await this.ensureSection(actor, body.sectionId);
    await this.enrolledIds(body.sectionId, [body.studentId]);
    return withTransaction(async (session) => {
      if (await attendanceRepository.findOne(body.studentId, body.date, body.session, session)) throw new ConflictError('Attendance was already recorded', 'ATTENDANCE_ALREADY_RECORDED');
      try {
        const created = await attendanceRepository.create({ student_id: new Types.ObjectId(body.studentId), section_id: new Types.ObjectId(body.sectionId), date: body.date, session: body.session, status: body.status, marked_by_user_id: new Types.ObjectId(actor.sub), marked_at: new Date() }, session);
        await recordAuditLog({ actor, action: 'CREATE', entityType: 'attendance', entityId: created._id.toString(), after: created as unknown as Record<string, unknown>, requestId, ip, session });
        return created;
      } catch (error: unknown) {
        if ((error as { code?: number }).code === 11000) throw new ConflictError('Attendance was already recorded', 'ATTENDANCE_ALREADY_RECORDED');
        throw error;
      }
    });
  }

  async sectionReport(actor: AuthTokenPayload, sectionId: string, from: string, to: string) {
    await this.ensureSection(actor, sectionId);
    const records = await attendanceRepository.recordsForSection(sectionId, from, to);
    const visible = actor.role === UserRole.GUARDIAN && actor.guardianId
      ? new Set((await StudentGuardian.find({ guardian_id: actor.guardianId }).select('student_id').lean()).map((item) => item.student_id.toString()))
      : null;
    const grouped = new Map<string, typeof records>();
    records.filter((record) => !visible || visible.has(record.student_id.toString())).forEach((record) => {
      const key = record.student_id.toString();
      grouped.set(key, [...(grouped.get(key) || []), record]);
    });
    return [...grouped.entries()].map(([studentId, items]) => ({ studentId, ...summarizeByDate(items) }));
  }

  async studentSummary(actor: AuthTokenPayload, studentId: string, from: string, to: string) {
    if (!Types.ObjectId.isValid(studentId)) throw new NotFoundError('Student was not found');
    if (actor.role === UserRole.GUARDIAN) {
      const linked = await StudentGuardian.exists({ guardian_id: actor.guardianId, student_id: studentId });
      if (!linked) throw new NotFoundError('Student was not found');
    } else if (actor.role === UserRole.TEACHER) {
      const year = await AcademicYear.findOne({ is_current: true }).lean();
      const assignments = await TeacherAssignment.find({ teacher_id: actor.teacherId }).select('section_id').lean();
      const enrolled = year && await Enrollment.exists({ student_id: studentId, academic_year_id: year._id, section_id: { $in: assignments.map((item) => item.section_id) } });
      if (!enrolled) throw new NotFoundError('Student was not found');
    }
    const records = await attendanceRepository.recordsForStudent(studentId, from, to);
    return { studentId, ...summarizeByDate(records) };
  }
}

export const attendanceService = new AttendanceService();
