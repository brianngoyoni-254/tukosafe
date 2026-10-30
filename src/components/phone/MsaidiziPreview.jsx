import { useState } from 'react';
import { LuCheck } from 'react-icons/lu';
import { useApp } from '../../context/app-context';
import { CHECKIN_TEMPLATES } from '../../data/dummy';

/** Slide 1: the original Msaidizi check-in preview. Local demo only: nothing is sent anywhere. */
export default function MsaidiziPreview() {
  const { lang, ai } = useApp();
  const [confirmed, setConfirmed] = useState(false);

  const greeting = ai.checkin
    ? CHECKIN_TEMPLATES[lang]('Wanjiru')
    : 'Check-in due: please confirm you are okay. If something isn’t right, reply “help”.';

  return (
    <div className="phone-slide">
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
      <div className="phone-note">
        <b>Last check-in</b>
        <span>12:30 AM · you said you were okay</span>
      </div>
      <div className="phone-spacer" />
      {confirmed && (
        <p className="phone-confirm" role="status">Marked okay in this demo. No one was notified.</p>
      )}
      <button type="button" className="phone-cta" onClick={() => setConfirmed((v) => !v)} aria-pressed={confirmed}>
        <LuCheck aria-hidden="true" /> {confirmed ? 'You’re okay ✓' : 'I’m okay'}
      </button>
      <button type="button" className="phone-cta phone-cta-ghost" onClick={() => setConfirmed(false)}>Something isn’t right</button>
    </div>
  );
}
