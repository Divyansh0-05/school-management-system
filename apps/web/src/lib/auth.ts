import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

export interface ServerUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'TEACHER' | 'GUARDIAN';
  fullName: string;
  isActive: boolean;
}

export async function requireUser(): Promise<ServerUser> {
  const cookieHeader = headers().get('cookie') || cookies().getAll().map(({ name, value }) => `${name}=${value}`).join('; ');
  const baseUrl = process.env.API_URL || 'http://127.0.0.1:5000';
  const response = await fetch(`${baseUrl}/api/v1/auth/me`, {
    headers: { Cookie: cookieHeader },
    cache: 'no-store',
  }).catch(() => null);
  if (!response?.ok) redirect('/login');
  const body = (await response.json()) as { user: ServerUser };
  return body.user;
}
