import { useEffect, useState } from 'react';
import { LuMapPin, LuRefreshCw, LuRadio, LuSquare, LuPause, LuPlay, LuExternalLink } from 'react-icons/lu';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useSharedLocations } from '../lib/useSharedLocations';
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

export default function LiveMap() {
  const {
    pos, locate, useDemoLocation,
    live, liveEndsAt, startLive, stopLive, locating, geoError,
    paused, setSharingPaused, myShares, lastSent, resumeSending,
  } = useApp();
  const { user } = useAuth();
  const { contacts } = useData();

  const [duration, setDuration] = useState(60);
  const [picked, setPicked] = useState([]);
  const [autoTried, setAutoTried] = useState(false);
  const remaining = useCountdown(liveEndsAt);

  const names = Object.fromEntries(contacts.map((c) => [c.id, c.name]));
  const { people, error: sharedError } = useSharedLocations(user.id, names);
  const sharingElsewhere = !live && myShares.some((s) => s.status === 'active' && new Date(s.expires_at) > new Date());

  // Auto-locate once on mount
  useEffect(() => {
    if (!autoTried && !pos) {
      setAutoTried(true);
      locate();
    }
  }, [autoTried, pos, locate]);

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
            <MapView height={480} friends={people} />
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
              <b>Share my live location</b>
              <p className="text-mut text-sm mt-1 mb-2">
                Only the friends you tick can see you, only until the time is up, and only while this page is open
                and sending. You can stop at any moment and access ends immediately.
              </p>
              {!live && (
                <>
                  <fieldset className="border-0 p-0 m-0 mb-2">
                    <legend className="text-sm font-bold mb-1">Who can see me</legend>
                    {!contacts.length && <p className="text-mut text-sm m-0">Add a trusted friend in the Trust Panel first.</p>}
                    {contacts.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 py-1 text-sm cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 accent-teal" checked={picked.includes(c.id)}
                          onChange={(e) => setPicked((p) => (e.target.checked ? [...p, c.id] : p.filter((x) => x !== c.id)))} />
                        {c.name}
                      </label>
                    ))}
                  </fieldset>
                  <div className="flex gap-2 items-center mb-2">
                    <label htmlFor="dur" className="text-sm text-mut">For</label>
                    <select id="dur" value={duration} onChange={(e) => setDuration(Number(e.target.value))}
                      className="p-2 rounded-lg border border-line bg-white text-sm">
                      <option value={15}>15 minutes</option>
                      <option value={60}>1 hour</option>
                      <option value={240}>4 hours</option>
                      <option value={720}>12 hours</option>
                    </select>
                  </div>
                  <Button onClick={() => startLive(duration, picked)} disabled={!picked.length || !('geolocation' in navigator)}>
                    <LuRadio size={16} /> Start sharing
                  </Button>
                  {sharingElsewhere && (
                    <div className="mt-3 p-2.5 rounded-lg bg-amberbg text-sm">
                      Your location is still being shared with {myShares.length} friend{myShares.length > 1 ? 's' : ''},
                      but this page is not sending updates.
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" onClick={resumeSending}>Resume sending</Button>
                        <Button size="sm" variant="outline" onClick={() => stopLive('Sharing stopped.')}>Stop sharing</Button>
                      </div>
                    </div>
                  )}
                </>
              )}
              {live && (
                <div>
                  <p className="text-sm m-0 mb-1" role="status">
                    {paused ? 'Paused. Nobody can see you.' : `Sharing with ${myShares.length} friend${myShares.length === 1 ? '' : 's'}.`}
                    {remaining && ` Ends in ${remaining}.`}
                  </p>
                  <p className="text-mut text-xs mt-0 mb-2">
                    {lastSent ? `Last update sent ${formatTime(lastSent)}.` : 'Waiting for the first update…'}
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    <Button variant="outline" onClick={() => setSharingPaused(!paused)}>
                      {paused ? <><LuPlay size={14} /> Resume</> : <><LuPause size={14} /> Pause</>}
                    </Button>
                    <Button variant="danger" onClick={() => stopLive('Sharing stopped. Your friends can no longer see you.')}>
                      <LuSquare size={14} /> Stop sharing
                    </Button>
                  </div>
                </div>
              )}
              <div className="mt-3">
                <Button variant="outline" size="sm" disabled={!pos}
                  onClick={() => window.open(mapsLink(pos.lat, pos.lng), '_blank', 'noopener')}>
                  <LuExternalLink size={16} /> Open my position in Google Maps
                </Button>
              </div>
            </Card>

            <Card>
              <b>Shared with you</b>
              {sharedError && <p className="text-red text-sm mt-1" role="alert">{sharedError}</p>}
              {!people.length && (
                <p className="text-mut text-sm mt-1 mb-0">
                  Nobody is sharing their location with you right now. Being trusted friends does not share location;
                  they must choose to share.
                </p>
              )}
              {people.map((p) => (
                <div key={p.id} className="flex items-start justify-between gap-3 mt-2.5 text-sm">
                  <div>
                    <b>{p.name}</b>
                    <div className="text-mut text-xs">
                      Updated {formatTime(new Date(p.updatedAt).getTime())}
                      {p.accuracy != null && ` · ±${Math.round(p.accuracy)} m`}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${p.state === 'live' ? 'bg-greenbg text-green' : p.state === 'stale' ? 'bg-amberbg text-amber' : 'bg-line text-mut'}`}>
                    {p.state === 'live' ? 'Live' : p.state === 'stale' ? 'Stale' : 'Offline'}
                  </span>
                </div>
              ))}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}