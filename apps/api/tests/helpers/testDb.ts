import mongoose from 'mongoose';
import { connectDb, disconnectDb } from '../../src/db/connection.js';
import { env } from '../../src/config/env.js';
// @ts-expect-error - JS migration file
import { up as applyBaselineMigrations } from '../../migrations/20261108000000-baseline-collections.js';

let isMigrated = false;

export async function setupTestDb(): Promise<void> {
  await connectDb(env.MONGODB_TEST_URI);
  if (!isMigrated && mongoose.connection.db) {
    await applyBaselineMigrations(mongoose.connection.db);
    isMigrated = true;
  }
}

export async function teardownTestDb(): Promise<void> {
  await disconnectDb();
}
