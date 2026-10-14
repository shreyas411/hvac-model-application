import type { User } from '../types';
import { api, getSession, setSession, type Session } from './api';

/** Supabase login through the backend; the API never stores passwords. */
export const auth = {
  async login(email: string, password: string) {
    setSession(await api<Session>('POST', '/auth/login', { email, password }));
  },
  /** The signed-in user's profile, or null when there's no valid session. */
  async me(): Promise<User | null> {
    if (!getSession()) return null;
    return api<User>('GET', '/auth/me');
  },
  async logout() {
    try { await api('POST', '/auth/logout'); } catch { /* the token is dropped locally either way */ }
    setSession(null);
  },
};
