import { AttendanceRecord } from '../models/AttendanceRecord.js';
import { Enrollment } from '../models/Enrollment.js';
import { IAcademicYear } from '../models/AcademicYear.js';
import { ITeacher } from '../models/Teacher.js';
import { Teacher } from '../models/Teacher.js';
import { AttendanceSession, AttendanceStatus } from '@school/shared';
import { Types } from 'mongoose';

function schoolDaysBeforeToday(count: number) {
  const dates: string[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (dates.length < count) {
    cursor.setDate(cursor.getDate() - 1);
    if (cursor.getDay() !== 0 && cursor.getDay() !== 6) dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates.reverse();
}

export async function seedAttendance(academicYear: IAcademicYear, teachers: ITeacher[]) {
  const enrollments = await Enrollment.find({ academic_year_id: academicYear._id }).lean();
  const teacherBySection = new Map<string, string>();
  const assignments = await (await import('../models/TeacherAssignment.js')).TeacherAssignment.find({}).lean();
  const teacherIds = [...new Set(assignments.map((assignment) => assignment.teacher_id.toString()))];
  const teacherDocs = await Teacher.find({ _id: { $in: teacherIds } }).lean();
  const userByTeacher = new Map(teacherDocs.map((teacher) => [teacher._id.toString(), teacher.user_id.toString()]));
  assignments.forEach((assignment) => teacherBySection.set(assignment.section_id.toString(), userByTeacher.get(assignment.teacher_id.toString()) || teachers[0].user_id.toString()));
  const dates = schoolDaysBeforeToday(20);
  const operations = enrollments.flatMap((enrollment) => {
    const marker = teacherBySection.get(enrollment.section_id.toString()) || teachers[0].user_id.toString();
    return dates.flatMap((date, day) => [AttendanceSession.MORNING, AttendanceSession.AFTERNOON].map((session) => {
      const status = (day + enrollment.roll_no + (session === AttendanceSession.AFTERNOON ? 1 : 0)) % 17 === 0
        ? AttendanceStatus.ABSENT
        : (day + enrollment.roll_no) % 13 === 0 ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;
      return {
        updateOne: {
          filter: { student_id: enrollment.student_id, date, session },
          update: { $set: { section_id: enrollment.section_id, status, marked_by_user_id: new Types.ObjectId(marker), marked_at: new Date(`${date}T12:00:00.000Z`) } },
          upsert: true,
        },
      };
    }));
  });
  if (operations.length) await AttendanceRecord.bulkWrite(operations, { ordered: false });
}
