import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LuTriangleAlert, LuPhone, LuFlag, LuCheck, LuMapPin } from 'react-icons/lu';
import * as api from '../lib/api';
import { useApp } from '../context/app-context';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useLiveQuery } from '../lib/useLiveQuery';
import { useSharedLocations } from '../lib/useSharedLocations';
import { useNow } from '../lib/useNow';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Chip from '../components/ui/Chip';
import MapView from '../components/MapView';
import Chat from '../components/Chat';
import { mapsLink } from '../lib/format';

const when = (iso) => new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

// Wording only. Every fact comes from the database; nothing is invented or estimated.
function buildBrief({ name, plan, lastSeen, friendly }) {
  const parts = [];
  if (plan?.status === 'overdue') {
    parts.push(friendly
      ? `${name} hasn’t confirmed arrival at ${plan.destination} yet. This may be a dead battery or poor signal.`
      : `ALERT: ${name} missed a check-in. Expected at ${plan.destination} by ${when(plan.expected_arrival)}.`);
  } else if (plan?.status === 'active') {
    parts.push(`${name} is on their way to ${plan.destination}, expected ${when(plan.expected_arrival)}.`);
  }
  parts.push(lastSeen
    ? `Last shared position: ${when(lastSeen)}.`
    : 'No location is being shared with you, so their position is unknown.');
  parts.push(`Try calling ${name} first. If you believe they are in danger, call 999 or 112.`);
  return parts.join(' ');
}

