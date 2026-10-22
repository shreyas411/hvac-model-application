const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`;

/** Production builds (or VITE_REQUIRE_LOGIN=true) use real Supabase login; otherwise the dev x-dev-user identity. */
export const REAL_AUTH = import.meta.env.PROD || import.meta.env.VITE_REQUIRE_LOGIN === 'true';

const DEV_KEY = 'apexhvac_dev_user';

// Sessions are httpOnly cookies set by the API: page scripts never see a token. Drop any token an older build left in localStorage.
localStorage.removeItem('apexhvac_token');
localStorage.removeItem('apexhvac_refresh_token');

/** Dev-only identity (x-dev-user header); never sent when REAL_AUTH is on. */
export const setDevUser = (u: string) => localStorage.setItem(DEV_KEY, u);

/** Fired when the session can't be renewed, so the UI can show the login screen. */
export const SESSION_EXPIRED = 'apexhvac:session-expired';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public issues?: unknown) {
    super(message);
  }
}

async function send(method: string, path: string, body?: unknown) {
  const devUser = REAL_AUTH ? null : localStorage.getItem(DEV_KEY) ?? import.meta.env.VITE_DEV_USER ?? 'dev-admin';
  return fetch(BASE + path, {
    method,
    credentials: 'include', // send the session cookies (also on queued replays, which keep this setting)
    headers: {
      'x-requested-with': 'apexhvac', // CSRF guard: the API rejects cookie-authenticated writes without it
      ...(body !== undefined && { 'content-type': 'application/json' }),
      ...(devUser && { 'x-dev-user': devUser }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// One refresh at a time: parallel 401s (the app loads ~11 lists at once) share the same attempt.
type Refresh = 'renewed' | 'refused' | 'network';
let refreshing: Promise<Refresh> | null = null;
export function refresh(): Promise<Refresh> {
  refreshing ??= (async (): Promise<Refresh> => {
    try {
      const res = await send('POST', '/auth/refresh');
      if (!res.ok) return 'refused';
      navigator.serviceWorker?.controller?.postMessage('drain'); // new cookies are set: let the worker resume its queue
      return 'renewed';
    } catch {
      return 'network'; // keep the session; the caller just sees its original 401
    }
  })().finally(() => { refreshing = null; });
  return refreshing;
}

// True when the worker's write queue (not the server) answered the latest write, so the UI can say "saved on this phone" instead of "saved".
let queued = false;
export const wasQueued = () => queued;

/** The single place that talks HTTP to the backend. */
export async function api<T = void>(method: string, path: string, body?: unknown): Promise<T> {
  let res = await send(method, path, body);
  if (res.status === 401 && REAL_AUTH && !path.startsWith('/auth/')) {
    const r = await refresh();
    if (r === 'renewed') res = await send(method, path, body);
    else if (r === 'refused') {
      window.dispatchEvent(new Event(SESSION_EXPIRED));
    }
  }
  // 202 {queued:true}: the service worker's write queue holds it (offline); it syncs later and the lists reload
  if (method !== 'GET') queued = res.status === 202;
  if (res.status === 204 || res.status === 202) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.code ?? 'ERROR', json.detail ?? res.statusText, json.issues);
  return json as T;
}

/** Download a binary (PDF) response as a Blob. */
export async function apiBlob(path: string): Promise<Blob> {
  const res = await send('GET', path);
  if (!res.ok) throw new ApiError(res.status, 'ERROR', (await res.json().catch(() => ({}))).detail ?? res.statusText);
  return res.blob();
}
