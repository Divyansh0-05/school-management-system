import { FilterQuery, Types } from 'mongoose';
import { UserRole } from '@school/shared';
import { Student, IStudent } from '../../models/Student.js';
import { TeacherAssignment } from '../../models/TeacherAssignment.js';
import { Enrollment } from '../../models/Enrollment.js';
import { StudentGuardian } from '../../models/StudentGuardian.js';
import { Section } from '../../models/Section.js';
import { Class } from '../../models/Class.js';
import { Guardian } from '../../models/Guardian.js';
import { AcademicYear } from '../../models/AcademicYear.js';
import { AuthTokenPayload } from '../auth/auth.tokens.js';

export interface StudentFilterOptions {
  q?: string;
  status?: string;
  page: number;
  pageSize: number;
}

export class StudentRepository {
  /**
   * Resolves the allowed student ObjectIds for the authenticated user based on role scoping.
   * Returns null if the user has unrestricted access (Admin).
   * Returns an array of ObjectIds if scoped (Teacher/Guardian).
   */
  private async resolveAllowedStudentIds(
    actor: AuthTokenPayload
  ): Promise<Types.ObjectId[] | null> {
    if (actor.role === UserRole.ADMIN) {
      return null; // Unrestricted access
    }

    if (actor.role === UserRole.TEACHER) {
      if (!actor.teacherId) return [];

      // Find sections assigned to teacher
      const assignments = await TeacherAssignment.find({
        teacher_id: new Types.ObjectId(actor.teacherId),
      }).select('section_id');

      const sectionIds = assignments.map((a) => a.section_id);
      if (sectionIds.length === 0) return [];

      // Find active academic year
      const currentYear = await AcademicYear.findOne({ is_current: true });
      const enrollmentFilter: FilterQuery<unknown> = {
        section_id: { $in: sectionIds },
      };
      if (currentYear) {
        enrollmentFilter.academic_year_id = currentYear._id;
      }

      const enrollments = await Enrollment.find(enrollmentFilter).select('student_id');
      return enrollments.map((e) => e.student_id);
    }

    if (actor.role === UserRole.GUARDIAN) {
      if (!actor.guardianId) return [];

      const links = await StudentGuardian.find({
        guardian_id: new Types.ObjectId(actor.guardianId),
      }).select('student_id');

      return links.map((l) => l.student_id);
    }

    return [];
  }

  async findScopedStudents(
    actor: AuthTokenPayload,
    options: StudentFilterOptions
  ): Promise<{ students: IStudent[]; total: number }> {
    const allowedIds = await this.resolveAllowedStudentIds(actor);

    const query: FilterQuery<IStudent> = {};

    if (allowedIds !== null) {
      query._id = { $in: allowedIds };
    }

    if (options.status) {
      query.status = options.status;
    }

    if (options.q) {
      const regex = new RegExp(options.q.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
      query.$or = [{ full_name: regex }, { admission_no: regex }];
    }

    const skip = (options.page - 1) * options.pageSize;

    const [students, total] = await Promise.all([
      Student.find(query).sort({ admission_no: 1 }).skip(skip).limit(options.pageSize),
      Student.countDocuments(query),
    ]);

    return { students, total };
  }

  async findScopedStudentById(
    actor: AuthTokenPayload,
    studentId: string
  ): Promise<IStudent | null> {
    if (!Types.ObjectId.isValid(studentId)) {
      return null;
    }

    const allowedIds = await this.resolveAllowedStudentIds(actor);

    const query: FilterQuery<IStudent> = {
      _id: new Types.ObjectId(studentId),
    };

    if (allowedIds !== null) {
      query._id = {
        $in: allowedIds.filter((id) => id.toString() === studentId),
      };
    }

    return Student.findOne(query);
  }

  async getStudentEnrollmentAndGuardians(studentId: Types.ObjectId) {
    const [enrollments, guardianLinks] = await Promise.all([
      Enrollment.find({ student_id: studentId })
        .populate({
          path: 'section_id',
          model: Section,
          populate: { path: 'class_id', model: Class },
        })
        .populate({ path: 'academic_year_id', model: AcademicYear }),
      StudentGuardian.find({ student_id: studentId }).populate({
        path: 'guardian_id',
        model: Guardian,
      }),
    ]);

    return { enrollments, guardianLinks };
  }
}

export const studentRepository = new StudentRepository();

