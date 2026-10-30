const map = {
  default: 'bg-mint text-teal',
  g: 'bg-greenbg text-green',
  y: 'bg-amberbg text-amber',
  r: 'bg-redbg text-red',
  n: 'bg-line text-mut',
};

export default function Chip({ tone = 'default', className = '', children }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${map[tone] || map.default} ${className}`}>
      {children}
    </span>
  );
}