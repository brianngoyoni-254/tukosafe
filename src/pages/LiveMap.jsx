import { useState } from 'react';
import { LuMapPin, LuRefreshCw, LuRadio, LuShare2, LuExternalLink } from 'react-icons/lu';
import { useApp } from '../context/app-context';
import MapView from '../components/MapView';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { formatCoords, compassLabel, formatTime, mapsLink } from '../lib/format';

export default function LiveMap() {
  const { pos, locate, useDemoLocation, showToast } = useApp();
  const [draft, setDraft] = useState('');

  const startLive = () => {
    showToast('Live location sharing is not connected in this demo.');
  };

  const generateDraft = () => {
    if (!pos) return;
    setDraft(
      `I am here: ${mapsLink(pos.lat, pos.lng)} (accuracy about ${Math.round(pos.accuracy)} m, ${formatTime(pos.ts)}). Sent from TukoSafe.`
    );
  };

  return (
    <>
      <div className="relative overflow-hidden bg-deep text-white pt-11 pb-20">
        <div className="max-w-[1120px] mx-auto px-5 relative">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/20 text-white/90 text-sm mb-3">
            <span className="w-2 h-2 rounded-full bg-amber animate-[blink_1.6s_infinite]" />
            Location preview
          </span>
          <h2 className="font-display font-extrabold text-[clamp(2rem,5vw,3.3rem)] text-white mb-2">
            Where you are, on your terms
          </h2>
          <p className="text-white/90 max-w-[58ch] m-0">
            Request a single browser location fix or use demo data. The map is illustrative; live tracking is not connected.
          </p>
        </div>
      </div>
      <div className="max-w-[1120px] mx-auto px-5 -mt-11 relative">
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5 items-start">
          <div>
            <MapView />
            <div className="mt-3 p-3 rounded-lg bg-accentbg text-sm" role="status">
              {pos ? 'Located. Nothing has been shared yet.' : 'Press “Locate me” to find your position.'}
            </div>
          </div>
          <div className="space-y-3.5">
            <Card>
              <div className="flex justify-between items-center gap-3 flex-wrap mb-3">
                <b>Your position</b>
                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${pos ? 'bg-greenbg text-green' : 'bg-line text-mut'}`}>
                  {pos ? 'Located' : 'Not located'}
                </span>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-sm">
                <dt className="text-mut">Coordinates</dt>
                <dd className="m-0 font-bold break-words">{pos ? formatCoords(pos.lat, pos.lng) : '–'}</dd>
                <dt className="text-mut">Accuracy</dt>
                <dd className="m-0 font-bold">{pos ? `±${Math.round(pos.accuracy)} m` : '–'}</dd>
                <dt className="text-mut">Heading</dt>
                <dd className="m-0 font-bold">{compassLabel(pos?.heading)}</dd>
                <dt className="text-mut">Updated</dt>
                <dd className="m-0 font-bold">{pos ? formatTime(pos.ts) : '–'}</dd>
              </dl>
              <div className="flex flex-wrap gap-2.5 mt-3">
                <Button onClick={locate}><LuMapPin size={16} /> Locate me</Button>
                <Button variant="outline" onClick={useDemoLocation}><LuRefreshCw size={16} /> Use demo location</Button>
              </div>
            </Card>

            <Card>
              <b>Live updates (demo only)</b>
              <p className="text-mut text-sm mb-2">No location updates are broadcast or tracked.</p>
              <div className="flex flex-wrap gap-2.5 mt-2">
                <Button onClick={startLive}><LuRadio size={16} /> Preview live updates</Button>
              </div>
            </Card>

            <Card>
              <b>Share this location</b>
              <textarea
                rows={3}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                aria-label="Message"
                className="w-full mt-2 p-2.5 rounded-lg border border-line bg-surface text-ink font-body"
              />
              <div className="flex flex-wrap gap-2.5 mt-2">
                <Button onClick={generateDraft} disabled={!pos}><LuShare2 size={16} /> Draft message</Button>
                <Button
                  variant="outline"
                  disabled={!pos}
                  onClick={() => window.open(mapsLink(pos.lat, pos.lng), '_blank', 'noopener')}
                >
                  <LuExternalLink size={16} /> Open in Google Maps
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}