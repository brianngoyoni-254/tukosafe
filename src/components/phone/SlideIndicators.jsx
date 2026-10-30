import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';

/** Previous / next buttons with clickable pagination dots. Active dot is amber. */
export default function SlideIndicators({ count, index, labels, onSelect, onPrev, onNext }) {
  return (
    <div className="phone-controls">
      <button type="button" className="phone-arrow" onClick={onPrev} aria-label="Previous slide"><LuChevronLeft aria-hidden="true" /></button>
      <div className="phone-dots" role="tablist" aria-label="Choose slide">
        {Array.from({ length: count }, (_, n) => (
          <button
            key={n}
            type="button"
            role="tab"
            aria-selected={n === index}
            aria-label={`${labels[n]} (slide ${n + 1} of ${count})`}
            onClick={() => onSelect(n)}
            className={n === index ? 'on' : ''}
          />
        ))}
      </div>
      <button type="button" className="phone-arrow" onClick={onNext} aria-label="Next slide"><LuChevronRight aria-hidden="true" /></button>
    </div>
  );
}
