import { useEffect, useState } from 'react';
import { LuCheck, LuTriangleAlert, LuClock } from 'react-icons/lu';
import { useApp } from '../context/app-context';
import { CHECKIN_TEMPLATES } from '../data/dummy';
import './phone.css';

const CAPTIONS = [
  'Sample check-in in your selected language',
  'Manually preview the missed-check-in steps',
  'Preview a scripted contact brief',
];

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function StatusBar() {
  return (
    <div className="phone-status" aria-hidden="true">
      <span className="phone-time">9:41</span>
      <span className="phone-status-icons">
        <svg viewBox="0 0 18 12" width="1.25em" height="0.85em" fill="currentColor">
          <rect x="0" y="8" width="3" height="4" rx="0.8" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="0.8" />
          <rect x="10" y="3" width="3" height="9" rx="0.8" />
          <rect x="15" y="0" width="3" height="12" rx="0.8" />
        </svg>
        <svg viewBox="0 0 16 12" width="1.1em" height="0.85em" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M1 4.2a10 10 0 0 1 14 0" />
          <path d="M3.6 6.9a6.2 6.2 0 0 1 8.8 0" />
          <path d="M6.2 9.5a2.4 2.4 0 0 1 3.6 0" />
        </svg>
        <svg viewBox="0 0 27 12" width="1.75em" height="0.85em" fill="none">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.2" stroke="currentColor" opacity="0.45" />
          <rect x="2" y="2" width="17" height="8" rx="2" fill="currentColor" />
          <rect x="24" y="4" width="2" height="4" rx="1" fill="currentColor" opacity="0.45" />
        </svg>
      </span>
    </div>
  );
}

export default function PhoneMockup() {
  const { lang, ai } = useApp();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion() || paused) return undefined;
    const id = setInterval(() => setI((x) => (x + 1) % 3), 4800);
    return () => clearInterval(id);
  }, [paused, i]);

  const greeting = ai.checkin
    ? CHECKIN_TEMPLATES[lang]('Wanjiru')
    : 'Check-in due: please confirm you are okay. If something isn’t right, reply “help”.';

  const screens = [
    <div key="s1" className="phone-slide">
      <header className="phone-app-head">
        <span className="phone-app-icon" aria-hidden="true" />
        <div>
          <h4>Msaidizi</h4>
          <small>Check-in · now</small>
        </div>
      </header>
      <div className="phone-bubble">{greeting}</div>
      <span className="phone-badge phone-badge-accent">{ai.checkin ? 'Scripted example' : 'Fallback example'}</span>
      <div className="phone-note">
        <b>Next check-in</b>
        <span>Tonight, 1:30 AM · every 30 min</span>
      </div>
      <div className="phone-spacer" />
      <button type="button" tabIndex={-1} className="phone-cta">
        <LuCheck aria-hidden="true" /> I’m okay
      </button>
      <button type="button" tabIndex={-1} className="phone-cta phone-cta-ghost">Something isn’t right</button>
    </div>,
    <div key="s2" className="phone-slide">
      <header className="phone-app-head">
        <span className="phone-app-icon phone-app-icon-warn" aria-hidden="true" />
        <div>
          <h4>Check-in overdue</h4>
          <small>Grace period</small>
        </div>
      </header>
      <span className="phone-badge phone-badge-warn"><LuTriangleAlert aria-hidden="true" /> Grace period running</span>
      <div className="phone-progress" aria-hidden="true"><i /></div>
      <ul className="phone-steps">
        <li className="done"><LuCheck aria-hidden="true" /> Reminder sent</li>
        <li className="now"><LuClock aria-hidden="true" /> Grace period</li>
        <li><LuClock aria-hidden="true" /> Contact alert (preview only)</li>
      </ul>
      <div className="phone-bubble">This demo advances manually. No contact is notified when the grace period ends.</div>
      <div className="phone-spacer" />
      <button type="button" tabIndex={-1} className="phone-cta">
        <LuCheck aria-hidden="true" /> I’m okay
      </button>
      <button type="button" tabIndex={-1} className="phone-cta phone-cta-ghost">Add 15 minutes</button>
    </div>,
    <div key="s3" className="phone-slide">
      <header className="phone-app-head">
        <span className="phone-app-icon phone-app-icon-warn" aria-hidden="true" />
        <div>
          <h4>Brian’s alert preview</h4>
          <small>Contact view</small>
        </div>
      </header>
      <span className="phone-badge phone-badge-warn"><LuTriangleAlert aria-hidden="true" /> Verify safety</span>
      <div className="phone-bubble phone-bubble-card">
        Wanjiru hasn’t confirmed arrival yet. <b>This may be a dead battery or poor signal.</b> Last known:
        Westlands, 1:42 AM. Please call first. If you believe she is in danger, call 999 or 112.
      </div>
      <span className="phone-badge phone-badge-accent">Scripted sample from the facts shown</span>
      <div className="phone-spacer" />
      <button type="button" tabIndex={-1} className="phone-cta phone-cta-amber">Call 999 / 112</button>
      <button type="button" tabIndex={-1} className="phone-cta phone-cta-ghost">Preview: call Wanjiru</button>
    </div>,
  ];

  return (
    <div className="phone-wrap">
      <div className="phone" role="group" aria-roledescription="carousel" aria-label="TukoSafe app preview">
        <span className="phone-btn phone-btn-action" aria-hidden="true" />
        <span className="phone-btn phone-btn-vol-up" aria-hidden="true" />
        <span className="phone-btn phone-btn-vol-down" aria-hidden="true" />
        <span className="phone-btn phone-btn-power" aria-hidden="true" />
        <div className="phone-bezel">
          <div className="phone-screen">
            <div className="phone-island" aria-hidden="true"><span /></div>
            <StatusBar />
            <div className="phone-stage">
              {screens.map((node, idx) => (
                <div
                  key={idx}
                  className="phone-stage-item"
                  data-active={idx === i}
                  aria-hidden={idx !== i}
                  inert={idx !== i}
                >
                  {node}
                </div>
              ))}
            </div>
            <div className="phone-home-bar" aria-hidden="true" />
            <div className="phone-glass" aria-hidden="true" />
          </div>
        </div>
      </div>

      <div className="phone-dots" role="tablist" aria-label="Preview slides">
        {[0, 1, 2].map((n) => (
          <button
            key={n}
            type="button"
            role="tab"
            aria-selected={n === i}
            aria-label={`Show slide ${n + 1} of 3`}
            onClick={() => { setI(n); setPaused(true); }}
            className={n === i ? 'on' : ''}
          />
        ))}
      </div>
      <p className="phone-caption" role="status">{CAPTIONS[i]}</p>
    </div>
  );
}
