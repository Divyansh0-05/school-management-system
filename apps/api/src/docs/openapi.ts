import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  HealthCheckResponseSchema,
  ApiErrorResponseSchema,
  LoginRequestSchema,
  AuthResponseSchema,
  ChangePasswordRequestSchema,
  StudentQuerySchema,
  StudentResponseSchema,
  StudentDetailResponseSchema,
  MasterQuerySchema,
  MasterBodySchemas,
  AttendanceBulkBodySchema,
  AttendanceDateQuerySchema,
  AttendanceReportQuerySchema,
  SingleAttendanceBodySchema,
  StudentAttendanceSummaryQuerySchema,
} from '@school/shared';

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// Register Bearer Auth Security Scheme
registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'JWT authorization header using the Bearer scheme or httpOnly auth_token cookie',
});

// Register Schemas
registry.register('HealthCheckResponse', HealthCheckResponseSchema);
registry.register('ApiErrorResponse', ApiErrorResponseSchema);
registry.register('LoginRequest', LoginRequestSchema);
registry.register('AuthResponse', AuthResponseSchema);
registry.register('ChangePasswordRequest', ChangePasswordRequestSchema);
registry.register('StudentQuery', StudentQuerySchema);
registry.register('StudentResponse', StudentResponseSchema);
registry.register('StudentDetailResponse', StudentDetailResponseSchema);
registry.register('MasterQuery', MasterQuerySchema);
registry.register('AttendanceBulkBody', AttendanceBulkBodySchema);
registry.register('SingleAttendanceBody', SingleAttendanceBodySchema);

// Register Paths

// 1. Health & Ready
registry.registerPath({
  method: 'get',
  path: '/api/health',
  summary: 'API Health Probe',
  description: 'Returns the operational health, database replica set status, and uptime of the API service.',
  tags: ['Observability'],
  responses: {
    200: {
      description: 'Service is healthy or degraded',
      content: { 'application/json': { schema: HealthCheckResponseSchema } },
    },
  },
});

const attendanceErrorResponses = {
  401: { description: 'Unauthenticated', content: { 'application/json': { schema: ApiErrorResponseSchema } } },
  403: { description: 'Role or edit-window restriction', content: { 'application/json': { schema: ApiErrorResponseSchema } } },
  404: { description: 'Resource not found or outside scope', content: { 'application/json': { schema: ApiErrorResponseSchema } } },
  422: { description: 'Invalid attendance request', content: { 'application/json': { schema: ApiErrorResponseSchema } } },
};

registry.registerPath({ method: 'get', path: '/api/v1/sections', summary: 'List accessible sections', tags: ['Attendance'], security: [{ bearerAuth: [] }], responses: { 200: { description: 'Accessible sections' }, ...attendanceErrorResponses } });
registry.registerPath({ method: 'get', path: '/api/v1/sections/{id}/students', summary: 'List current section students', tags: ['Attendance'], security: [{ bearerAuth: [] }], responses: { 200: { description: 'Enrolled students' }, ...attendanceErrorResponses } });
registry.registerPath({ method: 'get', path: '/api/v1/sections/{id}/attendance', summary: 'Read section attendance', tags: ['Attendance'], security: [{ bearerAuth: [] }], request: { query: AttendanceDateQuerySchema }, responses: { 200: { description: 'Attendance for a date and session' }, ...attendanceErrorResponses } });
registry.registerPath({ method: 'put', path: '/api/v1/sections/{id}/attendance', summary: 'Idempotently record section attendance', tags: ['Attendance'], security: [{ bearerAuth: [] }], request: { body: { content: { 'application/json': { schema: AttendanceBulkBodySchema } } } }, responses: { 200: { description: 'Attendance saved' }, ...attendanceErrorResponses } });
registry.registerPath({ method: 'post', path: '/api/v1/attendance', summary: 'Record one attendance row', tags: ['Attendance'], security: [{ bearerAuth: [] }], request: { body: { content: { 'application/json': { schema: SingleAttendanceBodySchema } } } }, responses: { 201: { description: 'Attendance created' }, 409: { description: 'Already recorded', content: { 'application/json': { schema: ApiErrorResponseSchema } } }, ...attendanceErrorResponses } });
registry.registerPath({ method: 'get', path: '/api/v1/reports/attendance/section', summary: 'Summarize section attendance', tags: ['Attendance'], security: [{ bearerAuth: [] }], request: { query: AttendanceReportQuerySchema }, responses: { 200: { description: 'Section attendance summary' }, ...attendanceErrorResponses } });
registry.registerPath({ method: 'get', path: '/api/v1/students/{id}/attendance-summary', summary: 'Summarize student attendance', tags: ['Attendance'], security: [{ bearerAuth: [] }], request: { query: StudentAttendanceSummaryQuerySchema }, responses: { 200: { description: 'Student attendance summary' }, ...attendanceErrorResponses } });

