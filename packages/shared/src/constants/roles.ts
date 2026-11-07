export const UserRole = {
  ADMIN: 'ADMIN',
  TEACHER: 'TEACHER',
  GUARDIAN: 'GUARDIAN',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ALL_ROLES = Object.values(UserRole);

