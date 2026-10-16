import type { User } from '../types';
import { api, ApiError, refresh } from './api';

/** Login goes through the backend; it answers with httpOnly cookies, so there is nothing to store here. */
export const auth = {
  async login(email: string, password: string) {
    await api('POST', '/auth/login', { email, password });
  },
  /** The signed-in user's profile, or null when there's no valid session (a network error still throws). */
  async me(): Promise<User | null> {
    try {
      return await api<User>('GET', '/auth/me');
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) throw e;
      return (await refresh()) === 'renewed' ? api<User>('GET', '/auth/me').catch(() => null) : null;
    }
  },
  async logout() {
    try { await api('POST', '/auth/logout'); } catch { /* the cookies are cleared server-side; a reload shows the login */ }
    await caches?.delete('api-cache'); // the service worker's offline copy of the last user's data
  },
};
