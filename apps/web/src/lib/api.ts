export interface ApiProblem {
  status?: number;
  code?: string;
  detail?: string;
  errors?: Array<{ path: string; message: string }>;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({}))) as ApiProblem;
    const error = new Error(problem.detail || `Request failed (${response.status})`) as Error & { problem?: ApiProblem };
    error.problem = { ...problem, status: response.status };
    throw error;
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export async function getMe() {
  return apiRequest<{ user: { id: string; email: string; role: 'ADMIN' | 'TEACHER' | 'GUARDIAN'; fullName: string; isActive: boolean } }>('/auth/me');
}
