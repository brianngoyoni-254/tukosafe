import { useEffect, useRef } from 'react';
import AnimatedCloudLayer from './AnimatedCloudLayer';
import LocationGlowOverlay from './LocationGlowOverlay';
import './hero-bg.css';

/**
 * Cinematic hero backdrop. Stacking order (bottom to top):
 *   1 satellite-style map  2 colour/lighting  3 clouds (3 layers)  4 readability shade  5 decorative location glow
 * It is absolutely positioned, ignores pointer events and never affects layout, so the page content above it
 * (navbar, headline, buttons, phone) is untouched by any of the animation.
 *
 * Animations pause (via a data attribute, no React re-render) when the tab is hidden or the hero is off screen.
 */
export default function CinematicHeroBackground() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let hidden = document.hidden;
    let offscreen = false;
    const apply = () => { el.dataset.paused = hidden || offscreen ? 'true' : 'false'; };
    const onVis = () => { hidden = document.hidden; apply(); };
    document.addEventListener('visibilitychange', onVis);
    let io;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(([entry]) => { offscreen = !entry.isIntersecting; apply(); });
      io.observe(el);
    }
    apply();
    return () => { document.removeEventListener('visibilitychange', onVis); io?.disconnect(); };
  }, []);

  return (
    <div className="hero-bg" ref={ref} aria-hidden="true">
      <div className="hero-bg-map" />
      <div className="hero-bg-light" />
      <AnimatedCloudLayer variant="large" />
      <AnimatedCloudLayer variant="medium" />
      <AnimatedCloudLayer variant="wisps" />
      <div className="hero-bg-shade" />
      <LocationGlowOverlay />
    </div>
  );
}
