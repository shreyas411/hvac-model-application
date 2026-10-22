import type { User } from '../types';
import { api, ApiError, refresh } from './api';

/** Login goes through the backend; it answers with httpOnly cookies, so there is nothing to store here. */
export const auth = {
  async login(email: string, password: string) {
    await api('POST', '/auth/login', { email, password });
  },
  /** The signed-in user's profile, or null when there's no valid session (a network error still throws). */
  async me(): Promise<User | null> {
    // api() turns a 200 with a non-JSON body (the SPA's index.html where /api isn't routed) into {}: that is not a profile.
    const profile = (u?: User) => (u?.id && u.role ? u : null);
    try {
      return profile(await api<User>('GET', '/auth/me'));
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) throw e;
      return (await refresh()) === 'renewed' ? api<User>('GET', '/auth/me').then(profile).catch(() => null) : null;
    }
  },
  async logout() {
    try { await api('POST', '/auth/logout'); } catch { /* the cookies are cleared server-side; a reload shows the login */ }
    await caches?.delete('api-cache'); // the service worker's offline copy of the last user's data
  },
};
