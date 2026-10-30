import { useMemo, useState } from 'react';
import {
  LuUsers, LuCalendar, LuMapPin, LuUserPlus, LuCheck, LuClock, LuLogOut,
  LuSquare, LuTrash2, LuPencil, LuHouse, LuX, LuMapPinned,
} from 'react-icons/lu';
import * as api from '../lib/api';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useLiveQuery } from '../lib/useLiveQuery';
import { useSharedLocations } from '../lib/useSharedLocations';
import { useNow } from '../lib/useNow';
import MapView from '../components/MapView';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Chip from '../components/ui/Chip';
import Toggle from '../components/ui/Toggle';

const INPUT = 'w-full p-2.5 rounded-lg border border-line bg-white text-ink font-body text-sm';
const toLocalInput = (d) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};
const fmt = (iso) => new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function MemberChip({ m }) {
  switch (m.status) {
    case 'accepted':
      return <Chip tone="g"><LuCheck size={12} /> Joined{m.shares_location ? ' · sharing location' : ''}</Chip>;
    case 'invited': return <Chip tone="y"><LuClock size={12} /> Invite pending</Chip>;
    case 'declined': return <Chip tone="n"><LuX size={12} /> Declined</Chip>;
    case 'left': return <Chip tone="n"><LuLogOut size={12} /> Left</Chip>;
    case 'removed': return <Chip tone="n">Removed</Chip>;
    case 'expired': return <Chip tone="n"><LuClock size={12} /> Invite expired</Chip>;
    default: return null;
  }
}

function useAct() {
  const { showToast } = useApp();
  const [busy, setBusy] = useState('');
  const act = async (key, fn, okMsg) => {
    setBusy(key);
    try { await fn(); if (okMsg) showToast(okMsg); return true; }
    catch (e) { showToast(e.message); return false; }
    finally { setBusy(''); }
  };
  return { busy, act };
}

function CreateOutingForm({ onCreated }) {
  const { contacts } = useData();
  const { busy, act } = useAct();
  const { showToast } = useApp();
  const [title, setTitle] = useState('');
  const [venue, setVenue] = useState('');
  const [startsAt, setStartsAt] = useState(() => toLocalInput(Date.now() + 60 * 60_000));
  const [endsAt, setEndsAt] = useState(() => toLocalInput(Date.now() + 4 * 3_600_000));
  const [invites, setInvites] = useState([]);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return showToast('Give the outing a name.');
    if (!venue.trim()) return showToast('Add a venue.');
    if (new Date(endsAt) <= new Date(startsAt)) return showToast('End time must be after start time.');
    const ok = await act('create', async () => {
      const id = await api.createOuting({
        title, venue, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), invitees: invites,
      });
      onCreated?.(id);
    }, invites.length ? 'Outing created. Invitations sent.' : 'Outing created.');
    if (ok) { setTitle(''); setVenue(''); setInvites([]); }
  };

  return (
    <Card>
      <h3 className="font-display font-extrabold text-xl mb-1">Create an outing</h3>
      <p className="text-mut text-sm mb-4">One night. One window. Everyone opts in. Sharing ends on its own.</p>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm font-bold">Outing name
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Concert at Uhuru Gardens"
            className={`${INPUT} mt-1 font-normal`} maxLength={120} />
        </label>
        <label className="block text-sm font-bold">Venue
          <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. Uhuru Gardens, Nairobi"
            className={`${INPUT} mt-1 font-normal`} maxLength={200} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-bold">Starts
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={`${INPUT} mt-1 font-normal`} />
          </label>
          <label className="block text-sm font-bold">Ends
            <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={`${INPUT} mt-1 font-normal`} />
          </label>
        </div>
        <div>
          <span className="block text-sm font-bold mb-1">Invite trusted friends</span>
          {!contacts.length && <p className="text-mut text-sm m-0">Add a trusted friend in the <a href="/trust" className="text-teal font-bold">Trust Panel</a> to invite them.</p>}
          <div className="space-y-1.5">
            {contacts.map((c) => {
              const on = invites.includes(c.id);
              return (
                <button type="button" key={c.id} aria-pressed={on}
                  onClick={() => setInvites((cur) => (on ? cur.filter((x) => x !== c.id) : [...cur, c.id]))}
                  className={`w-full flex items-center justify-between p-2.5 rounded-lg border-2 transition ${on ? 'border-teal bg-mint' : 'border-line bg-white hover:border-teal2'}`}>
                  <span className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-full bg-teal text-white grid place-items-center font-bold text-sm">{c.name[0]}</span>
                    <span className="font-bold text-sm">{c.name}</span>
                  </span>
                  {on ? <LuCheck size={16} className="text-teal" /> : <LuUserPlus size={16} className="text-mut" />}
                </button>
              );
            })}
          </div>
          <p className="text-mut text-xs mt-1.5 mb-0">Inviting someone does not share anyone&apos;s location. Each person chooses separately.</p>
        </div>
        <Button type="submit" disabled={busy === 'create'}><LuCalendar size={16} /> {busy === 'create' ? 'Creating…' : 'Create outing'}</Button>
      </form>
    </Card>
  );
}

