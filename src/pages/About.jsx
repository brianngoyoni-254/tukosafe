import { LuShieldCheck, LuUsers } from 'react-icons/lu';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

export default function About() {
  return (
    <>
      <div className="relative overflow-hidden bg-deep text-white pt-11 pb-20">
        <div className="max-w-[1120px] mx-auto px-5 relative">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/20 text-white/90 text-sm mb-3">
            <span className="w-2 h-2 rounded-full bg-amber animate-[blink_1.6s_infinite]" />
            About TukoSafe
          </span>
          <h2 className="font-display font-extrabold text-[clamp(2rem,5vw,3.3rem)] text-white mb-2">Tuko salama. We are safe.</h2>
          <p className="text-white/90 max-w-[58ch] m-0">
            TukoSafe comes from the Swahili <i>tuko salama</i>. This prototype explores how friends in Kenya could look out for each other on nights out.
          </p>
        </div>
      </div>
      <div className="max-w-[1120px] mx-auto px-5 -mt-11 relative">
        <Card className="!p-8">
          <p className="font-display font-extrabold text-[clamp(1.7rem,4vw,2.8rem)] leading-tight">
            Human-Centered Technology: Building Trust in Communities.
          </p>
          <p className="text-mut max-w-[64ch] mt-3.5">
            The demo previews check-ins, discreet help prompts, and sample contact briefs. It does not
            monitor participants, send alerts, or contact emergency responders.
          </p>
        </Card>

        <div className="grid md:grid-cols-3 gap-5 mt-5">
          {[
            ['AI concept', 'The interface previews proposed AI assistance with scripted examples and local rules.'],
            ['People should approve and act', 'The intended design keeps decisions with people. This prototype does not deliver messages.'],
            ['Demo fallback', 'Local sample wording remains available when the concept controls are switched off.'],
          ].map(([t, d]) => (
            <Card key={t}>
              <h3 className="font-display font-extrabold text-lg">{t}</h3>
              <p className="text-mut text-sm">{d}</p>
            </Card>
          ))}
        </div>

        <div className="mt-10 bg-deep text-white rounded-3xl p-6 md:p-11 grid md:grid-cols-[1.2fr_1fr] gap-7 items-center">
          <div>
            <h2 className="font-display font-extrabold text-[clamp(1.6rem,3.5vw,2.3rem)] mb-1.5">Product principles</h2>
            <ul className="list-disc pl-5 text-white/90 text-sm space-y-1 m-0">
              <li>AI should never contact responders.</li>
              <li>AI should not label anyone missing or in danger.</li>
              <li>Sharing should require clear, revocable consent.</li>
              <li>AI should never control escalation timing.</li>
              <li>Data use and retention need explicit production safeguards.</li>
            </ul>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button to="/trust" variant="amber" size="lg"><LuShieldCheck size={18} /> Open the Trust Panel</Button>
            <Button to="/outing" variant="ghost"><LuUsers size={16} /> Create an outing</Button>
          </div>
        </div>
        <p className="text-mut text-sm mt-4">
          This is a hackathon prototype. Contacts, SMS and transport are simulated, and TukoSafe is not an emergency service.
        </p>
      </div>
    </>
  );
}