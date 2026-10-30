import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { DEMO_POSITION, CONTACTS } from '../data/dummy';
import { useAuth } from './AuthContext';
import * as api from '../lib/api';
import { createSupportReference } from '../lib/ai';
import { loadOuting, saveOuting, createOuting as buildOuting } from '../lib/outingStore';

const AppContext = createContext(null);
const LS_KEY = 'tukosafe.support.requests';

export function AppProvider({ children }) {
  const { user: authUser } = useAuth();
  const user = authUser || { name: 'You' };
  const [lang, setLang] = useState('en');
  const [ai, setAi] = useState({ checkin: true, copilot: true, brief: true });
  const [aiFail, setAiFail] = useState(false);
  const [sos, setSos] = useState(false);
  const [outing, setOutingState] = useState(() => loadOuting());
  const [offline, setOffline] = useState(false);
  const [outbox, setOutbox] = useState([]);
  const [flags, setFlags] = useState([]);
  const [pos, setPos] = useState(null);
  const [toast, setToast] = useState('');
  const [notify, setNotify] = useState('Brian');
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
  const checkinTickId = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(supportRequests)); } catch {}
  }, [supportRequests]);

  const setOuting = useCallback((next) => {
    setOutingState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      saveOuting(value);
      return value;
    });
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  }, []);

  const send = useCallback((label) => {
    if (offline) {
      setOutbox((o) => [...o, label]);
      showToast(`Offline: ${label} queued. It sends when you reconnect.`);
    } else {
      showToast(`${label} sent.`);
    }
  }, [offline, showToast]);

  useEffect(() => {
    if (!offline && outbox.length) {
      showToast(`Back online. Sent ${outbox.length} queued item(s).`);
      setOutbox([]);
    }
  }, [offline, outbox.length, showToast]);

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
      showToast('Location is not supported. Use demo location.');
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
            ? 'Location is blocked. Allow it in your browser settings, or use demo location.'
            : err.code === 2
            ? 'Could not get a position. Check that location services are on.'
            : 'Locating took too long. Try again outdoors.';
        setGeoError(msg);
        showToast(msg);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [setPositionFromCoords, showToast]);

  const useDemoLocation = useCallback(() => {
    setPos({ ...DEMO_POSITION, ts: Date.now() });
    showToast('Showing a demo location in Nairobi.');
  }, [showToast]);

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

  useEffect(() => { refreshShares(); }, [refreshShares]);
  // Signing out must end local tracking immediately.
  useEffect(() => { if (!authUser) stopWatching(); }, [authUser, stopWatching]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => () => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    if (tickId.current) clearInterval(tickId.current);
  }, []);

  const flag = useCallback(() => {
    setFlags((f) => [...f, `Contact brief flagged at ${new Date().toLocaleTimeString()}`]);
    showToast('Flagged for human review');
  }, [showToast]);

  const requestSupport = useCallback(({ context, userMessage }) => {
    const ref = createSupportReference();
    const entry = { ref, context, userMessage, at: new Date().toISOString() };
    setSupportRequests((r) => [...r, entry]);
    showToast(`Support request ${ref}. A human will review this. In an emergency, call 999 or 112.`);
    return ref;
  }, [showToast]);

  // ── Outing actions ──
  const startOuting = useCallback((draft) => {
    const created = buildOuting({ ...draft, hostName: user.name });
    setOuting(created);
    showToast('Outing created. Invite your friends.');
    return created;
  }, [setOuting, showToast, user.name]);

  const inviteContact = useCallback((contact) => {
    setOuting((prev) => {
      if (!prev) return prev;
      if (prev.members.some((m) => m.name === contact.name)) return prev;
      return {
        ...prev,
        members: [
          ...prev.members,
          {
            id: `m_${contact.id}_${Date.now().toString(36)}`,
            name: contact.name,
            you: false,
            consent: false,
            invitedAt: Date.now(),
            joinedAt: null,
            leftAt: null,
          },
        ],
      };
    });
    showToast(`Invite sent to ${contact.name}.`);
  }, [setOuting, showToast]);

  const setMemberConsent = useCallback((memberId, consent) => {
    setOuting((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        members: prev.members.map((m) =>
          m.id === memberId
            ? { ...m, consent, joinedAt: consent ? m.joinedAt || Date.now() : null, leftAt: consent ? null : Date.now() }
            : m
        ),
      };
    });
  }, [setOuting]);

  const removeMember = useCallback((memberId) => {
    setOuting((prev) => (prev ? { ...prev, members: prev.members.filter((m) => m.id !== memberId) } : prev));
  }, [setOuting]);

  const leaveOuting = useCallback(() => {
    setOuting((prev) => {
      if (!prev) return prev;
      return { ...prev, members: prev.members.map((m) => (m.you ? { ...m, consent: false, leftAt: Date.now() } : m)) };
    });
    showToast('You left the outing. Sharing stopped for you.');
  }, [setOuting, showToast]);

  const rejoinOuting = useCallback(() => {
    setOuting((prev) => {
      if (!prev) return prev;
      return { ...prev, members: prev.members.map((m) => (m.you ? { ...m, consent: true, leftAt: null, joinedAt: m.joinedAt || Date.now() } : m)) };
    });
    showToast('You rejoined. Sharing resumed.');
  }, [setOuting, showToast]);

  const endSharing = useCallback(() => {
    setOuting((prev) => (prev ? { ...prev, sharing: false, endedAt: Date.now() } : prev));
    showToast('Sharing ended for this outing.');
  }, [setOuting, showToast]);

  const restartSharing = useCallback((hours = 4) => {
    setOuting((prev) => {
      if (!prev) return prev;
      return { ...prev, sharing: true, endedAt: null, expiresAt: Date.now() + hours * 3_600_000 };
    });
    showToast(`New sharing window started for ${hours} hours.`);
  }, [setOuting, showToast]);

  const updateReturnPlan = useCallback((plan) => {
    setOuting((prev) => (prev ? { ...prev, returnPlan: { ...prev.returnPlan, ...plan } } : prev));
    showToast('Return-home plan updated.');
  }, [setOuting, showToast]);

  const clearOuting = useCallback(() => {
    setOuting(null);
    showToast('Outing cleared.');
  }, [setOuting, showToast]);

  // ── Check-in actions ──
  const startCheckin = useCallback(() => {
    setOuting((prev) => {
      if (!prev) return prev;
      const dueAt = new Date(prev.endsAt).getTime() || Date.now() + 4 * 3_600_000;
      return {
        ...prev,
        checkin: {
          dueAt, graceMinutes: 15, state: 'scheduled',
          reminderAt: null, graceEndsAt: null, alertedAt: null, resolvedAt: null,
        },
      };
    });
    showToast('Check-in scheduled for the end of the outing.');
  }, [setOuting, showToast]);

  const confirmOkay = useCallback(() => {
    setOuting((prev) => {
      if (!prev) return prev;
      return { ...prev, checkin: { ...prev.checkin, state: 'resolved', resolvedAt: Date.now() } };
    });
    send('“I’m okay” to your contact');
  }, [setOuting, send]);

  const skipToGrace = useCallback(() => {
    setOuting((prev) => {
      if (!prev) return prev;
      const now = Date.now();
      return {
        ...prev,
        checkin: {
          ...prev.checkin, state: 'grace',
          reminderAt: prev.checkin.reminderAt || now,
          graceEndsAt: now + (prev.checkin.graceMinutes || 15) * 60_000,
        },
      };
    });
    showToast('Grace period started.');
  }, [setOuting, showToast]);

  const skipToAlerted = useCallback(() => {
    setOuting((prev) => {
      if (!prev) return prev;
      return { ...prev, checkin: { ...prev.checkin, state: 'alerted', alertedAt: Date.now() } };
    });
    send(`Alert to ${outing?.returnPlan?.notify || notify}`);
  }, [setOuting, send, outing, notify]);

  const resetCheckin = useCallback(() => {
    setOuting((prev) => {
      if (!prev) return prev;
      const dueAt = new Date(prev.endsAt).getTime() || Date.now() + 4 * 3_600_000;
      return {
        ...prev,
        checkin: {
          dueAt, graceMinutes: 15, state: 'scheduled',
          reminderAt: null, graceEndsAt: null, alertedAt: null, resolvedAt: null,
        },
      };
    });
    showToast('Check-in reset.');
  }, [setOuting, showToast]);

  // ── Check-in state machine ticker ──
  useEffect(() => {
    if (checkinTickId.current) clearInterval(checkinTickId.current);
    if (!outing) return;

    checkinTickId.current = setInterval(() => {
      setOutingState((prev) => {
        if (!prev || !prev.checkin) return prev;
        const ci = prev.checkin;
        if (ci.state === 'resolved' || ci.state === 'cancelled') return prev;
        const now = Date.now();

        if (ci.state === 'scheduled' && now >= ci.dueAt) {
          const next = { ...prev, checkin: { ...ci, state: 'reminder', reminderAt: now } };
          saveOuting(next);
          return next;
        }
        if (ci.state === 'reminder' && now >= ci.reminderAt + 60_000) {
          const next = {
            ...prev,
            checkin: { ...ci, state: 'grace', graceEndsAt: now + (ci.graceMinutes || 15) * 60_000 },
          };
          saveOuting(next);
          return next;
        }
        if (ci.state === 'grace' && now >= ci.graceEndsAt) {
          const next = { ...prev, checkin: { ...ci, state: 'alerted', alertedAt: now } };
          saveOuting(next);
          return next;
        }
        return prev;
      });
    }, 1000);

    return () => { if (checkinTickId.current) clearInterval(checkinTickId.current); };
  }, [outing?.id, setOutingState]);

  const availableContacts = CONTACTS.filter((c) => !outing?.members.some((m) => m.name === c.name));

  return (
    <AppContext.Provider value={{
      user, lang, setLang, ai, setAi, aiFail, setAiFail, sos, setSos,
      offline, setOffline, outbox, flags, flag, pos, locate, useDemoLocation,
      toast, showToast, send, notify, setNotify, supportRequests, requestSupport,
      live, liveEndsAt, locating, geoError, startLive, stopLive,
      paused, setSharingPaused, myShares, lastSent, resumeSending, refreshShares,
      outing, availableContacts,
      startOuting, inviteContact, setMemberConsent, removeMember,
      leaveOuting, rejoinOuting, endSharing, restartSharing,
      updateReturnPlan, clearOuting,
      startCheckin, confirmOkay, skipToGrace, skipToAlerted, resetCheckin,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}