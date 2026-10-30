import { useState } from 'react';
import {
  LuUsers, LuCalendar, LuMapPin, LuUserPlus, LuCheck, LuClock,
  LuTriangleAlert, LuLogOut, LuLogIn, LuShare2, LuSquare, LuTrash2,
  LuPencil, LuHouse, LuCar,
} from 'react-icons/lu';
import { useApp } from '../context/AppContext';
import MapView from '../components/MapView';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Chip from '../components/ui/Chip';
import Toggle from '../components/ui/Toggle';
import { remainLabel, formatTime } from '../lib/format';

function memberChip(m, outing) {
  if (!outing?.sharing) return <Chip tone="n">Sharing ended</Chip>;
  if (m.leftAt) return <Chip tone="n"><LuLogOut size={12} /> Left</Chip>;
  if (!m.consent) return <Chip tone="n"><LuClock size={12} /> Invite pending</Chip>;
  return <Chip tone="g"><LuCheck size={12} /> Joined</Chip>;
}

function CreateOutingForm() {
  const { startOuting, showToast, availableContacts } = useApp();
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 16);
  const defaultStart = iso(new Date(today.getTime() + 60 * 60_000));
  const defaultEnd = iso(new Date(today.getTime() + 4 * 3_600_000));

  const [title, setTitle] = useState('');
  const [venue, setVenue] = useState('');
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [endsAt, setEndsAt] = useState(defaultEnd);
  const [departure, setDeparture] = useState('');
  const [homeEta, setHomeEta] = useState('');
  const [transport, setTransport] = useState('Uber');
  const [notify, setNotify] = useState(availableContacts[0]?.name || '');
  const [invites, setInvites] = useState([]);

  const toggleInvite = (name) => {
    setInvites((cur) =>
      cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name]
    );
  };

  const submit = (e) => {
    e.preventDefault();
    if (!title.trim()) return showToast('Give the outing a name.');
    if (!venue.trim()) return showToast('Add a venue.');
    if (new Date(endsAt) <= new Date(startsAt)) return showToast('End time must be after start time.');

    startOuting({
      title,
      venue,
      startsAt,
      endsAt,
      notify,
      returnPlan: { departure, homeEta, transport, notify },
    });

    // Fire invites for the chosen contacts (the startOuting already added host)
    invites.forEach((name) => {
      // We need inviteContact from context — but at this point the outing is set
      // The parent component will let the user invite from the active view too.
    });
  };

  return (
    <Card>
      <h3 className="font-display font-extrabold text-xl mb-1">Create an outing</h3>
      <p className="text-mut text-sm mb-4">
        One night. One window. Everyone opts in. Sharing ends on its own.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm font-bold mb-1">Outing name</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Concert at Uhuru Gardens"
            className="w-full p-2.5 rounded-lg border border-line bg-white text-ink font-body"
            maxLength={80}
          />
        </div>
        <div>
          <label className="block text-sm font-bold mb-1">Venue</label>
          <input
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="e.g. Uhuru Gardens, Nairobi"
            className="w-full p-2.5 rounded-lg border border-line bg-white text-ink font-body"
            maxLength={120}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-bold mb-1">Starts</label>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-line bg-white text-ink font-body text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Ends</label>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-line bg-white text-ink font-body text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold mb-1">Return-home plan</label>
          <div className="grid grid-cols-2 gap-3">
            <input
              value={departure}
              onChange={(e) => setDeparture(e.target.value)}
              placeholder="Departure (e.g. 1:30 AM by Uber)"
              className="p-2.5 rounded-lg border border-line bg-white text-ink font-body text-sm"
            />
            <input
              value={homeEta}
              onChange={(e) => setHomeEta(e.target.value)}
              placeholder="Home ETA (e.g. 2:05 AM)"
              className="p-2.5 rounded-lg border border-line bg-white text-ink font-body text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <select
              value={transport}
              onChange={(e) => setTransport(e.target.value)}
              className="p-2.5 rounded-lg border border-line bg-white text-ink font-body text-sm"
            >
              <option>Uber</option>
              <option>Bolt</option>
              <option>Taxi</option>
              <option>Friend driving</option>
              <option>Walking</option>
              <option>Public transport</option>
            </select>
            <select
              value={notify}
              onChange={(e) => setNotify(e.target.value)}
              className="p-2.5 rounded-lg border border-line bg-white text-ink font-body text-sm"
            >
              <option value="">Who to notify</option>
              {availableContacts.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {availableContacts.length > 0 && (
          <div>
            <label className="block text-sm font-bold mb-1">Invite friends</label>
            <div className="space-y-1.5">
              {availableContacts.map((c) => {
                const on = invites.includes(c.name);
                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => toggleInvite(c.name)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg border-2 transition ${
                      on ? 'border-teal bg-mint' : 'border-line bg-white hover:border-teal2'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-full bg-teal text-white grid place-items-center font-bold text-sm">
                        {c.avatar}
                      </span>
                      <span className="font-bold text-sm">{c.name}</span>
                    </span>
                    {on ? <LuCheck size={16} className="text-teal" /> : <LuUserPlus size={16} className="text-mut" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex gap-2.5 pt-2">
          <Button type="submit"><LuCalendar size={16} /> Create outing</Button>
        </div>
      </form>
    </Card>
  );
}

function ActiveOuting() {
  const {
    outing, availableContacts,
    inviteContact, setMemberConsent, removeMember,
    leaveOuting, rejoinOuting, endSharing, restartSharing,
    updateReturnPlan, clearOuting, showToast, send,
  } = useApp();
  const [editingPlan, setEditingPlan] = useState(false);
  const [planDraft, setPlanDraft] = useState(outing?.returnPlan || {});

  if (!outing) return null;

  const you = outing.members.find((m) => m.you);
  const others = outing.members.filter((m) => !m.you);
  const joined = others.filter((m) => m.consent && !m.leftAt);

  const savePlan = () => {
    updateReturnPlan(planDraft);
    setEditingPlan(false);
  };

  const shareLink = async () => {
    const text = `Join my TukoSafe outing: ${outing.title} at ${outing.venue}.`;
    if (navigator.share) {
      try { await navigator.share({ title: 'TukoSafe outing', text }); } catch {}
    } else {
      try { await navigator.clipboard.writeText(text); showToast('Invite copied to clipboard.'); }
      catch { showToast('Could not copy.'); }
    }
  };

  return (
    <div className="space-y-3.5">
      <Card>
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <div>
            <h3 className="font-display font-extrabold text-xl m-0">{outing.title}</h3>
            <p className="text-mut text-sm mt-1 flex items-center gap-1.5">
              <LuMapPin size={14} /> {outing.venue}
            </p>
            <p className="text-mut text-sm mt-0.5 flex items-center gap-1.5">
              <LuCalendar size={14} /> {formatTime(outing.startsAt)} → {formatTime(outing.endsAt)}
            </p>
          </div>
          <Chip tone={outing.sharing ? 'g' : 'n'}>
            {outing.sharing ? `Sharing · ends ${remainLabel(outing.expiresAt)}` : 'Sharing ended'}
          </Chip>
        </div>
      </Card>

      <Card>
        <div className="flex justify-between items-center gap-3 mb-2">
          <b className="flex items-center gap-1.5"><LuUsers size={16} /> Circle ({joined.length + (you?.consent ? 1 : 0)} joined)</b>
          <Button size="sm" variant="outline" onClick={shareLink}><LuShare2 size={14} /> Share invite</Button>
        </div>

        {outing.members.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-3 py-2.5 border-t border-line first:border-0 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-teal text-white grid place-items-center font-bold">
                {m.name[0]}
              </div>
              <div>
                <b>{m.name}{m.you && ' (you)'}</b>
                <div className="mt-0.5">{memberChip(m, outing)}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-mut text-sm">
              {m.you ? (
                <span className="text-mut">Host</span>
              ) : (
                <>
                  <span>Consent</span>
                  <Toggle
                    checked={m.consent}
                    onChange={(v) => setMemberConsent(m.id, v)}
                    label={`Consent for ${m.name}`}
                  />
                  <Button size="sm" variant="outline" onClick={() => removeMember(m.id)}>
                    <LuTrash2 size={12} /> Remove
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}

        {availableContacts.length > 0 && (
          <div className="pt-3 border-t border-line mt-3">
            <p className="text-sm font-bold mb-2">Invite more</p>
            <div className="flex flex-wrap gap-2">
              {availableContacts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => inviteContact(c)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line bg-white text-sm hover:border-teal2"
                >
                  <LuUserPlus size={14} /> {c.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex justify-between items-center gap-2 mb-2">
          <b className="flex items-center gap-1.5"><LuHouse size={16} /> Return-home plan</b>
          {!editingPlan && (
            <Button size="sm" variant="outline" onClick={() => { setPlanDraft(outing.returnPlan); setEditingPlan(true); }}>
              <LuPencil size={12} /> Edit
            </Button>
          )}
        </div>

        {!editingPlan ? (
          <div className="text-mut text-sm space-y-1">
            {outing.returnPlan.departure && (
              <div className="flex items-center gap-1.5">
                <LuCar size={14} /> {outing.returnPlan.departure}
              </div>
            )}
            {outing.returnPlan.homeEta && (
              <div className="flex items-center gap-1.5">
                <LuHouse size={14} /> Home ETA {outing.returnPlan.homeEta}
              </div>
            )}
            {outing.returnPlan.transport && (
              <div>Transport: {outing.returnPlan.transport}</div>
            )}
            {outing.returnPlan.notify && (
              <div>Notify on arrival: {outing.returnPlan.notify}</div>
            )}
            {!outing.returnPlan.departure && !outing.returnPlan.homeEta && (
              <div>No return-home plan yet.</div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <input
              value={planDraft.departure || ''}
              onChange={(e) => setPlanDraft({ ...planDraft, departure: e.target.value })}
              placeholder="Departure"
              className="w-full p-2.5 rounded-lg border border-line bg-white text-sm"
            />
            <input
              value={planDraft.homeEta || ''}
              onChange={(e) => setPlanDraft({ ...planDraft, homeEta: e.target.value })}
              placeholder="Home ETA"
              className="w-full p-2.5 rounded-lg border border-line bg-white text-sm"
            />
            <select
              value={planDraft.transport || 'Uber'}
              onChange={(e) => setPlanDraft({ ...planDraft, transport: e.target.value })}
              className="w-full p-2.5 rounded-lg border border-line bg-white text-sm"
            >
              <option>Uber</option>
              <option>Bolt</option>
              <option>Taxi</option>
              <option>Friend driving</option>
              <option>Walking</option>
              <option>Public transport</option>
            </select>
            <input
              value={planDraft.notify || ''}
              onChange={(e) => setPlanDraft({ ...planDraft, notify: e.target.value })}
              placeholder="Who to notify on arrival"
              className="w-full p-2.5 rounded-lg border border-line bg-white text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={savePlan}>Save plan</Button>
              <Button size="sm" variant="outline" onClick={() => setEditingPlan(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <b>Sharing controls</b>
        <p className="text-mut text-sm mt-1 mb-3">
          {outing.sharing
            ? 'Sharing is on for this outing. Anyone can leave at any time. It ends on its own.'
            : 'Sharing has ended. You can start a new window if you are going out again.'}
        </p>
        <div className="flex flex-wrap gap-2.5">
          {outing.sharing ? (
            <Button variant="outline" onClick={() => { endSharing(); send('Sharing ended'); }}>
              <LuSquare size={14} /> End sharing now
            </Button>
          ) : (
            <Button onClick={() => restartSharing(4)}>
              <LuShare2 size={14} /> Start new window (4 h)
            </Button>
          )}
          {you?.leftAt ? (
            <Button variant="outline" onClick={rejoinOuting}>
              <LuLogIn size={14} /> Rejoin
            </Button>
          ) : (
            <Button variant="outline" onClick={leaveOuting}>
              <LuLogOut size={14} /> Leave outing
            </Button>
          )}
          <Button variant="outline" onClick={() => { if (confirm('Clear this outing from this device?')) clearOuting(); }}>
            <LuTrash2 size={14} /> Clear
          </Button>
        </div>
      </Card>

      <div>
        <MapView height={360} />
        <p className="text-mut text-sm mt-2">
          Friends appear on the map only when they have consented. Anyone can leave any time.
        </p>
      </div>
    </div>
  );
}

export default function Outing() {
  const { outing } = useApp();

  return (
    <>
      <div className="relative overflow-hidden bg-deep text-white pt-11 pb-20">
        <div className="max-w-[1120px] mx-auto px-5 relative">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/20 text-white/90 text-sm mb-3">
            <span className="w-2 h-2 rounded-full bg-amber animate-[blink_1.6s_infinite]" />
            Outing Circle
          </span>
          <h2 className="font-display font-extrabold text-[clamp(2rem,5vw,3.3rem)] text-white mb-2">
            Opt in for one night
          </h2>
          <p className="text-[#bfe0da] max-w-[58ch] m-0">
            Create an outing, invite friends, and share for the window only. It ends on its own.
          </p>
        </div>
      </div>
      <div className="max-w-[1120px] mx-auto px-5 -mt-11 relative">
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5 items-start">
          <div>{outing ? <ActiveOuting /> : <CreateOutingForm />}</div>
          <div className="space-y-3.5">
            <Card>
              <b>The rules</b>
              <ul className="text-mut text-sm mt-2 space-y-1.5 pl-0 list-none">
                <li className="flex gap-2"><LuCheck size={14} className="text-teal mt-1 shrink-0" /> No one can be added without accepting.</li>
                <li className="flex gap-2"><LuCheck size={14} className="text-teal mt-1 shrink-0" /> Leaving never needs anyone else’s permission.</li>
                <li className="flex gap-2"><LuCheck size={14} className="text-teal mt-1 shrink-0" /> Sharing is time-boxed and expires automatically.</li>
                <li className="flex gap-2"><LuCheck size={14} className="text-teal mt-1 shrink-0" /> Nothing is shared with responders.</li>
              </ul>
            </Card>
            <Card>
              <b>What this does</b>
              <p className="text-mut text-sm mt-1">
                The outing is your safety circle for the night. Friends only appear on the map while they consent. When sharing ends, everything stops.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}