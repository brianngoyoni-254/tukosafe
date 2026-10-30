import { useState } from 'react';
import { LuTriangleAlert, LuCheck, LuClock, LuMapPin } from 'react-icons/lu';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useApp } from '../context/AppContext';
import * as api from '../lib/api';
import { useLiveQuery } from '../lib/useLiveQuery';
import Card from './ui/Card';
import Button from './ui/Button';
import { mapsLink } from '../lib/format';

const CHANNEL_LABEL = { push: 'push', email: 'email', sms: 'SMS' };
// "accepted" means the provider took it. It does NOT mean the person has seen it.
const STATUS_LABEL = {
  queued: 'queued', sending: 'sending', provider_accepted: 'handed to provider (not confirmed read)',
  failed: 'failed', not_configured: 'not sent (provider not set up)',
};

const when = (iso) => new Date(iso).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });

export default function AlertPanel() {
  const { user } = useAuth();
  const { alerts, queue, ackAlert, closeAlert, flushQueue, dismissQueued, contacts } = useData();
  const { showToast } = useApp();
  const [busy, setBusy] = useState('');
  const nameOf = (id) => contacts.find((c) => c.id === id)?.name || 'A friend';

  const run = async (key, fn) => {
    setBusy(key);
    try { await fn(); } catch (e) { showToast(e.message); } finally { setBusy(''); }
  };

  const mine = alerts.filter((a) => a.sender_id === user.id);
  const incoming = alerts.filter((a) => a.sender_id !== user.id);
  const notificationIds = mine.flatMap((a) => a.attempts.map((t) => t.notification_id)).filter(Boolean);
  const idsKey = notificationIds.join(',');
  const { data: deliveries } = useLiveQuery(idsKey || null, () => api.fetchDeliveries(idsKey.split(',')), ['notification_deliveries']);
  const byNotification = (deliveries || []).reduce((acc, d) => ({ ...acc, [d.notification_id]: [...(acc[d.notification_id] || []), d] }), {});

  return (
    <div className="space-y-3.5">
      {queue.length > 0 && (
        <Card className="border-amber">
          <b>Waiting to send ({queue.length})</b>
          {queue.map((q) => (
            <div key={q.clientId} className="mt-2 text-sm">
              <span className={q.status === 'failed' ? 'text-red font-bold' : 'text-amber font-bold'}>
                {q.status === 'failed' ? 'Failed' : 'Pending'}
              </span>{' '}
              · {q.kind === 'sos' ? 'SOS' : 'Help request'} · saved {new Date(q.queuedAt).toLocaleTimeString()}
              {q.error && <div className="text-red text-xs">{q.error}</div>}
              <div className="flex gap-2 mt-1">
                {q.status === 'pending' && <Button size="sm" variant="outline" onClick={flushQueue}>Retry now</Button>}
                <Button size="sm" variant="outline" onClick={() => dismissQueued(q.clientId)}>Discard</Button>
              </div>
            </div>
          ))}
          <p className="text-mut text-xs mb-0 mt-2">Nothing has been delivered yet. In danger, call 999 or 112.</p>
        </Card>
      )}

      {incoming.filter((a) => a.status === 'active').map((a) => {
        const me = a.recipients.find((r) => r.recipient_id === user.id);
        return (
          <Card key={a.id} className="border-red">
            <div className="flex items-center gap-2 text-red font-bold">
              <LuTriangleAlert size={18} /> {a.kind === 'sos' ? 'SOS' : 'Help request'} from {a.sender?.display_name || 'a friend'}
            </div>
            <p className="text-sm my-1.5">{a.message}</p>
            <p className="text-mut text-xs m-0">{when(a.created_at)}</p>
            {a.lat != null && (
              <a href={mapsLink(a.lat, a.lng)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-teal mt-1.5">
                <LuMapPin size={14} /> Location they chose to share
              </a>
            )}
            <div className="flex flex-wrap gap-2 mt-2.5">
              {me?.acknowledged_at
                ? <span className="text-sm text-green font-bold">You acknowledged this</span>
                : <Button size="sm" disabled={busy === a.id} onClick={() => run(a.id, () => ackAlert(a.id))}><LuCheck size={14} /> I have seen this</Button>}
              <Button size="sm" variant="amber" href="tel:999">Call 999</Button>
              <Button size="sm" variant="outline" href="tel:112">Call 112</Button>
            </div>
            <p className="text-mut text-xs mt-2 mb-0">Acknowledging tells them you saw it. It does not contact emergency services.</p>
          </Card>
        );
      })}

      <Card>
        <b>Your alerts</b>
        {!mine.length && <p className="text-mut text-sm mt-1 mb-0">No alerts sent.</p>}
        {mine.map((a) => {
          const total = a.recipients.length;
          const delivered = a.attempts.filter((t) => t.status === 'delivered').length;
          const acked = a.recipients.filter((r) => r.acknowledged_at).length;
          return (
            <div key={a.id} className="border-t border-line first:border-t-0 mt-2.5 pt-2.5 text-sm">
              <div className="flex justify-between gap-2">
                <b>{a.kind === 'sos' ? 'SOS' : 'Help request'} · {a.status}</b>
                <span className="text-mut text-xs">{when(a.created_at)}</span>
              </div>
              <ul className="list-none p-0 mt-1 mb-0 text-xs text-mut space-y-0.5">
                <li className="flex items-center gap-1.5"><LuCheck size={12} className="text-green" /> Recorded on the server for {total} friend{total === 1 ? '' : 's'}</li>
                <li className="flex items-center gap-1.5">
                  {delivered === total ? <LuCheck size={12} className="text-green" /> : <LuClock size={12} />}
                  Received on {delivered} of {total} friends’ devices
                </li>
                <li className="flex items-center gap-1.5">
                  {acked > 0 ? <LuCheck size={12} className="text-green" /> : <LuClock size={12} />}
                  Acknowledged by {acked} of {total}
                  {acked > 0 && ` (${a.recipients.filter((r) => r.acknowledged_at).map((r) => nameOf(r.recipient_id)).join(', ')})`}
                </li>
                {a.attempts.map((t) => (
                  <li key={t.notification_id} className="pl-4">
                    {nameOf(t.recipient_id)}: in-app {t.status === 'delivered' ? 'received' : 'recorded, device not confirmed'}
                    {(byNotification[t.notification_id] || []).map((d) => (
                      <span key={d.channel}> · {CHANNEL_LABEL[d.channel]}: <b className={d.status === 'failed' ? 'text-red' : ''}>{STATUS_LABEL[d.status]}</b></span>
                    ))}
                  </li>
                ))}
                <li>Emergency services were not contacted. Push, email and SMS happen only if your friend turned them on and the server has that provider set up.</li>
              </ul>
              {a.status === 'active' && (
                <div className="flex gap-2 mt-2">
                  <Button size="sm" disabled={busy === a.id} onClick={() => run(a.id, () => closeAlert(a.id, 'resolved'))}>I am safe: resolve</Button>
                  <Button size="sm" variant="outline" disabled={busy === a.id} onClick={() => run(a.id, () => closeAlert(a.id, 'cancelled'))}>Cancel alert</Button>
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
