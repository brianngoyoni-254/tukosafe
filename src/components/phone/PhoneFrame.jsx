import './phone.css';

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

/**
 * Stationary iPhone-style device (an original design, not an exact copy of any real model).
 * Children are rendered inside the screen below the status bar; the frame never resizes between slides.
 */
export default function PhoneFrame({ children, ...rest }) {
  return (
    <div className="phone" {...rest}>
      <span className="phone-btn phone-btn-action" aria-hidden="true" />
      <span className="phone-btn phone-btn-vol-up" aria-hidden="true" />
      <span className="phone-btn phone-btn-vol-down" aria-hidden="true" />
      <span className="phone-btn phone-btn-power" aria-hidden="true" />
      <div className="phone-bezel">
        <div className="phone-screen">
          <div className="phone-island" aria-hidden="true"><span /></div>
          <StatusBar />
          {children}
          <div className="phone-home-bar" aria-hidden="true" />
          <div className="phone-glass" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
