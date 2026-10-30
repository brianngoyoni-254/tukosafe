export default function Toggle({ checked, onChange, label }) {
  return (
    <label className="relative inline-flex w-12 h-7 cursor-pointer shrink-0">
      <input
        type="checkbox"
        className="peer absolute inset-0 w-full h-full opacity-0 z-10 m-0 cursor-pointer"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
      />
      <span className="absolute inset-0 rounded-full bg-line transition-colors peer-checked:bg-teal2 peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-amber" />
      <span className="absolute left-1 top-1 w-5 h-5 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
    </label>
  );
}