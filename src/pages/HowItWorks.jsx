import { LuCalendar, LuHandshake, LuMessageCircle, LuHouse } from 'react-icons/lu';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

const STEPS = [
  { Icon: LuCalendar, title: '1. Plan the outing', desc: 'Pick friends, a window, and a return-home plan.', cls: 'bg-surface border-line' },
  { Icon: LuHandshake, title: '2. Opt in', desc: 'Everyone agrees to share. Anyone can leave any time.', cls: 'bg-surface border-line' },
  { Icon: LuMessageCircle, title: '3. Check in', desc: 'Msaidizi asks if you’re okay. A tap answers.', cls: 'bg-surface border-line' },
  { Icon: LuHouse, title: '4. Get home', desc: 'Tap “I’m home”. Sharing ends and your contact is told.', cls: 'bg-accent text-white border-accent' },
];

const LADDER = [
  ['1', 'We inform', 'We show the facts we actually have.'],
  ['2', 'We suggest', 'We draft a message or an option from a template.'],
  ['3', 'You approve', 'You edit it, you send it.'],
  ['4', 'People act', 'You, your friends, or 999 / 112.'],
];

export default function HowItWorks() {
  return (
    <>
      <div className="relative overflow-hidden bg-deep text-white pt-11 pb-20">
        <div className="max-w-[1120px] mx-auto px-5 relative">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/20 text-white/90 text-sm mb-3">
            <span className="w-2 h-2 rounded-full bg-amber animate-[blink_1.6s_infinite]" />
            How it works
          </span>
          <h2 className="font-display font-extrabold text-[clamp(2rem,5vw,3.3rem)] text-white mb-2">From plan to doorstep</h2>
          <p className="text-white/90 max-w-[58ch] m-0">
            Create an account, invite friends you trust, and choose what to share. Everything is opt-in and can be stopped at any time.
          </p>
        </div>
      </div>
      <div className="max-w-[1120px] mx-auto px-5 -mt-11 relative">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {STEPS.map(({ Icon, title, desc, cls }) => (
            <div key={title} className={`${cls} border rounded-2xl p-5 shadow-[0_18px_40px_rgba(7,39,36,0.2)]`}>
              <Icon size={26} />
              <h3 className="font-display font-extrabold text-lg mt-2 mb-1">{title}</h3>
              <p className={`m-0 text-sm ${cls.includes('teal') ? 'opacity-90' : 'text-mut'}`}>{desc}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-10 mt-10 items-start">
          <div>
            <h2 className="font-display font-extrabold text-[clamp(1.6rem,3.5vw,2.3rem)]">If a check-in is missed</h2>
            <p className="text-mut">A journey-home plan is tracked on our servers, so the alert below fires even if your phone or browser is closed.</p>
            <ol className="list-none m-0 my-4 ml-2.5 p-0 border-l-[3px] border-accent">
              {[
                ['Journey planned', 'You choose a destination, an expected arrival time, a grace period and who to alert.', ''],
                ['Reminder sent', 'At the expected time you get a reminder asking if you are home safe.', ''],
                ['Grace period', 'Your contacts are only alerted when this ends, and you can still check in or add time.', 'a'],
                ['Contact alerted', 'The contacts you chose are told you have not checked in, with a calm note to try calling first.', 'r'],
                ['Arrived', 'You tap “I have arrived safely” and your contacts are told.', ''],
              ].map(([t, d, tone], i) => (
                <li key={i} className="relative pl-6 pb-5">
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
            <div className="flex flex-wrap gap-2.5">
              <Button to="/checkin">Try a check-in</Button>
              <Button to="/contact" variant="outline">Open contact view</Button>
            </div>
          </div>

          <div>
            <h2 className="font-display font-extrabold text-[clamp(1.6rem,3.5vw,2.3rem)]">Our principle</h2>
            <p className="text-mut">Suggestions come from templates and simple rules (no AI service is connected). People make the decisions.</p>
            {LADDER.map(([n, t, d]) => (
              <Card key={n} className="!mb-2.5 !flex !items-center !gap-3.5 !p-4">
                <span className="flex-none w-9 h-9 rounded-full bg-amber text-[#1b1200] grid place-items-center font-extrabold">{n}</span>
                <span>
                  <b>{t}</b>
                  <div className="text-mut text-sm">{d}</div>
                </span>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}