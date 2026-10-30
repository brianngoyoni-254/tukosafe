import { Link } from 'react-router-dom';
import { LuHouse, LuCircleAlert, LuUsers, LuMap, LuMessageCircle, LuShieldCheck, LuCompass } from 'react-icons/lu';
import Button from '../components/ui/Button';
import PhoneMockup from '../components/PhoneMockup';

const ACTIONS = [
  { to: '/help', icon: LuCircleAlert, title: 'SOS', desc: 'Press and hold. Contacts are alerted immediately.', cls: 'bg-red border-red text-white', descCls: 'text-[#ffe3df]' },
  { to: '/help', icon: LuHouse, title: 'Get Me Home', desc: 'Type a few words. Send a quiet message you approve.', cls: 'bg-accent border-accent text-white', descCls: 'text-[#d6efea]' },
  { to: '/outing', icon: LuUsers, title: 'Create an outing', desc: 'Opt in to share for one night. It expires on its own.', cls: 'bg-surface border-line', descCls: 'text-mut' },
  { to: '/map', icon: LuMap, title: 'Live map', desc: 'Finds your location automatically.', cls: 'bg-surface border-line', descCls: 'text-mut' },
];

const STEPS = [
  ['Plan the outing', 'Pick friends, a window, and a return-home plan.'],
  ['Opt in', 'Everyone agrees to share. Anyone can leave any time.'],
  ['Check in', 'Msaidizi asks if you’re okay. A tap answers.'],
  ['Get home', 'Tap “I’m home”. Sharing ends and your contact is told.'],
];

