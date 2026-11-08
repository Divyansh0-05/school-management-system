import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb } from '../helpers/testDb.js';
import { resetDatabase } from '../../src/seed/reset.js';
import { User } from '../../src/models/User.js';
import { Student } from '../../src/models/Student.js';
import { Teacher } from '../../src/models/Teacher.js';
import { Guardian } from '../../src/models/Guardian.js';
import { Class } from '../../src/models/Class.js';
import { Section } from '../../src/models/Section.js';
import { Subject } from '../../src/models/Subject.js';
import { Enrollment } from '../../src/models/Enrollment.js';
import { TeacherAssignment } from '../../src/models/TeacherAssignment.js';
import { env } from '../../src/config/env.js';

describe('Migration & Seed Integrity on Fresh Database', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('successfully resets, applies migrations, and runs idempotent seed on empty database', async () => {
    // Execute resetDatabase which drops DB, migrates collections, and seeds demo data
    await resetDatabase(env.MONGODB_TEST_URI);

    // Verify all collections exist
    const collections = await mongoose.connection.db!.listCollections().toArray();
    const collectionNames = collections.map((c) => c.name);

    expect(collectionNames).toContain('users');
    expect(collectionNames).toContain('teachers');
    expect(collectionNames).toContain('guardians');
    expect(collectionNames).toContain('students');
    expect(collectionNames).toContain('academic_years');
    expect(collectionNames).toContain('classes');
    expect(collectionNames).toContain('sections');
    expect(collectionNames).toContain('subjects');
    expect(collectionNames).toContain('enrollments');
    expect(collectionNames).toContain('teacher_assignments');
    expect(collectionNames).toContain('changelog');

    // Verify entity counts from §9
    const [
      usersCount,
      teachersCount,
      guardiansCount,
      studentsCount,
      classesCount,
      sectionsCount,
      subjectsCount,
      enrollmentsCount,
      teacherAssignmentsCount,
    ] = await Promise.all([
      User.countDocuments(),
      Teacher.countDocuments(),
      Guardian.countDocuments(),
      Student.countDocuments(),
      Class.countDocuments(),
      Section.countDocuments(),
      Subject.countDocuments(),
      Enrollment.countDocuments(),
      TeacherAssignment.countDocuments(),
    ]);

    expect(teachersCount).toBe(6);
    expect(guardiansCount).toBe(45);
    expect(studentsCount).toBe(60);
    expect(classesCount).toBe(3);
    expect(sectionsCount).toBe(6);
    expect(subjectsCount).toBe(8);
    expect(enrollmentsCount).toBe(60);
    expect(teacherAssignmentsCount).toBeGreaterThan(0);
    expect(usersCount).toBeGreaterThanOrEqual(1 + teachersCount + guardiansCount);

    // Verify Demo Accounts Exist
    const adminUser = await User.findOne({ email: 'admin@school.demo' });
    expect(adminUser).toBeDefined();
    expect(adminUser?.role).toBe('ADMIN');

    const teacher2User = await User.findOne({ email: 'teacher2@school.demo' });
    expect(teacher2User).toBeDefined();

    // Verify teacher2 single-section assignment invariant (A1 proof)
    const teacher2Doc = await Teacher.findOne({ user_id: teacher2User?._id });
    const teacher2Assignments = await TeacherAssignment.find({ teacher_id: teacher2Doc?._id });
    expect(teacher2Assignments.length).toBe(1);
  });
});

