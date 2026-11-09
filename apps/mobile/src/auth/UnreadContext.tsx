import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { api } from '../api';

interface UnreadValue { unread: number; refreshUnread(): Promise<void>; setUnread(n: number): void }
const Ctx = createContext<UnreadValue>({ unread: 0, refreshUnread: async () => undefined, setUnread: () => undefined });

/** Keeps the tab badge in sync with GET /notifications meta.unread. Polls while the app is foregrounded. */
export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const [unread, setUnread] = useState(0);

  const refreshUnread = useCallback(async () => {
    try {
      const r = await api.notifications.list(1);
      setUnread(r.meta.unread ?? 0);
    } catch {
      /* badge is best-effort; screens surface their own errors */
    }
  }, []);

  useEffect(() => {
    void refreshUnread();
    const timer = setInterval(() => void refreshUnread(), 60_000);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void refreshUnread(); });
    return () => { clearInterval(timer); sub.remove(); };
  }, [refreshUnread]);

  const value = useMemo(() => ({ unread, refreshUnread, setUnread }), [unread, refreshUnread]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useUnread = () => useContext(Ctx);
