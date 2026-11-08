import bcrypt from 'bcryptjs';
import type { UserProfile } from '@school/shared';
import { User } from '../../models/User.js';
import { Teacher } from '../../models/Teacher.js';
import { Guardian } from '../../models/Guardian.js';
import { env } from '../../config/env.js';
import { UnauthorizedError, NotFoundError, ValidationError } from '../../errors/appError.js';
import { signAuthToken, AuthTokenPayload } from './auth.tokens.js';

// Dummy hash used to mitigate timing attacks when a non-existent email is queried
const DUMMY_HASH = '$2a$12$e80yqV8tTq8m5pZ/H1d8.eM3kZp91m5T9jV3o8P4z1B9K7c3T4j2y';

export class AuthService {
  async login(
    email: string,
    password: string
  ): Promise<{ user: UserProfile; token: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      // Execute dummy compare to prevent timing differences
      await bcrypt.compare(password, DUMMY_HASH);
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    // Check account lockout
    if (user.locked_until && user.locked_until > new Date()) {
      const remainingMinutes = Math.ceil(
        (user.locked_until.getTime() - Date.now()) / (60 * 1000)
      );
      throw new UnauthorizedError(
        `Account is locked due to multiple failed login attempts. Please try again in ${remainingMinutes} minute(s).`,
        'ACCOUNT_LOCKED'
      );
    }

    // Check account activation
    if (!user.is_active) {
      throw new UnauthorizedError(
        'Account is deactivated. Please contact school administration.',
        'ACCOUNT_DEACTIVATED'
      );
    }

    // Verify password (bcrypt cost >= 12)
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      user.failed_logins += 1;
      if (user.failed_logins >= env.AUTH_MAX_FAILED_LOGINS) {
        user.locked_until = new Date(Date.now() + env.AUTH_LOCKOUT_MINUTES * 60 * 1000);
      }
      await user.save();
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    // Successful login: reset failed login attempts and lockout
    user.failed_logins = 0;
    user.locked_until = null;
    await user.save();

    // Fetch associated entity details
    let fullName = 'Administrator';
    let teacherId: string | undefined;
    let guardianId: string | undefined;

    if (user.role === 'TEACHER') {
      const teacher = await Teacher.findOne({ user_id: user._id });
      if (teacher) {
        fullName = teacher.full_name;
        teacherId = teacher._id.toString();
      }
    } else if (user.role === 'GUARDIAN') {
      const guardian = await Guardian.findOne({ user_id: user._id });
      if (guardian) {
        fullName = guardian.full_name;
        guardianId = guardian._id.toString();
      }
    }

    const payload: AuthTokenPayload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      fullName,
      teacherId,
      guardianId,
    };

    const token = signAuthToken(payload);

    const userProfile: UserProfile = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      fullName,
      teacherId,
      guardianId,
      isActive: user.is_active,
    };

    return { user: userProfile, token };
  }

  async changePassword(
    userId: string,
    currentPass: string,
    newPass: string
  ): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    const isCurrentValid = await bcrypt.compare(currentPass, user.password_hash);
    if (!isCurrentValid) {
      throw new UnauthorizedError('Current password is incorrect', 'INVALID_CURRENT_PASSWORD');
    }

    if (currentPass === newPass) {
      throw new ValidationError('New password must be different from current password', [
        { path: 'newPassword', message: 'New password cannot match old password' },
      ]);
    }

    const newHash = await bcrypt.hash(newPass, 12);
    user.password_hash = newHash;
    await user.save();
  }

  async getMe(userId: string): Promise<UserProfile> {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    let fullName = 'Administrator';
    let teacherId: string | undefined;
    let guardianId: string | undefined;

    if (user.role === 'TEACHER') {
      const teacher = await Teacher.findOne({ user_id: user._id });
      if (teacher) {
        fullName = teacher.full_name;
        teacherId = teacher._id.toString();
      }
    } else if (user.role === 'GUARDIAN') {
      const guardian = await Guardian.findOne({ user_id: user._id });
      if (guardian) {
        fullName = guardian.full_name;
        guardianId = guardian._id.toString();
      }
    }

    return {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      fullName,
      teacherId,
      guardianId,
      isActive: user.is_active,
    };
  }
}

export const authService = new AuthService();

