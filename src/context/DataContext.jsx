import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import * as api from '../lib/api';
import * as alertQueue from '../lib/alertQueue';
import { useAuth } from './AuthContext';
import { useApp } from './AppContext';

const DataContext = createContext(null);

const EMPTY = { contacts: [], invitations: [], blocked: [] };

export function DataProvider({ children }) {
  const { user } = useAuth();
  const { showToast } = useApp();
  const [trust, setTrust] = useState(EMPTY);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState({});
  const [realtime, setRealtime] = useState('connecting');
  const [loadError, setLoadError] = useState('');
  const userId = user?.id;
  const toastRef = useRef(showToast);
  toastRef.current = showToast;

  const refreshTrust = useCallback(async () => {
    if (!userId) return;
    try { setTrust(await api.fetchTrust(userId)); setLoadError(''); }
    catch (e) { setLoadError(e.message); }
  }, [userId]);

  const refreshNotifications = useCallback(async () => {
    if (!userId) return;
    try { setNotifications(await api.fetchNotifications()); } catch (e) { setLoadError(e.message); }
  }, [userId]);

  const refreshUnread = useCallback(async () => {
    if (!userId) return;
    try { setUnread(await api.fetchUnreadCounts(userId)); } catch (e) { setLoadError(e.message); }
  }, [userId]);

  const refreshAll = useCallback(() => {
    refreshTrust(); refreshNotifications(); refreshUnread();
    api.markMessagesDelivered().catch(() => {});
  }, [refreshTrust, refreshNotifications, refreshUnread]);

  useEffect(() => {
    if (!userId || !supabase) {
      setTrust(EMPTY); setNotifications([]); setUnread({});
      return undefined;
    }
    refreshAll();

    const onNotification = (row) => {
      setNotifications((n) => (n.some((x) => x.id === row.id) ? n : [row, ...n]));
      // Tell the server this device actually received it (drives "delivered" on SOS).
      api.markNotificationDelivered(row.id).catch(() => {});
      const urgent = row.type === 'sos' || row.type === 'missed_checkin';
      toastRef.current(`${urgent ? '⚠ ' : ''}${row.title}${row.body ? `: ${row.body}` : ''}`);
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
        try { new Notification(row.title, { body: row.body || '', tag: row.id }); } catch { /* unsupported */ }
      }
      if (row.type === 'invitation_accepted' || row.type === 'friend_invitation') refreshTrust();
    };

    const channel = supabase.channel(`tukosafe:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (p) => onNotification(p.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (p) => setNotifications((n) => n.map((x) => (x.id === p.new.id ? p.new : x))))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${userId}` },
        () => { refreshUnread(); api.markMessagesDelivered().catch(() => {}); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `recipient_id=eq.${userId}` },
        () => refreshUnread())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_invitations' }, () => refreshTrust())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trusted_contacts' }, () => refreshTrust())
      .subscribe((status) => {
        setRealtime(status === 'SUBSCRIBED' ? 'live' : status === 'CLOSED' ? 'offline' : 'connecting');
        if (status === 'SUBSCRIBED') refreshAll(); // catch up on anything missed while disconnected
      });

    const onOnline = () => refreshAll();
    window.addEventListener('online', onOnline);
    return () => { window.removeEventListener('online', onOnline); supabase.removeChannel(channel); };
  }, [userId, refreshAll, refreshTrust, refreshUnread]);

  // ── Alerts (SOS / help requests) ──
  const [alerts, setAlerts] = useState([]);
  const [queue, setQueue] = useState([]);

  const refreshAlerts = useCallback(async () => {
    if (!userId) return;
    try { setAlerts(await api.fetchAlerts()); } catch (e) { setLoadError(e.message); }
  }, [userId]);

  const syncQueue = useCallback(() => { if (userId) setQueue(alertQueue.queued(userId)); }, [userId]);

  const flushQueue = useCallback(async () => {
    if (!userId) return;
    for (const item of alertQueue.retryable(userId)) {
      const r = await alertQueue.attempt(item, api.createAlert);
      if (r.network) break;
    }
    syncQueue();
    refreshAlerts();
  }, [userId, syncQueue, refreshAlerts]);

  /** Create an alert. Resolves with { status: 'confirmed' | 'queued' | 'failed', error? }. */
  const sendAlert = useCallback(async ({ kind, message, recipients = null, location = null }) => {
    const item = { userId, clientId: crypto.randomUUID(), kind, message, recipients, location };
    alertQueue.enqueue(item);       // persist first so a crash/offline never loses it
    syncQueue();
    const r = await alertQueue.attempt(item, api.createAlert);
    syncQueue();
    if (r.ok) { refreshAlerts(); return { status: 'confirmed', id: r.id }; }
    return r.network ? { status: 'queued' } : { status: 'failed', error: r.error };
  }, [userId, syncQueue, refreshAlerts]);

  const dismissQueued = useCallback((clientId) => { alertQueue.remove(clientId); syncQueue(); }, [syncQueue]);

  const ackAlert = useCallback(async (id) => { await api.ackAlert(id); refreshAlerts(); }, [refreshAlerts]);
  const closeAlert = useCallback(async (id, status) => { await api.closeAlert(id, status); refreshAlerts(); }, [refreshAlerts]);

  useEffect(() => {
    if (!userId || !supabase) { setAlerts([]); setQueue([]); return undefined; }
    syncQueue(); refreshAlerts(); flushQueue();
    const ch = supabase.channel(`alerts:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_alerts' }, () => refreshAlerts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_recipients' }, () => refreshAlerts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_attempts' }, () => refreshAlerts())
      .subscribe((s) => { if (s === 'SUBSCRIBED') { refreshAlerts(); flushQueue(); } });
    window.addEventListener('online', flushQueue);
    return () => { window.removeEventListener('online', flushQueue); supabase.removeChannel(ch); };
  }, [userId, syncQueue, refreshAlerts, flushQueue]);

  const markRead = useCallback(async (id) => {
    setNotifications((n) => n.map((x) => (x.id === id ? { ...x, read_at: x.read_at || new Date().toISOString() } : x)));
    try { await api.markNotificationRead(id); } catch { refreshNotifications(); }
  }, [refreshNotifications]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    setNotifications((n) => n.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() })));
    try { await api.markAllNotificationsRead(userId); } catch { refreshNotifications(); }
  }, [userId, refreshNotifications]);

  const value = useMemo(() => ({
    ...trust,
    notifications,
    unread,
    unreadMessages: Object.values(unread).reduce((a, b) => a + b, 0),
    unreadNotifications: notifications.filter((n) => !n.read_at).length,
    realtime,
    loadError,
    refreshTrust,
    refreshUnread,
    markRead,
    markAllRead,
    alerts, queue, sendAlert, dismissQueued, flushQueue, ackAlert, closeAlert,
  }), [trust, notifications, unread, realtime, loadError, refreshTrust, refreshUnread, markRead, markAllRead,
    alerts, queue, sendAlert, dismissQueued, flushQueue, ackAlert, closeAlert]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}
