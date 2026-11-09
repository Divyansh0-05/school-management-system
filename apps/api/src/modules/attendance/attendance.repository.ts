import { ClientSession, Types } from 'mongoose';
import { UserRole } from '@school/shared';
import { AcademicYear } from '../../models/AcademicYear.js';
import { AttendanceRecord, IAttendanceRecord } from '../../models/AttendanceRecord.js';
import { Enrollment } from '../../models/Enrollment.js';
import { Section } from '../../models/Section.js';
import { Student } from '../../models/Student.js';
import { StudentGuardian } from '../../models/StudentGuardian.js';
import { TeacherAssignment } from '../../models/TeacherAssignment.js';
import type { AuthTokenPayload } from '../auth/auth.tokens.js';

type SectionStudent = { _id: Types.ObjectId; [key: string]: unknown };

export class AttendanceRepository {
  async currentYear(session?: ClientSession) {
    return AcademicYear.findOne({ is_current: true }).session(session || null).lean();
  }

  async findSectionForActor(actor: AuthTokenPayload, sectionId: string, session?: ClientSession) {
    if (!Types.ObjectId.isValid(sectionId)) return null;
    const section = await Section.findById(sectionId).session(session || null).lean();
    if (!section) return null;
    if (actor.role === UserRole.ADMIN) return section;
    if (actor.role === UserRole.TEACHER && actor.teacherId) {
      const assigned = await TeacherAssignment.exists({ teacher_id: actor.teacherId, section_id: section._id }).session(session || null);
      return assigned ? section : null;
    }
    if (actor.role === UserRole.GUARDIAN && actor.guardianId) {
      const linked = await StudentGuardian.exists({ guardian_id: actor.guardianId }).session(session || null);
      if (!linked) return null;
      const year = await this.currentYear(session);
      const enrollment = year && await Enrollment.exists({ section_id: section._id, academic_year_id: year._id, student_id: { $in: (await StudentGuardian.find({ guardian_id: actor.guardianId }).select('student_id').session(session || null)).map((item) => item.student_id) } }).session(session || null);
      return enrollment ? section : null;
    }
    return null;
  }

  async currentEnrollments(sectionId: string, session?: ClientSession) {
    const year = await this.currentYear(session);
    if (!year) return { year: null, enrollments: [] };
    const enrollments = await Enrollment.find({ section_id: sectionId, academic_year_id: year._id }).session(session || null).lean();
    return { year, enrollments };
  }

  async studentsForSection(actor: AuthTokenPayload, sectionId: string, session?: ClientSession): Promise<SectionStudent[]> {
    const { enrollments } = await this.currentEnrollments(sectionId, session);
    let allowed = enrollments;
    if (actor.role === UserRole.GUARDIAN && actor.guardianId) {
      const links = await StudentGuardian.find({ guardian_id: actor.guardianId }).select('student_id').session(session || null).lean();
      const ids = new Set(links.map((link) => link.student_id.toString()));
      allowed = enrollments.filter((enrollment) => ids.has(enrollment.student_id.toString()));
    }
    const students = await Student.find({ _id: { $in: allowed.map((item) => item.student_id) } }).sort({ admission_no: 1 }).session(session || null).lean();
    return students.map((student) => ({ ...student, enrollment: allowed.find((item) => item.student_id.toString() === student._id.toString()) })) as SectionStudent[];
  }

  async attendanceForSection(sectionId: string, date: string, sessionName: string, actor: AuthTokenPayload): Promise<unknown[]> {
    const students = await this.studentsForSection(actor, sectionId);
    const records = await AttendanceRecord.find({ section_id: sectionId, date, session: sessionName }).lean();
    const byStudent = new Map(records.map((record) => [record.student_id.toString(), record]));
    return students.map((student) => ({ student, attendance: byStudent.get(student._id.toString()) || null }));
  }

  async upsert(record: Record<string, unknown>, session: ClientSession) {
    return AttendanceRecord.findOneAndUpdate(
      { student_id: record.student_id, date: record.date, session: record.session },
      { $set: record },
      { upsert: true, new: true, session }
    );
  }

  async findOne(studentId: string, date: string, sessionName: string, session?: ClientSession) {
    return AttendanceRecord.findOne({ student_id: studentId, date, session: sessionName }).session(session || null).lean();
  }

  async create(record: Record<string, unknown>, session: ClientSession) {
    const docs = await AttendanceRecord.create([record], { session });
    return docs[0].toObject() as IAttendanceRecord;
  }

  async recordsForSection(sectionId: string, from: string, to: string) {
    return AttendanceRecord.find({ section_id: sectionId, date: { $gte: from, $lte: to } }).sort({ date: 1 }).lean();
  }

  async recordsForStudent(studentId: string, from: string, to: string) {
    return AttendanceRecord.find({ student_id: studentId, date: { $gte: from, $lte: to } }).sort({ date: 1 }).lean();
  }
}

export const attendanceRepository = new AttendanceRepository();
