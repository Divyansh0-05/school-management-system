import type {
  PaginatedResponse,
  StudentResponse,
  StudentDetailResponse,
} from '@school/shared';
import { studentRepository, StudentFilterOptions } from './student.repository.js';
import { AuthTokenPayload } from '../auth/auth.tokens.js';
import { can, PolicyAction } from '../../authz/policy.js';
import { ForbiddenError, NotFoundError } from '../../errors/appError.js';

export class StudentService {
  async listStudents(
    actor: AuthTokenPayload,
    options: StudentFilterOptions
  ): Promise<PaginatedResponse<StudentResponse>> {
    if (!can(actor, PolicyAction.STUDENT_READ)) {
      throw new ForbiddenError('Not authorized to view student records');
    }

    const { students, total } = await studentRepository.findScopedStudents(actor, options);

    const data: StudentResponse[] = students.map((s) => ({
      id: s._id.toString(),
      admissionNo: s.admission_no,
      fullName: s.full_name,
      dob: s.dob.toISOString().split('T')[0],
      gender: s.gender,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));

    const totalPages = Math.ceil(total / options.pageSize) || 1;

    return {
      data,
      meta: {
        page: options.page,
        pageSize: options.pageSize,
        total,
        totalPages,
      },
    };
  }

  async getStudentById(
    actor: AuthTokenPayload,
    studentId: string
  ): Promise<StudentDetailResponse> {
    if (!can(actor, PolicyAction.STUDENT_READ)) {
      throw new ForbiddenError('Not authorized to view student records');
    }

    const student = await studentRepository.findScopedStudentById(actor, studentId);
    if (!student) {
      // 404 returned on out-of-scope records to prevent existence leaks!
      throw new NotFoundError(`Student with ID '${studentId}' was not found`);
    }

    const { enrollments, guardianLinks } =
      await studentRepository.getStudentEnrollmentAndGuardians(student._id);

    const guardians = guardianLinks.map((link) => {
      const g = link.guardian_id as unknown as {
        _id: { toString(): string };
        full_name: string;
        phone: string;
      };
      return {
        id: g._id.toString(),
        fullName: g.full_name,
        phone: g.phone,
        relationship: link.relationship,
        isPrimary: link.is_primary,
      };
    });

    const enrollmentHistory = enrollments.map((e) => {
      const sec = e.section_id as unknown as {
        name: string;
        class_id: { name: string };
      };
      const yr = e.academic_year_id as unknown as { name: string };
      return {
        academicYear: yr?.name || 'Unknown',
        className: sec?.class_id?.name || 'Unknown',
        sectionName: sec?.name || 'Unknown',
        rollNo: e.roll_no,
      };
    });

    return {
      id: student._id.toString(),
      admissionNo: student.admission_no,
      fullName: student.full_name,
      dob: student.dob.toISOString().split('T')[0],
      gender: student.gender,
      status: student.status,
      guardians,
      enrollmentHistory,
      createdAt: student.createdAt.toISOString(),
      updatedAt: student.updatedAt.toISOString(),
    };
  }
}

export const studentService = new StudentService();

