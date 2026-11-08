import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from workspace root if running in local dev/test
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config(); // fallback to local

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  API_URL: z.string().default('http://localhost:5000'),
  WEB_URL: z.string().default('http://localhost:3000'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/school_management?replicaSet=rs0'),
  MONGODB_TEST_URI: z.string().default('mongodb://localhost:27018/school_management_test?replicaSet=rs0'),
  JWT_SECRET: z.string().min(16).default('development-jwt-secret-min-16-characters-long'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_SECRET: z.string().min(16).default('development-refresh-token-secret-min-16-chars'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  COOKIE_SECRET: z.string().min(16).default('development-cookie-secret-min-16-chars-long'),
  ATTENDANCE_EDIT_WINDOW_DAYS: z.coerce.number().default(2),
  SCHOOL_TIMEZONE: z.string().default('Asia/Kolkata'),
  ALLOW_DEMO_SEED: z.enum(['true', 'false']).default('false'),
  AUTH_MAX_FAILED_LOGINS: z.coerce.number().default(5),
  AUTH_LOCKOUT_MINUTES: z.coerce.number().default(15),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables configuration:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;

