import { useMemo, useState } from 'react';
import { LuCheck, LuClock, LuTriangleAlert, LuCalendarClock, LuX, LuPlay } from 'react-icons/lu';
import * as api from '../lib/api';
import { useApp } from '../context/app-context';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useLiveQuery } from '../lib/useLiveQuery';
import { useNow } from '../lib/useNow';
import CheckinStepper from '../components/CheckinStepper';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Chip from '../components/ui/Chip';
import { CHECKIN_TEMPLATES, LANG_LABELS } from '../data/dummy';

const INPUT = 'w-full p-2.5 rounded-lg border border-line bg-white text-ink font-body text-sm';
const time = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const dateTime = (iso) => new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const toLocalInput = (ms) => {
  const x = new Date(ms);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};

// Journey stage derived from what the SERVER says, plus the clock for the active -> grace boundary.
function stageOf(plan, now) {
  switch (plan.status) {
    case 'planned': return { step: 0, label: 'Planned', tone: 'n' };
    case 'active':
      return now >= new Date(plan.expected_arrival).getTime()
        ? { step: 2, label: 'Grace period', tone: 'y' }
        : { step: 1, label: 'Journey active', tone: 'default' };
    case 'overdue': return { step: 3, label: 'Contact alerted', tone: 'r' };
    case 'arrived': return { step: 4, label: 'Arrived safely', tone: 'g' };
    default: return { step: -1, label: 'Cancelled', tone: 'n' };
  }
}

