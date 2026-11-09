import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export * from './constants/roles.js';
export * from './constants/status.js';
export * from './schemas/health.js';
export * from './schemas/error.js';
export * from './schemas/auth.js';
export * from './schemas/student.js';
export * from './schemas/master-data.js';
export * from './schemas/attendance.js';
export * from './types/common.js';
export { z };
