import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import * as api from '../lib/api';
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
  }), [trust, notifications, unread, realtime, loadError, refreshTrust, refreshUnread, markRead, markAllRead]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}
