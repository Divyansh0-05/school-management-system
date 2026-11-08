import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { LoginRequestSchema, ChangePasswordRequestSchema } from '@school/shared';
import { authController } from './auth.controller.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';

export const authRouter = Router();

// Rate limiting for login: max 15 requests per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    type: 'https://school.demo/errors/TOO_MANY_REQUESTS',
    title: 'TooManyRequests',
    status: 429,
    code: 'TOO_MANY_REQUESTS',
    detail: 'Too many login attempts. Please try again later.',
  },
});

authRouter.post(
  '/login',
  loginLimiter,
  validate({ body: LoginRequestSchema }),
  authController.login
);

authRouter.post('/logout', authController.logout);

authRouter.get('/me', requireAuth, authController.getMe);

authRouter.post(
  '/change-password',
  requireAuth,
  validate({ body: ChangePasswordRequestSchema }),
  authController.changePassword
);

