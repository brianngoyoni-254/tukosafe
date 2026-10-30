import { useEffect, useState, useRef } from 'react';
import { LuMapPin, LuRefreshCw, LuRadio, LuSquare, LuShare2, LuExternalLink } from 'react-icons/lu';
import { useApp } from '../context/AppContext';
import MapView from '../components/MapView';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { formatCoords, compassLabel, formatTime, mapsLink } from '../lib/format';

function useCountdown(endsAt) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  if (!endsAt) return null;
  const ms = Math.max(0, endsAt - now);
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${m} min ${s.toString().padStart(2, '0')} s`;
}

function buildShareMessage(pos) {
  if (!pos) return '';
  return `I am here: ${mapsLink(pos.lat, pos.lng)} (accuracy about ${Math.round(pos.accuracy)} m, ${formatTime(pos.ts)}). Sent from TukoSafe.`;
}

export default function LiveMap() {
  const {
    pos, locate, useDemoLocation, send,
    live, liveEndsAt, startLive, stopLive, locating, geoError,
  } = useApp();

  const [draft, setDraft] = useState('');
  const [duration, setDuration] = useState(60);
  const [autoTried, setAutoTried] = useState(false);
  const lastFilledTs = useRef(0);
  const remaining = useCountdown(liveEndsAt);

  // Auto-locate once on mount
  useEffect(() => {
    if (!autoTried && !pos) {
      setAutoTried(true);
      locate();
    }
  }, [autoTried, pos, locate]);

  // Auto-fill share message whenever position changes
  // (first locate, live tick, or demo location).
  useEffect(() => {
    if (!pos) return;
    if (pos.ts === lastFilledTs.current) return;
    lastFilledTs.current = pos.ts;
    setDraft(buildShareMessage(pos));
  }, [pos]);

  // Manual re-fill: rebuild the share text from current position
  const refill = () => {
    if (!pos) return;
    lastFilledTs.current = pos.ts;
    setDraft(buildShareMessage(pos));
  };

  return (
    <>
      <div className="relative overflow-hidden bg-deep text-white pt-11 pb-20">
        <div className="max-w-[1120px] mx-auto px-5 relative">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/20 text-[#bfe0da] text-sm mb-3">
            <span className="w-2 h-2 rounded-full bg-amber animate-[blink_1.6s_infinite]" />
            Live map
          </span>
          <h2 className="font-display font-extrabold text-[clamp(2rem,5vw,3.3rem)] text-white mb-2">
            Where you are, on your terms
          </h2>
          <p className="text-[#bfe0da] max-w-[58ch] m-0">
            The map finds you automatically. Your position stays in this browser until you choose to share it.
          </p>
        </div>
      </div>

      <div className="max-w-[1120px] mx-auto px-5 -mt-11 relative">
        <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5 items-start">
          <div>
            <MapView height={480} />
            <div
              className={`mt-3 p-3 rounded-lg text-sm ${geoError ? 'bg-redbg text-red' : 'bg-mint'}`}
              role="status"
            >
              {geoError
                ? geoError
                : locating
                ? 'Locating… accept the browser prompt.'
                : pos
                ? live
                  ? `Live updates on. Updating every few seconds. Ends in ${remaining || '…'}.`
                  : 'Located. Your share message is ready below.'
                : 'Press “Locate me” to find your position.'}
            </div>
          </div>

          <div className="space-y-3.5">
            <Card>
              <div className="flex justify-between items-center gap-3 flex-wrap mb-3">
                <b>Your position</b>
                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${pos ? 'bg-greenbg text-green' : 'bg-line text-mut'}`}>
                  {live ? 'Live' : pos ? 'Located' : 'Not located'}
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
                <Button onClick={locate} disabled={locating}>
                  <LuMapPin size={16} /> {locating ? 'Locating…' : 'Locate me'}
                </Button>
                <Button variant="outline" onClick={useDemoLocation}>
                  <LuRefreshCw size={16} /> Use demo location
                </Button>
              </div>
            </Card>

            <Card>
              <b>Live updates</b>
              <p className="text-mut text-sm mb-2">
                The map follows you. Updates stop on their own when time is up.
              </p>
              <div className="flex gap-2 items-center mb-2">
                <label htmlFor="dur" className="text-sm text-mut">Duration</label>
                <select
                  id="dur"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  disabled={live}
                  className="p-2 rounded-lg border border-line bg-white text-sm"
                >
                  <option value={15}>15 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={240}>4 hours</option>
                </select>
              </div>
              {live ? (
                <Button variant="outline" onClick={() => stopLive('Live updates stopped.')}>
                  <LuSquare size={14} /> Stop live updates
                </Button>
              ) : (
                <Button onClick={() => startLive(duration)} disabled={!('geolocation' in navigator)}>
                  <LuRadio size={16} /> Start live updates
                </Button>
              )}
              {live && remaining && (
                <div className="text-mut text-xs mt-2">Ends in {remaining}</div>
              )}
            </Card>

            <Card>
              <div className="flex justify-between items-center gap-3 mb-2">
                <b>Share this location</b>
                {pos && (
                  <button
                    type="button"
                    onClick={refill}
                    className="inline-flex items-center gap-1 text-xs font-bold text-teal hover:underline"
                  >
                    <LuRefreshCw size={12} /> Refresh
                  </button>
                )}
              </div>
              <textarea
                rows={4}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={
                  pos
                    ? 'Your message is ready to send.'
                    : 'Your location will appear here once located.'
                }
                aria-label="Message"
                className="w-full mt-1 p-2.5 rounded-lg border border-line bg-white text-ink font-body text-sm"
              />
              <div className="flex flex-wrap gap-2.5 mt-2">
                <Button onClick={() => send('Location shared')} disabled={!pos || !draft.trim()}>
                  <LuShare2 size={16} /> Share
                </Button>
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