import { useEffect, useMemo, useState } from 'react';
import {
  LuCheck, LuClock, LuTriangleAlert, LuRotateCcw, LuCalendarClock,
  LuPhone, LuMessageCircle, LuShieldCheck, LuChevronDown, LuChevronUp,
} from 'react-icons/lu';
import { useApp } from '../context/AppContext';
import CheckinStepper from '../components/CheckinStepper';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Chip from '../components/ui/Chip';
import { CHECKIN_TEMPLATES, LANG_LABELS } from '../data/dummy';
import { formatTime, remainLabel } from '../lib/format';
import { formatHHMM, minutesBetween } from '../lib/outingStore';

// Map real check-in states to the stepper (CHECKIN_STEPS order: Scheduled, Reminder sent, Grace period, Contact alerted, Resolved)
const STEP_INDEX = {
  scheduled: 0,
  reminder: 1,
  grace: 2,
  alerted: 3,
  resolved: 4,
};

const STATE_LABEL = {
  scheduled: 'Scheduled',
  reminder: 'Reminder sent',
  grace: 'Grace period',
  alerted: 'Contact alerted',
  resolved: 'Resolved',
};

export default function CheckIn() {
  const {
    user, lang, setLang, ai, outing, notify,
    startCheckin, confirmOkay, skipToGrace, skipToAlerted, resetCheckin,
    send, showToast, offline, outbox,
  } = useApp();

  const checkin = outing?.checkin;
  const step = checkin ? STEP_INDEX[checkin.state] ?? 0 : 0;
  const you = outing?.members?.find((m) => m.you);
  const name = you?.name || user.name;

  const template = useMemo(
    () =>
      ai.checkin
        ? CHECKIN_TEMPLATES[lang](name)
        : 'Check-in due: please confirm you are okay. If something isn’t right, reply “help”.',
    [ai.checkin, lang, name]
  );

  // ── No outing: nothing to check in to ──
  if (!outing) {
    return (
      <>
        <Header />
        <div className="max-w-[1120px] mx-auto px-5 -mt-11 relative">
          <Card className="max-w-[620px]">
            <Chip tone="n"><LuCalendarClock size={12} /> No active outing</Chip>
            <p className="text-mut mt-2.5 mb-3">
              Check-ins belong to an outing. Create an outing first, then Msaidizi will schedule the
              check-in for the end of the night.
            </p>
            <Button to="/outing">Create an outing</Button>
          </Card>
        </div>
      </>
    );
  }

  const isResolved = checkin?.state === 'resolved';
  const isAlerted = checkin?.state === 'alerted';
  const notifyName = outing.returnPlan?.notify || notify;
  const dueAt = checkin?.dueAt;
  const graceEndsAt = checkin?.graceEndsAt;
  const reminderAt = checkin?.reminderAt;
  const alertedAt = checkin?.alertedAt;
  const resolvedAt = checkin?.resolvedAt;

  return (
    <>
      <Header />

      <div className="max-w-[1120px] mx-auto px-5 -mt-11 relative">
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5 items-start">
          <div>
            <Card>
              <b>Language</b>
              <div className="inline-flex bg-line rounded-xl p-1 mt-2 gap-1">
                {Object.entries(LANG_LABELS).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setLang(k)}
                    className={`px-3.5 py-2 rounded-lg font-bold text-sm ${
                      lang === k ? 'bg-white text-ink' : 'text-ink hover:bg-white/40'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Card>

            <Card>
              <div className="flex justify-between items-center gap-3 flex-wrap">
                <b>Check-in status</b>
                <Chip
                  tone={
                    isResolved ? 'g' : isAlerted ? 'r' : step >= 2 ? 'y' : 'n'
                  }
                >
                  {checkin ? STATE_LABEL[checkin.state] : 'Not scheduled'}
                </Chip>
              </div>

              <CheckinStepper step={step} />

              {/* Real facts */}
              <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-sm my-2">
                {dueAt && (
                  <>
                    <dt className="text-mut">Due</dt>
                    <dd className="m-0 font-bold">{formatTime(dueAt)}</dd>
                  </>
                )}
                {reminderAt && checkin?.state !== 'scheduled' && (
                  <>
                    <dt className="text-mut">Reminder sent</dt>
                    <dd className="m-0 font-bold">{formatTime(reminderAt)}</dd>
                  </>
                )}
                {graceEndsAt && (
                  <>
                    <dt className="text-mut">Grace ends</dt>
                    <dd className="m-0 font-bold">
                      {formatTime(graceEndsAt)} · {remainLabel(graceEndsAt)}
                    </dd>
                  </>
                )}
                {alertedAt && (
                  <>
                    <dt className="text-mut">Alerted</dt>
                    <dd className="m-0 font-bold">
                      {formatTime(alertedAt)} → {notifyName}
                    </dd>
                  </>
                )}
                {resolvedAt && (
                  <>
                    <dt className="text-mut">Resolved</dt>
                    <dd className="m-0 font-bold">{formatTime(resolvedAt)}</dd>
                  </>
                )}
                {checkin?.graceMinutes != null && (
                  <>
                    <dt className="text-mut">Grace window</dt>
                    <dd className="m-0 font-bold">{checkin.graceMinutes} min</dd>
                  </>
                )}
              </dl>

              <div className="flex flex-wrap gap-2.5 mt-3">
                <Button onClick={confirmOkay} disabled={isResolved}>
                  <LuCheck size={16} /> I’m okay
                </Button>

                {checkin?.state === 'scheduled' && (
                  <Button variant="outline" onClick={startCheckin}>
                    <LuClock size={16} /> Re-schedule for end of outing
                  </Button>
                )}
                {checkin?.state === 'reminder' && (
                  <Button variant="outline" onClick={skipToGrace}>
                    <LuClock size={16} /> Start grace period
                  </Button>
                )}
                {checkin?.state === 'grace' && (
                  <Button variant="outline" onClick={skipToAlerted}>
                    <LuTriangleAlert size={16} /> Alert now
                  </Button>
                )}
                <Button variant="outline" onClick={resetCheckin}>
                  <LuRotateCcw size={16} /> Reset
                </Button>
              </div>

              {offline && outbox.length > 0 && (
                <div className="mt-3 text-sm text-mut border-l-[3px] border-amber pl-2.5">
                  Queued while offline ({outbox.length}): {outbox.join(', ')}
                </div>
              )}
            </Card>

            <Card>
              <b>Test the escalation</b>
              <p className="text-mut text-sm mt-1 mb-2">
                These jump the deterministic timer so you can see each stage. In a real run, the
                scheduler in the app advances the state on its own.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={skipToGrace} disabled={step >= 2}>
                  → Grace
                </Button>
                <Button size="sm" variant="outline" onClick={skipToAlerted} disabled={step >= 3}>
                  → Alerted
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => send(`Test alert to ${notifyName}`)}
                >
                  Send test alert
                </Button>
              </div>
            </Card>

            <ReturnPlanPreview outing={outing} />

            <p className="text-mut text-sm">
              Timers run in a deterministic scheduler. AI only words the message and can’t delay or
              cancel escalation. Pressing SOS bypasses the timer entirely.
            </p>
          </div>

          {/* Phone preview */}
          <div className="grid place-items-center">
            <div className="relative w-[292px] bg-[#0d1f1d] border-8 border-[#1d3f3b] rounded-[40px] p-2.5 shadow-[0_40px_70px_rgba(0,0,0,0.4)]">
              <div className="h-[430px] rounded-[28px] bg-[#f4f8f7] text-ink p-5 space-y-3 overflow-hidden">
                {isResolved ? (
                  <>
                    <h4 className="font-display font-extrabold text-base m-0">Msaidizi</h4>
                    <div className="bg-white border border-line rounded-[14px_14px_14px_4px] p-3 text-sm">
                      {template}
                    </div>
                    <div className="ml-auto w-fit max-w-[80%] bg-teal text-white rounded-[16px_16px_4px_16px] px-3 py-2 text-sm">
                      I’m okay ✓
                    </div>
                    <Chip tone="g">Friends told</Chip>
                    <p className="text-mut text-xs m-0">
                      {resolvedAt ? `Resolved ${formatTime(resolvedAt)}` : ''}
                    </p>
                  </>
                ) : isAlerted ? (
                  <>
                    <h4 className="font-display font-extrabold text-base m-0">Contact alerted</h4>
                    <Chip tone="r">Alert sent to {notifyName}</Chip>
                    <div className="bg-white border border-line rounded-[14px] p-3 text-sm mt-2">
                      The grace period ended. {notifyName} received a calm brief with your last known
                      location. If you are safe, confirm below so they know.
                    </div>
                    <button
                      onClick={confirmOkay}
                      className="w-full py-3 rounded-xl bg-teal text-white font-bold text-sm"
                    >
                      I’m okay ✓
                    </button>
                    <a
                      href="tel:999"
                      className="block text-center text-xs font-bold text-red underline"
                    >
                      In danger? Call 999 / 112
                    </a>
                  </>
                ) : (
                  <>
                    <h4 className="font-display font-extrabold text-base m-0">Msaidizi</h4>
                    <div className="bg-white border border-line rounded-[14px_14px_14px_4px] p-3 text-sm">
                      {template}
                    </div>
                    <Chip tone={ai.checkin ? 'default' : 'y'}>
                      {ai.checkin ? 'Scripted example' : 'Fallback example'}
                    </Chip>

                    {checkin?.state === 'grace' && (
                      <>
                        <div className="h-2 rounded-full bg-line overflow-hidden">
                          <div className="h-full bg-amber animate-[fill_4s_linear_infinite]" />
                        </div>
                        <p className="text-mut text-xs m-0">
                          {graceEndsAt
                            ? `Grace ends in ${remainLabel(graceEndsAt)}`
                            : 'Grace period running'}
                        </p>
                      </>
                    )}

                    {checkin?.state === 'reminder' && (
                      <Chip tone="y">
                        <LuClock size={12} /> Reminder sent
                      </Chip>
                    )}

                    <button
                      onClick={confirmOkay}
                      className="w-full py-3 rounded-xl bg-teal text-white font-bold text-sm"
                    >
                      I’m okay ✓
                    </button>
                  </>
                )}
              </div>
            </div>
            <p className="text-mut text-xs mt-3 text-center max-w-[292px]">
              This is what {name} sees. Tapping “I’m okay” resolves the check-in and tells {notifyName}.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function ReturnPlanPreview({ outing }) {
  const [open, setOpen] = useState(false);
  const plan = outing?.returnPlan || {};
  const mins = minutesBetween(plan.departureTime, plan.homeEta);
  const hasPlan = plan.departureTime || plan.homeEta || plan.transport || plan.notify;

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex justify-between items-center gap-2 text-left"
        aria-expanded={open}
      >
        <b>Return-home plan</b>
        {open ? <LuChevronUp size={16} /> : <LuChevronDown size={16} />}
      </button>
      {!open && hasPlan && (
        <p className="text-mut text-sm mt-1 mb-0">
          {plan.departureTime ? `Leave ${formatHHMM(plan.departureTime)}` : 'No departure'}
          {plan.homeEta ? ` · Home ${formatHHMM(plan.homeEta)}` : ''}
          {mins != null ? ` (${mins} min)` : ''}
        </p>
      )}
      {open && (
        <div className="mt-3 text-sm space-y-1.5">
          <div className="flex justify-between gap-2">
            <span className="text-mut">Departure</span>
            <span className="font-bold">{plan.departureTime ? formatHHMM(plan.departureTime) : '—'}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-mut">Home ETA</span>
            <span className="font-bold">{plan.homeEta ? formatHHMM(plan.homeEta) : '—'}</span>
          </div>
          {mins != null && (
            <div className="flex justify-between gap-2">
              <span className="text-mut">Expected trip</span>
              <span className="font-bold">{mins} min</span>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <span className="text-mut">Transport</span>
            <span className="font-bold">{plan.transport || '—'}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-mut">Notify on arrival</span>
            <span className="font-bold">{plan.notify || '—'}</span>
          </div>
          <p className="text-mut text-xs m-0 pt-1">
            The check-in is scheduled for the outing end time, not the home ETA.
          </p>
        </div>
      )}
    </Card>
  );
}

function Header() {
  return (
    <div className="relative overflow-hidden bg-deep text-white pt-11 pb-20">
      <div className="max-w-[1120px] mx-auto px-5 relative">
        <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/20 text-[#bfe0da] text-sm mb-3">
          <span className="w-2 h-2 rounded-full bg-amber animate-[blink_1.6s_infinite]" />
          Msaidizi check-ins
        </span>
        <h2 className="font-display font-extrabold text-[clamp(2rem,5vw,3.3rem)] text-white mb-2">
          A calm check-in, in your language
        </h2>
        <p className="text-[#bfe0da] max-w-[58ch] m-0">
          English, Kiswahili or Sheng. A tap answers. Timers are never controlled by AI.
        </p>
      </div>
    </div>
  );
}