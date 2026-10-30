import { useState } from 'react';
import {
  LuLightbulb, LuUserRound, LuMapPin, LuCar, LuLifeBuoy,
  LuCircleAlert, LuCircleCheck, LuX,
} from 'react-icons/lu';
import { useApp } from '../context/app-context';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useData } from '../context/DataContext';
import AlertPanel from '../components/AlertPanel';
import SosButton from '../components/SosButton';
import { classifyGetMeHome, draftMessage } from '../lib/ai';

const OPTIONS = [
  { n: 1, icon: LuUserRound, label: 'Contact a trusted friend', hint: 'Low urgency. A quiet message.' },
  { n: 2, icon: LuMapPin, label: 'Share location and ask for help', hint: 'High urgency. Someone should come now.' },
  { n: 3, icon: LuCar, label: 'Arrange a safe journey home', hint: 'Transport. Share your trip home.' },
];

export default function GetHelp() {
  const { ai, pos, showToast, requestSupport } = useApp();
  const { contacts, sendAlert } = useData();
  const [recipients, setRecipients] = useState([]);
  const [shareLoc, setShareLoc] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState('');
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

  const sendHelp = async () => {
    setSending(true);
    setSendResult('');
    const location = drafted === 2 && shareLoc && pos ? { lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy } : null;
    const r = await sendAlert({ kind: 'help_request', message: message.trim(), recipients, location });
    setSending(false);
    setSendResult(
      r.status === 'confirmed' ? 'Request recorded. Track delivery and replies under “Your alerts”.'
      : r.status === 'queued' ? 'No connection. Saved on this device, NOT sent yet. It will send when you are back online.'
      : `Not sent: ${r.error}`
    );
    if (r.status === 'confirmed') { setDrafted(null); setMessage(''); setRecipients([]); setShareLoc(false); }
  };

  const handleSupport = () => {
    requestSupport({ context: 'get_me_home', userMessage: text });
  };

  const handleTextChange = (value) => {
    setText(value);
    if (!value.trim()) {
      setResult(null);
      setDrafted(null);
      setMessage('');
      return;
    }

    setResult({
      option: 2,
      confidence: 'high',
      source: 'autofill',
      reasoning: 'Your message is ready as a request for help.',
    });
    setDrafted(2);
    setMessage(`${draftMessage(2)} Details: ${value.trim()}`);
  };

  const lowConfidence =
    result && (result.option === 0 || result.confidence === 'low' || result.supportAvailable);

  return (
    <>
      <div className="relative overflow-hidden bg-deep text-white pt-11 pb-20">
        <div className="max-w-[1120px] mx-auto px-5 relative">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/20 text-white/90 text-sm mb-3">
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
                Type anything about what’s happening. We’ll prepare a request for help automatically.
              </label>
              <div className="flex gap-2 mt-1.5">
                <input
                  id="gt"
                  type="text"
                  value={text}
                  onChange={(e) => handleTextChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && askAI()}
                  placeholder="What’s happening?"
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
                      <LuCircleCheck size={12} /> {result.source === 'autofill' ? 'Help request ready' : 'AI suggestion'}
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
                    {result.source === 'autofill'
                      ? 'It sounds like you need help.'
                      : `Option ${result.option} — ${OPTIONS.find((o) => o.n === result.option)?.label}`}
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
                  <div className="text-mut text-xs mt-1">You edit it, you send it.</div>
                  {drafted === 3 ? (
                    <div className="mt-2">
                      <p className="text-sm m-0 mb-2">
                        A safe journey home is a real plan: you choose who is told, when you expect to arrive,
                        and they are alerted by the server if you do not check in.
                      </p>
                      <Button to="/checkin">Plan my journey home</Button>
                    </div>
                  ) : (
                    <>
                      <fieldset className="border-0 p-0 mt-2 mb-0">
                        <legend className="text-sm font-bold mb-1">Send to</legend>
                        {!contacts.length && <p className="text-mut text-sm m-0">You have no trusted friends yet. Add one in the Trust Panel, or call 999 / 112.</p>}
                        {contacts.map((c) => (
                          <label key={c.id} className="flex items-center gap-2 py-0.5 text-sm cursor-pointer">
                            <input type="checkbox" className="w-4 h-4 accent-teal" checked={recipients.includes(c.id)}
                              onChange={(e) => setRecipients((r) => (e.target.checked ? [...r, c.id] : r.filter((x) => x !== c.id)))} />
                            {c.name}
                          </label>
                        ))}
                      </fieldset>
                      {drafted === 2 && (
                        <label className="flex items-start gap-2 mt-2 text-sm cursor-pointer">
                          <input type="checkbox" className="w-4 h-4 accent-teal mt-0.5" checked={shareLoc}
                            onChange={(e) => setShareLoc(e.target.checked)} disabled={!pos} />
                          <span>
                            Include my current location in this request (one-time, not live tracking).
                            {!pos && <span className="block text-mut text-xs">Open the Live map and tap Locate me first.</span>}
                          </span>
                        </label>
                      )}
                      <div className="flex gap-2 mt-2">
                        <Button onClick={sendHelp} disabled={!recipients.length || !message.trim() || sending}>
                          {sending ? 'Sending…' : 'Approve and send'}
                        </Button>
                        <Button variant="outline" onClick={() => { setDrafted(null); setMessage(''); }}>
                          Cancel
                        </Button>
                      </div>
                      {sendResult && <p className="text-sm mt-2 mb-0" role="status">{sendResult}</p>}
                    </>
                  )}
                </div>
              )}
            </Card>

            <AlertPanel />
          </div>

          <Card className="text-center">
            <h3 className="font-display font-extrabold text-lg m-0">SOS</h3>
            <p className="text-mut text-sm mt-1">Hold for 3 seconds to alert your trusted friends. Release early to cancel.</p>
            <SosButton />
            <div className="flex justify-center gap-2.5 mt-4">
              <Button variant="amber" href="tel:999">Call 999</Button>
              <Button variant="outline" href="tel:112">Call 112</Button>
            </div>
            <p className="text-mut text-sm mt-3">
              SOS notifies your trusted friends inside TukoSafe. It does <b>not</b> contact police, ambulance or any
              emergency service. If you are in danger, call 999 or 112 yourself.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}