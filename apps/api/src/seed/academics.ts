import { AcademicYear, IAcademicYear } from '../models/AcademicYear.js';
import { Class, IClass } from '../models/Class.js';
import { Section, ISection } from '../models/Section.js';
import { Subject, ISubject } from '../models/Subject.js';
import { ClassSubject } from '../models/ClassSubject.js';
import { Enrollment } from '../models/Enrollment.js';
import { TeacherAssignment } from '../models/TeacherAssignment.js';
import { ITeacher } from '../models/Teacher.js';
import { IStudent } from '../models/Student.js';

export interface SeededAcademics {
  academicYear: IAcademicYear;
  classes: IClass[];
  sections: ISection[];
  subjects: ISubject[];
}

export async function seedAcademics(
  teachers: ITeacher[],
  students: IStudent[]
): Promise<SeededAcademics> {
  // 1. Academic Year
  const academicYear = await AcademicYear.findOneAndUpdate(
    { name: '2026-2027' },
    {
      name: '2026-2027',
      start_date: new Date('2026-04-01T00:00:00.000Z'),
      end_date: new Date('2027-03-31T23:59:59.999Z'),
      is_current: true,
    },
    { upsert: true, new: true }
  );

  // 2. Classes (Grade 6, Grade 7, Grade 8)
  const classDefs = [
    { name: 'Grade 6', level: 6 },
    { name: 'Grade 7', level: 7 },
    { name: 'Grade 8', level: 8 },
  ];

  const classes: IClass[] = [];
  for (const c of classDefs) {
    const cls = await Class.findOneAndUpdate(
      { name: c.name },
      { name: c.name, level: c.level },
      { upsert: true, new: true }
    );
    classes.push(cls);
  }

  // 3. Sections (2 per class: 6A, 6B, 7A, 7B, 8A, 8B)
  const sections: ISection[] = [];
  for (const cls of classes) {
    for (const secName of ['A', 'B']) {
      const sec = await Section.findOneAndUpdate(
        { class_id: cls._id, academic_year_id: academicYear._id, name: secName },
        { class_id: cls._id, academic_year_id: academicYear._id, name: secName },
        { upsert: true, new: true }
      );
      sections.push(sec);
    }
  }

  // 4. Subjects (~8 total)
  const subjectDefs = [
    { code: 'ENG', name: 'English' },
    { code: 'MATH', name: 'Mathematics' },
    { code: 'SCI', name: 'Science' },
    { code: 'SOC', name: 'Social Studies' },
    { code: 'CS', name: 'Computer Science' },
    { code: 'HIN', name: 'Hindi' },
    { code: 'ART', name: 'Visual Arts' },
    { code: 'PE', name: 'Physical Education' },
  ];

  const subjects: ISubject[] = [];
  for (const s of subjectDefs) {
    const sub = await Subject.findOneAndUpdate(
      { code: s.code },
      { code: s.code, name: s.name },
      { upsert: true, new: true }
    );
    subjects.push(sub);
  }

  // 5. Class-Subject Mappings
  for (const cls of classes) {
    for (const sub of subjects) {
      await ClassSubject.findOneAndUpdate(
        { class_id: cls._id, subject_id: sub._id },
        { class_id: cls._id, subject_id: sub._id },
        { upsert: true }
      );
    }
  }

  // 6. Enrollments: 60 students into 6 sections (10 per section), roll numbers 1..10
  for (let i = 0; i < students.length; i++) {
    const secIdx = Math.floor(i / 10);
    const targetSection = sections[secIdx % sections.length];
    const rollNo = (i % 10) + 1;

    await Enrollment.findOneAndUpdate(
      { student_id: students[i]._id, academic_year_id: academicYear._id },
      {
        student_id: students[i]._id,
        section_id: targetSection._id,
        academic_year_id: academicYear._id,
        roll_no: rollNo,
      },
      { upsert: true }
    );
  }

  // 7. Teacher Assignments
  // Crucial test invariant per §9 and A1:
  // teacher2 (Sarah Smith) is assigned to ONLY ONE section (6A, Mathematics)
  const teacher1 = teachers[0]; // multi-section
  const teacher2 = teachers[1]; // single-section (for A1)
  const teacher3 = teachers[2];
  const teacher4 = teachers[3];
  const teacher5 = teachers[4];
  const teacher6 = teachers[5];

  const sec6A = sections[0]; // 6A
  const sec6B = sections[1]; // 6B
  const sec7A = sections[2]; // 7A
  const sec7B = sections[3]; // 7B
  const sec8A = sections[4]; // 8A
  const sec8B = sections[5]; // 8B

  const subEng = subjects.find((s) => s.code === 'ENG')!;
  const subMath = subjects.find((s) => s.code === 'MATH')!;
  const subSci = subjects.find((s) => s.code === 'SCI')!;
  const subSoc = subjects.find((s) => s.code === 'SOC')!;
  const subCs = subjects.find((s) => s.code === 'CS')!;

  const assignTeacher = async (
    teacherId: ITeacher['_id'],
    sectionId: ISection['_id'],
    subjectId: ISubject['_id'],
    isClassTeacher: boolean
  ) => {
    await TeacherAssignment.findOneAndUpdate(
      { teacher_id: teacherId, section_id: sectionId, subject_id: subjectId },
      {
        teacher_id: teacherId,
        section_id: sectionId,
        subject_id: subjectId,
        is_class_teacher: isClassTeacher,
      },
      { upsert: true, new: true }
    );
  };

  // Teacher 2: ONLY 6A, Mathematics (Single-section assignment for A1)
  await assignTeacher(teacher2._id, sec6A._id, subMath._id, false);

  // Teacher 1: 6A (English, Class Teacher) and 6B (English)
  await assignTeacher(teacher1._id, sec6A._id, subEng._id, true);
  await assignTeacher(teacher1._id, sec6B._id, subEng._id, false);

  // Teacher 3: 6B (Math, Class Teacher), 7A (Math)
  await assignTeacher(teacher3._id, sec6B._id, subMath._id, true);
  await assignTeacher(teacher3._id, sec7A._id, subMath._id, false);

  // Teacher 4: 7A (Science, Class Teacher), 7B (Science)
  await assignTeacher(teacher4._id, sec7A._id, subSci._id, true);
  await assignTeacher(teacher4._id, sec7B._id, subSci._id, false);

  // Teacher 5: 7B (Social Studies, Class Teacher), 8A (Social Studies)
  await assignTeacher(teacher5._id, sec7B._id, subSoc._id, true);
  await assignTeacher(teacher5._id, sec8A._id, subSoc._id, false);

  // Teacher 6: 8A (CS, Class Teacher), 8B (CS, Class Teacher)
  await assignTeacher(teacher6._id, sec8A._id, subCs._id, true);
  await assignTeacher(teacher6._id, sec8B._id, subCs._id, true);

  return {
    academicYear,
    classes,
    sections,
    subjects,
  };
}

