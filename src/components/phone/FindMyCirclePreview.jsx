import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LuLocateFixed, LuChevronLeft, LuChevronRight, LuCircleOff, LuShieldCheck } from 'react-icons/lu';

// ALL DATA HERE IS FICTIONAL DEMO DATA. Positions are percentages of a drawn map, not real coordinates,
// and nothing on this slide reads or requests the visitor's location.
const FRIENDS = [
  { id: 'wanjiru', name: 'Wanjiru', color: '#0f8b80', available: true, status: 'Sharing location', updated: 'Updated just now', x: 64, y: 38, acc: 3.4, accuracy: '±25 m' },
  { id: 'brian', name: 'Brian', color: '#1d6fa5', available: true, status: 'Sharing location', updated: 'Updated 2 minutes ago', x: 28, y: 30, acc: 2.6, accuracy: '±40 m' },
  { id: 'achieng', name: 'Achieng', color: '#8394a3', available: false, status: 'Location unavailable', updated: 'Not sharing right now', x: null, y: null },
];
const ME = { x: 47, y: 62 };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// The "world" is larger than the viewport (160% x 150%); we pan it so the focus point sits near the centre.
function panFor(pt) {
  return { left: clamp(50 - pt.x * 1.6, -60, 0), top: clamp(44 - pt.y * 1.5, -50, 0) };
}

function MapArt() {
  const blocks = [];
  for (let gx = 0; gx < 5; gx += 1) {
    for (let gy = 0; gy < 5; gy += 1) {
      blocks.push(<rect key={`${gx}-${gy}`} x={gx * 32 + 3} y={gy * 30 + 3} width={26} height={24} rx={1.4} fill={(gx + gy) % 3 === 0 ? '#d9e2e9' : '#e1e9ef'} />);
    }
  }
  return (
    <svg className="fmc-svg" viewBox="0 0 160 150" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <rect width="160" height="150" fill="#eaf0f4" />
      {blocks}
      <rect x="96" y="6" width="58" height="42" rx="3" fill="#cfe7d6" />
      <rect x="10" y="68" width="40" height="22" rx="3" fill="#d4ead9" />
      <path d="M-5 112 C 28 98, 52 120, 84 104 S 140 92, 165 104 L165 128 C 140 118, 112 132, 84 130 S 30 146, -5 140 Z" fill="#bddcf0" />
      {/* roads: casing then fill */}
      {[32, 64, 96, 128].map((x) => <line key={`v${x}`} x1={x} y1="0" x2={x} y2="150" stroke="#fff" strokeWidth="3" />)}
      {[30, 60, 90, 120].map((y) => <line key={`h${y}`} x1="0" y1={y} x2="160" y2={y} stroke="#fff" strokeWidth="3" />)}
      <line x1="-4" y1="14" x2="164" y2="112" stroke="#d3dce3" strokeWidth="6.4" />
      <line x1="-4" y1="14" x2="164" y2="112" stroke="#fff6e0" strokeWidth="4.4" />
      <line x1="64" y1="-2" x2="64" y2="152" stroke="#d3dce3" strokeWidth="5.2" />
      <line x1="64" y1="-2" x2="64" y2="152" stroke="#fff" strokeWidth="3.6" />
    </svg>
  );
}

function Avatar({ friend, size = '2.3em' }) {
  return (
    <span className="fmc-avatar" style={{ background: friend.color, width: size, height: size }} aria-hidden="true">
      {friend.name[0]}
    </span>
  );
}

