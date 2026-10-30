import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { OUTING, MEMBERS, DEMO_POSITION, USER } from '../data/dummy';
import { createSupportReference } from '../lib/ai';

const AppContext = createContext(null);
const LS_KEY = 'tukosafe.support.requests';

export function AppProvider({ children }) {
  const [user] = useState(USER);
  const [lang, setLang] = useState('en');
  const [ai, setAi] = useState({ checkin: true, copilot: true, brief: true });
  const [aiFail, setAiFail] = useState(false);
  const [step, setStep] = useState(0);
  const [sos, setSos] = useState(false);
  const [members, setMembers] = useState(MEMBERS);
  const [sharing, setSharing] = useState(true);
  const [expiresAt, setExpiresAt] = useState(Date.now() + OUTING.expiresInHours * 3_600_000);
  const [offline, setOffline] = useState(false);
  const [outbox, setOutbox] = useState([]);
  const [flags, setFlags] = useState([]);
  const [pos, setPos] = useState(null);
  const [toast, setToast] = useState('');
  const [notify, setNotify] = useState('Brian');
  const [supportRequests, setSupportRequests] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
  });

  // Live tracking state
  const [live, setLive] = useState(false);
  const [liveEndsAt, setLiveEndsAt] = useState(0);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const watchId = useRef(null);
  const tickId = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(supportRequests)); } catch {}
  }, [supportRequests]);

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

  // ── One-shot locate (real geolocation) ──
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

  // ── Demo location ──
  const useDemoLocation = useCallback(() => {
    setPos({ ...DEMO_POSITION, ts: Date.now() });
    showToast('Showing a demo location in Nairobi.');
  }, [showToast]);

  // ── Stop live updates ──
  const stopLive = useCallback((reason) => {
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
    if (reason) showToast(reason);
  }, [showToast]);

  // ── Start live updates (real watchPosition, auto-stops at expiry) ──
  const startLive = useCallback((minutes = 60) => {
    if (!('geolocation' in navigator)) {
      showToast('Location is not supported.');
      return;
    }
    if (watchId.current != null) {
      showToast('Live updates are already on.');
      return;
    }
    setGeoError(null);
    const end = Date.now() + minutes * 60_000;
    setLiveEndsAt(end);
    setLive(true);

    watchId.current = navigator.geolocation.watchPosition(
      (p) => setPositionFromCoords(p.coords, p.timestamp),
      (err) => {
        const msg =
          err.code === 1
            ? 'Location is blocked. Live updates stopped.'
            : err.code === 2
            ? 'Signal lost. Live updates stopped.'
            : 'Live updates timed out.';
        setGeoError(msg);
        stopLive(msg);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
    );

    // Countdown tick — stops itself at expiry
    tickId.current = setInterval(() => {
      if (Date.now() >= end) stopLive('Time is up. Live updates ended automatically.');
    }, 1000);
  }, [setPositionFromCoords, stopLive, showToast]);

  // Cleanup on unmount
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

  return (
    <AppContext.Provider value={{
      user, lang, setLang, ai, setAi, aiFail, setAiFail, step, setStep, sos, setSos,
      members, setMembers, sharing, setSharing, expiresAt, setExpiresAt, offline, setOffline,
      outbox, flags, flag, pos, locate, useDemoLocation, toast, showToast, send, notify, setNotify,
      supportRequests, requestSupport,
      // new
      live, liveEndsAt, locating, geoError, startLive, stopLive,
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