import { memo } from 'react';

// Purely decorative markers. They are fixed positions on the artwork, not people, and use no real coordinates.
const MARKERS = [
  { id: 'a', cls: 'loc--a', initial: 'W', tone: 'teal' },
  { id: 'b', cls: 'loc--b', initial: 'B', tone: 'blue' },
  { id: 'c', cls: 'loc--c', initial: 'A', tone: 'violet' },
  { id: 'd', cls: 'loc--d', pin: true },
  { id: 'e', cls: 'loc--e', pin: true },
];

function LocationGlowOverlay() {
  return (
    <div className="loc-layer" aria-hidden="true">
      {MARKERS.map((m) => (
        <div key={m.id} className={`loc ${m.cls}`}>
          {m.pin ? (
            <span className="loc-pin"><i /></span>
          ) : (
            <>
              <span className="loc-ring loc-ring--1" />
              <span className="loc-ring loc-ring--2" />
              <span className="loc-ring loc-ring--3" />
              <span className="loc-dot" />
              <span className={`loc-badge loc-badge--${m.tone}`}>{m.initial}</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export default memo(LocationGlowOverlay);