function InvitationCard({ outing }) {
  const { busy, act } = useAct();
  const [share, setShare] = useState(false);
  const host = outing.members.find((m) => m.user_id === outing.host_id);
  return (
    <Card className="border-amber">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <b>{host?.profile?.display_name || 'A friend'} invited you</b>
          <h4 className="font-display font-extrabold text-lg m-0 mt-0.5">{outing.title}</h4>
          <p className="text-mut text-sm m-0 flex items-center gap-1.5"><LuMapPin size={14} /> {outing.venue}</p>
          <p className="text-mut text-sm m-0 flex items-center gap-1.5"><LuCalendar size={14} /> {fmt(outing.starts_at)} → {fmt(outing.ends_at)}</p>
        </div>
      </div>
      <label className="flex items-start gap-2 mt-3 text-sm cursor-pointer">
        <input type="checkbox" className="w-4 h-4 accent-teal mt-0.5" checked={share} onChange={(e) => setShare(e.target.checked)} />
        <span>Also share my location with this outing&apos;s members until it ends (optional, you can change this any time).</span>
      </label>
      <div className="flex gap-2 mt-3">
        <Button size="sm" disabled={busy === 'a'} onClick={() => act('a', () => api.respondOuting(outing.id, true, share), 'You joined the outing.')}><LuCheck size={14} /> Accept</Button>
        <Button size="sm" variant="outline" disabled={busy === 'd'} onClick={() => act('d', () => api.respondOuting(outing.id, false, false), 'Invitation declined.')}>Decline</Button>
      </div>
    </Card>
  );
}

