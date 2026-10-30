import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LuTriangleAlert } from 'react-icons/lu';

const HOLD_MS = 3000;
const R = 44;
const CIRC = 2 * Math.PI * R;
const CONTACTS = [['W', '#0f8b80', 'Wanjiru'], ['B', '#1d6fa5', 'Brian'], ['A', '#8394a3', 'Achieng']];

/**
 * Slide 3: SOS demonstration. It is isolated on purpose: no network, no geolocation, no tel: links,
 * no SOS backend. Holding for 3 s only shows a local sample preview. The real flow lives on /help.
 */
export default function SOSPreview({ active, onBusyChange }) {
  const [progress, setProgress] = useState(0);
  const [state, setState] = useState('idle'); // idle | holding | cancelled | done
  const timer = useRef(null);
  const startedAt = useRef(0);
  const holding = useRef(false);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    holding.current = false;
  }, []);

  const finish = useCallback(() => {
    stop();
    setProgress(1);
    setState('done');
    onBusyChange?.(true); // keep autoplay paused while the sample alert is on screen
  }, [stop, onBusyChange]);

  const cancel = useCallback(() => {
    if (!holding.current) return;
    stop();
    setProgress(0);
    setState('cancelled');
    onBusyChange?.(false);
  }, [stop, onBusyChange]);

  const begin = useCallback(() => {
    if (holding.current || state === 'done') return;
    holding.current = true;
    startedAt.current = Date.now();
    setState('holding');
    onBusyChange?.(true);
    timer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - startedAt.current) / HOLD_MS);
      setProgress(p);
      if (p >= 1) finish();
    }, 40);
  }, [state, finish, onBusyChange]);

  const reset = useCallback(() => {
    stop();
    setProgress(0);
    setState('idle');
    onBusyChange?.(false);
  }, [stop, onBusyChange]);

  // Leaving the slide abandons any hold or sample alert.
  useEffect(() => {
    if (!active) { stop(); if (state !== 'idle') { setProgress(0); setState('idle'); onBusyChange?.(false); } } // eslint-disable-line react-hooks/set-state-in-effect
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => stop, [stop]);

  const secondsLeft = Math.max(1, Math.ceil((1 - progress) * 3));
  const message = {
    idle: 'Press and hold for 3 seconds. Release to cancel.',
    holding: `Keep holding… ${secondsLeft} s. Release to cancel.`,
    cancelled: 'Cancelled before activation. Nothing happened.',
    done: 'Sample alert shown below. Nothing was sent.',
  }[state];

  return (
    <div className="phone-slide sos">
      <header className="sos-head">
        <h4>Emergency SOS</h4>
        <p>Help when you need it.</p>
      </header>

      <div className="sos-ring">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r={R} className="sos-track" />
          <circle cx="50" cy="50" r={R} className="sos-bar" strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - progress)} />
        </svg>
        <button
          type="button"
          className="sos-btn"
          data-holding={state === 'holding'}
          aria-label="SOS demo: hold for three seconds to preview a sample alert. Nothing is sent."
          onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); begin(); }}
          onPointerUp={cancel}
          onPointerCancel={cancel}
          onLostPointerCapture={cancel}
          onKeyDown={(e) => {
            if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); begin(); }
            if (e.key === 'Escape') cancel();
          }}
          onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') cancel(); }}
          onBlur={cancel}
          onContextMenu={(e) => e.preventDefault()}
          disabled={state === 'done'}
        >
          SOS
        </button>
      </div>

      <p className="sos-status" role="status" aria-live="polite">{message}</p>

      <div className="sos-contacts">
        <span className="sos-contacts-label">Trusted contacts <em>(sample)</em></span>
        <span className="sos-avatars" aria-hidden="true">
          {CONTACTS.map(([i, c]) => <i key={i} style={{ background: c }}>{i}</i>)}
        </span>
      </div>
      <p className="sos-numbers">Emergency numbers: <b>999</b> · <b>112</b>. Call them yourself; this demo never dials.</p>

      <div className="phone-spacer" />
      <Link to="/help" className="phone-cta phone-cta-ghost sos-open">Open Get Help (real page)</Link>

      {state === 'done' && (
        <div className="sos-sample" role="alertdialog" aria-label="Sample alert preview">
          <span className="phone-badge phone-badge-warn"><LuTriangleAlert aria-hidden="true" /> Sample alert preview</span>
          <p>“Wanjiru pressed SOS and needs help.” Contacts such as Brian and Achieng would see this in the real app.</p>
          <p className="sos-sample-strong">No real alert was sent. No message, location or call was made.</p>
          <button type="button" className="phone-cta" onClick={reset} autoFocus>Reset demo</button>
        </div>
      )}
    </div>
  );
}
