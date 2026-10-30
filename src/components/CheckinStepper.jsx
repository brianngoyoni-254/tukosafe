import { CHECKIN_STEPS } from '../data/dummy';

export default function CheckinStepper({ step }) {
  return (
    <div className="flex gap-1.5 flex-wrap my-3.5">
      {CHECKIN_STEPS.map((label, i) => {
        const cls =
          i < step
            ? 'bg-safebg text-safe'
            : i === step
            ? step === 3
              ? 'bg-alertbg text-alert'
              : 'bg-amberbg text-amber'
            : 'bg-line text-mut';
        return (
          <div key={label} className={`px-3 py-1.5 rounded-full text-xs font-bold ${cls}`}>
            {label}
          </div>
        );
      })}
    </div>
  );
}