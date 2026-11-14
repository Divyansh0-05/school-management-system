import { Types } from 'mongoose';
import { ExamStatus, UserRole } from '@school/shared';
import type { AuthTokenPayload } from '../auth/auth.tokens.js';
import type { ExamCreate, MarksBody } from '@school/shared';
import { withTransaction } from '../../db/connection.js';
import { recordAuditLog } from '../../audit/audit.service.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../errors/appError.js';
import { examsRepository } from './exams.repository.js';
import { denseRanks, gradeMarks, type GradingBand } from './grading.js';

const cents = (value: number | string) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || Math.round(parsed * 100) !== parsed * 100) throw new ValidationError('Marks must have at most 2 decimal places');
  return Math.round(parsed * 100);
};
const objectId = (id: string) => new Types.ObjectId(id);
const transition: Record<string, ExamStatus> = { open: ExamStatus.MARKS_OPEN, lock: ExamStatus.LOCKED, publish: ExamStatus.PUBLISHED };

export class ExamsService {
  private admin(actor: AuthTokenPayload) {
    if (actor.role !== UserRole.ADMIN) throw new ForbiddenError('Administrator role required', 'ROLE_NOT_PERMITTED');
  }
  async get(id: string) {
    const exam = await examsRepository.find(id);
    if (!exam) throw new NotFoundError('Exam was not found');
    const subjectIds = (exam.exam_subjects || []).map((s) => s.subject_id);
    if (subjectIds.length) {
      const subjects = await examsRepository.subjectsByIds(subjectIds);
      const subjectMap = new Map(subjects.map((s) => [s._id.toString(), s.name]));
      exam.exam_subjects = exam.exam_subjects.map((s) => ({
        ...s,
        subject_name: subjectMap.get(s.subject_id.toString()) || 'Subject',
      }));
    }
    return exam;
  }
  private async normalizedInput(input: ExamCreate) {
    const subjects = input.examSubjects.map((subject) => {
      const max = cents(subject.maxMarks);
      const pass = cents(subject.passMarks);
      if (pass <= 0 || pass > max) throw new ValidationError('Pass marks must be greater than zero and no greater than max marks');
      return { subject_id: objectId(subject.subjectId), max_marks: max, pass_marks: pass };
    });
    if (new Set(subjects.map((subject) => subject.subject_id.toString())).size !== subjects.length) throw new ConflictError('Exam subjects must be unique', 'DUPLICATE_EXAM_SUBJECT');
    for (const subject of subjects) if (!(await examsRepository.classSubject(input.classId, subject.subject_id.toString()))) throw new ConflictError('Subject is not mapped to the exam class', 'SUBJECT_NOT_IN_CLASS');
    if (!(await examsRepository.academicYear(input.academicYearId))) throw new NotFoundError('Academic year was not found');
    if (!(await examsRepository.classRecord(input.classId))) throw new NotFoundError('Class was not found');
    if (!(await examsRepository.scheme(input.gradingSchemeId))) throw new NotFoundError('Grading scheme was not found');
    return { name: input.name, term: input.term, academic_year_id: objectId(input.academicYearId), class_id: objectId(input.classId), grading_scheme_id: objectId(input.gradingSchemeId), starts_on: input.startsOn, exam_subjects: subjects, status: ExamStatus.DRAFT, grading_snapshot: null, published_at: null };
  }
  async list(actor: AuthTokenPayload, page: number, pageSize: number, filters: { classId?: string; academicYearId?: string; status?: string }) {
    if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.TEACHER && actor.role !== UserRole.GUARDIAN) throw new ForbiddenError('Role is not permitted', 'ROLE_NOT_PERMITTED');
    const filter: Record<string, unknown> = {};
    if (filters.classId) filter.class_id = filters.classId;
    if (filters.academicYearId) filter.academic_year_id = filters.academicYearId;
    if (filters.status) filter.status = filters.status;
    if (actor.role === UserRole.TEACHER) filter.class_id = { $in: actor.teacherId ? await examsRepository.assignedClassIds(actor.teacherId) : [] };
    if (actor.role === UserRole.GUARDIAN) filter.status = ExamStatus.PUBLISHED;
    const [data, total] = await examsRepository.list(filter, page, pageSize);
    return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 } };
  }
  async create(actor: AuthTokenPayload, input: ExamCreate, requestId: string, ip: string) {
    this.admin(actor);
    return withTransaction(async (session) => {
      const created = await examsRepository.create(await this.normalizedInput(input), session);
      await recordAuditLog({ actor, action: 'CREATE', entityType: 'exam', entityId: String(created._id), after: created as unknown as Record<string, unknown>, requestId, ip, session });
      return created;
    });
  }
  async update(actor: AuthTokenPayload, id: string, input: Partial<ExamCreate>, requestId: string, ip: string) {
    this.admin(actor);
    return withTransaction(async (session) => {
      const before = await examsRepository.find(id, session);
      if (!before) throw new NotFoundError('Exam was not found');
      if (before.status !== ExamStatus.DRAFT) throw new ConflictError('Only DRAFT exams can be edited', 'INVALID_STATE_TRANSITION');
      const merged = { ...before, ...input, examSubjects: input.examSubjects || before.exam_subjects.map((item) => ({ subjectId: item.subject_id.toString(), maxMarks: item.max_marks / 100, passMarks: item.pass_marks / 100 })), academicYearId: input.academicYearId || before.academic_year_id.toString(), classId: input.classId || before.class_id.toString(), gradingSchemeId: input.gradingSchemeId || before.grading_scheme_id.toString(), startsOn: input.startsOn || before.starts_on } as ExamCreate;
      const after = await examsRepository.update(id, await this.normalizedInput(merged), session);
      await recordAuditLog({ actor, action: 'UPDATE', entityType: 'exam', entityId: id, before: before as unknown as Record<string, unknown>, after: after as unknown as Record<string, unknown>, requestId, ip, session });
      return after;
    });
  }
  async remove(actor: AuthTokenPayload, id: string, requestId: string, ip: string) {
    this.admin(actor);
    return withTransaction(async (session) => {
      const before = await examsRepository.find(id, session);
      if (!before) throw new NotFoundError('Exam was not found');
      if (before.status !== ExamStatus.DRAFT) throw new ConflictError('Only DRAFT exams can be deleted', 'INVALID_STATE_TRANSITION');
      await examsRepository.remove(id, session);
      await recordAuditLog({ actor, action: 'DELETE', entityType: 'exam', entityId: id, before: before as unknown as Record<string, unknown>, after: null, requestId, ip, session });
      return before;
    });
  }
  async transitionExam(actor: AuthTokenPayload, id: string, action: string, reason: string | undefined, requestId: string, ip: string) {
    this.admin(actor);
    return withTransaction(async (session) => {
      const before = await examsRepository.find(id, session);
      if (!before) throw new NotFoundError('Exam was not found');
      if (action === 'reopen') {
        if (before.status !== ExamStatus.LOCKED || !reason) throw new ConflictError('Only LOCKED exams can be reopened with a reason', 'INVALID_STATE_TRANSITION');
        const after = await examsRepository.update(id, { status: ExamStatus.MARKS_OPEN }, session);
        await recordAuditLog({ actor, action: 'REOPEN', entityType: 'exam', entityId: id, before: before as unknown as Record<string, unknown>, after: { ...(after as object), reason } as Record<string, unknown>, requestId, ip, session });
        return after;
      }
      const next = transition[action];
      if (!next || (action === 'open' && before.status !== ExamStatus.DRAFT) || (action === 'lock' && before.status !== ExamStatus.MARKS_OPEN) || (action === 'publish' && before.status !== ExamStatus.LOCKED)) throw new ConflictError('Invalid exam state transition', 'INVALID_STATE_TRANSITION');
      let patch: Record<string, unknown> = { status: next };
      if (action === 'open' && !before.exam_subjects.length) throw new ConflictError('Exam needs at least one subject', 'INVALID_STATE_TRANSITION');
      if (action === 'lock') {
        const enrollments = await examsRepository.enrollments(before.class_id.toString(), undefined, session);
        const marks = await examsRepository.allMarks(id, enrollments.map((item) => item.student_id.toString()), session);
        const keys = new Set(marks.map((mark) => `${mark.student_id}:${mark.subject_id}`));
        if (enrollments.some((enrollment) => before.exam_subjects.some((subject) => !keys.has(`${enrollment.student_id}:${subject.subject_id}`)))) throw new ConflictError('Every enrolled student must have marks or be absent for every subject', 'INCOMPLETE_MARKS');
        const scheme = await examsRepository.scheme(before.grading_scheme_id.toString(), session);
        patch = { status: next, grading_snapshot: { grading_bands: scheme?.grading_bands || [] } };
      }
      if (action === 'publish') patch.published_at = new Date();
      const after = await examsRepository.update(id, patch, session);
      await recordAuditLog({ actor, action: action.toUpperCase(), entityType: 'exam', entityId: id, before: before as unknown as Record<string, unknown>, after: after as unknown as Record<string, unknown>, requestId, ip, session });
      return after;
    });
  }
  private async scopedExam(actor: AuthTokenPayload, examId: string, sectionId?: string, subjectId?: string) {
    const exam = await this.get(examId);
    if (actor.role === UserRole.ADMIN) return exam;
    if (actor.role === UserRole.TEACHER && sectionId && actor.teacherId && await examsRepository.section(sectionId).then((section) => section?.class_id.toString() === exam.class_id.toString()) && await Promise.all(exam.exam_subjects.filter((item) => !subjectId || item.subject_id.toString() === subjectId).map((item) => examsRepository.assignment(actor.teacherId!, sectionId, item.subject_id.toString()))).then((assigned) => assigned.some(Boolean))) return exam;
    throw new NotFoundError('Exam was not found');
  }
  async marks(actor: AuthTokenPayload, examId: string, subjectId: string, sectionId: string) {
    if (actor.role === UserRole.GUARDIAN) throw new ForbiddenError('Guardians cannot view marks entry', 'ROLE_NOT_PERMITTED');
    const exam = await this.scopedExam(actor, examId, sectionId, subjectId);
    if (exam.status !== ExamStatus.MARKS_OPEN) throw new ConflictError('Marks can only be viewed while MARKS_OPEN', 'INVALID_STATE_TRANSITION');
    const subject = exam.exam_subjects.find((item) => item.subject_id.toString() === subjectId);
    if (!subject) throw new NotFoundError('Exam subject was not found');
    const enrollments = await examsRepository.enrollments(exam.class_id.toString(), sectionId);
    const studentIds = enrollments.map((item) => item.student_id.toString());
    const [marks, students, subjects] = await Promise.all([
      examsRepository.marks(examId, subjectId, studentIds),
      examsRepository.studentsByIds(studentIds),
      examsRepository.subjectsByIds([subjectId]),
    ]);
    const studentMap = new Map(students.map((s) => [s._id.toString(), s]));
    const subjectName = subjects[0]?.name || (subject as { subject_name?: string })?.subject_name || 'Subject';
    return enrollments.map((enrollment) => {
      const student = studentMap.get(enrollment.student_id.toString());
      return {
        studentId: enrollment.student_id,
        student_name: student?.full_name || 'Student',
        admission_no: student?.admission_no || '',
        roll_no: enrollment.roll_no,
        subject_id: subjectId,
        subject_name: subjectName,
        marks: marks.find((item) => item.student_id.toString() === enrollment.student_id.toString()) || null,
      };
    });
  }
  async putMarks(actor: AuthTokenPayload, examId: string, subjectId: string, sectionId: string, body: MarksBody, requestId: string, ip: string) {
    if (actor.role === UserRole.GUARDIAN) throw new ForbiddenError('Guardians cannot enter marks', 'ROLE_NOT_PERMITTED');
    return withTransaction(async (session) => {
      const exam = await this.scopedExam(actor, examId, sectionId);
      if (exam.status !== ExamStatus.MARKS_OPEN) throw new ConflictError('Marks can only be entered while MARKS_OPEN', 'INVALID_STATE_TRANSITION');
      const subject = exam.exam_subjects.find((item) => item.subject_id.toString() === subjectId);
      if (!subject) throw new NotFoundError('Exam subject was not found');
      const enrollments = await examsRepository.enrollments(exam.class_id.toString(), sectionId, session);
      const allowed = new Set(enrollments.map((item) => item.student_id.toString()));
      if (new Set(body.records.map((record) => record.studentId)).size !== body.records.length) throw new ValidationError('A student may appear only once in a marks request');
      for (const record of body.records) {
        if (!allowed.has(record.studentId)) throw new ValidationError('Student is not enrolled in this section');
        if (record.isAbsent && record.marks !== null && record.marks !== undefined) throw new ValidationError('Absent students cannot have marks');
        const value = record.isAbsent ? null : cents(record.marks ?? 0);
        if (value !== null && value > subject.max_marks) throw new ValidationError('Marks cannot exceed max marks');
        const previous = (await examsRepository.marks(examId, subjectId, [record.studentId], session))[0];
        const saved = await examsRepository.upsertMark({ exam_id: objectId(examId), subject_id: objectId(subjectId), student_id: objectId(record.studentId) }, { exam_id: objectId(examId), subject_id: objectId(subjectId), student_id: objectId(record.studentId), marks_obtained: value, is_absent: record.isAbsent, entered_by_user_id: objectId(actor.sub) }, session);
        if (!saved) throw new ConflictError('Mark could not be saved', 'MARK_SAVE_FAILED');
        if (!previous || previous.marks_obtained !== saved.marks_obtained || previous.is_absent !== saved.is_absent) await recordAuditLog({ actor, action: previous ? 'UPDATE' : 'CREATE', entityType: 'mark', entityId: String(saved._id), before: previous as unknown as Record<string, unknown> || null, after: saved as unknown as Record<string, unknown>, requestId, ip, session });
      }
      return this.marks(actor, examId, subjectId, sectionId);
    });
  }
  async results(actor: AuthTokenPayload, examId: string, sectionId: string) {
    if (actor.role === UserRole.GUARDIAN) throw new ForbiddenError('Guardians cannot view section results', 'ROLE_NOT_PERMITTED');
    const exam = await this.scopedExam(actor, examId, sectionId);
    const enrollments = await examsRepository.enrollments(exam.class_id.toString(), sectionId);
    const studentIds = enrollments.map((item) => item.student_id.toString());
    const subjectIds = exam.exam_subjects.map((item) => item.subject_id.toString());
    const [marks, students, subjects] = await Promise.all([
      examsRepository.allMarks(examId, studentIds),
      examsRepository.studentsByIds(studentIds),
      examsRepository.subjectsByIds(subjectIds),
    ]);
    const studentMap = new Map(students.map((s) => [s._id.toString(), s]));
    const subjectMap = new Map(subjects.map((s) => [s._id.toString(), s.name]));
    const bands = (exam.grading_snapshot || await examsRepository.scheme(exam.grading_scheme_id.toString())) as unknown as { grading_bands?: GradingBand[] };
    const results = enrollments.map((enrollment) => {
      const graded = gradeMarks(
        exam.exam_subjects.map((item) => ({ subjectId: item.subject_id.toString(), maxMarks: item.max_marks, passMarks: item.pass_marks })),
        marks.filter((mark) => mark.student_id.toString() === enrollment.student_id.toString()).map((mark) => ({ subjectId: mark.subject_id.toString(), marks: mark.marks_obtained, isAbsent: mark.is_absent })),
        bands.grading_bands || bands as unknown as GradingBand[]
      );
      const student = studentMap.get(enrollment.student_id.toString());
      const subjectsWithNames = graded.subjects.map((s) => ({
        ...s,
        subject_name: subjectMap.get(s.subjectId) || 'Subject',
      }));
      return {
        studentId: enrollment.student_id,
        student_name: student?.full_name || 'Student',
        admission_no: student?.admission_no || '',
        roll_no: enrollment.roll_no,
        ...graded,
        subjects: subjectsWithNames,
      };
    });
    const ranks = denseRanks(results.map((item) => item.total));
    return results.map((item, index) => ({ ...item, rank: item.result === 'INCOMPLETE' ? null : ranks[index], sectionStrength: results.length }));
  }
  async reportCard(actor: AuthTokenPayload, studentId: string, examId: string) {
    const exam = await this.get(examId);
    if (actor.role === UserRole.GUARDIAN && (exam.status !== ExamStatus.PUBLISHED || !actor.guardianId || !(await examsRepository.linked(actor.guardianId, studentId)))) throw new NotFoundError('Report card was not found');
    if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.GUARDIAN && actor.role !== UserRole.TEACHER) throw new ForbiddenError('Role is not permitted', 'ROLE_NOT_PERMITTED');
    const enrollment = (await examsRepository.enrollments(exam.class_id.toString())).find((item) => item.student_id.toString() === studentId);
    if (!enrollment) throw new NotFoundError('Report card was not found');
    if (actor.role === UserRole.TEACHER) {
      const section = await examsRepository.section(enrollment.section_id.toString());
      const assigned = section && actor.teacherId && await Promise.all(exam.exam_subjects.map((item) => examsRepository.assignment(actor.teacherId!, section._id.toString(), item.subject_id.toString()))).then((values) => values.some(Boolean));
      if (!assigned) throw new NotFoundError('Report card was not found');
    }
    const results = await this.results(actor.role === UserRole.GUARDIAN ? { ...actor, role: UserRole.ADMIN } : actor, examId, enrollment.section_id.toString());
    const result = results.find((item) => item.studentId.toString() === studentId);
    if (!result) throw new NotFoundError('Report card was not found');
    const student = await examsRepository.student(studentId);
    const subjectIds = result.subjects.map((s) => s.subjectId);
    const subjects = await examsRepository.subjectsByIds(subjectIds);
    const subjectMap = new Map(subjects.map((s) => [s._id.toString(), s.name]));
    return {
      student,
      exam,
      subjects: result.subjects.map((subject) => ({
        subjectId: subject.subjectId,
        subject_name: subjectMap.get(subject.subjectId) || (subject as { subject_name?: string })?.subject_name || 'Subject',
        marks: subject.obtained,
        maxMarks: subject.maxMarks,
        percent: subject.percent,
        grade: subject.grade,
        pass: subject.passes,
        absent: subject.absent,
      })),
      total: result.total,
      maxTotal: result.maxTotal,
      overallPercent: result.overallPercent,
      grade: result.grade,
      result: result.result,
      rank: result.rank,
      sectionStrength: result.sectionStrength,
    };
  }
  async sectionPerformance(actor: AuthTokenPayload, examId: string, sectionId: string) {
    const results = await this.results(actor, examId, sectionId);
    const complete = results.filter((item) => item.result !== 'INCOMPLETE');
    const distribution = complete.reduce<Record<string, number>>((acc, item) => { if (item.grade) acc[item.grade] = (acc[item.grade] || 0) + 1; return acc; }, {});
    return { averages: complete.length ? Math.floor(complete.reduce((sum, item) => sum + item.overallPercent, 0) / complete.length) : 0, passRate: complete.length ? Math.floor(complete.filter((item) => item.result === 'PASS').length * 10000 / complete.length) : 0, gradeDistribution: distribution, sectionStrength: results.length };
  }
  async marksProgress(actor: AuthTokenPayload, id: string) {
    this.admin(actor);
    const exam = await examsRepository.find(id);
    if (!exam) throw new NotFoundError('Exam was not found');

    const sections = await examsRepository.sectionsByClassId(exam.class_id.toString());
    const sectionIds = sections.map((s) => s._id);
    const enrollments = await examsRepository.enrollmentsBySectionIds(sectionIds);

    const enrollmentsBySection = new Map<string, typeof enrollments>();
    for (const section of sections) {
      enrollmentsBySection.set(section._id.toString(), []);
    }
    for (const enrollment of enrollments) {
      const secId = enrollment.section_id.toString();
      const list = enrollmentsBySection.get(secId);
      if (list) list.push(enrollment);
    }

    const studentIds = [...new Set(enrollments.map((e) => e.student_id.toString()))];
    const [students, subjects] = await Promise.all([
      examsRepository.studentsByIds(studentIds),
      examsRepository.subjectsByIds(exam.exam_subjects.map((s) => s.subject_id.toString())),
    ]);
    const studentMap = new Map(students.map((s) => [s._id.toString(), s.full_name || 'Student']));
    const subjectMap = new Map(subjects.map((s) => [s._id.toString(), s.name]));

    const marks = await examsRepository.allMarks(id, studentIds);
    const enteredKeys = new Set(marks.map((m) => `${m.student_id.toString()}:${m.subject_id.toString()}`));

    const subjectIds = exam.exam_subjects.map((s) => s.subject_id);
    const assignments = await examsRepository.teacherAssignments({
      section_id: { $in: sectionIds },
      subject_id: { $in: subjectIds },
    });
    const teacherIds = [...new Set(assignments.map((a) => a.teacher_id.toString()))];
    const teachers = await examsRepository.teachersByIds(teacherIds);
    const teacherMap = new Map(teachers.map((t) => [t._id.toString(), t.full_name]));

    const assignmentMap = new Map<string, string>();
    for (const a of assignments) {
      const tName = teacherMap.get(a.teacher_id.toString());
      if (tName) assignmentMap.set(`${a.section_id.toString()}:${a.subject_id.toString()}`, tName);
    }

    const rows: Array<{
      section_id: string;
      section_name: string;
      subject_id: string;
      subject_name: string;
      enrolled_count: number;
      entered_count: number;
      missing_students: string[];
      teacher_name: string | null;
    }> = [];

    let totalMissingMarks = 0;
    const missingStudentIds = new Set<string>();

    for (const section of sections) {
      const secId = section._id.toString();
      const secEnrollments = enrollmentsBySection.get(secId) || [];
      for (const examSubject of exam.exam_subjects) {
        const subjId = examSubject.subject_id.toString();
        const subjName = subjectMap.get(subjId) || 'Subject';
        let entered = 0;
        const missingNames: string[] = [];
        for (const enrollment of secEnrollments) {
          const stId = enrollment.student_id.toString();
          if (enteredKeys.has(`${stId}:${subjId}`)) {
            entered++;
          } else {
            totalMissingMarks++;
            missingStudentIds.add(stId);
            if (missingNames.length < 10) {
              missingNames.push(studentMap.get(stId) || stId);
            }
          }
        }
        const teacherName = assignmentMap.get(`${secId}:${subjId}`) || null;
        rows.push({
          section_id: secId,
          section_name: section.name,
          subject_id: subjId,
          subject_name: subjName,
          enrolled_count: secEnrollments.length,
          entered_count: entered,
          missing_students: missingNames,
          teacher_name: teacherName,
        });
      }
    }

    return {
      data: rows,
      meta: {
        ready_to_lock: totalMissingMarks === 0 && exam.status === ExamStatus.MARKS_OPEN,
        missing_students_count: missingStudentIds.size,
        total_missing_marks: totalMissingMarks,
      },
    };
  }
  async mySubjects(actor: AuthTokenPayload, id: string, sectionId: string) {
    if (actor.role === UserRole.GUARDIAN) throw new ForbiddenError('Guardians cannot access exam subjects', 'ROLE_NOT_PERMITTED');
    const exam = await this.get(id);
    if (actor.role === UserRole.ADMIN) return exam.exam_subjects;
    if (actor.role === UserRole.TEACHER) {
      if (!actor.teacherId) return [];
      const assignments = await examsRepository.teacherAssignments({
        teacher_id: actor.teacherId,
        section_id: sectionId,
      });
      const assignedSubjectIds = new Set(assignments.map((a) => a.subject_id.toString()));
      return exam.exam_subjects.filter((s) => assignedSubjectIds.has(s.subject_id.toString()));
    }
    return [];
  }
}
export const examsService = new ExamsService();
