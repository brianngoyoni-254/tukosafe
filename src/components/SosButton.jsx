import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/app-context';

export default function SosButton() {
  const { send, setSos, setStep } = useApp();
  const [progress, setProgress] = useState(0);
  const timer = useRef(null);
  const start = useRef(0);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setProgress(0);
  };

  const startHold = (e) => {
    e.preventDefault();
    start.current = Date.now();
    timer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - start.current) / 3000);
      setProgress(p);
      if (p >= 1) {
        clearInterval(timer.current);
        timer.current = null;
        setSos(true);
        setStep(3);
        send('SOS alert');
      }
    }, 50);
  };

  useEffect(() => () => stop(), []);

  return (
    <div className="relative w-[210px] h-[210px] grid place-items-center mx-auto">
      <svg width="210" height="210" viewBox="0 0 210 210" className="absolute inset-0 -rotate-90">
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
        onPointerDown={startHold}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        aria-label="Hold to trigger SOS demo"
        className="relative w-[180px] h-[180px] rounded-full bg-red text-white font-display font-extrabold text-2xl cursor-pointer touch-none select-none"
      >
        SOS
      </button>
    </div>
  );
}