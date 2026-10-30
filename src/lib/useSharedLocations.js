import { useCallback, useEffect, useState } from 'react';
import { useNow } from './useNow';
import { supabase } from './supabase';
import { fetchVisibleLocations } from './api';

export const STALE_AFTER_MS = 2 * 60 * 1000;   // older than this: shown as stale
export const OFFLINE_AFTER_MS = 10 * 60 * 1000; // older than this: shown as offline/unavailable

export function freshness(updatedAt, now = Date.now()) {
  const age = now - new Date(updatedAt).getTime();
  if (age > OFFLINE_AFTER_MS) return 'offline';
  if (age > STALE_AFTER_MS) return 'stale';
  return 'live';
}

/**
 * Locations other people have explicitly shared with the signed-in user.
 * The server (RLS) decides what is returned; revocation shows up on the next refetch,
 * which is triggered by realtime events on location_shares and by a 30 s poll.
 */
export function useSharedLocations(userId, names = {}) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const now = useNow(15_000);

  const load = useCallback(async () => {
    try {
      const data = await fetchVisibleLocations();
      setRows(data.filter((r) => r.owner_id !== userId));
      setError('');
    } catch (e) { setError(e.message); }
  }, [userId]);

  useEffect(() => {
    if (!userId || !supabase) return undefined;
    load(); // eslint-disable-line react-hooks/set-state-in-effect
    const ch = supabase.channel(`locations:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_locations' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'location_shares', filter: `viewer_id=eq.${userId}` }, () => load())
      .subscribe((s) => { if (s === 'SUBSCRIBED') load(); });
    const poll = setInterval(load, 30_000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [userId, load]);

  const people = rows.map((r) => ({
    id: r.owner_id,
    name: names[r.owner_id] || 'Friend',
    lat: r.lat, lng: r.lng, accuracy: r.accuracy,
    updatedAt: r.updated_at,
    state: freshness(r.updated_at, now),
  }));
  return { people, error, reload: load };
}
