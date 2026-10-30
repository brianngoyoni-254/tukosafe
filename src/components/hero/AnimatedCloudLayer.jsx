import { memo } from 'react';

/**
 * One drifting cloud layer. Pure CSS: the track is a tiled, seamless cloud image translated by exactly one tile,
 * so the loop never jumps. Only `transform` and `opacity` animate (compositor-friendly, no JS, no re-renders).
 * variant: 'large' (slow, right to left) | 'medium' (diagonal) | 'wisps' (thin, quick).
 */
function AnimatedCloudLayer({ variant }) {
  return (
    <div className={`cloud cloud--${variant}`} aria-hidden="true">
      <div className="cloud-track" />
    </div>
  );
}

export default memo(AnimatedCloudLayer);
