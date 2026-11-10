import { env } from '../config/env.js';
import { connectDb, disconnectDb } from '../db/connection.js';
import { logger } from '../utils/logger.js';
import { seedIdentity } from './identity.js';
import { seedAcademics } from './academics.js';
import { seedAttendance } from './attendance.js';
import { seedExams } from './exams.js';
import { seedFees } from './fees.js';

export async function seed(dbUri?: string): Promise<void> {
  if (env.NODE_ENV === 'production' && env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error(
      'Demo seed execution is prohibited in production without ALLOW_DEMO_SEED=true'
    );
  }

  logger.info('Starting idempotent database seed...');
  await connectDb(dbUri);

  try {
    // Phase 1A: Identity and Academics
    logger.info('Seeding identity (admin, teachers, guardians, students)...');
    const identity = await seedIdentity();

    logger.info('Seeding academics (year, classes, sections, subjects, enrollments, assignments)...');
    const academics = await seedAcademics(identity.teachers, identity.students);
    logger.info('Seeding deterministic attendance history...');
    await seedAttendance(academics.academicYear, identity.teachers);
    logger.info('Seeding deterministic exams and marks...');
    await seedExams(academics, identity.adminUser._id);
    logger.info('Seeding deterministic fee invoices and ledger entries...');
    await seedFees(academics, identity.students, identity.adminUser._id);

    logger.info(
      {
        teachersCount: identity.teachers.length,
        guardiansCount: identity.guardians.length,
        studentsCount: identity.students.length,
        classesCount: academics.classes.length,
        sectionsCount: academics.sections.length,
        subjectsCount: academics.subjects.length,
      },
      'Database seeded successfully!'
    );
  } catch (err) {
    logger.error({ err }, 'Error during database seed');
    throw err;
  }
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].endsWith('index.ts')) {
  seed()
    .then(async () => {
      console.log('Seed completed successfully.');
      await disconnectDb();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Seed failed:', err);
      await disconnectDb();
      process.exit(1);
    });
}
