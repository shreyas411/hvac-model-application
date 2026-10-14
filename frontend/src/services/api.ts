const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`;

/** Production builds (or VITE_REQUIRE_LOGIN=true) use real Supabase login; otherwise the dev x-dev-user identity. */
export const REAL_AUTH = import.meta.env.PROD || import.meta.env.VITE_REQUIRE_LOGIN === 'true';

const TOKEN_KEY = 'apexhvac_token';
const REFRESH_KEY = 'apexhvac_refresh_token';
const DEV_KEY = 'apexhvac_dev_user';

/** Dev-only identity (x-dev-user header); never sent when REAL_AUTH is on. */
export const setDevUser = (u: string) => localStorage.setItem(DEV_KEY, u);

export interface Session { accessToken: string; refreshToken: string }
export const getSession = () => localStorage.getItem(TOKEN_KEY);
export const setSession = (s: Session | null) => {
  if (s) {
    localStorage.setItem(TOKEN_KEY, s.accessToken);
    localStorage.setItem(REFRESH_KEY, s.refreshToken);
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }
};

/** Fired when the session can't be renewed, so the UI can show the login screen. */
export const SESSION_EXPIRED = 'apexhvac:session-expired';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public issues?: unknown) {
    super(message);
  }
}

async function send(method: string, path: string, body?: unknown, token: string | null = getSession()) {
  const devUser = REAL_AUTH ? null : localStorage.getItem(DEV_KEY) ?? import.meta.env.VITE_DEV_USER;
  return fetch(BASE + path, {
    method,
    headers: {
      ...(body !== undefined && { 'content-type': 'application/json' }),
      ...(token && { authorization: `Bearer ${token}` }),
      ...(!token && devUser && { 'x-dev-user': devUser }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// One refresh at a time: parallel 401s (the app loads ~11 lists at once) share the same attempt.
type Refresh = 'renewed' | 'refused' | 'network';
let refreshing: Promise<Refresh> | null = null;
function refresh(): Promise<Refresh> {
  refreshing ??= (async (): Promise<Refresh> => {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return 'refused';
    try {
      const res = await send('POST', '/auth/refresh', { refreshToken }, null);
      if (!res.ok) return 'refused';
      setSession(await res.json());
      return 'renewed';
    } catch {
      return 'network'; // keep the session; the caller just sees its original 401
    }
  })().finally(() => { refreshing = null; });
  return refreshing;
}

/** The single place that talks HTTP to the backend. */
export async function api<T = void>(method: string, path: string, body?: unknown): Promise<T> {
  let res = await send(method, path, body);
  if (res.status === 401 && REAL_AUTH && getSession() && path !== '/auth/login') {
    const r = await refresh();
    if (r === 'renewed') res = await send(method, path, body);
    else if (r === 'refused') {
      setSession(null);
      window.dispatchEvent(new Event(SESSION_EXPIRED));
    }
  }
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.code ?? 'ERROR', json.detail ?? res.statusText, json.issues);
  return json as T;
}
