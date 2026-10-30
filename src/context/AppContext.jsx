import { useState, useEffect, useCallback } from 'react';
import { AppContext } from './app-context';
import { OUTING, MEMBERS, DEMO_POSITION, USER } from '../data/dummy';

const INITIAL_EXPIRES_AT = Date.now() + OUTING.expiresInHours * 3_600_000;

export function AppProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const t = localStorage.getItem('tukosafe:theme');
      if (t && ['harbor', 'grove', 'coast', 'ember'].includes(t)) return t;
    } catch {
      // ignore
    }
    return 'harbor';
  });
  const [user] = useState(USER);
  const [lang, setLang] = useState('en');
  const [ai, setAi] = useState({ checkin: true, copilot: true, brief: true });
  const [aiFail, setAiFail] = useState(false);
  const [step, setStep] = useState(0);
  const [sos, setSos] = useState(false);
  const [members, setMembers] = useState(MEMBERS);
  const [sharing, setSharing] = useState(true);
  const [expiresAt, setExpiresAt] = useState(INITIAL_EXPIRES_AT);
  const [offline, setOfflineState] = useState(false);
  const [outbox, setOutbox] = useState([]);
  const [flags, setFlags] = useState([]);
  const [pos, setPos] = useState(null);
  const [toast, setToast] = useState('');
  const [notify, setNotify] = useState('Brian');

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  }, []);

  const setOffline = useCallback((nextOffline) => {
    setOfflineState(nextOffline);
    if (!nextOffline && outbox.length) {
      showToast(`Demo only: ${outbox.length} queued item(s) were not delivered.`);
      setOutbox([]);
    }
  }, [outbox.length, showToast]);

  const setTheme = useCallback((next) => {
    setThemeState(next);
  }, []);

  const send = useCallback(
    (label) => {
      if (offline) {
        setOutbox((o) => [...o, label]);
        showToast(`Demo only: ${label} queued locally; nothing will be sent.`);
      } else {
        showToast(`Demo only: ${label} was not delivered.`);
      }
    },
    [offline, showToast]
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('tukosafe:theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    if (!sharing) return undefined;
    const timeout = window.setTimeout(
      () => setSharing(false),
      Math.max(0, expiresAt - Date.now())
    );
    return () => window.clearTimeout(timeout);
  }, [sharing, expiresAt]);

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      showToast('Geolocation not supported. Use demo location.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        setPos({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy || 30,
          heading: p.coords.heading,
          ts: Date.now(),
        }),
      () => showToast('Could not locate. Try demo location.'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [showToast]);

  const useDemoLocation = useCallback(() => {
    setPos({ ...DEMO_POSITION, ts: Date.now() });
    showToast('Showing a demo location in Nairobi.');
  }, [showToast]);

  const flag = useCallback(() => {
    setFlags((f) => [...f, `Contact brief flagged at ${new Date().toLocaleTimeString()}`]);
    showToast('Flagged for human review');
  }, [showToast]);

  return (
    <AppContext.Provider
      value={{
        theme, setTheme,
        user, lang, setLang, ai, setAi, aiFail, setAiFail, step, setStep, sos, setSos,
        members, setMembers, sharing, setSharing, expiresAt, setExpiresAt, offline, setOffline,
        outbox, flags, flag, pos, locate, useDemoLocation, toast, showToast, send, notify, setNotify,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
