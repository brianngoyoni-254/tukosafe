import { useEffect, useState } from 'react';
import { LuCheck, LuTriangleAlert } from 'react-icons/lu';
import { useApp } from '../context/AppContext';

const CAPTIONS = [
  'Msaidizi checks in, in your language',
  'The phone goes quiet. The grace period runs',
  'Your friend gets a calm brief, not a panic',
];

export default function PhoneMockup() {
  const { lang, ai } = useApp();
  const [i, setI] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setI(2); return; }
    const id = setInterval(() => setI((x) => (x + 1) % 3), 4200);
    return () => clearInterval(id);
  }, []);

  const greeting = ai.checkin
    ? lang === 'sw'
      ? 'Habari Wanjiru, umefika nyumbani salama?'
      : 'Niaje Wanjiru, uko poa? Unaeza confirm uko sawa? Gonga marafiki wajue.'
    : 'Check-in due: please confirm you are okay.';

  const screens = [
    <div key="s1" className="absolute inset-0 p-5 space-y-3">
      <h4 className="font-display font-extrabold text-base m-0">Msaidizi</h4>
      <div className="bg-white border border-line rounded-[14px_14px_14px_4px] p-3 text-sm">{greeting}</div>
      <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-mint text-teal">
        {ai.checkin ? 'AI-drafted' : 'Template (AI off)'}
      </span>
      <button className="w-full py-3 rounded-xl bg-teal text-white font-bold text-sm inline-flex items-center justify-center gap-1.5 animate-[tap_2s_infinite]">
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
      <div className="bg-white border border-line rounded-[14px_14px_14px_4px] p-3 text-sm">
        Wanjiru’s phone is quiet. Brian will only be alerted when the grace period ends.
      </div>
    </div>,
    <div key="s3" className="absolute inset-0 p-5 space-y-3">
      <h4 className="font-display font-extrabold text-base m-0">Brian’s alert</h4>
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amberbg text-amber">
        <LuTriangleAlert size={12} /> Verify safety
      </span>
      <div className="bg-white border border-line rounded-[14px] p-3 text-sm">
        Wanjiru hasn’t confirmed arrival yet. <b>This may be a dead battery or poor signal.</b> Last known:
        Westlands, 1:42 AM. Please call first. If you believe she is in danger, call 999 or 112.
      </div>
      <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-mint text-teal">
        AI-drafted from the facts shown
      </span>
    </div>,
  ];

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[292px] bg-[#0d1f1d] border-8 border-[#1d3f3b] rounded-[40px] p-2.5 shadow-[0_40px_70px_rgba(0,0,0,0.6)]">
        <div className="relative h-[430px] rounded-[28px] bg-[#f4f8f7] text-ink overflow-hidden">
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
          <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? 'bg-amber w-11' : 'bg-white/20 w-6'}`} />
        ))}
      </div>
      <p className="text-center text-[#bfe0da] text-sm mt-2 min-h-[1.5em]" role="status">{CAPTIONS[i]}</p>
    </div>
  );
}