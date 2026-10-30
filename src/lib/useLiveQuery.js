import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

/**
 * Load data through `fetcher` and keep it fresh: refetch on Realtime changes to `tables`
 * (RLS decides which events this user receives), on reconnect, on tab focus and on a slow poll.
 * The database stays the source of truth; nothing is cached locally.
 */
export function useLiveQuery(key, fetcher, tables, { pollMs = 30_000 } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const fetchRef = useRef(fetcher);
  useEffect(() => { fetchRef.current = fetcher; }, [fetcher]);

  const reload = useCallback(async () => {
    try {
      setData(await fetchRef.current());
      setError('');
    } catch (e) {
      setError(e.message || 'Could not load.');
    } finally {
      setLoading(false);
    }
  }, []);

  const tablesKey = tables.join(',');
  useEffect(() => {
    if (!key || !supabase) return undefined;
    const run = () => { reload(); };
    run();
    let ch = supabase.channel(`lq:${tablesKey}:${key}`);
    tablesKey.split(',').forEach((table) => {
      ch = ch.on('postgres_changes', { event: '*', schema: 'public', table }, run);
    });
    ch.subscribe((status) => { if (status === 'SUBSCRIBED') run(); });
    const poll = setInterval(run, pollMs);
    const onVisible = () => { if (!document.hidden) run(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', run);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', run);
    };
  }, [key, tablesKey, pollMs, reload]);

  return { data, error, loading, reload };
}
