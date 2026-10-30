import { LuDownload, LuTrash2 } from 'react-icons/lu';
import { useApp } from '../context/app-context';
import Card from '../components/ui/Card';
import Toggle from '../components/ui/Toggle';
import Button from '../components/ui/Button';

export default function TrustPanel() {
  const { ai, setAi, aiFail, setAiFail, flags, showToast } = useApp();

  const rows = [
    ['checkin', 'Msaidizi check-in preview', 'Sample wording in English, Kiswahili and Sheng'],
    ['copilot', 'Get Me Home suggestion', 'Local keyword rule and sample message'],
    ['brief', 'Contact brief preview', 'Fixed sample facts and local fallback'],
  ];

  return (
    <>
      <div className="relative overflow-hidden bg-deep text-white pt-11 pb-20">
        <div className="max-w-[1120px] mx-auto px-5 relative">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/20 text-white/90 text-sm mb-3">
            <span className="w-2 h-2 rounded-full bg-amber animate-[blink_1.6s_infinite]" />
            Trust Panel
          </span>
          <h2 className="font-display font-extrabold text-[clamp(2rem,5vw,3.3rem)] text-white mb-2">People First, AI Second</h2>
          <p className="text-white/90 max-w-[58ch] m-0">
            This prototype uses scripted examples and local rules; no AI service is connected. These controls preview the proposed behavior.
          </p>
        </div>
      </div>
      <div className="max-w-[1120px] mx-auto px-5 -mt-11 relative">
        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-3.5">
            <Card>
              <b>AI concept previews</b>
              {rows.map(([key, title, desc]) => (
                <div key={key} className="flex justify-between items-center gap-3 py-2.5 border-t border-line first:border-t-0 first:mt-2">
                  <div>
                    <b>{title}</b>
                    <div className="text-mut text-sm">{desc}</div>
                  </div>
                  <Toggle checked={ai[key]} onChange={(v) => setAi({ ...ai, [key]: v })} label={title} />
                </div>
              ))}
              <p className="text-mut text-sm">Toggle sample wording and rule-based suggestions. Emergency calls are separate phone links.</p>
            </Card>
            <Card>
              <b>Proposed AI ladder</b>
              <div className="text-mut text-sm">1. AI informs. 2. AI suggests. 3. You approve. 4. People act. This is a product principle, not a connected AI workflow.</div>
            </Card>
            <Card>
              <b>Hard limits</b>
              <div className="text-mut text-sm">
                No AI service or responder integration is connected in this prototype. Production versions would need technical controls to enforce these limits.
              </div>
            </Card>
          </div>

          <div className="space-y-3.5">
            <Card>
              <b>Your data</b>
              <div className="text-mut text-sm">
                Demo state stays in this browser session except the saved theme. No coordinates or phone numbers are sent to an AI service.
              </div>
              <div className="flex flex-wrap gap-2.5 mt-2.5">
                <Button variant="outline" onClick={() => showToast('Export started (simulated)')}><LuDownload size={16} /> Export my data</Button>
                <Button variant="outline" onClick={() => showToast('Deletion requested (simulated)')}><LuTrash2 size={16} /> Delete my data</Button>
              </div>
            </Card>
            <Card>
              <b>Flagged sample outputs ({flags.length})</b>
              {flags.length === 0 ? (
                <div className="text-mut text-sm">None yet. Flags are stored in this demo session; no moderator queue is connected.</div>
              ) : (
                flags.map((f, i) => <div key={i} className="text-mut text-sm">{f}</div>)
              )}
            </Card>
            <Card>
              <div className="flex justify-between items-center gap-3 flex-wrap">
                <div>
                  <b>Test: sample fact mismatch</b>
                  <div className="text-mut text-sm">The local brief changes a fact and its validator selects the template fallback.</div>
                </div>
                <Toggle
                  checked={aiFail}
                  onChange={(v) => { setAiFail(v); showToast(v ? 'Open Contact view: template fallback' : 'Test off'); }}
                  label="Sample fact mismatch test"
                />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}