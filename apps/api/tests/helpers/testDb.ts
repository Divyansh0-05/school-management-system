import { connectDb, disconnectDb } from '../../src/db/connection.js';
import { env } from '../../src/config/env.js';

export async function setupTestDb(): Promise<void> {
  try {
    await connectDb(env.MONGODB_TEST_URI);
  } catch (err) {
    console.warn('Could not connect to MongoDB test instance:', err);
  }
}

export async function teardownTestDb(): Promise<void> {
  await disconnectDb();
}

