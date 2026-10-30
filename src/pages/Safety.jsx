import { useState } from 'react';
import { LuSiren, LuPhone, LuHeart, LuShield, LuHouse } from 'react-icons/lu';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Chip from '../components/ui/Chip';
import { SAFETY_CHECKLIST, SAFETY_HELPLINES } from '../data/dummy';

const ICONS = { siren: LuSiren, phone: LuPhone, heart: LuHeart, shield: LuShield };

export default function Safety() {
  const [checks, setChecks] = useState(SAFETY_CHECKLIST.map(() => false));
  const done = checks.filter(Boolean).length;
  const pct = (done / SAFETY_CHECKLIST.length) * 100;

  return (
    <>
      <div className="relative overflow-hidden bg-deep text-white pt-11 pb-20">
        <div className="max-w-[1120px] mx-auto px-5 relative">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/20 text-white/90 text-sm mb-3">
            <span className="w-2 h-2 rounded-full bg-amber animate-[blink_1.6s_infinite]" />
            Safety resources
          </span>
          <h2 className="font-display font-extrabold text-[clamp(2rem,5vw,3.3rem)] text-white mb-2">Know who to call</h2>
          <p className="text-white/90 max-w-[58ch] m-0">
            Get ready before you go out, and know your next step if you feel unsafe.
          </p>
        </div>
      </div>
      <div className="max-w-[1120px] mx-auto px-5 -mt-11 relative">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {SAFETY_HELPLINES.map((h) => {
            const Icon = ICONS[h.icon] || LuPhone;
            const cls = h.kind === 'sos' ? 'bg-red border-red text-white' : h.kind === 'pri' ? 'bg-accent border-accent text-white' : 'bg-surface border-line text-ink';
            return (
              <a
                key={h.number}
                href={`tel:${h.number}`}
                className={`block ${cls} border rounded-2xl p-5 no-underline shadow-[0_18px_40px_rgba(7,39,36,0.2)] hover:-translate-y-1 transition-transform`}
              >
                <Icon size={26} />
                <h3 className="font-display font-extrabold text-lg mt-2 mb-1">{h.label}</h3>
                <p className={`m-0 text-sm ${h.kind === 'default' ? 'text-mut' : 'opacity-90'}`}>{h.desc}</p>
              </a>
            );
          })}
        </div>
        <p className="text-mut text-sm mt-3">
          Notifying friends is not dispatching responders. Helpline numbers can change, so confirm them
          before you rely on them.
        </p>

        <div className="grid md:grid-cols-2 gap-5 mt-5">
          <Card>
            <div className="flex justify-between items-center gap-3 flex-wrap">
              <b>Before you go out</b>
              <Chip tone={done === SAFETY_CHECKLIST.length ? 'g' : 'n'}>{done} of {SAFETY_CHECKLIST.length} ready</Chip>
            </div>
            <div className="h-2 rounded-full bg-line overflow-hidden my-3">
              <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
            </div>
            {SAFETY_CHECKLIST.map((t, i) => (
              <label key={i} className="flex items-center gap-3 py-3 border-t border-line first:border-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checks[i]}
                  onChange={() => setChecks((c) => c.map((v, j) => (i === j ? !v : v)))}
                  className="w-[22px] h-[22px] accent-teal shrink-0"
                />
                <span className="text-sm">{t}</span>
              </label>
            ))}
          </Card>

          <Card>
            <b>If you feel unsafe</b>
            <ol className="list-none m-0 mt-3 p-0 border-l-[3px] border-accent pl-0">
              {[
                ['Tell a friend quietly', 'Use Get Me Home with a few words or a code phrase.', ''],
                ['Ask for help', 'Share your location and ask someone to come.', 'a'],
                ['Hold SOS', 'Three seconds to preview the demo alert. No contact is notified.', 'r'],
                ['Call 999 or 112', 'If you believe you are in danger.', 'r'],
              ].map(([t, d, tone], i) => (
                <li key={i} className="relative pl-6 pb-5 -ml-1.5">
                  <span
                    className={`absolute -left-[12px] top-0.5 w-[21px] h-[21px] rounded-full border-4 ${
                      tone === 'r' ? 'border-red' : tone === 'a' ? 'border-amber' : 'border-accent'
                    } bg-surface`}
                  />
                  <h3 className="font-display font-extrabold text-base m-0">{t}</h3>
                  <span className="text-mut text-sm">{d}</span>
                </li>
              ))}
            </ol>
            <Button to="/help"><LuHouse size={16} /> Open Get help</Button>
          </Card>
        </div>
      </div>
    </>
  );
}