import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext';
import { AppContext } from './app-context';
import * as api from '../lib/api';
import { createSupportReference } from '../lib/ai';

const LS_KEY = 'tukosafe.support.requests';
const THEME_IDS = ['harbor', 'grove', 'coast', 'ember'];

export function AppProvider({ children }) {
  const { user: authUser } = useAuth();
  const [theme, setTheme] = useState(() => {
    try {
      const t = localStorage.getItem('tukosafe:theme');
      if (t && THEME_IDS.includes(t)) return t;
    } catch { /* storage blocked */ }
    return 'harbor';
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('tukosafe:theme', theme); } catch { /* storage blocked */ }
  }, [theme]);
  const user = useMemo(() => authUser || { name: 'You' }, [authUser]);
  const [lang, setLang] = useState('en');
  const [ai, setAi] = useState({ checkin: true, copilot: true, brief: true });
  const [aiFail, setAiFail] = useState(false);
  const [flags, setFlags] = useState([]);
  const [pos, setPos] = useState(null);
  const [toast, setToast] = useState('');
  const [supportRequests, setSupportRequests] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
  });

  const [live, setLive] = useState(false);
  const [liveEndsAt, setLiveEndsAt] = useState(0);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const [paused, setPaused] = useState(false);
  const [myShares, setMyShares] = useState([]);
  const [lastSent, setLastSent] = useState(0);
  const pausedRef = useRef(false);
  const lastPush = useRef(0);
  const watchId = useRef(null);
  const tickId = useRef(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(supportRequests)); } catch { /* storage blocked */ }
  }, [supportRequests]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
  }, []);

  const setPositionFromCoords = useCallback((c, ts) => {
    setPos({
      lat: c.latitude,
      lng: c.longitude,
      accuracy: c.accuracy || 30,
      heading: c.heading,
      ts: ts || Date.now(),
    });
  }, []);

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGeoError('This browser does not support location.');
      showToast('Location is not supported in this browser.');
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPositionFromCoords(p.coords, p.timestamp);
        setLocating(false);
        showToast('Location found.');
      },
      (err) => {
        setLocating(false);
        const msg =
          err.code === 1
            ? 'Location is blocked. Allow it in your browser settings.'
            : err.code === 2
            ? 'Could not get a position. Check that location services are on.'
            : 'Locating took too long. Try again outdoors.';
        setGeoError(msg);
        showToast(msg);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [setPositionFromCoords, showToast]);

  // Local watcher teardown only; server-side revocation is separate (see stopLive).
  const stopWatching = useCallback(() => {
    if (watchId.current != null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    if (tickId.current) {
      clearInterval(tickId.current);
      tickId.current = null;
    }
    setLive(false);
    setLiveEndsAt(0);
  }, []);

  // Stop sharing: revoke every share on the server immediately, then stop the watcher.
  const stopLive = useCallback(async (reason) => {
    stopWatching();
    setPaused(false);
    try { await api.setShareStatus(null, 'stopped'); } catch { /* already ended */ }
    setMyShares([]);
    if (reason) showToast(reason);
  }, [stopWatching, showToast]);

  const refreshShares = useCallback(async () => {
    if (!authUser) { setMyShares([]); return []; }
    try {
      const rows = await api.fetchMyShares(authUser.id);
      setMyShares(rows);
      return rows;
    } catch { return []; }
  }, [authUser]);

  // Browser geolocation -> server, at most once every 5 s. Sends nothing while paused.
  // This only runs while the page is open; there is no background tracking.
  const startWatching = useCallback((end) => {
    if (!('geolocation' in navigator)) { showToast('Location is not supported.'); return false; }
    if (watchId.current != null) return true;
    setLiveEndsAt(end);
    setLive(true);
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        setPositionFromCoords(p.coords, p.timestamp);
        const now = Date.now();
        if (pausedRef.current || now - lastPush.current < 5000) return;
        lastPush.current = now;
        api.pushLocation(p.coords).then(() => setLastSent(now)).catch((e) => {
          if (e.code === 'P0002') stopLive('Sharing has ended.');
          else setGeoError('Could not send your location. Retrying…');
        });
      },
      (err) => {
        const msg =
          err.code === 1 ? 'Location is blocked. Sharing stopped.'
          : err.code === 2 ? 'Signal lost. Sharing stopped.'
          : 'Location timed out. Sharing stopped.';
        setGeoError(msg);
        stopLive(msg);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
    );
    tickId.current = setInterval(() => {
      if (Date.now() >= end) stopLive('Time is up. Sharing ended automatically.');
    }, 1000);
    return true;
  }, [setPositionFromCoords, stopLive, showToast]);

  // Explicit consent: the caller names the viewers; nobody sees anything otherwise.
  const startLive = useCallback(async (minutes = 60, viewers = []) => {
    if (!viewers.length) { showToast('Choose who can see your location first.'); return; }
    setGeoError(null);
    try {
      await api.startLocationShare(viewers, minutes);
    } catch (e) { showToast(e.message); return; }
    lastPush.current = 0;
    setPaused(false);
    if (!startWatching(Date.now() + minutes * 60_000)) {
      await api.setShareStatus(null, 'stopped').catch(() => {});
      return;
    }
    refreshShares();
    showToast(`Sharing with ${viewers.length} friend${viewers.length > 1 ? 's' : ''}.`);
  }, [startWatching, refreshShares, showToast]);

  const setSharingPaused = useCallback(async (value) => {
    try {
      await api.setShareStatus(null, value ? 'paused' : 'active');
      setPaused(value);
      pausedRef.current = value;
      refreshShares();
    } catch (e) { showToast(e.message); }
  }, [refreshShares, showToast]);

  // After a reload the server may still hold an active share; offer to resume sending.
  const resumeSending = useCallback(async () => {
    const rows = await refreshShares();
    const active = rows.filter((s) => s.status === 'active' && new Date(s.expires_at) > new Date());
    if (!active.length) return;
    const end = Math.max(...active.map((s) => new Date(s.expires_at).getTime()));
    startWatching(end);
  }, [refreshShares, startWatching]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refreshShares(); }, [refreshShares]);
  // Signing out must end local tracking immediately.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!authUser) stopWatching(); }, [authUser, stopWatching]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => () => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    if (tickId.current) clearInterval(tickId.current);
  }, []);

  const flag = useCallback(() => {
    setFlags((f) => [...f, `Contact brief flagged at ${new Date().toLocaleTimeString()}`]);
    showToast('Flag saved on this device.');
  }, [showToast]);

  // No moderation service is connected. The note is kept on this device only and we say so.
  const requestSupport = useCallback(({ context, userMessage }) => {
    const ref = createSupportReference();
    setSupportRequests((r) => [...r, { ref, context, userMessage, at: new Date().toISOString() }]);
    showToast(`Saved as ${ref} on this device only. No human support team is connected yet. In an emergency, call 999 or 112.`);
    return ref;
  }, [showToast]);

  const value = useMemo(() => ({
    user, theme, setTheme, lang, setLang, ai, setAi, aiFail, setAiFail,
    flags, flag, pos, locate,
    toast, showToast, supportRequests, requestSupport,
    live, liveEndsAt, locating, geoError, startLive, stopLive,
    paused, setSharingPaused, myShares, lastSent, resumeSending, refreshShares,
  }), [user, theme, lang, ai, aiFail, flags, flag, pos, locate, toast, showToast, supportRequests, requestSupport,
    live, liveEndsAt, locating, geoError, startLive, stopLive, paused, setSharingPaused, myShares, lastSent,
    resumeSending, refreshShares]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
