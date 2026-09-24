/**
 * Auth types and helpers.
 * Re-exports User and session utils while delegating authentication calls to lib/api.
 */

export type UserRole = 'ADMIN' | 'CITIZEN';

export type User = {
  id?: number;
  email: string;
  role: UserRole;
  full_name?: string;
  steg_contract_no?: string;
};

// Hard-coded demo credentials for the helper panel (display only)
export const DEMO_USERS = [
  {
    email: 'admin@example.com',
    password: 'admin123',
    role: 'ADMIN' as UserRole,
  },
  {
    email: 'citizen@example.com',
    password: 'citizen123',
    role: 'CITIZEN' as UserRole,
  },
];

export function getSession() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('session');
  return raw ? JSON.parse(raw) : null;
}

export function logout() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('session');
    localStorage.removeItem('steg_solar_token');
    document.cookie = 'steg_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0';
    document.cookie = 'steg_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0';
  }
}

export function getDemoCredentials() {
  return DEMO_USERS;
}
