import { Exam, GradingScheme, Mark, Enrollment } from '../models/index.js';
import type { Types } from 'mongoose';
import { ExamStatus } from '@school/shared';
import type { SeededAcademics } from './academics.js';

export async function seedExams(academics: SeededAcademics, enteredByUserId: Types.ObjectId) {
  const bands = [
    { min_percent: 9000, grade: 'A', grade_point: 1000, remark: 'Excellent' },
    { min_percent: 7500, grade: 'B', grade_point: 800, remark: 'Good' },
    { min_percent: 6000, grade: 'C', grade_point: 600, remark: 'Satisfactory' },
    { min_percent: 4000, grade: 'D', grade_point: 400, remark: 'Pass' },
    { min_percent: 0, grade: 'F', grade_point: 0, remark: 'Fail' },
  ];
  const scheme = await GradingScheme.findOneAndUpdate(
    { name: 'Demo percentage scheme' },
    { name: 'Demo percentage scheme', is_default: true, grading_bands: bands },
    { upsert: true, new: true }
  );
  const published = await Exam.findOneAndUpdate(
    { name: 'Demo Term Examination', academic_year_id: academics.academicYear._id },
    {
      name: 'Demo Term Examination', term: 'Term 1', academic_year_id: academics.academicYear._id,
      class_id: academics.classes[0]._id, grading_scheme_id: scheme._id, status: ExamStatus.PUBLISHED,
      starts_on: new Date('2026-09-15T00:00:00.000Z'), published_at: new Date('2026-09-20T00:00:00.000Z'),
      grading_snapshot: { grading_bands: bands }, exam_subjects: academics.subjects.slice(0, 2).map((subject) => ({ subject_id: subject._id, max_marks: 10000, pass_marks: 4000 })),
    },
    { upsert: true, new: true }
  );
  const section = academics.sections[0];
  const enrollments = await Enrollment.find({ section_id: section._id, academic_year_id: academics.academicYear._id }).sort({ roll_no: 1 }).lean();
  const values = [[9000, 9000], [8999, 8999], [null, 8000], [3000, 3000], [8000, 8000], [8000, 8000], [7000, 7000], [6000, 6000], [5000, 5000], [4000, 4000]];
  for (let index = 0; index < enrollments.length; index += 1) {
    for (let subjectIndex = 0; subjectIndex < 2; subjectIndex += 1) {
      const absent = index === 2 && subjectIndex === 0;
      const value = absent ? null : values[index]?.[subjectIndex] ?? 0;
      await Mark.findOneAndUpdate(
        { exam_id: published._id, subject_id: academics.subjects[subjectIndex]._id, student_id: enrollments[index].student_id },
        { exam_id: published._id, subject_id: academics.subjects[subjectIndex]._id, student_id: enrollments[index].student_id, marks_obtained: value, is_absent: absent, entered_by_user_id: enteredByUserId },
        { upsert: true }
      );
    }
  }
  const open = await Exam.findOneAndUpdate(
    { name: 'Demo Open Examination', academic_year_id: academics.academicYear._id },
    {
      name: 'Demo Open Examination', term: 'Term 2', academic_year_id: academics.academicYear._id,
      class_id: academics.classes[1]._id, grading_scheme_id: scheme._id, status: ExamStatus.MARKS_OPEN,
      starts_on: new Date('2026-11-01T00:00:00.000Z'), published_at: null, grading_snapshot: null,
      exam_subjects: academics.subjects.slice(0, 2).map((subject) => ({ subject_id: subject._id, max_marks: 10000, pass_marks: 4000 })),
    },
    { upsert: true, new: true }
  );
  const openEnrollment = await Enrollment.findOne({ section_id: academics.sections[2]._id }).lean();
  if (openEnrollment) await Mark.findOneAndUpdate({ exam_id: open._id, subject_id: academics.subjects[0]._id, student_id: openEnrollment.student_id }, { exam_id: open._id, subject_id: academics.subjects[0]._id, student_id: openEnrollment.student_id, marks_obtained: 7500, is_absent: false, entered_by_user_id: enteredByUserId }, { upsert: true });
}
