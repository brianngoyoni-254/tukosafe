import { useEffect, useState } from 'react';
import { LuCheck, LuTriangleAlert } from 'react-icons/lu';
import { useApp } from '../context/AppContext';
import { CHECKIN_TEMPLATES } from '../data/dummy';

const CAPTIONS = [
  'Sample check-in in your selected language',
  'Manually preview the missed-check-in steps',
  'Preview a scripted contact brief',
];

export default function PhoneMockup() {
  const { lang, ai } = useApp();
  const [i, setI] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 2 : 0
  );

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const id = setInterval(() => setI((x) => (x + 1) % 3), 4200);
    return () => clearInterval(id);
  }, []);

  const greeting = ai.checkin
    ? CHECKIN_TEMPLATES[lang]('Wanjiru')
    : 'Check-in due: please confirm you are okay. If something isn’t right, reply “help”.';

  const screens = [
    <div key="s1" className="absolute inset-0 p-5 space-y-3">
      <h4 className="font-display font-extrabold text-base m-0">Msaidizi</h4>
      <div className="bg-surface border border-line rounded-[14px_14px_14px_4px] p-3 text-sm">{greeting}</div>
      <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-accentbg text-accent">
        {ai.checkin ? 'Scripted example' : 'Fallback example'}
      </span>
      <button className="w-full py-3 rounded-xl bg-accent text-white font-bold text-sm inline-flex items-center justify-center gap-1.5 animate-[tap_2s_infinite]">
        <LuCheck size={16} /> I’m okay
      </button>
    </div>,
    <div key="s2" className="absolute inset-0 p-5 space-y-3">
      <h4 className="font-display font-extrabold text-base m-0">Check-in overdue</h4>
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amberbg text-amber">
        <LuTriangleAlert size={12} /> Grace period running
      </span>
      <div className="h-2 rounded-full bg-line overflow-hidden">
        <div className="h-full bg-amber animate-[fill_4s_linear_infinite]" />
      </div>
      <div className="bg-surface border border-line rounded-[14px_14px_14px_4px] p-3 text-sm">
        This demo advances manually. No contact is notified when the grace period ends.
      </div>
    </div>,
    <div key="s3" className="absolute inset-0 p-5 space-y-3">
      <h4 className="font-display font-extrabold text-base m-0">Brian’s alert preview</h4>
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amberbg text-amber">
        <LuTriangleAlert size={12} /> Verify safety
      </span>
      <div className="bg-surface border border-line rounded-[14px] p-3 text-sm">
        Wanjiru hasn’t confirmed arrival yet. <b>This may be a dead battery or poor signal.</b> Last known:
        Westlands, 1:42 AM. Please call first. If you believe she is in danger, call 999 or 112.
      </div>
      <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-accentbg text-accent">
        Scripted sample from the facts shown
      </span>
    </div>,
  ];

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[292px] bg-deep border-line border-8 rounded-[40px] p-2.5 shadow-[0_40px_70px_rgba(0,0,0,0.6)]">
        <div className="relative h-[430px] rounded-[28px] bg-surface text-ink overflow-hidden">
          {screens.map((node, idx) => (
            <div
              key={idx}
              className={`transition-all duration-500 ${
                idx === i ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
              }`}
            >
              {node}
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2 justify-center mt-4">
        {[0, 1, 2].map((n) => (
          <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? 'bg-amber w-11' : 'bg-surface/20 w-6'}`} />
        ))}
      </div>
      <p className="text-center text-white/90 text-sm mt-2 min-h-[1.5em]" role="status">{CAPTIONS[i]}</p>
    </div>
  );
}