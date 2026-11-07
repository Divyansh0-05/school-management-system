import mongoose, { ClientSession } from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let isConnected = false;

export async function connectDb(uri?: string): Promise<typeof mongoose> {
  const mongoUri = uri || (env.NODE_ENV === 'test' ? env.MONGODB_TEST_URI : env.MONGODB_URI);

  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose;
  }

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true,
    });
    isConnected = true;
    logger.info({ uri: mongoUri.replace(/\/\/.*@/, '//<redacted>@') }, 'Connected to MongoDB');
    return conn;
  } catch (error) {
    logger.error({ error, uri: mongoUri }, 'Failed to connect to MongoDB');
    throw error;
  }
}

export async function disconnectDb(): Promise<void> {
  if (isConnected || mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isConnected = false;
    logger.info('Disconnected from MongoDB');
  }
}

export function getDbStatus(): {
  status: 'connected' | 'disconnected' | 'connecting';
  replicaSet?: string;
} {
  const state = mongoose.connection.readyState;
  switch (state) {
    case 1:
      return {
        status: 'connected',
        replicaSet: mongoose.connection.getClient()?.options?.replicaSet || 'rs0',
      };
    case 2:
      return { status: 'connecting' };
    default:
      return { status: 'disconnected' };
  }
}

export async function withTransaction<T>(
  fn: (session: ClientSession) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}

