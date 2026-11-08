import bcrypt from 'bcryptjs';
import { faker } from '@faker-js/faker';
import { UserRole, Gender, GuardianRelationship, StudentStatus } from '@school/shared';
import { User, IUser } from '../models/User.js';
import { Teacher, ITeacher } from '../models/Teacher.js';
import { Guardian, IGuardian } from '../models/Guardian.js';
import { Student, IStudent } from '../models/Student.js';
import { StudentGuardian } from '../models/StudentGuardian.js';

export const DEMO_PASSWORD = 'Demo@12345';
export const BCRYPT_SALT_ROUNDS = 12;

export interface SeededIdentity {
  adminUser: IUser;
  teachers: ITeacher[];
  teacherUsers: IUser[];
  guardians: IGuardian[];
  guardianUsers: IUser[];
  students: IStudent[];
}

export async function seedIdentity(): Promise<SeededIdentity> {
  // Use fixed deterministic faker seed
  faker.seed(20261108);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_SALT_ROUNDS);

  // 1. Admin account
  const adminUser = await User.findOneAndUpdate(
    { email: 'admin@school.demo' },
    {
      email: 'admin@school.demo',
      password_hash: passwordHash,
      role: UserRole.ADMIN,
      is_active: true,
      failed_logins: 0,
      locked_until: null,
    },
    { upsert: true, new: true }
  );

  // 2. Teachers (6 total: teacher1 to teacher6)
  const teacherUsers: IUser[] = [];
  const teachers: ITeacher[] = [];

  const teacherProfiles = [
    { email: 'teacher1@school.demo', name: 'John Doe', phone: '+91 98765 43210', empNo: 'EMP001' },
    { email: 'teacher2@school.demo', name: 'Sarah Smith', phone: '+91 98765 43211', empNo: 'EMP002' },
    { email: 'teacher3@school.demo', name: 'Rajesh Kumar', phone: '+91 98765 43212', empNo: 'EMP003' },
    { email: 'teacher4@school.demo', name: 'Emily Brown', phone: '+91 98765 43213', empNo: 'EMP004' },
    { email: 'teacher5@school.demo', name: 'Amit Verma', phone: '+91 98765 43214', empNo: 'EMP005' },
    { email: 'teacher6@school.demo', name: 'Priya Sharma', phone: '+91 98765 43215', empNo: 'EMP006' },
  ];

  for (const prof of teacherProfiles) {
    const user = await User.findOneAndUpdate(
      { email: prof.email },
      {
        email: prof.email,
        password_hash: passwordHash,
        role: UserRole.TEACHER,
        is_active: true,
        failed_logins: 0,
        locked_until: null,
      },
      { upsert: true, new: true }
    );
    teacherUsers.push(user);

    const teacher = await Teacher.findOneAndUpdate(
      { employee_no: prof.empNo },
      {
        user_id: user._id,
        employee_no: prof.empNo,
        full_name: prof.name,
        phone: prof.phone,
      },
      { upsert: true, new: true }
    );
    teachers.push(teacher);
  }

  // 3. Guardians (~45 total, including guardian1 with 2 kids and guardian2 with 1 kid)
  const guardianUsers: IUser[] = [];
  const guardians: IGuardian[] = [];

  // Demo Guardian 1
  const g1User = await User.findOneAndUpdate(
    { email: 'guardian1@school.demo' },
    {
      email: 'guardian1@school.demo',
      password_hash: passwordHash,
      role: UserRole.GUARDIAN,
      is_active: true,
      failed_logins: 0,
      locked_until: null,
    },
    { upsert: true, new: true }
  );
  guardianUsers.push(g1User);

  const g1 = await Guardian.findOneAndUpdate(
    { user_id: g1User._id },
    {
      user_id: g1User._id,
      full_name: 'Robert Davis',
      phone: '+91 98765 43220',
    },
    { upsert: true, new: true }
  );
  guardians.push(g1);

  // Demo Guardian 2
  const g2User = await User.findOneAndUpdate(
    { email: 'guardian2@school.demo' },
    {
      email: 'guardian2@school.demo',
      password_hash: passwordHash,
      role: UserRole.GUARDIAN,
      is_active: true,
      failed_logins: 0,
      locked_until: null,
    },
    { upsert: true, new: true }
  );
  guardianUsers.push(g2User);

  const g2 = await Guardian.findOneAndUpdate(
    { user_id: g2User._id },
    {
      user_id: g2User._id,
      full_name: 'Anita Patel',
      phone: '+91 98765 43221',
    },
    { upsert: true, new: true }
  );
  guardians.push(g2);

  // Generate 43 more guardians
  for (let i = 3; i <= 45; i++) {
    const email = `guardian${i}@school.demo`;
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const fullName = `${firstName} ${lastName}`;
    const phone = faker.helpers.fromRegExp('+91 98[0-9]{3} [0-9]{5}');

    const user = await User.findOneAndUpdate(
      { email },
      {
        email,
        password_hash: passwordHash,
        role: UserRole.GUARDIAN,
        is_active: true,
        failed_logins: 0,
        locked_until: null,
      },
      { upsert: true, new: true }
    );
    guardianUsers.push(user);

    const guardian = await Guardian.findOneAndUpdate(
      { user_id: user._id },
      {
        user_id: user._id,
        full_name: fullName,
        phone,
      },
      { upsert: true, new: true }
    );
    guardians.push(guardian);
  }

  // 4. Students (~60 total, admission_no ADM001 to ADM060)
  const students: IStudent[] = [];
  for (let i = 1; i <= 60; i++) {
    const admissionNo = `ADM${String(i).padStart(3, '0')}`;
    let fullName: string;

    if (i === 1) {
      fullName = 'Leo Davis'; // Child 1 of guardian1 (siblings)
    } else if (i === 2) {
      fullName = 'Maya Davis'; // Child 2 of guardian1 (siblings)
    } else if (i === 3) {
      fullName = 'Rohan Patel'; // Child of guardian2
    } else {
      fullName = `${faker.person.firstName()} ${faker.person.lastName()}`;
    }

    const gender = i % 2 === 0 ? Gender.FEMALE : Gender.MALE;
    // Age ~11-14 years old for Grade 6-8
    const birthYear = 2012 + (i % 3);
    const dob = new Date(birthYear, (i * 2) % 12, (i * 3) % 28 + 1);

    const student = await Student.findOneAndUpdate(
      { admission_no: admissionNo },
      {
        admission_no: admissionNo,
        full_name: fullName,
        dob,
        gender,
        status: StudentStatus.ACTIVE,
      },
      { upsert: true, new: true }
    );
    students.push(student);
  }

  // 5. Student-Guardian Relationships
  // Case A: Guardian 1 has 2 students (siblings Leo Davis & Maya Davis)
  await StudentGuardian.findOneAndUpdate(
    { student_id: students[0]._id, guardian_id: guardians[0]._id },
    {
      student_id: students[0]._id,
      guardian_id: guardians[0]._id,
      relationship: GuardianRelationship.FATHER,
      is_primary: true,
    },
    { upsert: true }
  );

  await StudentGuardian.findOneAndUpdate(
    { student_id: students[1]._id, guardian_id: guardians[0]._id },
    {
      student_id: students[1]._id,
      guardian_id: guardians[0]._id,
      relationship: GuardianRelationship.FATHER,
      is_primary: true,
    },
    { upsert: true }
  );

  // Case B: Guardian 2 has 1 student (Rohan Patel)
  await StudentGuardian.findOneAndUpdate(
    { student_id: students[2]._id, guardian_id: guardians[1]._id },
    {
      student_id: students[2]._id,
      guardian_id: guardians[1]._id,
      relationship: GuardianRelationship.MOTHER,
      is_primary: true,
    },
    { upsert: true }
  );

  // Case C: Student 3 (Rohan Patel) also has a second guardian (Father: guardian3)
  await StudentGuardian.findOneAndUpdate(
    { student_id: students[2]._id, guardian_id: guardians[2]._id },
    {
      student_id: students[2]._id,
      guardian_id: guardians[2]._id,
      relationship: GuardianRelationship.FATHER,
      is_primary: false, // Second guardian (not primary)
    },
    { upsert: true }
  );

  // Link remaining students 4..60 to remaining guardians 4..45
  for (let i = 3; i < 60; i++) {
    const guardianIdx = 3 + (i % 42); // distribute among guardians
    await StudentGuardian.findOneAndUpdate(
      { student_id: students[i]._id, guardian_id: guardians[guardianIdx]._id },
      {
        student_id: students[i]._id,
        guardian_id: guardians[guardianIdx]._id,
        relationship: i % 2 === 0 ? GuardianRelationship.MOTHER : GuardianRelationship.FATHER,
        is_primary: true,
      },
      { upsert: true }
    );
  }

  return {
    adminUser,
    teachers,
    teacherUsers,
    guardians,
    guardianUsers,
    students,
  };
}
