import bcrypt from 'bcryptjs';
import { ClientSession, Types } from 'mongoose';
import { UserRole } from '@school/shared';
import { AuthTokenPayload } from '../auth/auth.tokens.js';
import { User } from '../../models/User.js';
import { Exam } from '../../models/Exam.js';
import { ClassSubject } from '../../models/ClassSubject.js';
import { Section } from '../../models/Section.js';
import { withTransaction } from '../../db/connection.js';
import { recordAuditLog } from '../../audit/audit.service.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../errors/appError.js';
import { masterDataRepository, LooseDocument } from './master-data.repository.js';

const temporaryPassword = 'ChangeMe!123';
const toDb = (data: Record<string, unknown>) => {
  const result = { ...data };
  for (const key of ['class_id', 'academic_year_id', 'student_id', 'section_id', 'teacher_id', 'subject_id', 'guardian_id']) {
    if (typeof result[key] === 'string') result[key] = new Types.ObjectId(result[key]);
  }
  return result;
};

export class MasterDataService {
  private ensureAdmin(actor: AuthTokenPayload) {
    if (actor.role !== UserRole.ADMIN) throw new ForbiddenError('Administrator role required', 'ROLE_NOT_PERMITTED');
  }

  async list(actor: AuthTokenPayload, resource: string, options: { page: number; pageSize: number; q?: string; sort?: string }) {
    this.ensureAdmin(actor);
    const result = await masterDataRepository.list(resource, options);
    return { data: result.data, meta: { page: options.page, pageSize: options.pageSize, total: result.total, totalPages: Math.ceil(result.total / options.pageSize) || 1 } };
  }

  async get(actor: AuthTokenPayload, resource: string, id: string) {
    this.ensureAdmin(actor);
    const value = await masterDataRepository.findById(resource, id);
    if (!value) throw new NotFoundError(`${resource} record was not found`);
    return value;
  }

  async create(actor: AuthTokenPayload, resource: string, input: Record<string, unknown>, requestId: string, ip: string) {
    this.ensureAdmin(actor);
    return withTransaction(async (session) => {
      const data = toDb(input);
      if (resource === 'academic-years' && data.is_current) {
        await masterDataRepository.model(resource).updateMany({ is_current: true }, { $set: { is_current: false } }, { session });
      }
      if ((resource === 'teachers' || resource === 'guardians') && typeof data.email === 'string') {
        const password = typeof data.temporary_password === 'string' ? data.temporary_password : temporaryPassword;
        const user = await User.create([{ email: data.email, password_hash: await bcrypt.hash(password, 12), role: resource === 'teachers' ? UserRole.TEACHER : UserRole.GUARDIAN }], { session });
        data.user_id = user[0]._id;
        delete data.email; delete data.temporary_password;
      }
      if (resource === 'grading-schemes') this.validateBands(data.grading_bands);
      if (resource === 'teacher-assignments') await this.validateAssignment(data, session);
      const created = await masterDataRepository.create(resource, data, session);
      await recordAuditLog({ actor, action: 'CREATE', entityType: resource, entityId: created._id.toString(), after: created, requestId, ip, session });
      return created;
    }).catch((error: unknown) => this.mapDuplicate(error));
  }

  async update(actor: AuthTokenPayload, resource: string, id: string, input: Record<string, unknown>, requestId: string, ip: string) {
    this.ensureAdmin(actor);
    return withTransaction(async (session) => {
      const before = await masterDataRepository.findById(resource, id, session);
      if (!before) throw new NotFoundError(`${resource} record was not found`);
      if (resource === 'grading-schemes') {
        const referenced = await Exam.countDocuments({ grading_scheme_id: id, status: { $ne: 'DRAFT' } }).session(session);
        if (referenced) throw new ConflictError('Grading scheme is referenced by a non-DRAFT exam', 'GRADING_SCHEME_REFERENCED');
        if (input.grading_bands) this.validateBands(input.grading_bands);
      }
      if (resource === 'academic-years' && input.is_current) {
        await masterDataRepository.model(resource).updateMany({ is_current: true, _id: { $ne: id } }, { $set: { is_current: false } }, { session });
      }
      if (resource === 'teacher-assignments') await this.validateAssignment(toDb({ ...before, ...input, _id: id }), session, id);
      const after = await masterDataRepository.update(resource, id, toDb(input), session);
      await recordAuditLog({ actor, action: 'UPDATE', entityType: resource, entityId: id, before: before as LooseDocument, after: after as LooseDocument, requestId, ip, session });
      return after;
    }).catch((error: unknown) => this.mapDuplicate(error));
  }

