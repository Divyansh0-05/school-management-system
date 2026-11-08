import { z } from 'zod';
import { UserRole } from '../constants/roles.js';

export const LoginRequestSchema = z.object({
  email: z.string().email('Valid email address required').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const ChangePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters long')
    .max(128, 'New password is too long'),
});

export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;

export const UserProfileSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: z.enum([UserRole.ADMIN, UserRole.TEACHER, UserRole.GUARDIAN]),
  fullName: z.string(),
  teacherId: z.string().optional(),
  guardianId: z.string().optional(),
  isActive: z.boolean(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

export const AuthResponseSchema = z.object({
  user: UserProfileSchema,
  message: z.string().optional(),
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;