function OutingDetail({ outing, onGone }) {
  const { user } = useAuth();
  const { contacts } = useData();
  const { busy, act } = useAct();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});

  const isHost = outing.host_id === user.id;
  const active = outing.status === 'active';
  const me = outing.members.find((m) => m.user_id === user.id);
  const visible = outing.members.filter((m) => active || m.status === 'accepted');
  const joined = outing.members.filter((m) => m.status === 'accepted');
  const invitable = contacts.filter((c) => !outing.members.some((m) => m.user_id === c.id && ['invited', 'accepted'].includes(m.status)));

  const names = useMemo(() => Object.fromEntries(
    outing.members.map((m) => [m.user_id, m.profile?.display_name || 'Member'])), [outing.members]);
  const { people } = useSharedLocations(user.id, names);
  const onMap = people.filter((p) => joined.some((m) => m.user_id === p.id));

  const startEdit = () => {
    setDraft({ title: outing.title, venue: outing.venue, startsAt: toLocalInput(outing.starts_at), endsAt: toLocalInput(outing.ends_at) });
    setEditing(true);
  };
  const saveEdit = async () => {
    const ok = await act('save', () => api.updateOuting({
      id: outing.id, title: draft.title, venue: draft.venue,
      startsAt: new Date(draft.startsAt).toISOString(), endsAt: new Date(draft.endsAt).toISOString(),
    }), 'Outing updated. Members were notified.');
    if (ok) setEditing(false);
  };

  return (
    <div className="space-y-3.5">
      <Card>
        {!editing ? (
          <div className="flex justify-between items-start gap-3 flex-wrap">
            <div>
              <h3 className="font-display font-extrabold text-xl m-0">{outing.title}</h3>
              <p className="text-mut text-sm mt-1 mb-0 flex items-center gap-1.5"><LuMapPin size={14} /> {outing.venue}</p>
              <p className="text-mut text-sm mt-0.5 mb-0 flex items-center gap-1.5"><LuCalendar size={14} /> {fmt(outing.starts_at)} → {fmt(outing.ends_at)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Chip tone={active ? 'g' : 'n'}>{active ? 'Active' : 'Ended'}</Chip>
              {isHost && active && <Button size="sm" variant="outline" onClick={startEdit}><LuPencil size={12} /> Edit</Button>}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <input className={INPUT} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} aria-label="Outing name" />
            <input className={INPUT} value={draft.venue} onChange={(e) => setDraft({ ...draft, venue: e.target.value })} aria-label="Venue" />
            <div className="grid grid-cols-2 gap-2">
              <input type="datetime-local" className={INPUT} value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} aria-label="Starts" />
              <input type="datetime-local" className={INPUT} value={draft.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} aria-label="Ends" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={busy === 'save'} onClick={saveEdit}>Save</Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <b className="flex items-center gap-1.5 mb-2"><LuUsers size={16} /> Circle ({joined.length} joined)</b>
        {visible.map((m) => (
          <div key={m.user_id} className="flex items-center justify-between gap-3 py-2.5 border-t border-line first:border-0 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-teal text-white grid place-items-center font-bold">{(m.profile?.display_name || '?')[0]}</div>
              <div>
                <b>{m.profile?.display_name || 'Former member'}{m.user_id === user.id && ' (you)'}{m.user_id === outing.host_id && ' · host'}</b>
                <div className="mt-0.5"><MemberChip m={m} /></div>
              </div>
            </div>
            {isHost && active && m.user_id !== user.id && ['invited', 'accepted'].includes(m.status) && (
              <Button size="sm" variant="outline" disabled={busy === `r${m.user_id}`}
                onClick={() => window.confirm(`Remove ${m.profile?.display_name || 'this member'} from the outing?`)
                  && act(`r${m.user_id}`, () => api.removeOutingMember(outing.id, m.user_id), 'Removed.')}>
                <LuTrash2 size={12} /> Remove
              </Button>
            )}
          </div>
        ))}
        {isHost && active && invitable.length > 0 && (
          <div className="pt-3 border-t border-line mt-3">
            <p className="text-sm font-bold mb-2">Invite more</p>
            <div className="flex flex-wrap gap-2">
              {invitable.map((c) => (
                <button key={c.id} type="button" disabled={busy === `i${c.id}`}
                  onClick={() => act(`i${c.id}`, () => api.inviteToOuting(outing.id, c.id), `Invitation sent to ${c.name}.`)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line bg-white text-sm hover:border-teal2">
                  <LuUserPlus size={14} /> {c.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {active && me?.status === 'accepted' && (
        <Card>
          <div className="flex justify-between items-center gap-3">
            <div>
              <b className="flex items-center gap-1.5"><LuMapPinned size={16} /> Share my location with this outing</b>
              <p className="text-mut text-sm mt-1 mb-0">
                Only joined members who also share can see you, until {fmt(outing.ends_at)}. Updates are sent from the Live map page.
              </p>
            </div>
            <Toggle checked={!!me.shares_location} label="Share my location with this outing"
              onChange={(v) => act('consent', () => api.setOutingConsent(outing.id, v), v ? 'Sharing with this outing.' : 'Stopped sharing with this outing.')} />
          </div>
          {me.shares_location && <Button to="/map" size="sm" variant="outline" className="mt-3">Open Live map to send updates</Button>}
        </Card>
      )}

      {active && (
        <Card>
          <b className="flex items-center gap-1.5"><LuHouse size={16} /> Getting home</b>
          <p className="text-mut text-sm mt-1 mb-2">Set up a journey home so a contact is alerted by the server if you do not arrive.</p>
          <Button to="/checkin" size="sm" variant="outline">Plan my journey home</Button>
        </Card>
      )}

      <Card>
        <b>Outing controls</b>
        <div className="flex flex-wrap gap-2.5 mt-2.5">
          {isHost && active && (
            <Button variant="outline" disabled={busy === 'end'}
              onClick={() => window.confirm('End this outing now? All location sharing for it stops immediately.')
                && act('end', () => api.endOuting(outing.id), 'Outing ended. Sharing stopped.')}>
              <LuSquare size={14} /> End outing now
            </Button>
          )}
          {!isHost && active && me?.status === 'accepted' && (
            <Button variant="outline" disabled={busy === 'leave'}
              onClick={() => act('leave', () => api.leaveOuting(outing.id), 'You left the outing. Sharing stopped.')}>
              <LuLogOut size={14} /> Leave outing
            </Button>
          )}
          {isHost && (
            <Button variant="outline" disabled={busy === 'del'}
              onClick={async () => {
                if (!window.confirm('Delete this outing for everyone? This cannot be undone.')) return;
                if (await act('del', () => api.deleteOuting(outing.id), 'Outing deleted.')) onGone?.();
              }}>
              <LuTrash2 size={14} /> Delete
            </Button>
          )}
        </div>
      </Card>

      {active && (
        <div>
          <MapView height={360} friends={onMap} />
          <p className="text-mut text-sm mt-2">
            {onMap.length ? `${onMap.length} member${onMap.length > 1 ? 's' : ''} sharing with you.` : 'Nobody in this outing is sharing their location with you right now.'}
          </p>
        </div>
      )}
    </div>
  );
}

export default function Outing() {
  const { user } = useAuth();
  const { data: outings, error, loading, reload } = useLiveQuery(user.id, api.fetchOutings, ['outings', 'outing_members', 'location_shares']);
  const [selected, setSelected] = useState(null);

  const now = useNow(30_000);
  const list = outings || [];
  const mineStatus = (o) => o.members.find((m) => m.user_id === user.id)?.status;
  const invitations = list.filter((o) => mineStatus(o) === 'invited' && o.status === 'active' && new Date(o.ends_at).getTime() > now);
  const expired = list.filter((o) => mineStatus(o) === 'expired');
  const current = list.filter((o) => o.status === 'active' && (o.host_id === user.id || mineStatus(o) === 'accepted'));
  const history = list.filter((o) => o.status === 'ended' && (o.host_id === user.id || ['accepted', 'left'].includes(mineStatus(o))));
  const shown = list.find((o) => o.id === selected) || current[0] || null;

  return (
    <>
      <div className="relative overflow-hidden bg-deep text-white pt-11 pb-20">
        <div className="max-w-[1120px] mx-auto px-5 relative">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/20 text-[#bfe0da] text-sm mb-3">
            <span className="w-2 h-2 rounded-full bg-amber animate-[blink_1.6s_infinite]" />
            Outing Circle
          </span>
          <h2 className="font-display font-extrabold text-[clamp(2rem,5vw,3.3rem)] text-white mb-2">Opt in for one night</h2>
          <p className="text-[#bfe0da] max-w-[58ch] m-0">
            Create an outing, invite friends, and share for the window only. It ends on its own.
          </p>
        </div>
      </div>
      <div className="max-w-[1120px] mx-auto px-5 -mt-11 relative">
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5 items-start">
          <div className="space-y-3.5">
            {loading && <Card><p className="text-mut m-0" role="status">Loading your outings…</p></Card>}
            {error && (
              <Card className="border-red">
                <p className="text-red m-0" role="alert">Could not load outings: {error}</p>
                <Button size="sm" variant="outline" className="mt-2" onClick={reload}>Try again</Button>
              </Card>
            )}
            {invitations.map((o) => <InvitationCard key={o.id} outing={o} />)}
            {expired.length > 0 && (
              <Card><p className="text-mut text-sm m-0">{expired.length} invitation{expired.length > 1 ? 's' : ''} expired before you answered: {expired.map((o) => o.title).join(', ')}.</p></Card>
            )}
            {current.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {current.map((o) => (
                  <button key={o.id} type="button" onClick={() => setSelected(o.id)} aria-pressed={shown?.id === o.id}
                    className={`px-3 py-1.5 rounded-full border text-sm font-bold ${shown?.id === o.id ? 'border-teal bg-mint' : 'border-line bg-white'}`}>{o.title}</button>
                ))}
              </div>
            )}
            {shown && <OutingDetail key={shown.id} outing={shown} onGone={() => setSelected(null)} />}
            {!loading && !shown && !error && !invitations.length && (
              <Card><p className="text-mut text-sm m-0">You have no active outing. Create one below, or wait for an invitation from a friend.</p></Card>
            )}
            <CreateOutingForm onCreated={(id) => setSelected(id)} />
            {history.length > 0 && (
              <Card>
                <b>Past outings</b>
                {history.map((o) => (
                  <button key={o.id} type="button" onClick={() => setSelected(o.id)}
                    className="w-full text-left flex justify-between gap-3 py-2 border-t border-line first:border-0 text-sm">
                    <span><b>{o.title}</b> · {o.venue}</span><span className="text-mut">{fmt(o.starts_at)}</span>
                  </button>
                ))}
                <p className="text-mut text-xs mt-2 mb-0">History shows only outings you hosted or joined. Locations are never kept.</p>
              </Card>
            )}
          </div>
          <div className="space-y-3.5">
            <Card>
              <b>The rules</b>
              <ul className="text-mut text-sm mt-2 space-y-1.5 pl-0 list-none">
                <li className="flex gap-2"><LuCheck size={14} className="text-teal mt-1 shrink-0" /> No one can be added without accepting.</li>
                <li className="flex gap-2"><LuCheck size={14} className="text-teal mt-1 shrink-0" /> Joining does not share location. That is a separate choice.</li>
                <li className="flex gap-2"><LuCheck size={14} className="text-teal mt-1 shrink-0" /> Leaving never needs anyone else&apos;s permission.</li>
                <li className="flex gap-2"><LuCheck size={14} className="text-teal mt-1 shrink-0" /> Sharing expires automatically when the outing ends.</li>
                <li className="flex gap-2"><LuCheck size={14} className="text-teal mt-1 shrink-0" /> Nothing is shared with responders.</li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
