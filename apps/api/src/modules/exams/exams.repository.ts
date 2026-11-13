import { ClientSession } from 'mongoose';
import { Exam } from '../../models/Exam.js';
import { Mark } from '../../models/Mark.js';
import { Enrollment } from '../../models/Enrollment.js';
import { Section } from '../../models/Section.js';
import { TeacherAssignment } from '../../models/TeacherAssignment.js';
import { StudentGuardian } from '../../models/StudentGuardian.js';
import { GradingScheme } from '../../models/GradingScheme.js';
import { Student } from '../../models/Student.js';
import { Subject } from '../../models/Subject.js';
import { AcademicYear } from '../../models/AcademicYear.js';
import { Class } from '../../models/Class.js';

export const examsRepository = {
  list: (filter: Record<string, unknown>, page: number, pageSize: number) => Promise.all([
    Exam.find(filter).sort({ starts_on: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Exam.countDocuments(filter),
  ]),
  find: (id: string, session?: ClientSession) => Exam.findById(id).session(session || null).lean(),
  create: async (data: Record<string, unknown>, session: ClientSession) => (await Exam.create([data], { session }))[0].toObject(),
  update: (id: string, data: Record<string, unknown>, session: ClientSession) => Exam.findByIdAndUpdate(id, { $set: data }, { new: true, session, runValidators: true }).lean(),
  remove: (id: string, session: ClientSession) => Exam.deleteOne({ _id: id }, { session }),
  marks: (examId: string, subjectId: string, studentIds: string[], session?: ClientSession) => Mark.find({ exam_id: examId, subject_id: subjectId, student_id: { $in: studentIds } }).session(session || null).lean(),
  upsertMark: (filter: Record<string, unknown>, data: Record<string, unknown>, session: ClientSession) => Mark.findOneAndUpdate(filter, { $set: data }, { upsert: true, new: true, session, runValidators: true }).lean(),
  allMarks: (examId: string, studentIds: string[], session?: ClientSession) => Mark.find({ exam_id: examId, student_id: { $in: studentIds } }).session(session || null).lean(),
  enrollments: (classId: string, sectionId?: string, session?: ClientSession) => {
    const query: Record<string, unknown> = {};
    if (sectionId) query.section_id = sectionId;
    return Section.find(sectionId ? { _id: sectionId, class_id: classId } : { class_id: classId }).session(session || null).lean().then(async (sections) => {
      const ids = sections.map((section) => section._id);
      return Enrollment.find({ section_id: { $in: ids } }).session(session || null).lean();
    });
  },
  section: (id: string, session?: ClientSession) => Section.findById(id).session(session || null).lean(),
  assignment: (teacherId: string, sectionId: string, subjectId: string, session?: ClientSession) => TeacherAssignment.exists({ teacher_id: teacherId, section_id: sectionId, subject_id: subjectId }).session(session || null),
  assignedClassIds: async (teacherId: string, session?: ClientSession) => {
    const assignments = await TeacherAssignment.find({ teacher_id: teacherId }).select('section_id').session(session || null).lean();
    const sections = await Section.find({ _id: { $in: assignments.map((item) => item.section_id) } }).select('class_id').session(session || null).lean();
    return [...new Set(sections.map((item) => item.class_id.toString()))];
  },
  linked: (guardianId: string, studentId: string, session?: ClientSession) => StudentGuardian.exists({ guardian_id: guardianId, student_id: studentId }).session(session || null),
  scheme: (id: string, session?: ClientSession) => GradingScheme.findById(id).session(session || null).lean(),
  academicYear: (id: string) => AcademicYear.findById(id).lean(),
  classRecord: (id: string) => Class.findById(id).lean(),
  student: (id: string) => Student.findById(id).lean(),
  subjectsByIds: (ids: unknown[], session?: ClientSession) => Subject.find({ _id: { $in: ids } }).session(session || null).lean(),
  studentsByIds: (ids: unknown[], session?: ClientSession) => Student.find({ _id: { $in: ids } }).session(session || null).lean(),
  classSubject: (classId: string, subjectId: string, session?: ClientSession) => import('../../models/ClassSubject.js').then(({ ClassSubject }) => ClassSubject.exists({ class_id: classId, subject_id: subjectId }).session(session || null)),
};
