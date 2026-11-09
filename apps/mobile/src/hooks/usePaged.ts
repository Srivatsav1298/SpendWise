import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { PageMeta, Paged } from '../api/types';
import { errorMessage } from './useResource';

export interface PagedList<T> {
  items: T[];
  meta: PageMeta | null;
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: string | null;
  moreError: string | null;
  reload(): Promise<void>;
  onRefresh(): Promise<void>;
  loadMore(): Promise<void>;
}

/** Page-based infinite list. `key` changes (e.g. a filter) reset the list. Silent refetch of page 1 on focus. */
export function usePaged<T extends { id: string }>(fetchPage: (page: number) => Promise<Paged<T>>, key: string): PagedList<T> {
  const [items, setItems] = useState<T[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const seq = useRef(0);
  const busyMore = useRef(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const loadFirst = useCallback(async () => {
    const id = ++seq.current;
    try {
      const r = await fetchRef.current(1);
      if (!mounted.current || id !== seq.current) return;
      setItems(r.data); setMeta(r.meta); setError(null); setMoreError(null);
    } catch (e) {
      if (mounted.current && id === seq.current) setError(errorMessage(e));
    } finally {
      if (mounted.current && id === seq.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  const keyRef = useRef(key);
  useEffect(() => {
    if (keyRef.current === key) return;
    keyRef.current = key;
    setItems([]); setMeta(null); setLoading(true); setError(null);
    void loadFirst();
  }, [key, loadFirst]);

  useFocusEffect(useCallback(() => {
    void loadFirst();
  }, [loadFirst]));

  const reload = useCallback(async () => { setLoading(true); setError(null); await loadFirst(); }, [loadFirst]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await loadFirst(); }, [loadFirst]);

  const loadMore = useCallback(async () => {
    if (busyMore.current || !meta || meta.page >= meta.totalPages) return;
    busyMore.current = true;
    setLoadingMore(true); setMoreError(null);
    const id = seq.current;
    try {
      const r = await fetchRef.current(meta.page + 1);
      if (!mounted.current || id !== seq.current) return;
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...r.data.filter((d) => !seen.has(d.id))];
      });
      setMeta(r.meta);
    } catch (e) {
      if (mounted.current) setMoreError(errorMessage(e));
    } finally {
      busyMore.current = false;
      if (mounted.current) setLoadingMore(false);
    }
  }, [meta]);

  return { items, meta, loading, refreshing, loadingMore, error, moreError, reload, onRefresh, loadMore };
}