for (const resource of Object.keys(MasterBodySchemas)) {
  const schema = MasterBodySchemas[resource as keyof typeof MasterBodySchemas];
  registry.registerPath({
    method: 'get',
    path: `/api/v1/${resource}`,
    summary: `List ${resource}`,
    tags: ['Master Data'],
    security: [{ bearerAuth: [] }],
    request: { query: MasterQuerySchema },
    responses: {
      200: { description: 'Paginated resource list' },
      401: { description: 'Unauthenticated', content: { 'application/json': { schema: ApiErrorResponseSchema } } },
      403: { description: 'Administrator role required', content: { 'application/json': { schema: ApiErrorResponseSchema } } },
    },
  });
  registry.registerPath({
    method: 'post',
    path: `/api/v1/${resource}`,
    summary: `Create ${resource}`,
    tags: ['Master Data'],
    security: [{ bearerAuth: [] }],
    request: { body: { content: { 'application/json': { schema } } } },
    responses: {
      201: { description: 'Created' },
      401: { description: 'Unauthenticated', content: { 'application/json': { schema: ApiErrorResponseSchema } } },
      403: { description: 'Administrator role required', content: { 'application/json': { schema: ApiErrorResponseSchema } } },
      409: { description: 'Duplicate or domain conflict', content: { 'application/json': { schema: ApiErrorResponseSchema } } },
      422: { description: 'Invalid input', content: { 'application/json': { schema: ApiErrorResponseSchema } } },
    },
  });
}

registry.registerPath({
  method: 'get',
  path: '/api/ready',
  summary: 'API Readiness Probe',
  description: 'Returns HTTP 200 when database connection is established; HTTP 503 otherwise.',
  tags: ['Observability'],
  responses: {
    200: { description: 'Service ready' },
    503: { description: 'Service not ready' },
  },
});

// 2. Auth Endpoints
registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/login',
  summary: 'User Login',
  description: 'Authenticates a user via email and password, setting an httpOnly JWT cookie.',
  tags: ['Authentication'],
  request: {
    body: {
      content: { 'application/json': { schema: LoginRequestSchema } },
    },
  },
  responses: {
    200: {
      description: 'Authentication successful',
      content: { 'application/json': { schema: AuthResponseSchema } },
    },
    401: {
      description: 'Invalid credentials, account locked, or deactivated',
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
    },
    429: {
      description: 'Rate limit exceeded for login attempts',
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/logout',
  summary: 'User Logout',
  description: 'Clears the authentication cookie and ends the session.',
  tags: ['Authentication'],
  responses: {
    200: {
      description: 'Logout successful',
      content: {
        'application/json': {
          schema: z.object({ message: z.string() }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/auth/me',
  summary: 'Current User Profile',
  description: 'Returns profile details and tenancy scope of the currently authenticated user.',
  tags: ['Authentication'],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Current user profile',
      content: { 'application/json': { schema: AuthResponseSchema } },
    },
    401: {
      description: 'Unauthenticated request',
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/change-password',
  summary: 'Change Password',
  description: 'Updates the authenticated user password with bcrypt hash verification.',
  tags: ['Authentication'],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: ChangePasswordRequestSchema } },
    },
  },
  responses: {
    200: {
      description: 'Password changed successfully',
      content: {
        'application/json': {
          schema: z.object({ message: z.string() }),
        },
      },
    },
    401: {
      description: 'Current password invalid',
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
    },
  },
});

// 3. Students Endpoints
registry.registerPath({
  method: 'get',
  path: '/api/v1/students',
  summary: 'List Students (Scoped)',
  description: 'Paginated list of students filtered by role scope: Admin views all, Teachers view assigned sections, Guardians view linked children.',
  tags: ['Students'],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Paginated list of students',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(StudentResponseSchema),
            meta: z.object({
              page: z.number(),
              pageSize: z.number(),
              total: z.number(),
              totalPages: z.number(),
            }),
          }),
        },
      },
    },
    401: {
      description: 'Unauthenticated',
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/students/{id}',
  summary: 'Get Student By ID (Scoped)',
  description: 'Fetches student profile, enrollment history, and guardian details. Returns 404 if record is out of the user scope to prevent existence leaks.',
  tags: ['Students'],
  security: [{ bearerAuth: [] }],
  parameters: [
    {
      name: 'id',
      in: 'path',
      required: true,
      schema: { type: 'string' },
      description: 'Student MongoDB ObjectId',
    },
  ],
  responses: {
    200: {
      description: 'Detailed student profile',
      content: {
        'application/json': {
          schema: z.object({ data: StudentDetailResponseSchema }),
        },
      },
    },
    401: {
      description: 'Unauthenticated',
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
    },
    404: {
      description: 'Student not found or out of scope',
      content: { 'application/json': { schema: ApiErrorResponseSchema } },
    },
  },
});

export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'School Management System API',
      version: '1.0.0',
      description:
        'Production REST API for school operations with role-based access control, attendance tracking, grading engine, and financial ledger.',
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Local development server',
      },
    ],
  });
}
