import { Link } from 'react-router-dom';
import { LuHouse, LuCircleAlert, LuUsers, LuMap, LuBell, LuMessageCircle, LuTriangleAlert, LuCalendar, LuRoute } from 'react-icons/lu';
import * as api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useLiveQuery } from '../lib/useLiveQuery';
import { useNow } from '../lib/useNow';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Chip from '../components/ui/Chip';

const ACTIONS = [
  { to: '/help', icon: LuCircleAlert, title: 'SOS', desc: 'Press and hold. Your trusted friends are alerted.', cls: 'bg-red border-red text-white', descCls: 'text-[#ffe3df]' },
  { to: '/checkin', icon: LuHouse, title: 'Get me home', desc: 'Plan your journey. Contacts are alerted if you do not arrive.', cls: 'bg-teal border-teal text-white', descCls: 'text-[#d6efea]' },
  { to: '/outing', icon: LuUsers, title: 'Outings', desc: 'Create or join an outing for one night.', cls: 'bg-white border-line', descCls: 'text-mut' },
  { to: '/map', icon: LuMap, title: 'Live map', desc: 'Share your location with chosen friends.', cls: 'bg-white border-line', descCls: 'text-mut' },
];

const when = (iso) => new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function Dashboard() {
  const { user } = useAuth();
  const { contacts, invitations, notifications, unreadMessages, unreadNotifications, alerts } = useData();
  const now = useNow(60_000);
  const outings = useLiveQuery(user.id, api.fetchOutings, ['outings', 'outing_members']);
  const plans = useLiveQuery(user.id, api.fetchPlans, ['return_home_plans']);

  const activeOutings = (outings.data || []).filter((o) => o.status === 'active' && new Date(o.ends_at).getTime() > now
    && o.members.some((m) => m.user_id === user.id && m.status === 'accepted'));
  const outingInvites = (outings.data || []).filter((o) => o.status === 'active' && new Date(o.ends_at).getTime() > now
    && o.members.some((m) => m.user_id === user.id && m.status === 'invited'));
  const myJourney = (plans.data || []).find((p) => p.user_id === user.id && ['planned', 'active', 'overdue'].includes(p.status));
  const watching = (plans.data || []).filter((p) => p.user_id !== user.id && ['active', 'overdue'].includes(p.status));
  const incoming = alerts.filter((a) => a.sender_id !== user.id && a.status === 'active');
  const friendInvites = invitations.filter((i) => i.invitee_id === user.id);
  const nameOf = (id) => contacts.find((c) => c.id === id)?.name || 'A friend';

  return (
    <>
      <section className="relative overflow-hidden bg-deep text-white pt-12 pb-28">
        <div className="max-w-[1120px] mx-auto px-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/20 text-[#bfe0da] text-sm mb-4">
            <span className="w-2 h-2 rounded-full bg-amber animate-[blink_1.6s_infinite]" />
            Signed in as {user.email}
          </div>
          <h1 className="font-display font-extrabold text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.05] mb-3">
            Hello, {user.name.split(' ')[0]}.<br /><span className="text-amber">Get home safe.</span>
          </h1>
          <p className="text-[#bfe0da] max-w-[56ch] m-0">
            TukoSafe is not an emergency service. In an emergency call{' '}
            <a className="text-white font-bold" href="tel:999">999</a> or <a className="text-white font-bold" href="tel:112">112</a>.
          </p>
        </div>
      </section>

      <div className="max-w-[1120px] mx-auto px-5 -mt-16 relative pb-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {ACTIONS.map(({ to, icon: Icon, title, desc, cls, descCls }) => (
            <Link key={title} to={to}
              className={`block ${cls} border rounded-2xl p-5 no-underline shadow-[0_18px_40px_rgba(7,39,36,0.2)] hover:-translate-y-1 transition-transform`}>
              <Icon size={28} />
              <h3 className="font-display font-extrabold text-lg mt-2 mb-1">{title}</h3>
              <p className={`m-0 text-sm ${descCls}`}>{desc}</p>
            </Link>
          ))}
        </div>

        {incoming.length > 0 && (
          <Card className="mt-5 border-red">
            <b className="flex items-center gap-2 text-red"><LuTriangleAlert size={18} /> {incoming.length} active alert{incoming.length > 1 ? 's' : ''} from friends</b>
            {incoming.map((a) => (
              <p key={a.id} className="text-sm my-1.5">
                <b>{a.sender?.display_name || 'A friend'}</b>: {a.message || 'needs help'} <span className="text-mut">({when(a.created_at)})</span>
              </p>
            ))}
            <Button to="/help" size="sm" variant="danger">Open alerts</Button>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-5 mt-5">
          <Card>
            <b className="flex items-center gap-2"><LuRoute size={16} /> Your journey home</b>
            {plans.loading ? <p className="text-mut text-sm mt-2 mb-0">Loading…</p>
              : myJourney ? (
                <div className="mt-2 text-sm">
                  <Chip tone={myJourney.status === 'overdue' ? 'r' : myJourney.status === 'active' ? 'g' : 'n'}>
                    {myJourney.status === 'overdue' ? 'Contacts alerted' : myJourney.status === 'active' ? 'In progress' : 'Planned'}
                  </Chip>
                  <p className="m-0 mt-1.5">To <b>{myJourney.destination}</b>, expected {when(myJourney.expected_arrival)}</p>
                  <Button to="/checkin" size="sm" variant="outline" className="mt-2">Open check-in</Button>
                </div>
              ) : (
                <div className="mt-2"><p className="text-mut text-sm m-0">No journey planned.</p>
                  <Button to="/checkin" size="sm" variant="outline" className="mt-2">Plan a journey home</Button></div>
              )}
            {watching.length > 0 && (
              <p className="text-sm mt-3 mb-0 pt-3 border-t border-line">
                You are watching over: {watching.map((p) => `${nameOf(p.user_id)}${p.status === 'overdue' ? ' (overdue)' : ''}`).join(', ')}
              </p>
            )}
          </Card>

          <Card>
            <b className="flex items-center gap-2"><LuCalendar size={16} /> Outings</b>
            {outings.loading ? <p className="text-mut text-sm mt-2 mb-0">Loading…</p> : (
              <div className="mt-2 text-sm">
                {outingInvites.length > 0 && <p className="m-0 mb-1.5 text-amber font-bold">{outingInvites.length} invitation{outingInvites.length > 1 ? 's' : ''} waiting for you</p>}
                {activeOutings.map((o) => (
                  <p key={o.id} className="m-0 mb-1"><b>{o.title}</b> · {o.venue} · ends {when(o.ends_at)}</p>
                ))}
                {!activeOutings.length && !outingInvites.length && <p className="text-mut m-0">No active outings.</p>}
                <Button to="/outing" size="sm" variant="outline" className="mt-2">{activeOutings.length || outingInvites.length ? 'Open outings' : 'Create an outing'}</Button>
              </div>
            )}
          </Card>

          <Card>
            <b className="flex items-center gap-2"><LuUsers size={16} /> Trusted friends ({contacts.length})</b>
            <div className="mt-2 text-sm">
              {friendInvites.length > 0 && <p className="m-0 mb-1.5 text-amber font-bold">{friendInvites.length} invitation{friendInvites.length > 1 ? 's' : ''} to answer</p>}
              {contacts.length ? (
                <ul className="list-none p-0 m-0 space-y-1">
                  {contacts.slice(0, 5).map((c) => (
                    <li key={c.id}>
                      <Link to={`/contact?with=${c.id}`} className="font-bold text-ink">{c.name}</Link>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-mut m-0">You have no trusted friends yet.</p>}
              <Button to="/trust" size="sm" variant="outline" className="mt-2">{contacts.length ? 'Manage' : 'Invite a friend'}</Button>
            </div>
          </Card>

          <Card>
            <b className="flex items-center gap-2">
              <LuBell size={16} /> Notifications
              {unreadNotifications > 0 && <Chip tone="y">{unreadNotifications} new</Chip>}
              {unreadMessages > 0 && <Chip tone="r"><LuMessageCircle size={12} /> {unreadMessages} unread</Chip>}
            </b>
            <div className="mt-2 text-sm">
              {notifications.slice(0, 5).map((n) => (
                <p key={n.id} className={`m-0 mb-1 ${n.read_at ? 'text-mut' : 'font-bold'}`}>{n.title} <span className="text-mut font-normal">· {when(n.created_at)}</span></p>
              ))}
              {!notifications.length && <p className="text-mut m-0">Nothing yet. Invitations, messages and alerts appear here.</p>}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
