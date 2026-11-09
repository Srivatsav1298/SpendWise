import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export interface Resource<T> {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  reload(): Promise<void>;
  onRefresh(): Promise<void>;
}

/** Loads on mount and whenever the screen regains focus (silently, keeping stale data visible). */
export function useResource<T>(fetcher: () => Promise<T>, refetchOnFocus = true): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const seq = useRef(0);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const run = useCallback(async () => {
    const id = ++seq.current;
    try {
      const d = await fetcherRef.current();
      if (mounted.current && id === seq.current) { setData(d); setError(null); }
    } catch (e) {
      if (mounted.current && id === seq.current) setError(errorMessage(e));
    } finally {
      if (mounted.current && id === seq.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  const reload = useCallback(async () => { setLoading(true); setError(null); await run(); }, [run]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await run(); }, [run]);

  const first = useRef(true);
  useFocusEffect(useCallback(() => {
    if (first.current) { first.current = false; void run(); } else if (refetchOnFocus) void run();
  }, [run, refetchOnFocus]));

  return { data, loading, refreshing, error, reload, onRefresh };
}
