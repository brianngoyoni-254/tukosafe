const map = {
  default: 'bg-surface text-ink border border-line',
  g: 'bg-safebg text-safe border border-safe/30',
  y: 'bg-amberbg text-amber border border-amber/30',
  r: 'bg-alertbg text-alert border border-alert/30',
  n: 'bg-line text-mut border border-line',
};

export default function Chip({ tone = 'default', className = '', children }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${map[tone] || map.default} ${className}`}>
      {children}
    </span>
  );
}