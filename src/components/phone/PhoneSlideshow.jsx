import { useCallback, useEffect, useRef, useState } from 'react';
import PhoneFrame from './PhoneFrame';
import SlideIndicators from './SlideIndicators';
import MsaidiziPreview from './MsaidiziPreview';
import FindMyCirclePreview from './FindMyCirclePreview';
import SOSPreview from './SOSPreview';
import './phone-slides.css';

const AUTOPLAY_MS = 6000;
const TOUCH_PAUSE_MS = 20000;

const SLIDES = [
  { id: 'msaidizi', title: 'Msaidizi check-in', caption: 'Stay connected with smart check-ins.', Slide: MsaidiziPreview },
  { id: 'circle', title: 'Find My Circle', caption: 'Share your location with people you trust.', Slide: FindMyCirclePreview },
  { id: 'sos', title: 'Emergency SOS', caption: 'Get help when you need it most.', Slide: SOSPreview },
];

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/**
 * Homepage showcase: three demo screens inside one stationary phone.
 * Autoplay (6 s) pauses on hover, keyboard focus, touch interaction, an in-progress SOS demo and hidden tabs,
 * and is disabled for users who prefer reduced motion. Everything here is demo-only.
 */
export default function PhoneSlideshow() {
  const [index, setIndex] = useState(0);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [touching, setTouching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(() => document.hidden);
  const reduced = useReducedMotion();
  const touchTimer = useRef(null);

  const go = useCallback((n) => setIndex(((n % SLIDES.length) + SLIDES.length) % SLIDES.length), []);
  const next = useCallback(() => setIndex((i) => (i + 1) % SLIDES.length), []);
  const prev = useCallback(() => setIndex((i) => (i - 1 + SLIDES.length) % SLIDES.length), []);

  const paused = hover || focus || touching || busy || hidden;
  const autoplaying = !reduced && !paused;

  useEffect(() => {
    if (!autoplaying) return undefined;
    const id = setTimeout(next, AUTOPLAY_MS);
    return () => clearTimeout(id);
  }, [autoplaying, index, next]);

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); clearTimeout(touchTimer.current); };
  }, []);

  const onTouchInteract = (e) => {
    if (e.pointerType === 'mouse') return;
    setTouching(true);
    clearTimeout(touchTimer.current);
    touchTimer.current = setTimeout(() => setTouching(false), TOUCH_PAUSE_MS);
  };

  const onKeyDown = (e) => {
    if (e.target.closest?.('.sos-btn')) return; // never hijack keys while holding the SOS demo
    if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
  };

  return (
    <section
      className="phone-wrap"
      aria-roledescription="carousel"
      aria-label="TukoSafe app preview (demo)"
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHover(true); }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHover(false); }}
      onPointerDown={onTouchInteract}
      onFocus={() => setFocus(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocus(false); }}
      onKeyDown={onKeyDown}
    >
      <PhoneFrame>
        <div className="phone-stage" aria-live={autoplaying ? 'off' : 'polite'}>
          {SLIDES.map(({ id, title, Slide }, idx) => (
            <div
              key={id}
              className="phone-stage-item"
              data-active={idx === index}
              role="group"
              aria-roledescription="slide"
              aria-label={`${idx + 1} of ${SLIDES.length}: ${title}`}
              aria-hidden={idx !== index}
              inert={idx !== index}
            >
              <Slide active={idx === index} onBusyChange={setBusy} />
            </div>
          ))}
        </div>
      </PhoneFrame>

      <SlideIndicators
        count={SLIDES.length}
        index={index}
        labels={SLIDES.map((s) => s.title)}
        onSelect={go}
        onPrev={prev}
        onNext={next}
      />
      <p className="phone-caption" aria-live={autoplaying ? 'off' : 'polite'}>{SLIDES[index].caption}</p>
    </section>
  );
}
