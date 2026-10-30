export default function Logo({ className = '', title = 'TukoSafe', wordmark = true }) {
  return (
    <span
      className={`inline-flex items-center gap-2.5 shrink-0 no-underline group ${className}`}
      aria-label={title}
    >
      {/* TukoSafe shield logo: protection hands cradling a growing tree */}
      <svg
        width="36"
        height="36"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
      >
        {/* foundation line */}
        <path d="M 44 136 L 156 136" stroke="#1d6fa5" strokeWidth="7" strokeLinecap="round" />
        {/* holding hands / arms (teal) */}
        <path
          d="M 62 128 Q 54 110 66 92 Q 74 80 84 90"
          stroke="#2aa8a0"
          strokeWidth="15"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 138 128 Q 146 110 134 92 Q 126 80 116 90"
          stroke="#2aa8a0"
          strokeWidth="15"
          strokeLinecap="round"
          fill="none"
        />
        {/* shield outline (protection blue) */}
        <path
          d="M 100 30 L 142 58 L 152 100 Q 152 126 110 130 L 100 124 L 90 130 Q 48 126 48 100 L 58 58 Z"
          fill="none"
          stroke="#1d6fa5"
          strokeWidth="7"
          strokeLinejoin="round"
        />
        {/* shield inner */}
        <path
          d="M 100 40 L 132 62 L 140 100 Q 140 120 102 124 L 100 120 L 98 124 Q 60 120 60 100 L 68 62 Z"
          fill="#5b9bd5"
          fillOpacity="0.55"
        />
        {/* tree trunk */}
        <rect x="96" y="100" width="8" height="24" rx="4" fill="#4a9a5a" />
        {/* tree leaves */}
        <circle cx="100" cy="60" r="15" fill="#5aad6a" />
        <circle cx="86" cy="68" r="12" fill="#5aad6a" />
        <circle cx="114" cy="68" r="12" fill="#5aad6a" />
        <circle cx="92" cy="80" r="11" fill="#5aad6a" />
        <circle cx="108" cy="80" r="11" fill="#5aad6a" />
        <circle cx="100" cy="88" r="10" fill="#5aad6a" />
        <circle cx="78" cy="76" r="9" fill="#5aad6a" />
        <circle cx="122" cy="76" r="9" fill="#5aad6a" />
      </svg>
      {wordmark && <span className="font-display font-extrabold text-xl tracking-tight">TukoSafe</span>}
    </span>
  );
}