function countdown(targetIso, now) {
  const ms = new Date(targetIso).getTime() - now;
  if (ms <= 0) return 'now';
  const m = Math.floor(ms / 60_000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m ${Math.floor((ms % 60_000) / 1000)}s`;
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

function PlanForm({ onDone }) {
  const { contacts } = useData();
  const { busy, act } = useAct();
  const { showToast } = useApp();
  const [destination, setDestination] = useState('Home');
  const [expected, setExpected] = useState(() => toLocalInput(Date.now() + 60 * 60_000));
  const [grace, setGrace] = useState(15);
  const [notify, setNotify] = useState([]);

  const submit = async (start) => {
    if (!destination.trim()) return showToast('Where are you going?');
    if (!notify.length) return showToast('Choose at least one contact to alert.');
    if (new Date(expected).getTime() <= Date.now()) return showToast('Expected arrival must be in the future.');
    const ok = await act(start ? 'start' : 'plan', async () => {
      const id = await api.createReturnPlan({
        destination, expected: new Date(expected).toISOString(), grace, notify,
      });
      if (start) await api.startReturnPlan(id);
    }, start ? 'Journey started. Your contacts were told.' : 'Journey planned.');
    if (ok) onDone?.();
  };

  return (
    <Card>
      <h3 className="font-display font-extrabold text-xl mb-1">Plan your journey home</h3>
      <p className="text-mut text-sm mb-3">
        If you have not arrived and checked in by the expected time plus the grace period, the server alerts the
        contacts you choose. This works even if your phone or browser is closed.
      </p>
      <div className="space-y-3">
        <label className="block text-sm font-bold">Destination
          <input className={`${INPUT} mt-1 font-normal`} value={destination} onChange={(e) => setDestination(e.target.value)} maxLength={200} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-bold">Expected arrival
            <input type="datetime-local" className={`${INPUT} mt-1 font-normal`} value={expected} onChange={(e) => setExpected(e.target.value)} />
          </label>
          <label className="block text-sm font-bold">Grace period
            <select className={`${INPUT} mt-1 font-normal`} value={grace} onChange={(e) => setGrace(Number(e.target.value))}>
              {[10, 15, 30, 60].map((g) => <option key={g} value={g}>{g} minutes</option>)}
            </select>
          </label>
        </div>
        <fieldset className="border-0 p-0 m-0">
          <legend className="text-sm font-bold mb-1">Alert these contacts if I do not arrive</legend>
          {!contacts.length && <p className="text-mut text-sm m-0">Add a trusted friend in the <a href="/trust" className="text-teal font-bold">Trust Panel</a> first.</p>}
          {contacts.map((c) => (
            <label key={c.id} className="flex items-center gap-2 py-1 text-sm cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-teal" checked={notify.includes(c.id)}
                onChange={(e) => setNotify((n) => (e.target.checked ? [...n, c.id] : n.filter((x) => x !== c.id)))} />
              {c.name}
              {!c.receivesCheckins && <span className="text-xs text-amber">(has check-in alerts turned off, so they will not be told)</span>}
            </label>
          ))}
        </fieldset>
        <div className="flex flex-wrap gap-2.5">
          <Button disabled={!!busy} onClick={() => submit(true)}><LuPlay size={15} /> {busy === 'start' ? 'Starting…' : 'Start journey now'}</Button>
          <Button variant="outline" disabled={!!busy} onClick={() => submit(false)}>Save for later</Button>
        </div>
      </div>
    </Card>
  );
}

function ActivePlan({ plan, now, names }) {
  const { busy, act } = useAct();
  const [note, setNote] = useState('');
  const { data: checkins, reload } = useLiveQuery(plan.id, () => api.fetchCheckins(plan.id), ['checkins']);
  const st = stageOf(plan, now);
  const live = plan.status === 'active' || plan.status === 'overdue';
  const graceEnds = new Date(new Date(plan.expected_arrival).getTime() + plan.grace_minutes * 60_000).toISOString();

  return (
    <Card>
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <b>Journey to {plan.destination}</b>
        <Chip tone={st.tone}>{st.label}</Chip>
      </div>
      <CheckinStepper step={st.step} />
      <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-sm my-2">
        <dt className="text-mut">Expected</dt><dd className="m-0 font-bold">{dateTime(plan.expected_arrival)}{plan.status === 'active' && now < new Date(plan.expected_arrival).getTime() && ` · in ${countdown(plan.expected_arrival, now)}`}</dd>
        {plan.started_at && (<><dt className="text-mut">Started</dt><dd className="m-0 font-bold">{time(plan.started_at)}</dd></>)}
        {plan.reminder_sent_at && (<><dt className="text-mut">Reminder sent</dt><dd className="m-0 font-bold">{time(plan.reminder_sent_at)}</dd></>)}
        {plan.status === 'active' && plan.reminder_sent_at && (<><dt className="text-mut">Contacts alerted in</dt><dd className="m-0 font-bold">{countdown(graceEnds, now)}</dd></>)}
        {plan.overdue_alerted_at && (<><dt className="text-mut">Contacts alerted</dt><dd className="m-0 font-bold">{time(plan.overdue_alerted_at)}</dd></>)}
        {plan.arrived_at && (<><dt className="text-mut">Arrived</dt><dd className="m-0 font-bold">{time(plan.arrived_at)}</dd></>)}
        <dt className="text-mut">Grace period</dt><dd className="m-0 font-bold">{plan.grace_minutes} min</dd>
        <dt className="text-mut">Alerts go to</dt><dd className="m-0 font-bold">{plan.notify_ids.map((id) => names[id] || 'Contact').join(', ')}</dd>
      </dl>
      {plan.status === 'overdue' && (
        <p className="text-sm text-red m-0 mb-2" role="alert">
          Your contacts were alerted inside TukoSafe at {time(plan.overdue_alerted_at)}. If you are safe, mark yourself as arrived.
        </p>
      )}

      {live && (
        <>
          <div className="flex gap-2 mt-2">
            <input className={INPUT} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note, e.g. on the matatu" maxLength={500} aria-label="Check-in note" />
            <Button variant="outline" disabled={busy === 'ci'} onClick={async () => { if (await act('ci', () => api.planCheckin(plan.id, note), 'Checked in. Your contacts were told.')) { setNote(''); reload(); } }}>
              Check in
            </Button>
          </div>
          <div className="flex flex-wrap gap-2.5 mt-3">
            <Button disabled={busy === 'arr'} onClick={() => act('arr', () => api.arriveSafely(plan.id), 'Marked as arrived safely.')}><LuCheck size={16} /> I have arrived safely</Button>
            {plan.status === 'active' && (
              <Button variant="outline" disabled={busy === 'ext'} onClick={() => act('ext', () => api.extendReturnPlan(plan.id, 15), 'Added 15 minutes. Your contacts were told.')}><LuClock size={16} /> Running late: +15 min</Button>
            )}
            <Button variant="outline" disabled={busy === 'can'} onClick={() => window.confirm('Cancel this journey? Your contacts will be told.') && act('can', () => api.cancelReturnPlan(plan.id), 'Journey cancelled.')}><LuX size={16} /> Cancel journey</Button>
          </div>
        </>
      )}
      {plan.status === 'planned' && (
        <div className="flex flex-wrap gap-2.5 mt-3">
          <Button disabled={busy === 'go'} onClick={() => act('go', () => api.startReturnPlan(plan.id), 'Journey started. Your contacts were told.')}><LuPlay size={15} /> Start journey</Button>
          <Button variant="outline" disabled={busy === 'can'} onClick={() => act('can', () => api.cancelReturnPlan(plan.id), 'Plan removed.')}>Remove plan</Button>
        </div>
      )}

      {checkins && checkins.length > 0 && (
        <div className="mt-4">
          <b className="text-sm">Check-ins</b>
          <ul className="list-none p-0 mt-1 mb-0 text-sm text-mut space-y-0.5">
            {checkins.map((c) => <li key={c.id}>{time(c.created_at)}{c.note ? ` · ${c.note}` : ''}</li>)}
          </ul>
        </div>
      )}
    </Card>
  );
}

function Watching({ plans, names, now }) {
  if (!plans.length) return null;
  return (
    <Card>
      <b>Friends who asked you to watch over them</b>
      {plans.map((p) => {
        const st = stageOf(p, now);
        return (
          <div key={p.id} className="flex justify-between items-start gap-3 mt-2.5 text-sm border-t border-line first:border-0 pt-2 first:pt-0">
            <div>
              <b>{names[p.user_id] || 'A friend'}</b> → {p.destination}
              <div className="text-mut text-xs">Expected {dateTime(p.expected_arrival)}{p.arrived_at && ` · arrived ${time(p.arrived_at)}`}</div>
              {p.status === 'overdue' && <div className="text-red text-xs font-bold">Has not checked in. Try to reach them; call 999/112 if worried.</div>}
            </div>
            <Chip tone={st.tone}>{st.label}</Chip>
          </div>
        );
      })}
    </Card>
  );
}

export default function CheckIn() {
  const { user } = useAuth();
  const { contacts } = useData();
  const { lang, setLang, ai } = useApp();
  const now = useNow(1000);
  const { data: plans, error, loading, reload } = useLiveQuery(user.id, api.fetchPlans, ['return_home_plans']);

  const names = useMemo(() => Object.fromEntries(contacts.map((c) => [c.id, c.name])), [contacts]);
  const mine = (plans || []).filter((p) => p.user_id === user.id);
  const watching = (plans || []).filter((p) => p.user_id !== user.id && ['active', 'overdue'].includes(p.status));
  const current = mine.find((p) => ['active', 'overdue'].includes(p.status)) || mine.find((p) => p.status === 'planned');
  const past = mine.filter((p) => ['arrived', 'cancelled'].includes(p.status));
  const template = ai.checkin
    ? CHECKIN_TEMPLATES[lang](user.name)
    : 'Check-in due: please confirm you are okay. If something isn’t right, reply “help”.';
  const stage = current ? stageOf(current, now) : null;

  return (
    <>
      <div className="relative overflow-hidden bg-deep text-white pt-11 pb-20">
        <div className="max-w-[1120px] mx-auto px-5 relative">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/20 text-[#bfe0da] text-sm mb-3">
            <span className="w-2 h-2 rounded-full bg-amber animate-[blink_1.6s_infinite]" />
            Msaidizi check-ins
          </span>
          <h2 className="font-display font-extrabold text-[clamp(2rem,5vw,3.3rem)] text-white mb-2">A calm check-in, in your language</h2>
          <p className="text-[#bfe0da] max-w-[58ch] m-0">English, Kiswahili or Sheng. A tap answers. Timers run on the server and are never controlled by AI.</p>
        </div>
      </div>

      <div className="max-w-[1120px] mx-auto px-5 -mt-11 relative">
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5 items-start">
          <div className="space-y-3.5">
            {loading && <Card><p className="text-mut m-0" role="status">Loading your journeys…</p></Card>}
            {error && (
              <Card className="border-red">
                <p className="text-red m-0" role="alert">Could not load journeys: {error}</p>
                <Button size="sm" variant="outline" className="mt-2" onClick={reload}>Try again</Button>
              </Card>
            )}
            {current ? <ActivePlan key={current.id} plan={current} now={now} names={names} />
              : !loading && <PlanForm onDone={reload} />}
            <Watching plans={watching} names={names} now={now} />

            <Card>
              <b>Language</b>
              <div className="inline-flex bg-line rounded-xl p-1 mt-2 gap-1 ml-3">
                {Object.entries(LANG_LABELS).map(([k, label]) => (
                  <button key={k} onClick={() => setLang(k)} aria-pressed={lang === k}
                    className={`px-3.5 py-2 rounded-lg font-bold text-sm ${lang === k ? 'bg-white text-ink' : 'text-ink hover:bg-white/40'}`}>{label}</button>
                ))}
              </div>
              <p className="text-mut text-xs mt-2 mb-0">Language changes the preview wording on this page. Server reminders are sent in English.</p>
            </Card>

            {past.length > 0 && (
              <Card>
                <b>Journey history</b>
                {past.map((p) => (
                  <div key={p.id} className="flex justify-between gap-3 mt-2 text-sm border-t border-line first:border-0 pt-2 first:pt-0">
                    <span><b>{p.destination}</b> · {dateTime(p.created_at)}</span>
                    <Chip tone={p.status === 'arrived' ? 'g' : 'n'}>{p.status === 'arrived' ? 'Arrived' : 'Cancelled'}</Chip>
                  </div>
                ))}
              </Card>
            )}
            <p className="text-mut text-sm">
              Alerts reach your contacts inside TukoSafe (and by push, email or SMS only where they turned those on and the
              server has a provider set up). This is not a call to emergency services. In danger, call 999 or 112.
            </p>
          </div>

          <div className="grid place-items-center">
            <div className="relative w-[292px] bg-[#0d1f1d] border-8 border-[#1d3f3b] rounded-[40px] p-2.5 shadow-[0_40px_70px_rgba(0,0,0,0.4)]">
              <div className="h-[430px] rounded-[28px] bg-[#f4f8f7] text-ink p-5 space-y-3 overflow-hidden">
                {!current ? (
                  <>
                    <h4 className="font-display font-extrabold text-base m-0">Msaidizi</h4>
                    <p className="text-mut text-sm m-0"><LuCalendarClock size={14} className="inline mr-1" />No journey yet. Plan one and this is the reminder you will get.</p>
                    <div className="bg-white border border-line rounded-[14px_14px_14px_4px] p-3 text-sm">{template}</div>
                  </>
                ) : current.status === 'overdue' ? (
                  <>
                    <h4 className="font-display font-extrabold text-base m-0">Contacts alerted</h4>
                    <Chip tone="r"><LuTriangleAlert size={12} /> {current.notify_ids.length} contact{current.notify_ids.length > 1 ? 's' : ''} told</Chip>
                    <div className="bg-white border border-line rounded-[14px] p-3 text-sm">
                      The grace period ended and your contacts were alerted. If you are safe, let them know.
                    </div>
                    <a href="tel:999" className="block text-center text-xs font-bold text-red underline">In danger? Call 999 / 112</a>
                  </>
                ) : (
                  <>
                    <h4 className="font-display font-extrabold text-base m-0">Msaidizi</h4>
                    <div className="bg-white border border-line rounded-[14px_14px_14px_4px] p-3 text-sm">{template}</div>
                    <Chip tone={ai.checkin ? 'default' : 'y'}>{ai.checkin ? 'Wording by template' : 'Plain template (AI off)'}</Chip>
                    {stage?.step === 2 && <Chip tone="y"><LuClock size={12} /> Grace period running</Chip>}
                    {stage?.step === 4 && <Chip tone="g">Arrived</Chip>}
                  </>
                )}
              </div>
            </div>
            <p className="text-mut text-xs mt-3 text-center max-w-[292px]">
              Preview of the reminder wording. Use the buttons on the left to check in or arrive; the server tracks the deadline.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
