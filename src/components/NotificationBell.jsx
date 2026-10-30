import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuBell } from 'react-icons/lu';
import { useData } from '../context/DataContext';

const ROUTE = {
  friend_invitation: '/trust', invitation_accepted: '/trust', message: '/trust',
  sos: '/help', help_request: '/help', sos_acknowledged: '/help',
  checkin: '/checkin', missed_checkin: '/checkin', arrived: '/checkin',
  outing_invitation: '/outing', location_share: '/map',
};

export default function NotificationBell() {
  const { notifications, unreadNotifications, markRead, markAllRead } = useData();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!e.target.closest('[data-bell]')) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const go = (n) => { markRead(n.id); setOpen(false); navigate(ROUTE[n.type] || '/'); };

  return (
    <div className="relative" data-bell>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="true"
        aria-label={`Notifications${unreadNotifications ? `, ${unreadNotifications} unread` : ''}`}
        className="relative w-9 h-9 grid place-items-center rounded-lg text-[#bfe0da] hover:text-white hover:bg-white/10">
        <LuBell size={17} />
        {unreadNotifications > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red text-white text-[10px] font-bold grid place-items-center">
            {unreadNotifications > 9 ? '9+' : unreadNotifications}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[min(360px,90vw)] max-h-[70vh] overflow-y-auto rounded-xl bg-white text-ink border border-line shadow-[0_18px_50px_rgba(7,39,36,0.15)] z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <b className="text-sm">Notifications</b>
            {unreadNotifications > 0 && <button type="button" onClick={markAllRead} className="text-xs font-bold text-teal hover:underline">Mark all read</button>}
          </div>
          {!notifications.length && <p className="px-4 py-6 text-sm text-mut text-center m-0">Nothing yet.</p>}
          {notifications.map((n) => (
            <button key={n.id} type="button" onClick={() => go(n)}
              className={`w-full text-left px-4 py-3 border-b border-line last:border-b-0 hover:bg-mint ${n.read_at ? '' : 'bg-[#f4f8f7]'}`}>
              <div className="flex items-start gap-2">
                {!n.read_at && <span className="w-2 h-2 rounded-full bg-amber mt-1.5 shrink-0" />}
                <div className="min-w-0">
                  <div className={`text-sm ${n.type === 'sos' || n.type === 'missed_checkin' ? 'text-red font-bold' : 'font-semibold'}`}>{n.title}</div>
                  {n.body && <div className="text-xs text-mut truncate">{n.body}</div>}
                  <div className="text-[11px] text-mut mt-0.5">{new Date(n.created_at).toLocaleString()}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