export default function ContactView() {
  const { user } = useAuth();
  const { contacts, alerts, ackAlert, unread } = useData();
  const { ai, flag, showToast, myShares } = useApp();
  const [params, setParams] = useSearchParams();
  const now = useNow(30_000);

  const contact = contacts.find((c) => c.id === params.get('with')) || contacts[0] || null;
  const names = useMemo(() => Object.fromEntries(contacts.map((c) => [c.id, c.name])), [contacts]);
  const { people } = useSharedLocations(user.id, names);
  const plans = useLiveQuery(user.id, api.fetchPlans, ['return_home_plans']);

  if (!contacts.length) {
    return (
      <div className="max-w-[1120px] mx-auto px-5 pt-10">
        <Card className="max-w-[620px]">
          <Chip tone="n">No trusted friends yet</Chip>
          <p className="text-mut mt-2.5">When you and a friend accept each other&apos;s invitation, you can see your relationship, shared location and conversation here.</p>
          <Button to="/trust">Invite a friend</Button>
        </Card>
      </div>
    );
  }

  const theirLocation = people.find((p) => p.id === contact.id);
  const sharingWithThem = myShares.some((s) => s.viewer_id === contact.id && s.status === 'active' && new Date(s.expires_at).getTime() > now);
  const theirPlan = (plans.data || []).find((p) => p.user_id === contact.id && ['active', 'overdue'].includes(p.status));
  const theirAlerts = alerts.filter((a) => a.sender_id === contact.id && a.status === 'active');
  const concerning = theirAlerts.length > 0 || theirPlan?.status === 'overdue';
  const brief = buildBrief({ name: contact.name, plan: theirPlan, lastSeen: theirLocation?.updatedAt, friendly: ai.brief });

  return (
    <>
      <div className="relative overflow-hidden bg-deep text-white pt-11 pb-20">
        <div className="max-w-[1120px] mx-auto px-5 relative">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/20 text-[#bfe0da] text-sm mb-3">
            <span className="w-2 h-2 rounded-full bg-amber animate-[blink_1.6s_infinite]" />
            Contact view
          </span>
          <h2 className="font-display font-extrabold text-[clamp(2rem,5vw,3.3rem)] text-white mb-2">{contact.name}</h2>
          <p className="text-[#bfe0da] max-w-[58ch] m-0">What you can see about this friend, only what they chose to share with you.</p>
        </div>
      </div>

      <div className="max-w-[1120px] mx-auto px-5 -mt-11 relative">
        {contacts.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {contacts.map((c) => (
              <button key={c.id} type="button" onClick={() => setParams({ with: c.id })} aria-pressed={c.id === contact.id}
                className={`px-3.5 py-1.5 rounded-full border text-sm font-bold ${c.id === contact.id ? 'border-teal bg-mint' : 'border-line bg-white'}`}>
                {c.name}{unread[c.id] > 0 && <span className="ml-1.5 text-red">({unread[c.id]})</span>}
              </button>
            ))}
          </div>
        )}

        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5 items-start">
          <div className="space-y-3.5">
            {theirAlerts.map((a) => {
              const mine = a.recipients.find((r) => r.recipient_id === user.id);
              return (
                <Card key={a.id} className="border-red">
                  <Chip tone="r"><LuTriangleAlert size={12} /> {a.kind === 'sos' ? 'SOS' : 'Help request'}</Chip>
                  <p className="mt-2.5 mb-1">{a.message || `${contact.name} needs help.`}</p>
                  <p className="text-mut text-xs m-0">{when(a.created_at)}</p>
                  {a.lat != null && (
                    <a href={mapsLink(a.lat, a.lng)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-teal mt-1.5">
                      <LuMapPin size={14} /> Location they chose to share
                    </a>
                  )}
                  <div className="flex flex-wrap gap-2.5 mt-3">
                    {contact.phone && <Button href={`tel:${contact.phone}`}><LuPhone size={16} /> Call {contact.name}</Button>}
                    <Button variant="amber" href="tel:999"><LuPhone size={16} /> Call 999</Button>
                    {mine?.acknowledged_at
                      ? <span className="text-sm text-green font-bold self-center">You acknowledged this</span>
                      : <Button variant="outline" onClick={() => ackAlert(a.id).catch((e) => showToast(e.message))}><LuCheck size={16} /> I have seen this</Button>}
                  </div>
                </Card>
              );
            })}

            <Card className={concerning ? 'border-amber' : ''}>
              <div className="flex justify-between items-center gap-3 flex-wrap">
                <b>Status</b>
                {concerning ? <Chip tone="y"><LuTriangleAlert size={12} /> Verify safety</Chip>
                  : theirPlan ? <Chip tone="g">On a journey</Chip> : <Chip tone="n">Nothing to report</Chip>}
              </div>
              <p className="mt-2.5 leading-relaxed">{brief}</p>
              <span className="inline-block px-2 py-0.5 rounded-md bg-amberbg text-amber text-xs font-bold">
                Template wording from recorded facts{ai.brief ? '' : ' (plain style)'}. Status is not a guarantee.
              </span>
              <div className="flex flex-wrap gap-2.5 mt-3">
                {contact.phone && <Button href={`tel:${contact.phone}`}><LuPhone size={16} /> Call {contact.name}</Button>}
                <Button variant="amber" href="tel:999"><LuPhone size={16} /> Call 999 / 112</Button>
                <Button variant="outline" onClick={flag}><LuFlag size={16} /> Flag as wrong or unhelpful</Button>
              </div>
            </Card>

            <Card>
              <b>Conversation</b>
              <div className="mt-2"><Chat key={contact.id} contact={contact} /></div>
            </Card>
          </div>

          <div className="space-y-3.5">
            <Card>
              <b>Relationship</b>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-sm mt-2 mb-0">
                <dt className="text-mut">Status</dt><dd className="m-0 font-bold">Trusted friends since {new Date(contact.since).toLocaleDateString()}</dd>
                <dt className="text-mut">Email</dt><dd className="m-0 font-bold break-all">{contact.email}</dd>
                <dt className="text-mut">Gets my SOS</dt><dd className="m-0 font-bold">{contact.receivesSos ? 'Yes' : 'No'}</dd>
                <dt className="text-mut">Gets my check-ins</dt><dd className="m-0 font-bold">{contact.receivesCheckins ? 'Yes' : 'No'}</dd>
                <dt className="text-mut">Their location</dt>
                <dd className="m-0 font-bold">{theirLocation ? `Sharing with you (${theirLocation.state})` : 'Not sharing with you'}</dd>
                <dt className="text-mut">My location</dt>
                <dd className="m-0 font-bold">{sharingWithThem ? 'Sharing with them' : 'Not sharing with them'}</dd>
              </dl>
              <div className="flex gap-2 mt-3">
                <Button to="/map" size="sm" variant="outline">Live map</Button>
                <Link to="/trust" className="inline-flex items-center text-sm font-bold text-teal">Manage in Trust Panel</Link>
              </div>
            </Card>
            {theirLocation ? (
              <div>
                <MapView showMembers friends={[theirLocation]} height={320} />
                <p className="text-mut text-sm mt-2">
                  Updated {when(theirLocation.updatedAt)}{theirLocation.accuracy != null && ` · ±${Math.round(theirLocation.accuracy)} m`}. GPS can fail.
                </p>
              </div>
            ) : (
              <Card><p className="text-mut text-sm m-0">{contact.name} is not sharing their location with you. Sharing needs their separate, explicit consent.</p></Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
