import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { OUTING, MEMBERS, DEMO_POSITION, USER } from '../data/dummy';

const AppContext = createContext(null);

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

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  }, []);

  const send = useCallback(
    (label) => {
      if (offline) {
        setOutbox((o) => [...o, label]);
        showToast(`Offline: ${label} queued. It sends when you reconnect.`);
      } else {
        showToast(`${label} sent (simulated).`);
      }
    },
    [offline, showToast]
  );

  useEffect(() => {
    if (!offline && outbox.length) {
      showToast(`Back online. Sent ${outbox.length} queued item(s).`);
      setOutbox([]);
    }
  }, [offline, outbox.length, showToast]);

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
        user, lang, setLang, ai, setAi, aiFail, setAiFail, step, setStep, sos, setSos,
        members, setMembers, sharing, setSharing, expiresAt, setExpiresAt, offline, setOffline,
        outbox, flags, flag, pos, locate, useDemoLocation, toast, showToast, send, notify, setNotify,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}