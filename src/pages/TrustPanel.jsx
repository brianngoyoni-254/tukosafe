import { LuDownload, LuTrash2 } from 'react-icons/lu';
import { useApp } from '../context/AppContext';
import Card from '../components/ui/Card';
import Toggle from '../components/ui/Toggle';
import Button from '../components/ui/Button';
import TrustCircle from '../components/TrustCircle';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export default function TrustPanel() {
  const { ai, setAi, aiFail, setAiFail, flags, showToast } = useApp();
  const { user, deleteAccount } = useAuth();

  // Export everything the signed-in user can read (RLS limits this to their own data).
  const exportData = async () => {
    const tables = ['profiles', 'trusted_contacts', 'messages', 'notifications', 'outings', 'return_home_plans', 'sos_alerts', 'audit_log'];
    const out = {};
    for (const t of tables) {
      const { data, error } = await supabase.from(t).select('*');
      out[t] = error ? { error: error.message } : data;
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `tukosafe-${user.id}.json` });
    a.click();
    URL.revokeObjectURL(url);
  };

  const removeAccount = async () => {
    if (!window.confirm('Permanently delete your account and all your data? This cannot be undone.')) return;
    const r = await deleteAccount();
    showToast(r.ok ? 'Account deleted.' : r.error);
  };

  const rows = [
    ['checkin', 'Msaidizi check-ins', 'Wording in English, Kiswahili, Sheng'],
    ['copilot', 'Get Me Home Copilot', 'Suggests an option and drafts a message'],
    ['brief', 'AI Situation Brief', 'Plain-language alert for contacts'],
  ];

  return (
    <>
      <div className="relative overflow-hidden bg-deep text-white pt-11 pb-20">
        <div className="max-w-[1120px] mx-auto px-5 relative">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/20 text-[#bfe0da] text-sm mb-3">
            <span className="w-2 h-2 rounded-full bg-amber animate-[blink_1.6s_infinite]" />
            Trust Panel
          </span>
          <h2 className="font-display font-extrabold text-[clamp(2rem,5vw,3.3rem)] text-white mb-2">People First, AI Second</h2>
          <p className="text-[#bfe0da] max-w-[58ch] m-0">
            Switch any AI feature off and check-ins, SOS and 999 / 112 still work.
          </p>
        </div>
      </div>
      <div className="max-w-[1120px] mx-auto px-5 -mt-11 relative">
        <div className="mb-5">
          <h3 className="font-display font-extrabold text-xl text-ink mb-3">Your trusted circle</h3>
          <TrustCircle />
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          <div className="space-y-3.5">
            <Card>
              <b>AI features</b>
              {rows.map(([key, title, desc]) => (
                <div key={key} className="flex justify-between items-center gap-3 py-2.5 border-t border-line first:border-t-0 first:mt-2">
                  <div>
                    <b>{title}</b>
                    <div className="text-mut text-sm">{desc}</div>
                  </div>
                  <Toggle checked={ai[key]} onChange={(v) => setAi({ ...ai, [key]: v })} label={title} />
                </div>
              ))}
              <p className="text-mut text-sm">Turn any off. Check-ins, SOS and 999 / 112 still work with templates.</p>
            </Card>
            <Card>
              <b>AI ladder</b>
              <div className="text-mut text-sm">1. AI informs. 2. AI suggests. 3. You approve. 4. People act.</div>
            </Card>
            <Card>
              <b>Hard limits</b>
              <div className="text-mut text-sm">
                AI never contacts responders, never labels anyone missing or in danger, never starts or
                extends sharing, never delays escalation, and never uses your data for ads or training.
              </div>
            </Card>
          </div>

          <div className="space-y-3.5">
            <Card>
              <b>Your data</b>
              <div className="text-mut text-sm">
                Sharing is per outing, visible to named people, and expires automatically. Only a minimised
                context goes to the AI: no coordinates or phone numbers.
              </div>
              <div className="flex flex-wrap gap-2.5 mt-2.5">
                <Button variant="outline" onClick={() => exportData().catch((e) => showToast(e.message))}><LuDownload size={16} /> Export my data</Button>
                <Button variant="outline" onClick={removeAccount}><LuTrash2 size={16} /> Delete my account</Button>
              </div>
            </Card>
            <Card>
              <b>Flagged AI outputs ({flags.length})</b>
              {flags.length === 0 ? (
                <div className="text-mut text-sm">None yet. A human moderator reviews every flag.</div>
              ) : (
                flags.map((f, i) => <div key={i} className="text-mut text-sm">{f}</div>)
              )}
            </Card>
            <Card>
              <div className="flex justify-between items-center gap-3 flex-wrap">
                <div>
                  <b>Test: AI makes an error</b>
                  <div className="text-mut text-sm">The brief changes a fact and the validator falls back to a template.</div>
                </div>
                <Toggle
                  checked={aiFail}
                  onChange={(v) => { setAiFail(v); showToast(v ? 'Open Contact view: template fallback' : 'Test off'); }}
                  label="AI error test"
                />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}