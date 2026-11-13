import type { Request, Response, NextFunction } from 'express';
import { UserRole } from '@school/shared';
import { verifyAuthToken, signAuthToken, AuthTokenPayload } from '../modules/auth/auth.tokens.js';
import { UnauthorizedError, ForbiddenError } from '../errors/appError.js';
import { env } from '../config/env.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  let token: string | undefined;

  // 1. Check signed/unsigned cookies
  if (req.cookies && req.cookies.auth_token) {
    token = req.cookies.auth_token;
  }

  // 2. Fallback to Authorization header
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    next(new UnauthorizedError('Authentication token required', 'TOKEN_REQUIRED'));
    return;
  }

  try {
    const payload = verifyAuthToken(token);
    req.user = payload;

      // Sliding refresh: issue a fresh 15-minute token on every valid authenticated request
    const refreshed = signAuthToken({
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      fullName: payload.fullName,
      teacherId: payload.teacherId,
      guardianId: payload.guardianId,
    });
    const isProduction = env.NODE_ENV === 'production';
    res.cookie('auth_token', refreshed, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    next();
  } catch (err: unknown) {
    const errorName = (err as Error).name;
    if (errorName === 'TokenExpiredError') {
      next(new UnauthorizedError('Authentication token has expired', 'TOKEN_EXPIRED'));
    } else {
      next(new UnauthorizedError('Invalid authentication token', 'TOKEN_INVALID'));
    }
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Authentication required', 'AUTHENTICATION_REQUIRED'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(
        new ForbiddenError(
          `Access forbidden: required role [${allowedRoles.join(', ')}], current role is [${req.user.role}]`,
          'ROLE_NOT_PERMITTED'
        )
      );
      return;
    }

    next();
  };
}
