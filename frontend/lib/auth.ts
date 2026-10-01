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