export default function Home() {
  return (
    <>
      <section className="relative overflow-hidden bg-deep text-white pt-14 pb-32">
        <div className="max-w-[1120px] mx-auto px-5 grid md:grid-cols-[1.05fr_.95fr] gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/20 text-white/90 text-sm mb-5">
              <span className="w-2 h-2 rounded-full bg-amber animate-[blink_1.6s_infinite]" />
              AI-powered, people-led safety companion
            </div>
            <h1 className="font-display font-extrabold text-[clamp(2.7rem,6.6vw,5rem)] leading-[1.05] mb-4">
              <span className="block opacity-0 translate-y-5 animate-[up_.8s_cubic-bezier(.2,.7,.2,1)_forwards]">Go out.</span>
              <span className="block opacity-0 translate-y-5 animate-[up_.8s_cubic-bezier(.2,.7,.2,1)_.18s_forwards]">Have fun.</span>
              <span className="block text-amber opacity-0 translate-y-5 animate-[up_.8s_cubic-bezier(.2,.7,.2,1)_.36s_forwards]">Get home safe.</span>
            </h1>
            <p className="text-lg text-white/90 max-w-[50ch] mb-6">
              TukoSafe helps friends in Kenya look out for each other on nights out. It notices when
              something may be wrong, helps you ask for help discreetly, and gets everyone home.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-[520px]">
              <Button to="/help" variant="amber" size="lg" className="sm:col-span-2">
                <LuHouse size={18} /> Get Me Home
              </Button>
              <Button to="/help" variant="danger">
                <LuCircleAlert size={18} /> SOS · hold for help
              </Button>
              <Button to="/outing" variant="ghost">
                <LuUsers size={18} /> Create an outing
              </Button>
              <Button to="/map" variant="ghost" className="sm:col-span-2">
                <LuMap size={18} /> Show my location on the live map
              </Button>
            </div>
            <p className="mt-4 text-mut/80 text-sm">
              TukoSafe is not an emergency service. In an emergency call{' '}
              <a className="text-white font-bold" href="tel:999">999</a> or{' '}
              <a className="text-white font-bold" href="tel:112">112</a>.
              <br />
              Your position stays in this browser until you choose to share it.
            </p>
          </div>
          <div className="relative grid place-items-center min-h-[520px]">
            <div className="relative w-[460px] h-[460px] hidden md:block">
              <span className="absolute inset-0 rounded-full border border-accent/40 animate-[pulse-ring_6s_ease-out_infinite]" />
              <span className="absolute inset-0 rounded-full border border-accent/25 animate-[pulse-ring_6s_ease-out_infinite_2s]" />
              <span className="absolute inset-0 rounded-full border border-accent/15 animate-[pulse-ring_6s_ease-out_infinite_4s]" />
            </div>
            <div className="absolute md:static">
              <PhoneMockup />
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-[1120px] mx-auto px-5 -mt-20 relative">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {ACTIONS.map(({ to, icon: Icon, title, desc, cls, descCls }) => (
            <Link
              key={title}
              to={to}
              className={`block ${cls} border rounded-2xl p-5 no-underline shadow-[0_18px_40px_rgba(7,39,36,0.2)] hover:-translate-y-1 transition-transform`}
            >
              <Icon size={28} />
              <h3 className="font-display font-extrabold text-lg mt-2 mb-1">{title}</h3>
              <p className={`m-0 text-sm ${descCls}`}>{desc}</p>
            </Link>
          ))}
        </div>
        <div className="text-center text-mut text-sm mt-5">
          Need emergency services?{' '}
          <a href="tel:999" className="font-bold text-ink">Call 999</a>{' '}
          <a href="tel:112" className="font-bold text-ink">Call 112</a> — Notifying friends is not dispatching responders.
        </div>
      </div>

      <section className="py-16">
        <div className="max-w-[1120px] mx-auto px-5">
          <h2 className="font-display font-extrabold text-[clamp(1.6rem,3.5vw,2.3rem)]">The 2 AM problem</h2>
          <p className="text-mut max-w-[62ch] mb-4">
            A silent phone, and a friend who doesn’t know what to do. Is it a dead battery or an emergency?
            TukoSafe tells your friend what is known, what is unknown, and what to do next.
          </p>
          <div className="grid md:grid-cols-2 gap-5">
            <div className="bg-redbg rounded-2xl p-5">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-redbg text-red text-xs font-bold">A typical alert</span>
              <q className="block text-lg mt-2.5">“No location update from Wanjiru.”</q>
              <p className="text-mut text-sm mt-2.5">No context, no caveat, no next step. Friends panic or ignore it.</p>
            </div>
            <div className="bg-surface border-2 border-accent rounded-2xl p-5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-greenbg text-green text-xs font-bold">
                <LuShieldCheck size={12} /> A TukoSafe brief
              </span>
              <q className="block text-lg mt-2.5">
                “Wanjiru hasn’t confirmed arrival yet. This may be a dead battery or poor signal. Last
                known location: Westlands, 1:42 AM. Please try calling first. If you believe she is in
                danger, call 999 or 112.”
              </q>
              <span className="inline-block mt-2.5 px-2 py-0.5 rounded-md bg-accentbg text-accent text-xs font-bold">
                AI-drafted from the facts shown
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-accentbg">
        <div className="max-w-[1120px] mx-auto px-5">
          <h2 className="font-display font-extrabold text-[clamp(1.6rem,3.5vw,2.3rem)]">
            Everything you need, nothing you don’t
          </h2>
          <div className="grid md:grid-cols-3 gap-4 mt-6">
            <div className="md:row-span-2 rounded-2xl p-6 bg-deep text-white">
              <div className="font-display font-extrabold text-4xl leading-none">Msaidizi</div>
              <h3 className="font-display font-extrabold text-lg mt-3">Your AI check-in companion</h3>
              <p className="text-white/90 mt-1">
                Msaidizi means “helper”. It asks if you’re okay in English, Kiswahili or Sheng. It only
                words the message. Timers and escalation run on fixed rules, never on AI.
              </p>
              <Button to="/checkin" variant="amber" size="sm" className="mt-3">
                <LuMessageCircle size={16} /> Try a check-in
              </Button>
            </div>
            <div className="rounded-2xl p-6 bg-surface border border-line">
              <h3 className="font-display font-extrabold text-lg">Get Me Home</h3>
              <p className="text-mut text-sm mb-3">Describe it in a few words or a code phrase. You review, then send.</p>
              <Button to="/help" size="sm"><LuHouse size={14} /> Open</Button>
            </div>
            <div className="rounded-2xl p-6 bg-amberbg">
              <h3 className="font-display font-extrabold text-lg">Short and time-boxed</h3>
              <p className="text-mut text-sm mb-3">Sharing is per outing, visible to named friends, and ends automatically.</p>
              <Button to="/outing" variant="outline" size="sm">See an outing</Button>
            </div>
            <div className="rounded-2xl p-6 bg-surface border border-line">
              <h3 className="font-display font-extrabold text-lg">Trust Panel</h3>
              <p className="text-mut text-sm mb-3">Every AI output shows its facts and can be flagged or switched off.</p>
              <Button to="/trust" variant="outline" size="sm">Open</Button>
            </div>
            <div className="rounded-2xl p-6 bg-surface border border-line">
              <h3 className="font-display font-extrabold text-lg">Contact brief</h3>
              <p className="text-mut text-sm mb-3">What your friend sees when you miss a check-in.</p>
              <Button to="/contact" variant="outline" size="sm">Preview</Button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-[1120px] mx-auto px-5">
          <h2 className="font-display font-extrabold text-[clamp(1.6rem,3.5vw,2.3rem)] mb-6">
            From plan to doorstep in four steps
          </h2>
          <ol className="grid grid-cols-2 md:grid-cols-4 gap-4 list-none p-0 m-0">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="pt-3.5 border-t-4 border-accent">
                <span className="block font-bold text-accent text-sm">Step {i + 1}</span>
                <h3 className="font-display font-extrabold text-lg mt-1">{t}</h3>
                <span className="text-mut text-sm">{d}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-16 bg-accentbg">
        <div className="max-w-[1120px] mx-auto px-5">
          <p className="font-display font-extrabold text-[clamp(1.7rem,4vw,2.8rem)] leading-[1.1] tracking-tight">
            People First, AI Second.<br />AI does the work. People make the decisions.
          </p>
          <div className="grid md:grid-cols-3 gap-5 mt-7">
            {[
              ['AI informs and suggests', 'It summarises verified facts and drafts messages. That is where it stops.'],
              ['You approve and act', 'You edit, send, call, or contact 999 / 112. AI never contacts responders.'],
              ['Works with AI switched off', 'Every AI feature has a plain fallback, so help is never blocked.'],
            ].map(([t, d]) => (
              <div key={t} className="bg-surface border border-line rounded-2xl p-5">
                <h3 className="font-display font-extrabold text-lg">{t}</h3>
                <p className="text-mut text-sm">{d}</p>
              </div>
            ))}
          </div>
          <p className="text-mut text-sm mt-4">Human-Centered Technology: Building Trust in Communities.</p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-[1120px] mx-auto px-5">
          <div className="bg-deep text-white rounded-3xl p-6 md:p-11 grid md:grid-cols-[1.2fr_1fr] gap-7 items-center">
            <div>
              <h2 className="font-display font-extrabold text-[clamp(1.6rem,3.5vw,2.3rem)] mb-1.5">Tuko salama. We are safe.</h2>
              <p className="text-white/90">
                TukoSafe comes from the Swahili <i>tuko salama</i>. Plan tonight’s outing, and get everyone home.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Button to="/outing" variant="amber" size="lg"><LuUsers size={18} /> Create an outing</Button>
              <Button to="/help" variant="ghost"><LuHouse size={16} /> Get Me Home</Button>
              <Button to="/map" variant="ghost"><LuCompass size={16} /> Find me</Button>
              <Button to="/help" variant="danger"><LuCircleAlert size={16} /> SOS</Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}