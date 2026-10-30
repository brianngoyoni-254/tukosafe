import { useState } from 'react';
import { LuLightbulb, LuUserRound, LuMapPin, LuCar, LuWifiOff } from 'react-icons/lu';
import { useApp } from '../context/app-context';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Toggle from '../components/ui/Toggle';
import SosButton from '../components/SosButton';
import { copilotClassify, COPILOT_DRAFTS } from '../lib/messages';

const OPTIONS = [
  { n: 1, icon: LuUserRound, label: 'Contact a trusted friend' },
  { n: 2, icon: LuMapPin, label: 'Share location and ask for help' },
  { n: 3, icon: LuCar, label: 'Arrange a safe journey home' },
];

export default function GetHelp() {
  const { ai, offline, setOffline, outbox, send, showToast } = useApp();
  const [text, setText] = useState('');
  const [suggestion, setSuggestion] = useState(null);
  const [drafted, setDrafted] = useState(null);

  const runCopilot = () => {
    if (!text.trim()) return showToast('Type a few words first, or pick an option below.');
    if (!ai.copilot) return showToast('Copilot is off. Choose one of the three options below.');
    setSuggestion(copilotClassify(text));
  };

  return (
    <>
      <div className="relative overflow-hidden bg-deep text-white pt-11 pb-20">
        <div className="max-w-[1120px] mx-auto px-5 relative">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/20 text-white/90 text-sm mb-3">
            <span className="w-2 h-2 rounded-full bg-amber animate-[blink_1.6s_infinite]" />
            Get help
          </span>
          <h2 className="font-display font-extrabold text-[clamp(2rem,5vw,3.3rem)] text-white mb-2">Ask quietly. Or hold SOS.</h2>
          <p className="text-white/90 max-w-[58ch] m-0">Get Me Home, SOS, and a direct line to 999 and 112.</p>
        </div>
      </div>
      <div className="max-w-[1120px] mx-auto px-5 -mt-11 relative">
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5 items-start">
          <div className="space-y-3.5">
            <Card>
              <h3 className="font-display font-extrabold text-lg m-0 mb-1">Get Me Home</h3>
              <label htmlFor="gt" className="text-mut text-sm">Describe it in a few words, in any language.</label>
              <input
                id="gt"
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="e.g. “Mambo si poa hapa”"
                className="w-full mt-1.5 p-2.5 rounded-lg border border-line bg-surface text-ink font-body"
              />
              <div className="mt-2.5 mb-2.5">
                <Button onClick={runCopilot}><LuLightbulb size={16} /> Suggest an option</Button>
              </div>
              {suggestion && (
                <div className="p-3 rounded-lg bg-accentbg mb-3">
                  <span className="inline-block px-2 py-0.5 rounded-md bg-surface text-accent text-xs font-bold">Keyword-rule demo</span>{' '}
                  Suggested: option {suggestion}
                  <div className="text-mut text-xs mt-1">Local keyword rules use only your words. No AI service or network request is connected.</div>
                </div>
              )}
              <div className="space-y-2">
                {OPTIONS.map(({ n, icon: Icon, label }) => (
                  <Button key={n} variant="outline" className="w-full !justify-start" onClick={() => setDrafted(n)}>
                    <Icon size={16} /> {n} · {label}
                  </Button>
                ))}
              </div>
              {drafted && (
                <div className="mt-3 p-3 border border-line rounded-lg">
                  <b>Review your message</b>
                  <textarea
                    rows={3}
                    defaultValue={COPILOT_DRAFTS[drafted]}
                    className="w-full mt-1.5 p-2.5 rounded-lg border border-line bg-surface text-ink font-body"
                  />
                  <div className="text-mut text-xs mt-1">
                    Edit this sample message. The send action below only previews a local demo response.{drafted === 3 ? ' Transport links are not connected.' : ''}
                  </div>
                  <Button className="mt-2" onClick={() => send('Message to friend')}>Preview send action</Button>
                </div>
              )}
            </Card>

            <Card>
              <div className="flex justify-between items-center gap-3 flex-wrap">
                <div>
                  <b className="inline-flex items-center gap-1.5"><LuWifiOff size={14} /> Simulate offline mode</b>
                  <div className="text-mut text-sm">Local demo queue only. Reconnecting does not deliver messages.</div>
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