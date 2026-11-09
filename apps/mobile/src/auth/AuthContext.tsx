import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError, onSessionExpired } from '../api';
import type { Me } from '../api/types';
import { DEFAULT_CURRENCY } from '../config';

type Status = 'loading' | 'signedOut' | 'signedIn' | 'unreachable';

interface AuthValue {
  status: Status;
  me: Me | null;
  currency: string;
  bootError: string | null;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  reloadMe(): Promise<void>;
  retryBoot(): void;
  updateName(firstName: string, lastName: string): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [me, setMe] = useState<Me | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootTick, setBootTick] = useState(0);

  useEffect(() => onSessionExpired(() => { setMe(null); setStatus('signedOut'); }), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus('loading');
      try {
        if (!(await api.auth.hasSession())) { if (!cancelled) setStatus('signedOut'); return; }
        const m = await api.auth.me();
        if (!cancelled) { setMe(m); setStatus('signedIn'); }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status !== 0 && e.status < 500) {
          await api.auth.logout();
          setStatus('signedOut');
        } else {
          setBootError(e instanceof Error ? e.message : 'Could not reach the server.');
          setStatus('unreachable');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [bootTick]);

  const signIn = useCallback(async (email: string, password: string) => {
    await api.auth.login(email, password);
    try {
      setMe(await api.auth.me());
      setStatus('signedIn');
    } catch (e) {
      await api.auth.logout();
      throw e;
    }
  }, []);

  const signOut = useCallback(async () => {
    await api.auth.logout();
    setMe(null);
    setStatus('signedOut');
  }, []);

  const reloadMe = useCallback(async () => { setMe(await api.auth.me()); }, []);

  const updateName = useCallback(async (firstName: string, lastName: string) => {
    await api.users.update({ firstName, lastName });
    setMe(await api.auth.me());
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    if (!me) throw new ApiError(401, ['Not signed in']);
    await api.users.changePassword(currentPassword, newPassword);
    // The API revokes every refresh token on password change, so establish a fresh session immediately.
    await api.auth.login(me.email, newPassword);
  }, [me]);

  const value = useMemo<AuthValue>(() => ({
    status, me, bootError,
    currency: me?.organisation?.baseCurrency ?? DEFAULT_CURRENCY,
    signIn, signOut, reloadMe, updateName, changePassword,
    retryBoot: () => setBootTick((t) => t + 1),
  }), [status, me, bootError, signIn, signOut, reloadMe, updateName, changePassword]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
