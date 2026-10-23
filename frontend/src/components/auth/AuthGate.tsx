import React, { createContext, useContext, useEffect, useState } from 'react';
import { IconFlame, IconLoader2 } from '@tabler/icons-react';
import { Alert, AlertDescription } from '@/src/components/ui/alert';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import type { User } from '../../types';
import { ApiError, REAL_AUTH, SESSION_EXPIRED } from '../../services/api';
import { auth } from '../../services/auth';

interface AuthState { user: User | null; logout: () => Promise<void> }
const AuthContext = createContext<AuthState>({ user: null, logout: async () => {} });
/** `user` is null in dev mode (role switcher in use); set once someone is signed in. */
export const useAuth = () => useContext(AuthContext);

function Login({ onDone, notice }: { onDone: (u: User) => void; notice?: string }) {
  const [company, setCompany] = useState(() => localStorage.getItem('hvac_company') ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(notice ?? '');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await auth.login(company.trim(), email.trim(), password);
      localStorage.setItem('hvac_company', company.trim());
      const me = await auth.me();
      if (!me) { setError('Signed in, but your profile could not be loaded. Try again.'); return; }
      onDone(me);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/40 flex items-center justify-center p-4 font-sans">
      <Card className="w-full max-w-sm">
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center"><IconFlame className="w-5 h-5" aria-hidden="true" /></div>
              <div>
                <p className="font-bold leading-tight">ApexHVAC</p>
                <p className="text-[11px] text-muted-foreground">Field Service UK</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company" className="text-xs">Company</Label>
              <Input id="company" name="company" autoComplete="organization" spellCheck={false} autoCapitalize="none" required autoFocus={!company} value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="username" spellCheck={false} required autoFocus={!!company} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs">Password</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <Alert variant="destructive" className="border-destructive/30 bg-destructive/5 py-2"><AlertDescription className="text-xs text-destructive">{error}</AlertDescription></Alert>}
            <Button type="submit" disabled={busy} className="w-full">
              {busy && <IconLoader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
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
  if (checking) return <div role="status" className="min-h-screen flex items-center justify-center"><IconLoader2 className="w-6 h-6 animate-spin motion-reduce:animate-none text-muted-foreground" aria-hidden="true" /><span className="sr-only">Loading…</span></div>;
  if (!user) return <Login onDone={(u) => { setNotice(undefined); setUser(u); }} notice={notice} />;

  // A reload is the simplest way to drop everything the previous user loaded (the data store is module-level).
  const logout = async () => { await auth.logout(); window.location.reload(); };
  return <AuthContext.Provider value={{ user, logout }}>{children}</AuthContext.Provider>;
}