/** Slide 2: Find My Circle. An original TukoSafe design showing demo friends on a drawn map. */
export default function FindMyCirclePreview() {
  const [selected, setSelected] = useState(null);      // friend id | 'me' | null
  const [view, setView] = useState('list');            // 'list' | 'detail'
  const [stopped, setStopped] = useState({});          // friend id -> I stopped sharing with them (demo)

  const friend = FRIENDS.find((f) => f.id === selected) || null;
  const focus = selected === 'me' ? ME : friend?.available ? friend : { x: 46, y: 40 };
  const pan = panFor(focus);
  const sharingWith = FRIENDS.filter((f) => f.available && !stopped[f.id]).length;

  const choose = (id) => { setSelected(id); setView('list'); };

  return (
    <div className="phone-slide fmc">
      <div className="fmc-map">
        <div className="fmc-world" style={{ left: `${pan.left}%`, top: `${pan.top}%` }}>
          <MapArt />
          <span className="fmc-label" style={{ left: '74%', top: '14%' }}>Demo Park</span>
          <span className="fmc-label" style={{ left: '48%', top: '82%' }}>Demo River</span>

          {/* me */}
          <span className="fmc-me" style={{ left: `${ME.x}%`, top: `${ME.y}%` }} aria-hidden="true"><i /></span>

          {FRIENDS.filter((f) => f.available).map((f) => (
            <div key={f.id} className="fmc-pin" style={{ left: `${f.x}%`, top: `${f.y}%` }} data-dim={!!stopped[f.id]}>
              <span className="fmc-acc" style={{ width: `${f.acc * 2}em`, height: `${f.acc * 2}em`, background: `${f.color}26`, borderColor: `${f.color}88` }} aria-hidden="true" />
              <button
                type="button"
                className="fmc-marker"
                data-selected={selected === f.id}
                onClick={() => choose(f.id)}
                aria-pressed={selected === f.id}
                aria-label={`${f.name}, ${f.status.toLowerCase()}, ${f.updated.toLowerCase()} (demo)`}
              >
                <span className="fmc-pulse" style={{ borderColor: f.color }} aria-hidden="true" />
                <Avatar friend={f} size={selected === f.id ? '2.7em' : '2.2em'} />
              </button>
            </div>
          ))}
        </div>

        <div className="fmc-title">
          <b>Find My Circle</b>
          <span className="fmc-live"><i aria-hidden="true" /> Sharing with {sharingWith} {sharingWith === 1 ? 'person' : 'people'}</span>
        </div>
        <span className="fmc-demo-tag">Demo</span>
        <button type="button" className="fmc-locate" onClick={() => choose('me')} aria-label="My location (demo)" aria-pressed={selected === 'me'}>
          <LuLocateFixed aria-hidden="true" />
        </button>
      </div>

      <section className="fmc-sheet" aria-label="Your circle (demo)">
        <span className="fmc-grab" aria-hidden="true" />
        {view === 'list' || !friend ? (
          <>
            <ul className="fmc-list">
              {FRIENDS.map((f) => {
                const on = selected === f.id;
                return (
                  <li key={f.id}>
                    <div className="fmc-row" data-selected={on}>
                      <button type="button" className="fmc-row-main" onClick={() => choose(f.id)} aria-pressed={on}>
                        <Avatar friend={f} />
                        <span className="fmc-row-text">
                          <b>{f.name}</b>
                          <small data-off={!f.available}>
                            {stopped[f.id] ? <span>You stopped sharing (demo)</span> : <><span>{f.status}</span><span>{f.updated}</span></>}
                          </small>
                        </span>
                      </button>
                      {on ? (
                        <button type="button" className="fmc-view" onClick={() => setView('detail')}>View Friend</button>
                      ) : (
                        <LuChevronRight className="fmc-chev" aria-hidden="true" />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="fmc-consent"><LuShieldCheck aria-hidden="true" /> Demo data. Real sharing always needs each person&apos;s consent. <Link to="/map">Open Live Map</Link></p>
          </>
        ) : (
          <div className="fmc-detail">
            <button type="button" className="fmc-back" onClick={() => setView('list')}><LuChevronLeft aria-hidden="true" /> Circle</button>
            <div className="fmc-detail-head">
              <Avatar friend={friend} size="2.9em" />
              <span className="fmc-row-text">
                <b>{friend.name}</b>
                <small data-off={!friend.available}><span>{friend.status}</span><span>{friend.updated}</span></small>
              </span>
            </div>
            {friend.available ? (
              <p className="fmc-detail-text">Accuracy {friend.accuracy} (fictional). {stopped[friend.id] ? 'You stopped sharing with them, so they can’t see you.' : 'You are sharing your location with them.'}</p>
            ) : (
              <p className="fmc-detail-text"><LuCircleOff aria-hidden="true" /> They may be offline or may have stopped sharing. TukoSafe never guesses a location.</p>
            )}
            {friend.available && (
              <button type="button" className="fmc-stop" onClick={() => setStopped((s) => ({ ...s, [friend.id]: !s[friend.id] }))}>
                {stopped[friend.id] ? `Resume sharing with ${friend.name} (demo)` : `Stop sharing with ${friend.name} (demo)`}
              </button>
            )}
            <p className="fmc-consent"><LuShieldCheck aria-hidden="true" /> Demo only: no real location is used. <Link to="/map">Open Live Map</Link></p>
          </div>
        )}
      </section>
    </div>
  );
}
