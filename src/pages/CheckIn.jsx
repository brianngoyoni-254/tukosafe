import { LuCheck } from 'react-icons/lu';
import { useApp } from '../context/app-context';
import CheckinStepper from '../components/CheckinStepper';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Chip from '../components/ui/Chip';
import { CHECKIN_TEMPLATES, LANG_LABELS } from '../lib/messages';

export default function CheckIn() {
  const { lang, setLang, ai, step, setStep, setSos, send, members } = useApp();
  const name = members[0].name;
  const template = ai.checkin ? CHECKIN_TEMPLATES[lang](name) : 'Check-in due: please confirm you are okay.';

  return (
    <>
      <div className="relative overflow-hidden bg-deep text-white pt-11 pb-20">
        <div className="max-w-[1120px] mx-auto px-5 relative">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/20 text-white/90 text-sm mb-3">
            <span className="w-2 h-2 rounded-full bg-amber animate-[blink_1.6s_infinite]" />
            Msaidizi check-ins
          </span>
          <h2 className="font-display font-extrabold text-[clamp(2rem,5vw,3.3rem)] text-white mb-2">
            A calm check-in, in your language
          </h2>
          <p className="text-white/90 max-w-[58ch] m-0">
            English, Kiswahili or Sheng. A tap answers. Timers are never controlled by AI.
          </p>
        </div>
      </div>
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
                    className={`px-3.5 py-2 rounded-lg font-bold text-sm ${lang === k ? 'bg-white text-ink' : 'text-ink hover:bg-white/40'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Card>

            <Card>
              <b>Escalation timeline</b>
              <CheckinStepper step={step} />
              <div className="flex flex-wrap gap-2.5 mt-3">
                <Button onClick={() => { setStep(4); setSos(false); send('“I’m okay”'); }}>
                  <LuCheck size={16} /> I’m okay
                </Button>
                <Button
                  variant="outline"
                  disabled={step >= 3}
                  onClick={() => {
                    const next = Math.min(3, step + 1);
                    setStep(next);
                    if (next === 3) send('Alert to Brian');
                  }}
                >
                  Simulate missed check-in
                </Button>
                <Button variant="outline" onClick={() => { setStep(0); setSos(false); }}>Reset</Button>
              </div>
            </Card>

            <p className="text-mut text-sm">
              Timers run in a deterministic scheduler. AI only words the message and can’t delay or cancel escalation.
            </p>
          </div>

          <div className="grid place-items-center">
            <div className="relative w-[292px] bg-[#0d1f1d] border-8 border-[#1d3f3b] rounded-[40px] p-2.5 shadow-[0_40px_70px_rgba(0,0,0,0.4)]">
              <div className="h-[430px] rounded-[28px] bg-[#f4f8f7] text-ink p-5 space-y-3 overflow-hidden">
                {step === 4 ? (
                  <>
                    <h4 className="font-display font-extrabold text-base m-0">Msaidizi</h4>
                    <div className="bg-white border border-line rounded-[14px_14px_14px_4px] p-3 text-sm">{template}</div>
                    <div className="ml-auto w-fit max-w-[80%] bg-accent text-white rounded-[16px_16px_4px_16px] px-3 py-2 text-sm">
                      I’m okay ✓
                    </div>
                    <Chip tone="g">Friends told</Chip>
                  </>
                ) : step === 3 ? (
                  <>
                    <h4 className="font-display font-extrabold text-base m-0">Contact alerted</h4>
                    <Chip tone="r">Alert sent to Brian</Chip>
                    <div className="bg-white border border-line rounded-[14px] p-3 text-sm mt-2">
                      The grace period ended. Brian received a calm brief with your last known location.
                    </div>
                    <button className="w-full py-3 rounded-xl bg-accent text-white font-bold text-sm">I’m okay ✓</button>
                  </>
                ) : (
                  <>
                    <h4 className="font-display font-extrabold text-base m-0">Msaidizi</h4>
                    <div className="bg-white border border-line rounded-[14px_14px_14px_4px] p-3 text-sm">{template}</div>
                    <Chip tone={ai.checkin ? 'default' : 'y'}>
                      {ai.checkin ? 'AI-drafted' : 'Template (AI off)'}
                    </Chip>
                    {step === 2 && (
                      <div className="h-2 rounded-full bg-line overflow-hidden">
                        <div className="h-full bg-amber animate-[fill_4s_linear_infinite]" />
                      </div>
                    )}
                    <button className="w-full py-3 rounded-xl bg-accent text-white font-bold text-sm">I’m okay ✓</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}