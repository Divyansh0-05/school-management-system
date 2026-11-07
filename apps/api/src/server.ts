import { createServer } from 'node:http';
import { app } from './app.js';
import { env } from './config/env.js';
import { connectDb, disconnectDb } from './db/connection.js';
import { logger } from './utils/logger.js';

const server = createServer(app);

async function startServer() {
  try {
    // Attempt DB connection (non-fatal on boot to allow health check to report cold start / degraded)
    try {
      await connectDb();
    } catch (dbErr) {
      logger.warn({ dbErr }, 'Initial database connection failed; will retry on incoming requests');
    }

    server.listen(env.PORT, () => {
      logger.info(`API server running on ${env.API_URL} (Port ${env.PORT}) in ${env.NODE_ENV} mode`);
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start API server');
    process.exit(1);
  }
}

async function handleShutdown(signal: string) {
  logger.info(`Received ${signal}. Gracefully shutting down API server...`);
  server.close(async () => {
    try {
      await disconnectDb();
      logger.info('API server closed gracefully');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during graceful shutdown');
      process.exit(1);
    }
  });

  // Force shutdown after 10s timeout
  setTimeout(() => {
    logger.error('Forcefully terminating process due to shutdown timeout');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

startServer();

