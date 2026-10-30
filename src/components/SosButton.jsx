import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../context/app-context';
import { useData } from '../context/DataContext';

const HOLD_MS = 3000;

export default function SosButton() {
  const { pos, showToast } = useApp();
  const { sendAlert, contacts } = useData();
  const [progress, setProgress] = useState(0);
  const [includeLocation, setIncludeLocation] = useState(false);
  const [outcome, setOutcome] = useState(null); // { status, error }
  const timer = useRef(null);
  const start = useRef(0);
  const holding = useRef(false);
  const include = useRef(includeLocation);
  useEffect(() => { include.current = includeLocation; }, [includeLocation]);

  const cancel = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    holding.current = false;
    setProgress(0);
  }, []);

  const activate = useCallback(async () => {
    cancel();
    setOutcome({ status: 'sending' });
    const location = include.current && pos ? { lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy } : null;
    const r = await sendAlert({ kind: 'sos', message: 'SOS: I need help.', location });
    setOutcome(r);
    if (r.status === 'failed') showToast(r.error);
  }, [cancel, pos, sendAlert, showToast]);

  const begin = useCallback(() => {
    if (holding.current) return;
    holding.current = true;
    setOutcome(null);
    start.current = Date.now();
    timer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - start.current) / HOLD_MS);
      setProgress(p);
      if (p >= 1) activate();
    }, 50);
  }, [activate]);

  useEffect(() => cancel, [cancel]);

  const status = progress > 0
    ? `Keep holding… ${Math.ceil((1 - progress) * 3)} s. Release to cancel.`
    : outcome?.status === 'sending' ? 'Sending alert…'
    : outcome?.status === 'confirmed' ? 'Alert recorded on the server. Delivery to each friend is shown below as it is confirmed.'
    : outcome?.status === 'queued' ? 'No connection. Alert saved on this device and NOT sent yet. It sends automatically when you are back online. Call 999 or 112 if in danger.'
    : outcome?.status === 'failed' ? `Alert not sent: ${outcome.error}`
    : '';

  return (
    <div>
      <div className="relative w-[210px] h-[210px] grid place-items-center mx-auto">
        <svg width="210" height="210" viewBox="0 0 210 210" className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle cx="105" cy="105" r="99" fill="none" stroke="var(--color-line)" strokeWidth="8" />
          <circle
            cx="105" cy="105" r="99"
            fill="none" stroke="var(--color-amber)" strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray="622"
            strokeDashoffset={622 * (1 - progress)}
            className="transition-[stroke-dashoffset] duration-75"
          />
        </svg>
        <button
          type="button"
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
          aria-label="Hold for three seconds to send SOS to your trusted friends"
          disabled={outcome?.status === 'sending'}
          className="relative w-[180px] h-[180px] rounded-full bg-red text-white font-display font-extrabold text-2xl cursor-pointer touch-none select-none disabled:opacity-60"
        >
          SOS
        </button>
      </div>
      <label className="flex items-center justify-center gap-2 text-sm mt-3 cursor-pointer">
        <input type="checkbox" className="w-4 h-4 accent-teal" checked={includeLocation}
          onChange={(e) => setIncludeLocation(e.target.checked)} disabled={!pos} />
        Include my current location in the alert
      </label>
      {!pos && <p className="text-mut text-xs text-center mt-1 mb-0">Open the Live map and tap Locate me to enable this.</p>}
      {!contacts.length && <p className="text-red text-xs text-center mt-2 mb-0">You have no trusted friends yet, so there is nobody to alert. Call 999 or 112.</p>}
      <p className="text-sm text-center mt-3 mb-0 min-h-[2.5rem]" role="status" aria-live="polite">{status}</p>
    </div>
  );
}
