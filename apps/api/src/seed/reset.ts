import mongoose from 'mongoose';
import { database, up } from 'migrate-mongo';
import { env } from '../config/env.js';
import { connectDb, disconnectDb } from '../db/connection.js';
import { logger } from '../utils/logger.js';
import { seed } from './index.js';

export async function resetDatabase(dbUri?: string): Promise<void> {
  const uri = dbUri || (env.NODE_ENV === 'test' ? env.MONGODB_TEST_URI : env.MONGODB_URI);

  logger.info({ uri: uri.replace(/\/\/.*@/, '//<redacted>@') }, 'Resetting database...');
  await connectDb(uri);

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection not established');
  }

  // Drop all collections
  const collections = await db.listCollections().toArray();
  for (const c of collections) {
    if (!c.name.startsWith('system.')) {
      try {
        await db.collection(c.name).drop();
        logger.debug(`Dropped collection ${c.name}`);
      } catch (err: unknown) {
        logger.warn(`Could not drop collection ${c.name}: ${(err as Error).message}`);
      }
    }
  }

  // Disconnect mongoose before migrate-mongo
  await disconnectDb();

  // Run migrations
  try {
    const { db: migDb, client } = await database.connect();
    await up(migDb, client);
    await client.close();
    logger.info('Applied migrations up');
  } catch (migErr) {
    logger.warn({ migErr }, 'Migration step returned notice');
  }

  // Run seed
  await seed(uri);
  logger.info('Database reset and seeded successfully.');
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].endsWith('reset.ts')) {
  resetDatabase()
    .then(async () => {
      console.log('Database reset completed successfully.');
      await disconnectDb();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Database reset failed:', err);
      await disconnectDb();
      process.exit(1);
    });
}