  async deactivate(actor: AuthTokenPayload, resource: string, id: string, requestId: string, ip: string) {
    this.ensureAdmin(actor);
    return withTransaction(async (session) => {
      const before = await masterDataRepository.findById(resource, id, session);
      if (!before) throw new NotFoundError(`${resource} record was not found`);
      const refs: Record<string, Array<[string, string]>> = {
        classes: [['sections', 'class_id'], ['class-subjects', 'class_id'], ['enrollments', 'class_id']],
        subjects: [['class-subjects', 'subject_id'], ['teacher-assignments', 'subject_id']],
        sections: [['enrollments', 'section_id'], ['teacher-assignments', 'section_id']],
        students: [['enrollments', 'student_id'], ['student-guardians', 'student_id']],
        guardians: [['student-guardians', 'guardian_id']],
        teachers: [['teacher-assignments', 'teacher_id']],
        'academic-years': [['enrollments', 'academic_year_id'], ['sections', 'academic_year_id']],
        'grading-schemes': [['exams', 'grading_scheme_id']],
      };
      for (const [target, field] of refs[resource] || []) {
        const count = target === 'exams' ? await Exam.countDocuments({ [field]: id }).session(session) : await masterDataRepository.count(target, { [field]: id }, session);
        if (count) throw new ConflictError(`${resource} record is referenced and cannot be deactivated`, 'REFERENCED_RESOURCE');
      }
      const after = await masterDataRepository.deactivate(resource, id, session);
      await recordAuditLog({ actor, action: 'DEACTIVATE', entityType: resource, entityId: id, before: before as LooseDocument, after: after as LooseDocument, requestId, ip, session });
      return after;
    });
  }

  async linkGuardian(actor: AuthTokenPayload, studentId: string, input: Record<string, unknown>, requestId: string, ip: string) {
    this.ensureAdmin(actor);
    return withTransaction(async (session) => {
      const data = { ...toDb(input), student_id: new Types.ObjectId(studentId), is_primary: input.is_primary ?? false };
      if (!(await masterDataRepository.findById('students', studentId, session))) throw new NotFoundError('Student not found');
      if (!(await masterDataRepository.findById('guardians', String(input.guardian_id), session))) throw new NotFoundError('Guardian not found');
      const created = await masterDataRepository.linkStudentGuardian(data, session);
      await recordAuditLog({ actor, action: 'CREATE', entityType: 'student-guardian', entityId: created._id.toString(), after: created, requestId, ip, session });
      return created;
    }).catch((error: unknown) => this.mapDuplicate(error));
  }

  async unlinkGuardian(actor: AuthTokenPayload, studentId: string, guardianId: string, requestId: string, ip: string) {
    this.ensureAdmin(actor);
    return withTransaction(async (session) => {
      const removed = await masterDataRepository.unlinkStudentGuardian(studentId, guardianId, session);
      if (!removed) throw new NotFoundError('Guardian link not found');
      await recordAuditLog({ actor, action: 'DEACTIVATE', entityType: 'student-guardian', entityId: removed._id.toString(), before: removed as unknown as Record<string, unknown>, after: null, requestId, ip, session });
      return removed;
    });
  }

  private validateBands(value: unknown) {
    const bands = value as Array<{ min_percent: number }>;
    const mins = bands.map((band) => band.min_percent);
    if (!mins.includes(0) || new Set(mins).size !== mins.length || mins.some((value, index) => index > 0 && value <= mins[index - 1])) {
      throw new ConflictError('Grading bands must be ascending, unique, non-overlapping, and cover 0', 'INVALID_GRADING_BANDS');
    }
  }

  private async validateAssignment(data: Record<string, unknown>, session: ClientSession, currentId?: string) {
    const section = await Section.findById(data.section_id).session(session);
    if (!section) throw new NotFoundError('Section not found');
    const mapping = await ClassSubject.findOne({ class_id: section.class_id, subject_id: data.subject_id }).session(session);
    if (!mapping) throw new ConflictError('Subject is not mapped to the section class', 'SUBJECT_NOT_IN_CLASS');
    if (data.is_class_teacher) {
      const filter: Record<string, unknown> = { section_id: data.section_id, is_class_teacher: true };
      if (currentId) filter._id = { $ne: new Types.ObjectId(currentId) };
      const existing = await masterDataRepository.count('teacher-assignments', filter, session);
      if (existing) throw new ConflictError('Section already has a class teacher', 'CLASS_TEACHER_EXISTS');
    }
  }

  private mapDuplicate(error: unknown): never {
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: number }).code === 11000) {
      throw new ConflictError('A record with the same unique key already exists', 'DUPLICATE_RESOURCE');
    }
    throw error;
  }
}

export const masterDataService = new MasterDataService();
