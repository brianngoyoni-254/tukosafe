import { useState } from 'react';
import {
  LuLightbulb, LuUserRound, LuMapPin, LuCar, LuLifeBuoy,
  LuCircleAlert, LuCircleCheck, LuX,
} from 'react-icons/lu';
import { useApp } from '../context/AppContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Toggle from '../components/ui/Toggle';
import SosButton from '../components/SosButton';
import { classifyGetMeHome, draftMessage } from '../lib/ai';

const OPTIONS = [
  { n: 1, icon: LuUserRound, label: 'Contact a trusted friend', hint: 'Low urgency. A quiet message.' },
  { n: 2, icon: LuMapPin, label: 'Share location and ask for help', hint: 'High urgency. Someone should come now.' },
  { n: 3, icon: LuCar, label: 'Arrange a safe journey home', hint: 'Transport. Share your trip home.' },
];

export default function GetHelp() {
  const { ai, offline, setOffline, outbox, send, showToast, requestSupport } = useApp();
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [drafted, setDrafted] = useState(null);
  const [message, setMessage] = useState('');

  const askAI = () => {
    if (!text.trim()) return showToast('Type a few words first.');
    if (!ai.copilot) return showToast('Copilot is off. Choose one of the three options below.');
    setLoading(true);
    // Simulated latency so the UI feels deliberate, not instant
    setTimeout(() => {
      const r = classifyGetMeHome(text);
      setResult(r);
      if (r.option > 0 && r.confidence !== 'low') {
        setDrafted(r.option);
        setMessage(draftMessage(r.option));
      }
      setLoading(false);
    }, 450);
  };

  const chooseOption = (n) => {
    setResult(null);
    setDrafted(n);
    setMessage(draftMessage(n));
  };

  const handleSupport = () => {
    requestSupport({ context: 'get_me_home', userMessage: text });
  };

  const lowConfidence =
    result && (result.option === 0 || result.confidence === 'low' || result.supportAvailable);

  return (
    <>
      <div className="relative overflow-hidden bg-deep text-white pt-11 pb-20">
        <div className="max-w-[1120px] mx-auto px-5 relative">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/20 text-[#bfe0da] text-sm mb-3">
            <span className="w-2 h-2 rounded-full bg-amber animate-[blink_1.6s_infinite]" />
            Get help
          </span>
          <h2 className="font-display font-extrabold text-[clamp(2rem,5vw,3.3rem)] text-white mb-2">
            Ask quietly. Or hold SOS.
          </h2>
          <p className="text-[#bfe0da] max-w-[58ch] m-0">
            English, Kiswahili, or Sheng. Get Me Home, SOS, and a direct line to 999 and 112.
          </p>
        </div>
      </div>

      <div className="max-w-[1120px] mx-auto px-5 -mt-11 relative">
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5 items-start">
          <div className="space-y-3.5">
            <Card>
              <h3 className="font-display font-extrabold text-lg m-0 mb-1">Get Me Home</h3>
              <label htmlFor="gt" className="text-mut text-sm">
                Describe it in a few words — any language, any phrase.
              </label>
              <div className="flex gap-2 mt-1.5">
                <input
                  id="gt"
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && askAI()}
                  placeholder='e.g. "si poa hapa", "nataka nyumbani", "help me"'
                  className="flex-1 p-2.5 rounded-lg border border-line bg-white text-ink font-body"
                />
                <Button onClick={askAI} disabled={loading}>
                  <LuLightbulb size={16} />
                  {loading ? 'Thinking…' : 'Ask AI'}
                </Button>
              </div>

              {/* Positive result */}
              {result && !lowConfidence && (
                <div className="mt-3 p-3 rounded-lg bg-mint border border-teal2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white text-teal text-xs font-bold">
                      <LuCircleCheck size={12} /> AI suggestion
                    </span>
                    <button
                      onClick={() => { setResult(null); setDrafted(null); }}
                      className="text-mut hover:text-ink"
                      aria-label="Dismiss"
                    >
                      <LuX size={16} />
                    </button>
                  </div>
                  <p className="mt-1.5 mb-0 font-bold">
                    Option {result.option} — {OPTIONS.find((o) => o.n === result.option)?.label}
                  </p>
                  <p className="text-mut text-xs mt-1 mb-0">{result.reasoning}</p>
                  {result.matchedPhrase && (
                    <p className="text-mut text-xs mt-0.5 mb-0">
                      Matched phrase: “{result.matchedPhrase}” ({result.meaning})
                    </p>
                  )}
                </div>
              )}

              {/* Low confidence → support fallback */}
              {lowConfidence && (
                <div className="mt-3 p-3 rounded-lg bg-amberbg border border-amber">
                  <p className="flex items-center gap-2 font-bold text-amber m-0">
                    <LuCircleAlert size={16} /> I’m not sure I understood that correctly.
                  </p>
                  <p className="text-sm text-mut mt-1 mb-2">
                    {result.reasoning}. A human moderator can help — or pick an option below.
                    In an emergency, call 999 or 112.
                  </p>
                  <Button variant="amber" onClick={handleSupport}>
                    <LuLifeBuoy size={16} /> Talk to support
                  </Button>
                </div>
              )}

              {/* Manual options — always available */}
              <p className="text-mut text-xs mt-4 mb-1.5">Or choose manually:</p>
              <div className="space-y-2">
                {OPTIONS.map(({ n, icon: Icon, label, hint }) => (
                  <button
                    key={n}
                    onClick={() => chooseOption(n)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition flex items-start gap-3 ${
                      drafted === n
                        ? 'border-teal bg-mint'
                        : 'border-line bg-white hover:border-teal2'
                    }`}
                  >
                    <Icon size={18} className="mt-0.5 shrink-0" />
                    <div>
                      <b className="text-sm">{n} · {label}</b>
                      <div className="text-mut text-xs mt-0.5">{hint}</div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Draft review */}
              {drafted && (
                <div className="mt-3 p-3 border border-line rounded-lg">
                  <b>Review your message</b>
                  <textarea
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full mt-1.5 p-2.5 rounded-lg border border-line bg-white text-ink font-body"
                  />
                  <div className="text-mut text-xs mt-1">
                    You edit it, you send it. {drafted === 3 && 'Transport links are simulated.'}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button onClick={() => send('Message to friend')}>Approve and send</Button>
                    <Button variant="outline" onClick={() => { setDrafted(null); setMessage(''); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            <Card>
              <div className="flex justify-between items-center gap-3 flex-wrap">
                <div>
                  <b>Simulate offline mode</b>
                  <div className="text-mut text-sm">SOS and check-ins queue until you reconnect.</div>
                </div>
                <Toggle checked={offline} onChange={setOffline} label="Offline" />
              </div>
              {outbox.length > 0 && (
                <div className="mt-2.5 text-sm">
                  <b>Queued ({outbox.length})</b>
                  <div className="text-mut">{outbox.join(', ')}</div>
                </div>
              )}
            </Card>
          </div>

          <Card className="text-center">
            <h3 className="font-display font-extrabold text-lg m-0">SOS</h3>
            <p className="text-mut text-sm mt-1">Press and hold for 3 seconds. Release to cancel.</p>
            <SosButton />
            <div className="flex justify-center gap-2.5 mt-4">
              <Button variant="amber" href="tel:999">Call 999</Button>
              <Button variant="outline" href="tel:112">Call 112</Button>
            </div>
            <p className="text-mut text-sm mt-3">Notifying friends is not dispatching responders.</p>
          </Card>
        </div>
      </div>
    </>
  );
}