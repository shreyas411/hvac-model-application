import React, { createContext, useContext, useEffect, useState } from 'react';
import { Flame, Loader2 } from 'lucide-react';
import type { User } from '../../types';
import { ApiError, REAL_AUTH, SESSION_EXPIRED } from '../../services/api';
import { auth } from '../../services/auth';

interface AuthState { user: User | null; logout: () => Promise<void> }
const AuthContext = createContext<AuthState>({ user: null, logout: async () => {} });
/** `user` is null in dev mode (role switcher in use); set once someone is signed in. */
export const useAuth = () => useContext(AuthContext);

const field = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500';

function Login({ onDone, notice }: { onDone: (u: User) => void; notice?: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(notice ?? '');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await auth.login(email.trim(), password);
      onDone((await auth.me())!);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401 && err.code === 'UNAUTHENTICATED'
          ? 'Signed in, but this account has no profile yet. Ask an administrator to set it up.'
          : err instanceof ApiError ? err.message : 'Could not reach the server. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <form onSubmit={submit} className="w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center"><Flame className="w-5 h-5" /></div>
          <div>
            <p className="font-bold text-slate-900 leading-tight">ApexHVAC</p>
            <p className="text-[11px] text-slate-500">Field Service UK</p>
          </div>
        </div>
        <div className="space-y-1">
          <label htmlFor="email" className="text-xs font-semibold text-slate-700">Email</label>
          <input id="email" type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
        </div>
        <div className="space-y-1">
          <label htmlFor="password" className="text-xs font-semibold text-slate-700">Password</label>
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
        </div>
        {error && <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{error}</p>}
        <button type="submit" disabled={busy} className="w-full py-2 text-sm font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-60 flex items-center justify-center gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          Sign in
        </button>
      </form>
    </div>
  );
}

/**
 * Production / VITE_REQUIRE_LOGIN: shows the login screen until a Supabase session exists, then renders the app with that user.
 * Dev mode: renders the app straight away (the role switcher + x-dev-user header).
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(REAL_AUTH);
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    if (!REAL_AUTH) return;
    auth.me().then(setUser)
      .catch(() => {}) // network error: stay on the login screen rather than signing anything out
      .finally(() => setChecking(false));
    const expired = () => { setUser(null); setNotice('Your session expired. Please sign in again.'); };
    window.addEventListener(SESSION_EXPIRED, expired);
    return () => window.removeEventListener(SESSION_EXPIRED, expired);
  }, []);

  if (!REAL_AUTH) return <AuthContext.Provider value={{ user: { id: 'dev-admin', name: 'Dev Admin', email: 'admin@dev.local', role: 'admin', phone: '' }, logout: async () => {} }}>{children}</AuthContext.Provider>;
  if (checking) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (!user) return <Login onDone={(u) => { setNotice(undefined); setUser(u); }} notice={notice} />;

  // A reload is the simplest way to drop everything the previous user loaded (the data store is module-level).
  const logout = async () => { await auth.logout(); window.location.reload(); };
  return <AuthContext.Provider value={{ user, logout }}>{children}</AuthContext.Provider>;
}
