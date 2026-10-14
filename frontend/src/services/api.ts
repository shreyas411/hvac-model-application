const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`;
const TOKEN_KEY = 'apexhvac_token';

const DEV_KEY = 'apexhvac_dev_user';
/** Dev-only identity (x-dev-user header); the backend honours it only when Supabase auth isn't configured. */
export const setDevUser = (u: string) => localStorage.setItem(DEV_KEY, u);

export const setToken = (t: string | null) =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public issues?: unknown) {
    super(message);
  }
}

/** The single place that talks HTTP to the backend. */
export async function api<T = void>(method: string, path: string, body?: unknown): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const devUser = localStorage.getItem(DEV_KEY) ?? import.meta.env.VITE_DEV_USER;
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body !== undefined && { 'content-type': 'application/json' }),
      ...(token && { authorization: `Bearer ${token}` }),
      ...(!token && devUser && { 'x-dev-user': devUser }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.code ?? 'ERROR', json.detail ?? res.statusText, json.issues);
  return json as T;
}
