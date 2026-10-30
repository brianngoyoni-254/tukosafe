import { LuCheck, LuClock, LuTriangleAlert } from 'react-icons/lu';
import { useApp } from '../context/app-context';
import MapView from '../components/MapView';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Chip from '../components/ui/Chip';
import Toggle from '../components/ui/Toggle';
import { OUTING } from '../data/dummy';
import { remainLabel } from '../lib/format';

function memberChip(m, step, sharing) {
  if (!sharing) return <Chip tone="n">Demo ended</Chip>;
  if (!m.consent) return <Chip tone="n"><LuClock size={12} /> Not joined</Chip>;
  if (m.you && step >= 3) return <Chip tone="r"><LuTriangleAlert size={12} /> Help may be needed</Chip>;
  if (m.you && step >= 1) return <Chip tone="y"><LuClock size={12} /> Check-in overdue</Chip>;
  return <Chip tone="g"><LuCheck size={12} /> Checked in</Chip>;
}

export default function Outing() {
  const { members, setMembers, sharing, setSharing, expiresAt, setExpiresAt, step, send } = useApp();

  return (
    <>
      <div className="relative overflow-hidden bg-deep text-white pt-11 pb-20">
        <div className="max-w-[1120px] mx-auto px-5 relative">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/20 text-white/90 text-sm mb-3">
            <span className="w-2 h-2 rounded-full bg-amber animate-[blink_1.6s_infinite]" />
            Outing Circle
          </span>
          <h2 className="font-display font-extrabold text-[clamp(2rem,5vw,3.3rem)] text-white mb-2">Opt in for one night</h2>
          <p className="text-white/90 max-w-[58ch] m-0">
            Preview consent controls and automatic expiry in this browser. No location is shared with friends.
          </p>
        </div>
      </div>
      <div className="max-w-[1120px] mx-auto px-5 -mt-11 relative">
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5 items-start">
          <div className="space-y-3.5">
            <Card>
              <div className="flex justify-between items-center gap-3 flex-wrap">
                <b>{OUTING.title}</b>
                <Chip tone={sharing ? 'g' : 'n'}>{sharing ? 'Demo timer on' : 'Demo ended'}</Chip>
              </div>
              <div className="text-mut text-sm mt-1">
                {OUTING.startsAt} – {OUTING.endsAt}. Demo sharing ends in <b>{remainLabel(expiresAt)}</b>.
                Consent switches only change this local preview.
              </div>
            </Card>

            <Card>
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 py-2.5 border-t border-line first:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-accent text-white grid place-items-center font-bold">
                      {m.name[0]}
                    </div>
                    <div>
                      <b>{m.name}{m.you && ' (you)'}</b>
                      <div className="mt-0.5">{memberChip(m, step, sharing)}</div>
                    </div>
                  </div>
                  {m.you ? (
                    <span className="text-mut text-sm">You</span>
                  ) : (
                    <div className="flex items-center gap-2 text-mut text-sm">
                      Demo consent
                      <Toggle
                        checked={m.consent}
                        onChange={(v) => setMembers((arr) => arr.map((x) => (x.id === m.id ? { ...x, consent: v } : x)))}
                        label={`Consent for ${m.name}`}
                      />
                    </div>
                  )}
                </div>
              ))}
            </Card>

            <Card>
              <b>Return-home plan</b>
              <div className="text-mut text-sm mt-1">
                Leave venue {OUTING.returnPlan.departure}. Home ETA {OUTING.returnPlan.homeEta}. Notify{' '}
                {OUTING.returnPlan.notify} on arrival.
              </div>
            </Card>

            <div className="flex flex-wrap gap-2.5">
              <Button variant="outline" onClick={() => { setSharing(false); send('Sharing ended'); }}>
                Stop sharing now
              </Button>
              {!sharing && (
                <Button onClick={() => { setSharing(true); setExpiresAt(Date.now() + 4 * 3_600_000); }}>
                  Start a new sharing window (demo)
                </Button>
              )}
            </div>
          </div>

          <div>
            <MapView />
            <p className="text-mut text-sm mt-2">
              Friends appear on the map only when they have consented. Their positions are demo values.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}