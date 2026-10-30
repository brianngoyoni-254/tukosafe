import { LuTriangleAlert, LuPhone, LuSiren, LuFlag } from 'react-icons/lu';
import { useApp } from '../context/app-context';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Chip from '../components/ui/Chip';
import MapView from '../components/MapView';
import { buildSituationBrief } from '../lib/ai';
import { AI_FACTS } from '../data/dummy';

export default function ContactView() {
  const { ai, aiFail, step, setStep, sos, flag, showToast } = useApp();

  if (sos) {
    return (
      <div className="max-w-[1120px] mx-auto px-5 pt-10">
        <Card className="border-red max-w-[620px]">
          <Chip tone="r"><LuSiren size={12} /> SOS</Chip>
          <p className="mt-2.5">
            {AI_FACTS.name} has requested urgent help. Last location shared at {AI_FACTS.lastLocationTime}.
            Call {AI_FACTS.name} now. If you believe {AI_FACTS.name} is in danger, call 999 or 112.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <Button href="tel:+254700000000"><LuPhone size={16} /> Call {AI_FACTS.name}</Button>
            <Button variant="amber" href="tel:999"><LuPhone size={16} /> Call 999</Button>
            <Button variant="outline" onClick={() => showToast('Acknowledged (simulated)')}>Acknowledge</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (step < 3) {
    return (
      <div className="max-w-[1120px] mx-auto px-5 pt-10">
        <Card className="max-w-[620px]">
          <Chip tone="g">No alert</Chip>
          <p className="text-mut mt-2.5">
            Brian sees an alert here when {AI_FACTS.name} misses a check-in or presses SOS.
          </p>
          <Button onClick={() => setStep(3)}>Skip to alert</Button>
        </Card>
      </div>
    );
  }

  const brief = buildSituationBrief(
    {
      name: AI_FACTS.name,
      location: AI_FACTS.lastLocationLabel,
      time: AI_FACTS.lastLocationTime,
      battery: AI_FACTS.battery,
      usualTrip: AI_FACTS.usualTripMinutes,
    },
    { aiEnabled: ai.brief, aiFail }
  );

  return (
    <>
      <div className="relative overflow-hidden bg-deep text-white pt-11 pb-20">
        <div className="max-w-[1120px] mx-auto px-5 relative">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/20 text-white/90 text-sm mb-3">
            <span className="w-2 h-2 rounded-full bg-amber animate-[blink_1.6s_infinite]" />
            Contact view
          </span>
          <h2 className="font-display font-extrabold text-[clamp(2rem,5vw,3.3rem)] text-white mb-2">
            What your friend sees
          </h2>
          <p className="text-[#bfe0da] max-w-[58ch] m-0">
            The brief a trusted friend gets when you miss a check-in or press SOS.
          </p>
        </div>
      </div>
      <div className="max-w-[1120px] mx-auto px-5 -mt-11 relative">
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5 items-start">
          <Card className="border-amber">
            <Chip tone="y"><LuTriangleAlert size={12} /> Verify safety</Chip>
            <p className="mt-2.5 leading-relaxed">{brief.text}</p>
            {brief.ai ? (
              <span className="inline-block px-2 py-0.5 rounded-md bg-accentbg text-accent text-xs font-bold">
                AI-drafted from the facts shown
              </span>
            ) : (
              <>
                <span className="inline-block px-2 py-0.5 rounded-md bg-amberbg text-amber text-xs font-bold">
                  Template alert
                </span>
                <div className="text-mut text-sm mt-1">{brief.why}</div>
              </>
            )}
            <div className="text-sm text-mut border-l-[3px] border-accent pl-2.5 my-2.5">
              Based on: last location {AI_FACTS.lastLocationTime}, {AI_FACTS.lastLocationLabel}; battery{' '}
              {AI_FACTS.battery}%; usual trip {AI_FACTS.usualTripMinutes} min. Generated just now. Status is not a guarantee.
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Button href="tel:+254700000000"><LuPhone size={16} /> Call {AI_FACTS.name}</Button>
              <Button variant="amber" href="tel:999"><LuPhone size={16} /> Call 999 / 112</Button>
              <Button variant="outline" onClick={flag}><LuFlag size={16} /> Flag as wrong or unhelpful</Button>
            </div>
          </Card>
          <div>
            <MapView showMembers={false} />
            <p className="text-mut text-sm mt-2">Last known position. GPS can fail.</p>
          </div>
        </div>
      </div>
    </>
  );
}