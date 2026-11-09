import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, Session, SessionUser, session, setSessionLostHandler } from '../lib/api';

interface Ctx {
  user: SessionUser | null;
  isManager: boolean;
  currency: string;
  login(email: string, password: string): Promise<void>;
  register(p: { email: string; password: string; firstName: string; lastName: string; organisationName: string }): Promise<void>;
  acceptInvite(p: { token: string; password: string; firstName: string; lastName: string }): Promise<void>;
  logout(): Promise<void>;
}
const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => session.get()?.user ?? null);
  const [currency, setCurrency] = useState('NOK');

  useEffect(() => { setSessionLostHandler(() => setUser(null)); }, []);
  useEffect(() => {
    if (!user?.organisationId) return;
    api.get('/organisations/current').then((r) => setCurrency(r.data.baseCurrency)).catch(() => undefined);
  }, [user?.organisationId]);

  const adopt = useCallback((s: Session) => { session.set(s); setUser(s.user); }, []);
  const value = useMemo<Ctx>(() => ({
    user, currency,
    isManager: user?.role === 'ORG_ADMIN' || user?.role === 'FINANCE_MANAGER',
    login: async (email, password) => adopt((await api.post('/auth/login', { email, password }, { auth: false })).data),
    register: async (p) => adopt((await api.post('/auth/register', p, { auth: false })).data),
    acceptInvite: async (p) => adopt((await api.post('/auth/accept-invite', p, { auth: false })).data),
    logout: async () => {
      const s = session.get();
      if (s) await api.post('/auth/logout', { refreshToken: s.refreshToken }, { auth: false }).catch(() => undefined);
      session.clear(); setUser(null);
    },
  }), [user, currency, adopt]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}
